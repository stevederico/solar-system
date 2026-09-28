import * as THREE from 'three';
import { MOONS, PLANET_BY_ID, PLANETS, SUN } from '../data/bodies.ts';
import type { GamePlanet } from '../game/physics.ts';
import { planetPosition } from '../game/physics.ts';
import { heliocentricPosition, moonAngle, orbitPath } from '../sim/kepler.ts';
import { SCENE_AU, orbitRadiusToScene, positionToScene } from '../sim/scale.ts';
import type { ScaleMode } from '../sim/scale.ts';
import { applySurfaceTexture, createMoon, createPlanet, createSun } from './bodyFactory.ts';
import type { BodyView } from './bodyFactory.ts';
import { createRandom } from './noise.ts';
import { createStarField } from './textures.ts';

const ORBIT_SEGMENTS = 256;
const STAR_COUNT = 7000;
const STAR_RADIUS = 5000;
const BELT_COUNT = 2600;
const BELT_PERIOD_DAYS = 1680;
const MAX_SPIN_PER_FRAME = 0.06;
const ROUGH_PLANET_WIDTH = 256;
const ROUGH_MOON_WIDTH = 64;
const ORBIT_COLORS: Record<string, string> = {
  mercury: '#b9a58f', venus: '#e8c988', earth: '#6fb4ff', mars: '#e0764a', jupiter: '#d9a36b',
  saturn: '#e6d3a3', uranus: '#9fe3ea', neptune: '#5f8dff', pluto: '#c9b49a',
};

/** Everything drawn in space: Sun, planets, moons, orbits, belt and stars. */
export class SolarScene {
  readonly scene = new THREE.Scene();
  readonly bodies = new Map<string, BodyView>();
  private readonly orbitLines = new Map<string, THREE.Line>();
  private readonly belt: THREE.Points;
  private readonly sunMaterial: THREE.ShaderMaterial;
  private lastDays?: number;
  private orbitsVisible = true;
  private moonsVisible = true;

