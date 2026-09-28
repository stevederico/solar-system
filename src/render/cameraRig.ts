import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface FlyTarget {
  /** Reads the current center of the thing being followed. */
  position: (out: THREE.Vector3) => THREE.Vector3;
  /** Camera distance to settle at. */
  distance: number;
  /** Closest the user may zoom in. */
  minDistance: number;
}

const FLY_SECONDS = 1.6;
const MAX_DISTANCE = 1400;
const DEFAULT_MIN_DISTANCE = 0.5;
const MIN_OFFSET = 1e-3;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Orbit camera that can fly to a moving body and then ride along with it. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private follow?: FlyTarget;
  private flight?: { from: THREE.Vector3; offset: THREE.Vector3; endOffset: THREE.Vector3; elapsed: number; duration: number };
  private readonly center = new THREE.Vector3();
  private readonly previous = new THREE.Vector3();

  constructor(element: HTMLElement, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 12000);
    this.camera.position.set(0, 42, 58);
    this.controls = new OrbitControls(this.camera, element);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.zoomSpeed = 1.1;
    this.controls.rotateSpeed = 0.6;
    this.controls.minDistance = DEFAULT_MIN_DISTANCE;
    this.controls.maxDistance = MAX_DISTANCE;
  }

  /** True while the camera is gliding toward a new target. */
  get isFlying(): boolean {
    return this.flight !== undefined;
  }

  /**
   * Glide to a target and keep following it.
   * An optional view direction sets where the camera ends up relative to the target.
   */
  flyTo(target: FlyTarget, direction?: THREE.Vector3, seconds = FLY_SECONDS): void {
    // A zero sized viewport gives an infinite fit distance. Flying there would poison the camera.
    if (!Number.isFinite(target.distance) || target.distance <= 0) return;
    const from = this.controls.target.clone();
    const offset = this.camera.position.clone().sub(from);
    const offsetSq = offset.lengthSq();
    if (!Number.isFinite(offsetSq) || offsetSq < MIN_OFFSET * MIN_OFFSET) offset.set(0, MIN_OFFSET, MIN_OFFSET);
    const endDirection = (direction ?? offset).clone().normalize();
    this.flight = {
      from,
      offset,
      endOffset: endDirection.multiplyScalar(target.distance),
      elapsed: 0,
      duration: Math.max(seconds, 0.001),
    };
    this.follow = target;
    this.controls.minDistance = target.minDistance;
    this.controls.enabled = false;
  }

  /** Let the user zoom and rotate, or lock the camera during drags on other things. */
  setEnabled(enabled: boolean): void {
    if (!this.flight) this.controls.enabled = enabled;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    // Widen the view on tall phone screens so the system still fits.
    this.camera.fov = aspect < 1 ? 68 : 50;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    if (this.flight && this.follow) {
      this.advanceFlight(dt, this.follow);
      return;
    }
    if (this.follow) {
      this.follow.position(this.center);
      this.camera.position.add(this.center.clone().sub(this.previous));
      this.controls.target.copy(this.center);
      this.previous.copy(this.center);
    }
    this.controls.update();
  }

  private advanceFlight(dt: number, target: FlyTarget): void {
    const flight = this.flight!;
    flight.elapsed += dt;
    const t = easeInOut(Math.min(flight.elapsed / flight.duration, 1));
    target.position(this.center);
    const focus = flight.from.clone().lerp(this.center, t);

    const startLength = flight.offset.length();
    const endLength = flight.endOffset.length();
    const direction = flight.offset.clone().normalize().lerp(flight.endOffset.clone().normalize(), t).normalize();
    // Blend distance on a log scale so long zooms feel even.
    const length = Math.exp(Math.log(startLength) * (1 - t) + Math.log(endLength) * t);

    this.controls.target.copy(focus);
    this.camera.position.copy(focus).add(direction.multiplyScalar(length));
    this.camera.lookAt(focus);
    if (flight.elapsed >= flight.duration) {
      this.flight = undefined;
      this.previous.copy(this.center);
      this.controls.enabled = true;
      this.controls.update();
    }
  }
}
