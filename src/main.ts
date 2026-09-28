import { ExploreMode } from './app/exploreMode.ts';
import { MissionMode } from './app/missionMode.ts';
import { Stage } from './app/stage.ts';
import { PLANETS } from './data/bodies.ts';
import { SPEEDS } from './ui/exploreHud.ts';
import { byId, setPressed, setVisible } from './ui/dom.ts';

type Mode = 'title' | 'explore' | 'missions';

const MAX_FRAME_SECONDS = 0.1;

/** Top level controller: owns the mode and the frame loop. */
class App {
  readonly stage = new Stage();
  readonly explore = new ExploreMode(this.stage);
  readonly missions = new MissionMode(
    this.stage,
    () => this.setMode('title'),
    () => this.explore.enter(false),
  );
  mode: Mode = 'title';
  private lastFrame = performance.now();
  private labelsOn = true;
  private orbitsOn = true;

  constructor() {
    this.stage.onPick = (id) => {
      if (this.mode === 'explore') this.explore.select(id, true);
    };
    this.bindChrome();
    this.bindKeys();
    this.setMode('title');
    requestAnimationFrame((now) => this.frame(now));
  }

  private bindChrome(): void {
    const unlock = (): void => this.stage.sound.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    byId('start-explore').addEventListener('click', () => this.setMode('explore'));
    byId('start-missions').addEventListener('click', () => this.setMode('missions'));
    byId('tab-explore').addEventListener('click', () => this.setMode('explore'));
    byId('tab-missions').addEventListener('click', () => this.setMode('missions'));
    byId('home-button').addEventListener('click', () => this.setMode('title'));

    const scale = byId('toggle-scale');
    scale.addEventListener('click', () => {
      const mode = this.explore.toggleScale();
      scale.textContent = mode === 'compact' ? 'Compact Scale' : 'True Scale';
      setPressed(scale, mode === 'true');
      this.stage.sound.click();
    });
    byId('toggle-orbits').addEventListener('click', () => this.toggleOrbits());
    byId('toggle-labels').addEventListener('click', () => this.toggleLabels());
    const sound = byId('toggle-sound');
    setPressed(sound, !this.stage.sound.isMuted);
    sound.addEventListener('click', () => {
      this.stage.sound.setMuted(!this.stage.sound.isMuted);
      setPressed(sound, !this.stage.sound.isMuted);
    });
  }

  private toggleOrbits(): void {
    this.orbitsOn = !this.orbitsOn;
    this.stage.solar.setOrbitsVisible(this.orbitsOn);
    setPressed(byId('toggle-orbits'), this.orbitsOn);
  }

