import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Vec2 } from '../game/physics.ts';
import { SCENE_AU } from '../sim/scale.ts';
import { createGlowTexture } from './textures.ts';

const TRAIL_COLOR = '#7fe3ff';
const FORECAST_COLOR = '#ffd166';
const FORECAST_HIT_COLOR = '#7dff9b';
const TARGET_COLOR = '#7dff9b';
const GHOST_COLOR = '#ffd166';
const AIM_COLOR = '#ffd166';
const PROBE_LENGTH = 0.5;
const RING_SEGMENTS = 96;
const LIFT = 0.02;

/** Convert a point on the game plane to scene coordinates. */
export function gameToScene(point: Vec2, out: THREE.Vector3): THREE.Vector3 {
  return out.set(point.x * SCENE_AU, LIFT, -point.y * SCENE_AU);
}

function flatten(points: Vec2[]): number[] {
  const flat: number[] = [];
  for (const point of points) flat.push(point.x * SCENE_AU, LIFT, -point.y * SCENE_AU);
  return flat;
}

function createProbe(): THREE.Group {
  const probe = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: '#e8edf5', roughness: 0.4, metalness: 0.6, emissive: '#30343c' });
  const body = new THREE.Mesh(new THREE.ConeGeometry(PROBE_LENGTH * 0.22, PROBE_LENGTH, 12), hull);
  body.rotation.z = -Math.PI / 2;
  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#2b5fd9', roughness: 0.3, metalness: 0.7, emissive: '#0c1f55' });
  const panels = new THREE.Mesh(new THREE.BoxGeometry(PROBE_LENGTH * 0.3, 0.015, PROBE_LENGTH * 1.3), panelMaterial);
  panels.position.x = -PROBE_LENGTH * 0.15;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(PROBE_LENGTH * 0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hull);
  dish.rotation.z = Math.PI / 2;
  dish.position.x = -PROBE_LENGTH * 0.45;
  probe.add(body, panels, dish);
  return probe;
}

/** Probe, trail, forecast, target ring and aim arrow for a mission. */
export class MissionView {
  readonly group = new THREE.Group();
  private readonly probe = createProbe();
  private readonly beacon: THREE.Sprite;
  private readonly flame: THREE.Sprite;
  private readonly trail: Line2;
  private readonly forecast: Line2;
  private readonly aim: Line2;
  private readonly targetRing: THREE.Mesh;
  private readonly ghostRing: THREE.Mesh;
  private readonly materials: LineMaterial[] = [];
  private trailCount = 0;

  constructor() {
    this.trail = this.createLine(TRAIL_COLOR, 3, false);
    this.forecast = this.createLine(FORECAST_COLOR, 2.5, true);
    this.aim = this.createLine(AIM_COLOR, 4, false);

    const glow = createGlowTexture('rgba(255, 255, 255, 1)', 'rgba(127, 227, 255, 0.5)');
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true,
    }));
    this.beacon.scale.setScalar(0.045);
    const fire = createGlowTexture('rgba(255, 244, 200, 1)', 'rgba(255, 120, 40, 0.6)');
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fire, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true,
    }));
    this.flame.scale.setScalar(0.07);
    this.flame.visible = false;

    const ring = new THREE.RingGeometry(0.93, 1, RING_SEGMENTS);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: TARGET_COLOR, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    });
    this.targetRing = new THREE.Mesh(ring, ringMaterial);
    this.targetRing.rotation.x = -Math.PI / 2;
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: GHOST_COLOR, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
    });
    this.ghostRing = new THREE.Mesh(ring, ghostMaterial);
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.visible = false;

    this.group.add(this.trail, this.forecast, this.aim, this.targetRing, this.ghostRing, this.probe, this.beacon, this.flame);
    this.group.visible = false;
  }

  private createLine(color: string, width: number, dashed: boolean): Line2 {
    const material = new LineMaterial({
      color, linewidth: width, transparent: true, opacity: 0.95, dashed, dashSize: 0.5, gapSize: 0.35, depthWrite: false,
    });
    this.materials.push(material);
    const geometry = new LineGeometry();
    geometry.setPositions([0, 0, 0, 0, 0, 0]);
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    line.visible = false;
    return line;
  }

  private setLine(line: Line2, points: Vec2[]): void {
    if (points.length < 2) {
      line.visible = false;
      return;
    }
    line.geometry.dispose();
    line.geometry = new LineGeometry();
    line.geometry.setPositions(flatten(points));
    line.computeLineDistances();
    line.visible = true;
  }

  resize(width: number, height: number): void {
    for (const material of this.materials) material.resolution.set(width, height);
  }

  /** Dotted path ahead of launch. Turns green when it reaches the target. */
  setForecast(points: Vec2[], hits: boolean): void {
    this.setLine(this.forecast, points);
    (this.forecast.material as LineMaterial).color.set(hits ? FORECAST_HIT_COLOR : FORECAST_COLOR);
  }

  /** Arrow from the home planet showing launch direction and power. */
  setAim(from: Vec2, to: Vec2): void {
    this.setLine(this.aim, [from, to]);
  }

  /** Faint ring where the target will be when the forecast path passes closest. */
  setGhost(center: Vec2, radius: number): void {
    gameToScene(center, this.ghostRing.position);
    this.ghostRing.scale.setScalar(radius * SCENE_AU);
    this.ghostRing.visible = true;
  }

  hidePlanning(): void {
    this.ghostRing.visible = false;
    this.forecast.visible = false;
    this.aim.visible = false;
  }

  setTrail(points: Vec2[]): void {
    if (points.length === this.trailCount) return;
    this.trailCount = points.length;
    this.setLine(this.trail, points);
  }

  clearTrail(): void {
    this.trailCount = 0;
    this.trail.visible = false;
  }

  setTarget(center: Vec2, radius: number, seconds: number): void {
    gameToScene(center, this.targetRing.position);
    const pulse = 1 + Math.sin(seconds * 3) * 0.04;
    this.targetRing.scale.setScalar(radius * SCENE_AU * pulse);
    (this.targetRing.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(seconds * 3) * 0.25;
  }

  /** Place the probe and point it along its direction of travel. */
  setProbe(pos: Vec2, heading: Vec2, thrusting: boolean, visible: boolean): void {
    this.probe.visible = visible;
    this.beacon.visible = visible;
    this.flame.visible = visible && thrusting;
    if (!visible) return;
    gameToScene(pos, this.probe.position);
    this.probe.rotation.set(0, Math.atan2(heading.y, heading.x), 0);
    this.beacon.position.copy(this.probe.position);
    this.flame.position.copy(this.probe.position);
  }

  /** Scene position of the probe, for the chase camera. */
  probePosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.probe.position);
  }
}
