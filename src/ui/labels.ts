import * as THREE from 'three';
import type { BodyView } from '../render/bodyFactory.ts';
import { pickBody } from './pick.ts';
import type { ScreenPoint } from './pick.ts';

interface Label {
  view: BodyView;
  element: HTMLButtonElement;
}

const MIN_MOON_ORBIT_PIXELS = 26;
const LABEL_GAP = 10;

/** Name tags that float over bodies, plus screen space picking. */
export class Labels {
  private readonly labels: Label[] = [];
  private readonly points = new Map<string, ScreenPoint>();
  private readonly world = new THREE.Vector3();
  private readonly parentWorld = new THREE.Vector3();
  private enabled = true;

  constructor(
    private readonly container: HTMLElement,
    bodies: Iterable<BodyView>,
    onPick: (id: string) => void,
  ) {
    for (const view of bodies) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `body-label body-label-${view.kind}`;
      element.textContent = view.name;
      element.setAttribute('aria-label', `Select ${view.name}`);
      element.addEventListener('click', () => onPick(view.id));
      container.appendChild(element);
      this.labels.push({ view, element });
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.classList.toggle('is-hidden', !enabled);
  }

  /** Labels are buttons in Explore, but plain name tags where picking does nothing. */
  setInteractive(interactive: boolean): void {
    this.container.classList.toggle('is-passive', !interactive);
    for (const { element } of this.labels) {
      element.tabIndex = interactive ? 0 : -1;
      element.setAttribute('aria-hidden', String(!interactive));
    }
  }

  /** Reposition every label. Moons only show when the camera is near their parent. */
  update(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    isVisible: (id: string) => boolean,
    bodies: Map<string, BodyView>,
    highlightId?: string,
  ): void {
    const pixelsPerUnit = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const { view, element } of this.labels) {
      view.anchor.getWorldPosition(this.world);
      const depth = this.world.distanceTo(camera.position);
      const projected = this.world.clone().project(camera);
      const inFront = projected.z > -1 && projected.z < 1;
      let visible = inFront && isVisible(view.id);
      if (visible && view.parentId) {
        // Moon names only appear once their orbit is wide enough on screen to tell them apart.
        bodies.get(view.parentId)!.anchor.getWorldPosition(this.parentWorld);
        const parentDepth = Math.max(this.parentWorld.distanceTo(camera.position), 1e-6);
        visible = ((view.orbitDistance ?? 0) * pixelsPerUnit) / parentDepth > MIN_MOON_ORBIT_PIXELS;
      }
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const radius = (view.radius * view.anchor.scale.x * pixelsPerUnit) / Math.max(depth, 1e-6);
      this.points.set(view.id, { x, y, depth, radius, visible });

      const show = visible && this.enabled && x > -50 && x < width + 50 && y > -30 && y < height + 30;
      element.style.display = show ? '' : 'none';
      if (!show) continue;
      element.style.transform = `translate(${x.toFixed(1)}px, ${(y + radius + LABEL_GAP).toFixed(1)}px) translateX(-50%)`;
      element.classList.toggle('is-selected', view.id === highlightId);
    }
  }

  /** Screen position of a body from the last update. */
  screenPoint(id: string): ScreenPoint | undefined {
    return this.points.get(id);
  }

  /** Body under a click or tap. Small bodies get a generous hit area. */
  pick(x: number, y: number): string | undefined {
    return pickBody(this.points, x, y);
  }
}
