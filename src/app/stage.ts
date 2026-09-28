import * as THREE from 'three';
import { Sound } from '../audio/sound.ts';
import { CameraRig } from '../render/cameraRig.ts';
import { MissionView } from '../render/missionView.ts';
import { SolarScene } from '../render/solarScene.ts';
import { Labels } from '../ui/labels.ts';
import { byId } from '../ui/dom.ts';

const MAX_PIXEL_RATIO = 2;
const SMALL_SCREEN = 700;
const CLICK_SLOP = 7;
const CLICK_MS = 600;
const VIEW_SHIFT_RATE = 6;

/** Shared renderer, scene, camera, labels and sound used by every mode. */
export class Stage {
  readonly canvas = byId<HTMLCanvasElement>('scene');
  readonly renderer: THREE.WebGLRenderer;
  readonly solar = new SolarScene();
  readonly missionView = new MissionView();
  readonly rig: CameraRig;
  readonly labels: Labels;
  readonly sound = new Sound();
  width = window.innerWidth;
  height = window.innerHeight;
  /** Called when a body is clicked, tapped or picked by label. */
  onPick: (id: string) => void = () => {};
  highlightId?: string;
  /** Share of the screen height the view slides up, to clear a bottom panel. */
  viewShiftTarget = 0;
  private viewShift = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.rig = new CameraRig(this.canvas, this.width / this.height || 1);
    this.solar.scene.add(this.missionView.group);
    this.labels = new Labels(byId('labels'), this.solar.bodies.values(), (id) => this.onPick(id));
    this.watchClicks();
    window.addEventListener('resize', () => this.resize());
    this.resize();

    const isSmall = Math.min(window.screen.width, window.screen.height) < SMALL_SCREEN;
    void this.solar.paintTextures(isSmall ? 512 : 1024, isSmall ? 128 : 256);
  }

  private watchClicks(): void {
    let start: { x: number; y: number; at: number } | undefined;
    this.canvas.addEventListener('pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY, at: performance.now() };
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const quick = performance.now() - start.at < CLICK_MS;
      start = undefined;
      if (moved > CLICK_SLOP || !quick) return;
      const id = this.labels.pick(event.clientX, event.clientY);
      if (id) this.onPick(id);
    });
  }

  resize(): void {
    // Hidden or collapsed windows report 0x0. Keep the last good size instead of a NaN aspect.
    if (window.innerWidth === 0 || window.innerHeight === 0) return;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.rig.resize(this.width / this.height);
    this.applyViewShift();
    this.missionView.resize(this.width, this.height);
  }

  private applyViewShift(): void {
    const camera = this.rig.camera;
    if (Math.abs(this.viewShift) < 0.001) camera.clearViewOffset();
    else camera.setViewOffset(this.width, this.height, 0, this.viewShift * this.height, this.width, this.height);
  }

  /** Camera distance that fits a circle of the given radius on screen. */
  distanceToFit(radius: number): number {
    const camera = this.rig.camera;
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360);
    const halfWidth = halfHeight * camera.aspect;
    return radius / Math.min(halfHeight, halfWidth);
  }

  /** Project a scene point to CSS pixels. */
  toScreen(point: THREE.Vector3): { x: number; y: number; inFront: boolean } {
    const projected = point.clone().project(this.rig.camera);
    return {
      x: (projected.x * 0.5 + 0.5) * this.width,
      y: (-projected.y * 0.5 + 0.5) * this.height,
      inFront: projected.z < 1,
    };
  }

  /** Where a screen point lands on the ecliptic plane, if it does. */
  toPlane(x: number, y: number): THREE.Vector3 | undefined {
    const pointer = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.rig.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit : undefined;
  }

  render(dt: number, seconds: number): void {
    if (Math.abs(this.viewShiftTarget - this.viewShift) > 0.0005) {
      this.viewShift += (this.viewShiftTarget - this.viewShift) * Math.min(1, dt * VIEW_SHIFT_RATE);
      this.applyViewShift();
    }
    this.solar.tick(seconds);
    this.rig.update(dt);
    this.labels.update(
      this.rig.camera,
      this.width,
      this.height,
      (id) => this.solar.isVisible(id),
      this.solar.bodies,
      this.highlightId,
    );
    this.renderer.render(this.solar.scene, this.rig.camera);
  }
}