  private toggleLabels(): void {
    this.labelsOn = !this.labelsOn;
    this.stage.labels.setEnabled(this.labelsOn);
    setPressed(byId('toggle-labels'), this.labelsOn);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.explore.exit();
    this.missions.exit();
    setVisible(byId('title-screen'), mode === 'title');
    setVisible(byId('top-bar'), mode !== 'title');
    setVisible(byId('toggle-scale'), mode === 'explore');
    byId('tab-explore').classList.toggle('is-active', mode === 'explore');
    byId('tab-missions').classList.toggle('is-active', mode === 'missions');
    this.stage.labels.setEnabled(this.labelsOn && mode !== 'title');
    this.stage.labels.setInteractive(mode === 'explore');

    if (mode === 'missions') {
      this.explore.enter(false);
      this.missions.showLevels();
    } else {
      this.explore.enter(mode === 'explore');
      if (mode === 'explore') this.explore.setSpeed(1);
    }
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement) return;
      // Let a focused button handle its own activation keys.
      const isActivation = event.code === 'Enter' || event.code === 'Space';
      if (isActivation && event.target instanceof HTMLButtonElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (this.handleKey(event.code, event.shiftKey)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.missions.steering.handleKey(event.code, false);
    });
  }

  private handleKey(code: string, isShift: boolean): boolean {
    if (code === 'KeyM') {
      byId('toggle-sound').click();
      return true;
    }
    if (this.mode === 'explore') return this.handleExploreKey(code);
    if (this.mode === 'missions') return this.handleMissionKey(code, isShift);
    if (code === 'Enter' || code === 'Space') {
      this.setMode('missions');
      return true;
    }
    return false;
  }

  private handleExploreKey(code: string): boolean {
    const explore = this.explore;
    const digit = /^Digit(\d)$/.exec(code);
    if (digit) {
      const index = Number(digit[1]);
      explore.select(index === 0 ? 'sun' : PLANETS[index - 1].id, true);
      return true;
    }
    switch (code) {
      case 'Space': explore.setPlaying(!explore.playing); return true;
      case 'BracketLeft': case 'Comma': explore.setSpeed(explore.speedIndex - 1); return true;
      case 'BracketRight': case 'Period': explore.setSpeed(Math.min(explore.speedIndex + 1, SPEEDS.length - 1)); return true;
      case 'KeyR': explore.setReverse(!explore.reverse); return true;
      case 'KeyT': explore.today(); return true;
      case 'KeyO': this.toggleOrbits(); return true;
      case 'KeyL': this.toggleLabels(); return true;
      case 'KeyH': explore.overview(); return true;
      case 'Escape': explore.deselect(); return true;
      default: return false;
    }
  }

  private handleMissionKey(code: string, isShift: boolean): boolean {
    const missions = this.missions;
    const mission = missions.mission;
    if (!mission) {
      if (code === 'Escape') this.setMode('title');
      return code === 'Escape';
    }
    if (code === 'Escape') {
      missions.showLevels();
      return true;
    }
    if (code === 'KeyR') {
      missions.start(missions.levelIndex);
      return true;
    }
    if (mission.phase === 'aim') return this.handleAimKey(code, isShift);
    if (mission.phase === 'flight') {
      if (code === 'KeyF') missions.cycleWarp();
      else if (code === 'KeyC') missions.toggleChase();
      else return missions.steering.handleKey(code, true);
      return true;
    }
    if (code === 'Enter' || code === 'Space') {
      const won = mission.phase === 'won';
      missions.start(won ? missions.levelIndex + 1 : missions.levelIndex);
      return true;
    }
    return false;
  }

  private handleAimKey(code: string, isShift: boolean): boolean {
    const step = isShift ? 5 : 1;
    const missions = this.missions;
    switch (code) {
      case 'ArrowLeft': case 'KeyA': missions.nudge(step, 0, 0); return true;
      case 'ArrowRight': case 'KeyD': missions.nudge(-step, 0, 0); return true;
      case 'ArrowUp': case 'KeyW': missions.nudge(0, step, 0); return true;
      case 'ArrowDown': case 'KeyS': missions.nudge(0, -step, 0); return true;
      case 'KeyQ': missions.nudge(0, 0, -step); return true;
      case 'KeyE': missions.nudge(0, 0, step); return true;
      case 'Enter': case 'Space': missions.launch(); return true;
      default: return false;
    }
  }

  /** Run one frame of simulation and drawing. Also used by automated play tests. */
  advance(dt: number, seconds: number): void {
    if (this.mode === 'missions' && this.missions.mission) this.missions.update(dt, seconds);
    else this.explore.update(dt);
    this.stage.render(dt, seconds);
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.lastFrame) / 1000, MAX_FRAME_SECONDS);
    this.lastFrame = now;
    this.advance(dt, now / 1000);
    requestAnimationFrame((next) => this.frame(next));
  }
}

function start(): void {
  try {
    const app = new App();
    // Exposed in dev builds only, for automated play tests.
    if (import.meta.env.DEV) (window as unknown as { orrery: App }).orrery = app;
  } catch (error) {
    console.error(error);
    byId('title-screen').hidden = false;
    document.querySelector('.tagline')!.textContent =
      'This browser could not start 3D graphics. Try a current version of Chrome, Safari, Firefox or Edge.';
    document.querySelector<HTMLElement>('.title-actions')!.hidden = true;
  }
}

start();