  constructor() {
    this.scene.background = new THREE.Color('#02030a');
    this.scene.add(new THREE.AmbientLight('#8fa0ff', 0.07));
    this.scene.add(this.createStars());

    const sun = createSun(SUN);
    this.sunMaterial = sun.spin.material as THREE.ShaderMaterial;
    this.addBody(sun);

    for (const planet of PLANETS) {
      const view = createPlanet(planet);
      this.addBody(view);
      const color = ORBIT_COLORS[planet.id] ?? '#8fa3c7';
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 });
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      line.frustumCulled = false;
      this.orbitLines.set(planet.id, line);
      this.scene.add(line);
    }
    for (const moon of MOONS) {
      const parent = this.bodies.get(moon.parent)!;
      this.bodies.set(moon.id, createMoon(moon, PLANET_BY_ID.get(moon.parent)!, parent));
    }
    this.belt = this.createBelt();
    this.scene.add(this.belt);
  }

  private addBody(view: BodyView): void {
    this.bodies.set(view.id, view);
    this.scene.add(view.anchor);
  }

  private createStars(): THREE.Points {
    const field = createStarField(STAR_COUNT, STAR_RADIUS, 7);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(field.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(field.colors, 3));
    const material = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false });
    const stars = new THREE.Points(geometry, material);
    stars.frustumCulled = false;
    return stars;
  }

  private createBelt(): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BELT_COUNT * 3), 3));
    const material = new THREE.PointsMaterial({ color: '#a89a8a', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false });
    return new THREE.Points(geometry, material);
  }

  private layoutBelt(mode: ScaleMode): void {
    const random = createRandom(31);
    const position = this.belt.geometry.attributes.position as THREE.BufferAttribute;
    for (let n = 0; n < BELT_COUNT; n++) {
      const au = 2.15 + (random() + random()) * 0.55;
      const angle = random() * Math.PI * 2;
      const radius = orbitRadiusToScene(au, mode);
      position.setXYZ(n, Math.cos(angle) * radius, (random() - 0.5) * 0.5, Math.sin(angle) * radius);
    }
    position.needsUpdate = true;
    this.belt.geometry.computeBoundingSphere();
  }

  /** Redraw orbit lines and the belt for a distance scale. */
  layoutExplore(mode: ScaleMode, days: number): void {
    for (const planet of PLANETS) {
      const points = orbitPath(planet.elements!, days, ORBIT_SEGMENTS).map((p) => {
        const s = positionToScene(p, mode);
        return new THREE.Vector3(s.x, s.y, s.z);
      });
      this.setOrbit(planet.id, points);
    }
    this.layoutBelt(mode);
    this.setGameBodiesVisible(true);
  }

  /** Redraw orbit lines as the flat circles used by missions. */
  layoutGame(planets: GamePlanet[]): void {
    for (const line of this.orbitLines.values()) line.visible = false;
    for (const planet of planets) {
      const points: THREE.Vector3[] = [];
      for (let n = 0; n <= ORBIT_SEGMENTS; n++) {
        const angle = (n / ORBIT_SEGMENTS) * Math.PI * 2;
        const radius = planet.orbitRadius * SCENE_AU;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius));
      }
      this.setOrbit(planet.id, points);
    }
    this.layoutBelt('compact');
    this.setGameBodiesVisible(false);
  }

  private setOrbit(id: string, points: THREE.Vector3[]): void {
    const line = this.orbitLines.get(id)!;
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    line.visible = this.orbitsVisible;
  }

  /** Pluto and the moons sit out of missions to keep the board readable. */
  private setGameBodiesVisible(visible: boolean): void {
    this.bodies.get('pluto')!.anchor.visible = visible;
    this.orbitLines.get('pluto')!.visible = visible && this.orbitsVisible;
    this.moonsVisible = visible;
    this.applyMoonVisibility(visible);
  }

  private applyMoonVisibility(visible: boolean): void {
    this.scene.traverse((object) => {
      if (object.userData.isMoonPlane) object.visible = visible;
      if (object.userData.isOrbit) object.visible = this.orbitsVisible;
    });
  }

  /** Show or hide every orbit line. */
  setOrbitsVisible(visible: boolean): void {
    this.orbitsVisible = visible;
    for (const [id, line] of this.orbitLines) {
      line.visible = visible && this.bodies.get(id)!.anchor.visible;
    }
    this.applyMoonVisibility(this.moonsVisible);
  }

  /** Hide moons while time runs too fast to follow them. */
  setMoonsBlurred(blurred: boolean): void {
    const visible = !blurred;
    if (visible === this.moonsVisible) return;
    this.moonsVisible = visible;
    this.applyMoonVisibility(visible);
  }

  /** Whether a body can be seen and picked right now. */
  isVisible(id: string): boolean {
    const view = this.bodies.get(id);
    if (!view) return false;
    if (view.kind === 'moon') return this.moonsVisible;
    return view.anchor.visible;
  }

  /** Place every body for a date, using real orbital elements. */
  updateExplore(days: number, mode: ScaleMode): void {
    for (const planet of PLANETS) {
      const s = positionToScene(heliocentricPosition(planet.elements!, days), mode);
      this.bodies.get(planet.id)!.anchor.position.set(s.x, s.y, s.z);
    }
    this.belt.rotation.y = (days / BELT_PERIOD_DAYS) * Math.PI * 2;
    this.updateMoons(days);
    this.updateSpin(days);
  }

  /** Place the planets for a mission clock time. */
  updateGame(planets: GamePlanet[], t: number, days: number): void {
    for (const planet of planets) {
      const at = planetPosition(planet, t);
      this.bodies.get(planet.id)!.anchor.position.set(at.x * SCENE_AU, 0, -at.y * SCENE_AU);
    }
    this.belt.rotation.y = (days / BELT_PERIOD_DAYS) * Math.PI * 2;
    this.updateSpin(days);
  }

  private updateMoons(days: number): void {
    for (const view of this.bodies.values()) {
      if (!view.moon || view.orbitDistance === undefined) continue;
      const angle = moonAngle(view.moon, days);
      view.anchor.position.set(Math.cos(angle) * view.orbitDistance, 0, -Math.sin(angle) * view.orbitDistance);
    }
  }

  private updateSpin(days: number): void {
    const elapsed = this.lastDays === undefined ? 0 : days - this.lastDays;
    this.lastDays = days;
    for (const view of this.bodies.values()) {
      const turn = ((elapsed * 24) / view.rotationHours) * Math.PI * 2;
      const step = Math.min(Math.max(turn, -MAX_SPIN_PER_FRAME), MAX_SPIN_PER_FRAME);
      view.spin.rotation.y += step;
      if (view.clouds) view.clouds.rotation.y += step * 1.25 + 0.0002;
    }
  }

  /** Animate effects that run on wall clock time. */
  tick(seconds: number): void {
    this.sunMaterial.uniforms.time.value = seconds;
  }

  /** World position of a body's center. */
  worldPosition(id: string, out: THREE.Vector3): THREE.Vector3 {
    const view = this.bodies.get(id);
    if (!view) return out.set(0, 0, 0);
    return view.anchor.getWorldPosition(out);
  }

  /**
   * Paint every texture without blocking frames.
   * A quick rough pass comes first so nothing stays flat for long, then a sharp pass.
   */
  async paintTextures(planetWidth: number, moonWidth: number): Promise<void> {
    const order = [...this.bodies.values()].sort((a, b) => b.radius - a.radius);
    for (const view of order) await applySurfaceTexture(view, view.kind === 'moon' ? ROUGH_MOON_WIDTH : ROUGH_PLANET_WIDTH);
    for (const view of order) await applySurfaceTexture(view, view.kind === 'moon' ? moonWidth : planetWidth);
  }
}
