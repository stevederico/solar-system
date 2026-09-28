import type { SteerInput } from '../game/mission.ts';
import { byId } from './dom.ts';

type Direction = 'boost' | 'brake' | 'left' | 'right';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'boost',
  KeyW: 'boost',
  ArrowDown: 'brake',
  KeyS: 'brake',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

/** Tracks held thruster keys and on-screen thruster buttons. */
export class Steering {
  private readonly held = new Set<string>();
  private readonly buttons = new Map<Direction, HTMLElement>();

  constructor() {
    for (const direction of ['boost', 'brake', 'left', 'right'] as const) {
      const button = byId(`steer-${direction}`);
      this.buttons.set(direction, button);
      const source = `button-${direction}`;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.held.add(`${source}|${direction}`);
        this.refresh();
      });
      const release = (): void => {
        this.held.delete(`${source}|${direction}`);
        this.refresh();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    }
    window.addEventListener('blur', () => this.clear());
  }

  /** Feed a key event. Returns true when the key is a thruster key. */
  handleKey(code: string, isDown: boolean): boolean {
    const direction = KEY_DIRECTIONS[code];
    if (!direction) return false;
    const entry = `${code}|${direction}`;
    if (isDown) this.held.add(entry);
    else this.held.delete(entry);
    this.refresh();
    return true;
  }

  clear(): void {
    this.held.clear();
    this.refresh();
  }

  private isHeld(direction: Direction): boolean {
    for (const entry of this.held) {
      if (entry.endsWith(`|${direction}`)) return true;
    }
    return false;
  }

  private refresh(): void {
    for (const [direction, button] of this.buttons) {
      button.classList.toggle('is-active', this.isHeld(direction));
    }
  }

  /** Current thrust request. Opposite directions cancel out. */
  get input(): SteerInput {
    return {
      forward: Number(this.isHeld('boost')) - Number(this.isHeld('brake')),
      side: Number(this.isHeld('left')) - Number(this.isHeld('right')),
    };
  }

  get isActive(): boolean {
    const { forward, side } = this.input;
    return forward !== 0 || side !== 0;
  }
}
