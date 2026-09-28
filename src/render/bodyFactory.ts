import * as THREE from 'three';
import type { MoonData, PlanetData } from '../data/bodies.ts';
import type { BodyKind, Surface } from '../data/planets.ts';
import { bodyRadiusToScene, moonDistanceToScene } from '../sim/scale.ts';
import { createAtmosphereMaterial, createSunMaterial } from './materials.ts';
import { createCloudTexture, createGlowTexture, createRingTexture, createSurfaceTexture } from './textures.ts';

export interface BodyView {
  id: string;
  name: string;
  kind: BodyKind;
  parentId?: string;
  /** Group placed at the body's center. */
  anchor: THREE.Group;
  /** Mesh that turns with the body's day. */
  spin: THREE.Mesh;
  clouds?: THREE.Mesh;
  radius: number;
  rotationHours: number;
  surface: Surface;
  /** Distance from the parent in scene units, for moons. */
  orbitDistance?: number;
  moon?: MoonData;
  /** Group that holds moons circling above the equator. */
  equator?: THREE.Group;
  /** Group that holds moons circling near the ecliptic. */
  ecliptic?: THREE.Group;
}

const DEG = Math.PI / 180;
const MIN_MOON_RADIUS = 0.014;
const MOON_ORBIT_SEGMENTS = 96;
const ATMOSPHERE_SCALE = 1.18;
const CLOUD_SCALE = 1.015;

function averageColor(surface: Surface): THREE.Color {
  return new THREE.Color(surface.palette[Math.floor(surface.palette.length / 2)]);
}

function createSphere(radius: number, surface: Surface, segments: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, segments, segments / 2);
  const material = new THREE.MeshStandardMaterial({ color: averageColor(surface), roughness: 0.92, metalness: 0 });
  return new THREE.Mesh(geometry, material);
}

function createRing(planet: PlanetData, radius: number): THREE.Mesh {
  const ring = planet.ring!;
  const geometry = new THREE.RingGeometry(radius * ring.inner, radius * ring.outer, 160, 1);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const span = radius * (ring.outer - ring.inner);
  for (let n = 0; n < position.count; n++) {
    const distance = Math.hypot(position.getX(n), position.getY(n));
    uv.setXY(n, (distance - radius * ring.inner) / span, 0.5);
  }
  const material = new THREE.MeshBasicMaterial({
    map: createRingTexture(ring.color, planet.surface.seed),
    transparent: true,
    opacity: ring.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** The Sun: a churning shader sphere, a soft corona and the system's light. */
export function createSun(sun: PlanetData): BodyView {
  const radius = bodyRadiusToScene(sun.radiusKm);
  const anchor = new THREE.Group();
  const spin = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), createSunMaterial());
  anchor.add(spin);

  const glowMap = createGlowTexture('rgba(255, 236, 190, 1)', 'rgba(255, 150, 40, 0.42)');
  for (const [scale, opacity] of [[5.2, 0.9], [12, 0.35]]) {
    const material = new THREE.SpriteMaterial({
      map: glowMap,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity,
      transparent: true,
    });
    const glow = new THREE.Sprite(material);
    glow.scale.setScalar(radius * scale);
    anchor.add(glow);
  }

  const light = new THREE.PointLight('#fff4e0', 3.2, 0, 0);
  anchor.add(light);
  return { id: sun.id, name: sun.name, kind: sun.kind, anchor, spin, radius, rotationHours: sun.rotationHours, surface: sun.surface };
}

/** A planet with its tilt, rings, clouds and atmosphere. */
export function createPlanet(planet: PlanetData): BodyView {
  const radius = bodyRadiusToScene(planet.radiusKm);
  const anchor = new THREE.Group();
  const equator = new THREE.Group();
  equator.rotation.z = planet.tilt * DEG;
  const ecliptic = new THREE.Group();
  anchor.add(equator, ecliptic);

  const spin = createSphere(radius, planet.surface, 64);
  equator.add(spin);
  if (planet.ring) equator.add(createRing(planet, radius));

  let clouds: THREE.Mesh | undefined;
  if (planet.surface.style === 'earth') {
    const material = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1, opacity: 0 });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * CLOUD_SCALE, 64, 32), material);
    equator.add(clouds);
  }
  if (planet.surface.atmosphere) {
    const shell = new THREE.SphereGeometry(radius * ATMOSPHERE_SCALE, 48, 24);
    equator.add(new THREE.Mesh(shell, createAtmosphereMaterial(planet.surface.atmosphere, 1.1)));
  }

  // Retrograde spin is already expressed by a tilt past 90 degrees.
  const rotationHours = planet.tilt > 90 ? Math.abs(planet.rotationHours) : planet.rotationHours;
  return {
    id: planet.id, name: planet.name, kind: planet.kind, anchor, spin, clouds, radius, rotationHours,
    surface: planet.surface, equator, ecliptic,
  };
}

function createMoonOrbitLine(distance: number): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  for (let n = 0; n < MOON_ORBIT_SEGMENTS; n++) {
    const angle = (n / MOON_ORBIT_SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * distance, 0, -Math.sin(angle) * distance));
  }
  const material = new THREE.LineBasicMaterial({ color: '#8fa3c7', transparent: true, opacity: 0.22 });
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
  line.userData.isOrbit = true;
  return line;
}

/** A moon placed inside its parent's orbit plane. */
export function createMoon(moon: MoonData, parentData: PlanetData, parent: BodyView): BodyView {
  const radius = Math.max(bodyRadiusToScene(moon.radiusKm), MIN_MOON_RADIUS);
  const orbitDistance = moonDistanceToScene(moon.orbitKm, parentData.radiusKm, parent.radius);
  const plane = new THREE.Group();
  plane.rotation.x = moon.inclination * DEG;
  plane.userData.isMoonPlane = true;
  (moon.plane === 'ecliptic' ? parent.ecliptic! : parent.equator!).add(plane);

  const anchor = new THREE.Group();
  const spin = createSphere(radius, moon.surface, 32);
  anchor.add(spin);
  if (moon.surface.atmosphere) {
    const shell = new THREE.SphereGeometry(radius * ATMOSPHERE_SCALE, 32, 16);
    anchor.add(new THREE.Mesh(shell, createAtmosphereMaterial(moon.surface.atmosphere, 0.9)));
  }
  plane.add(anchor, createMoonOrbitLine(orbitDistance));

  // Large moons keep one face toward their parent, so a day equals an orbit.
  return {
    id: moon.id, name: moon.name, kind: 'moon', parentId: moon.parent, anchor, spin, radius,
    rotationHours: moon.periodDays * 24, surface: moon.surface, orbitDistance, moon,
  };
}

function swapMap(material: THREE.MeshStandardMaterial, map: THREE.Texture): void {
  material.map?.dispose();
  material.map = map;
  material.needsUpdate = true;
}

/** Paint the procedural texture for a body and swap it onto the mesh. */
export async function applySurfaceTexture(view: BodyView, width: number): Promise<void> {
  if (view.kind === 'star') return;
  const material = view.spin.material as THREE.MeshStandardMaterial;
  swapMap(material, await createSurfaceTexture(view.surface, width));
  material.color.set('#ffffff');
  if (view.clouds) {
    const clouds = view.clouds.material as THREE.MeshStandardMaterial;
    swapMap(clouds, await createCloudTexture(view.surface.seed + 1, width));
    clouds.opacity = 0.9;
  }
}
