import * as THREE from 'three';
import { aimDirection } from '../game/flight.ts';
import type { LaunchPlan, Outcome } from '../game/flight.ts';
import { GAME_BODY_SCALE, LEVELS } from '../game/levels.ts';
import type { Level } from '../game/levels.ts';
import { Mission } from '../game/mission.ts';
import type { MissionEvent } from '../game/mission.ts';
import { DAYS_PER_TIME_UNIT, KM_S_PER_SPEED_UNIT, planetPosition, planetVelocity } from '../game/physics.ts';
import type { Vec2 } from '../game/physics.ts';
import { browserStore, loadProgress, saveResult } from '../game/progress.ts';
import { gameToScene } from '../render/missionView.ts';
import { SCENE_AU } from '../sim/scale.ts';
import { byId, setVisible } from '../ui/dom.ts';
import { MissionHud } from '../ui/missionHud.ts';
import type { PlanChange } from '../ui/missionHud.ts';
import { Steering } from '../ui/steering.ts';
import type { Stage } from './stage.ts';

const GAME_SPEED = 0.9;
const WARPS = [1, 2, 4];
const RESULT_DELAY_SECONDS = 0.9;
const AIM_LENGTH_SHARE = 0.2;
const BOARD_DIRECTION = new THREE.Vector3(0, 1, 0.5);
const BOARD_MARGIN = 1.3;
const CHASE_DISTANCE = 9;
const DEG = Math.PI / 180;
const KEY_ANGLE_STEP = 1;
const KEY_POWER_STEP = 1;
const KEY_WINDOW_STEP = 0.05;

/** The slingshot game: pick a level, plan a launch, fly, score. */
export class MissionMode {
  readonly hud: MissionHud;
  readonly steering = new Steering();
  mission?: Mission;
  levelIndex = 0;
  private warpIndex = 0;
  private chase = false;
  private pendingResult?: { delay: number; show: () => void };
  private readonly handle = byId('aim-handle');
  private readonly scratch = new THREE.Vector3();
  private isDraggingAim = false;

  constructor(
    private readonly stage: Stage,
    onLeave: () => void,
    private readonly onBackdrop: () => void,
  ) {
    this.hud = new MissionHud({
      onPlan: (change) => this.changePlan(change),
      onLaunch: () => this.launch(),
      onRetry: () => this.start(this.levelIndex),
      onWarp: () => this.cycleWarp(),
      onChase: () => this.toggleChase(),
      onNext: () => this.start(this.levelIndex + 1),
      onMenu: () => this.showLevels(),
      onPickLevel: (index) => this.start(index),
      onBack: onLeave,
    });
    this.watchAimHandle();
  }

  private targetName(level: Level): string {
    return this.stage.solar.bodies.get(level.target)?.name ?? level.target;
  }

  showLevels(): void {
    if (this.mission) this.onBackdrop();
    this.clearMission();
    this.stage.sound.click();
    this.hud.showLevels(LEVELS, loadProgress(browserStore()), (level) => this.targetName(level));
  }

  exit(): void {
    this.clearMission();
    this.hud.hideAll();
  }

  private clearMission(): void {
    this.pendingResult = undefined;
    this.mission = undefined;
    this.steering.clear();
    this.stage.sound.setEngine(false);
    this.stage.missionView.group.visible = false;
    this.stage.highlightId = undefined;
    setVisible(this.handle, false);
  }

  /** Begin a fresh attempt at a level. */
  start(index: number): void {
    this.clearMission();
    this.levelIndex = Math.min(Math.max(index, 0), LEVELS.length - 1);
    const level = LEVELS[this.levelIndex];
    const mission = new Mission(level);
    this.mission = mission;
    this.warpIndex = 0;
    this.chase = false;

    const { solar, missionView, sound } = this.stage;
    solar.layoutGame(mission.planets);
    for (const view of solar.bodies.values()) {
      view.anchor.scale.setScalar(view.kind === 'planet' ? GAME_BODY_SCALE : 1);
    }
    solar.updateGame(mission.planets, mission.time, mission.time * DAYS_PER_TIME_UNIT);
    missionView.group.visible = true;
    missionView.clearTrail();
    missionView.setProbe({ x: 0, y: 0 }, { x: 1, y: 0 }, false, false);
    this.stage.highlightId = level.target;

    this.hud.showAim(level, this.levelIndex, this.targetName(level));
    this.hud.setWarp(WARPS[this.warpIndex]);
    this.hud.setChase(false);
    this.syncPlan();
    this.frameBoard();
    sound.click();
  }

  /** Point the camera down at the whole playing field. */
  private frameBoard(): void {
    const mission = this.mission;
    if (!mission) return;
    const home = mission.planet(mission.level.home);
    const target = mission.planet(mission.level.target);
    const reach = Math.max(home.orbitRadius, target.orbitRadius) * SCENE_AU * BOARD_MARGIN;
    this.stage.rig.controls.autoRotate = false;
    this.stage.rig.flyTo(
      { position: (out) => out.set(0, 0, 0), distance: this.stage.distanceToFit(reach), minDistance: 2 },
      BOARD_DIRECTION,
    );
  }

  private changePlan(change: PlanChange): void {
    const mission = this.mission;
    if (!mission || mission.phase !== 'aim') return;
    const next: Partial<LaunchPlan> = {};
    if (change.windowTime !== undefined) next.windowTime = change.windowTime;
    if (change.angleDeg !== undefined) next.angle = change.angleDeg * DEG;
    if (change.powerPercent !== undefined) next.speed = (change.powerPercent / 100) * mission.level.fuel;
    mission.setPlan(next);
    this.syncPlan();
  }

  private syncPlan(): void {
    const mission = this.mission;
    if (!mission) return;
    const { plan, level } = mission;
    this.hud.setPlan(plan.windowTime, plan.angle / DEG, plan.speed / level.fuel, plan.speed);
    const forecast = mission.getForecast();
    const target = this.targetName(level);
    if (forecast.outcome === 'won') {
      this.hud.setForecast(`Forecast: arrival at ${target}.`, 'good');
    } else if (forecast.outcome === 'sun' || forecast.outcome === 'crash') {
      this.hud.setForecast(`Forecast: this path hits ${forecast.crashedInto ?? 'the Sun'}.`, 'bad');
    } else {
      const shown = Math.round(level.previewTime * DAYS_PER_TIME_UNIT);
      const gap = forecast.closestToTarget.toFixed(2);
      this.hud.setForecast(`Forecast (${shown} d): closest ${gap} game AU from ${target}.`, 'plain');
    }
  }

  /** Nudge the plan from the keyboard while aiming. */
  nudge(angleSteps: number, powerSteps: number, windowSteps: number): void {
    const mission = this.mission;
    if (!mission || mission.phase !== 'aim') return;
    const { plan, level } = mission;
    this.changePlan({
      angleDeg: plan.angle / DEG + angleSteps * KEY_ANGLE_STEP,
      powerPercent: (plan.speed / level.fuel) * 100 + powerSteps * KEY_POWER_STEP,
      windowTime: plan.windowTime + windowSteps * KEY_WINDOW_STEP,
    });
  }

  launch(): void {
    const mission = this.mission;
    if (!mission || mission.phase !== 'aim') return;
    mission.launch();
    this.stage.missionView.hidePlanning();
    setVisible(this.handle, false);
    this.hud.showFlight();
    this.stage.sound.launch();
  }

  cycleWarp(): void {
    this.warpIndex = (this.warpIndex + 1) % WARPS.length;
    this.hud.setWarp(WARPS[this.warpIndex]);
    this.stage.sound.click();
  }

  toggleChase(): void {
    this.setChase(!this.chase);
  }

  private setChase(on: boolean): void {
    this.chase = on;
    this.hud.setChase(on);
    if (!on) {
      this.frameBoard();
      return;
    }
    this.stage.rig.flyTo(
      {
        position: (out) => this.stage.missionView.probePosition(out),
        distance: CHASE_DISTANCE,
        minDistance: 1,
      },
      BOARD_DIRECTION,
    );
  }

  private aimLength(): number {
    const camera = this.stage.rig.camera;
    const distance = camera.position.distanceTo(this.stage.rig.controls.target);
    return (distance * AIM_LENGTH_SHARE) / SCENE_AU;
  }

  private watchAimHandle(): void {
    this.handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.handle.setPointerCapture(event.pointerId);
      this.isDraggingAim = true;
      this.stage.rig.setEnabled(false);
    });
    this.handle.addEventListener('pointermove', (event) => {
      if (this.isDraggingAim) this.aimAt(event.clientX, event.clientY);
    });
    const release = (): void => {
      this.isDraggingAim = false;
      this.stage.rig.setEnabled(true);
    };
    this.handle.addEventListener('pointerup', release);
    this.handle.addEventListener('pointercancel', release);
  }

  private aimAt(x: number, y: number): void {
    const mission = this.mission;
    const hit = this.stage.toPlane(x, y);
    if (!mission || mission.phase !== 'aim' || !hit) return;
    const home = mission.planet(mission.level.home);
    const at = planetPosition(home, mission.plan.windowTime);
    const vel = planetVelocity(home, mission.plan.windowTime);
    const dx = hit.x / SCENE_AU - at.x;
    const dy = -hit.z / SCENE_AU - at.y;
    const angle = Math.atan2(dy, dx) - Math.atan2(vel.y, vel.x);
    const share = Math.hypot(dx, dy) / this.aimLength();
    this.changePlan({ angleDeg: Math.atan2(Math.sin(angle), Math.cos(angle)) / DEG, powerPercent: share * 100 });
  }

  private drawPlanning(mission: Mission): void {
    const { plan, level } = mission;
    const home = mission.planet(level.home);
    const from = planetPosition(home, plan.windowTime);
    const direction = aimDirection(home, plan.windowTime, plan.angle);
    const length = this.aimLength() * (plan.speed / level.fuel);
    const tip: Vec2 = { x: from.x + direction.x * length, y: from.y + direction.y * length };
    const forecast = mission.getForecast();
    this.stage.missionView.setAim(from, tip);
    this.stage.missionView.setForecast(forecast.points, forecast.outcome === 'won');
    const target = mission.planet(level.target);
    this.stage.missionView.setGhost(planetPosition(target, forecast.closestTime), target.captureRadius);

    const screen = this.stage.toScreen(gameToScene(tip, this.scratch));
    setVisible(this.handle, screen.inFront && !this.stage.rig.isFlying);
    this.handle.style.transform = `translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px)`;
  }

  private handleEvents(mission: Mission, events: MissionEvent[]): void {
    for (const event of events) {
      if (event.type === 'assist') {
        const speed = Math.hypot(mission.flight!.probe.vel.x, mission.flight!.probe.vel.y);
        const change = (event.assist.energyGain / Math.max(speed, 0.05)) * KM_S_PER_SPEED_UNIT;
        const sign = change >= 0 ? '+' : '';
        this.hud.showToast(`Gravity Assist: ${event.assist.planetName} ${sign}${change.toFixed(1)} km/s`);
        this.stage.sound.assist();
      } else {
        this.finish(mission, event.outcome);
      }
    }
  }

  private finish(mission: Mission, outcome: Outcome): void {
    const { sound } = this.stage;
    sound.setEngine(false);
    const target = this.targetName(mission.level);
    if (outcome === 'won' && mission.score) {
      const score = mission.score;
      sound.win();
      this.hud.setStatus(`Arrived at ${target}.`, 'good');
      const isBest = saveResult(browserStore(), mission.level.id, { score: score.total, stars: score.stars });
      const hasNext = this.levelIndex < LEVELS.length - 1;
      this.pendingResult = {
        delay: RESULT_DELAY_SECONDS,
        show: () => this.hud.showWin(target, score, mission.elapsed, isBest, hasNext),
      };
      return;
    }
    if (outcome === 'won' || outcome === 'flying') return;
    sound.lose();
    this.hud.setStatus('Signal lost.', 'bad');
    const closest = `${mission.flight!.closestToTarget.toFixed(2)} game AU from ${target}`;
    const crashedInto = mission.flight!.crashedInto;
    this.pendingResult = { delay: RESULT_DELAY_SECONDS, show: () => this.hud.showLoss(outcome, crashedInto, closest) };
  }

  private showFlightStatus(steering: boolean, fuel: number): void {
    if (fuel <= 0) this.hud.setStatus('Out of fuel. Coasting.', 'bad');
    else if (steering) this.hud.setStatus('Thrusters firing.', 'plain');
    else this.hud.setStatus('Coasting. Thrusters ready.', 'plain');
  }

  private tickResult(dt: number): void {
    const pending = this.pendingResult;
    if (!pending) return;
    pending.delay -= dt;
    if (pending.delay > 0) return;
    this.pendingResult = undefined;
    pending.show();
  }

  update(dt: number, seconds: number): void {
    const mission = this.mission;
    if (!mission) return;
    const { solar, missionView, sound } = this.stage;
    const target = mission.planet(mission.level.target);

    if (mission.phase === 'flight') {
      const steering = this.steering.isActive && mission.flight!.fuel > 0;
      const warp = steering ? 1 : WARPS[this.warpIndex];
      sound.setEngine(steering);
      const events = mission.update(dt * GAME_SPEED * warp, this.steering.input);
      this.showFlightStatus(steering, mission.flight!.fuel);
      this.handleEvents(mission, events);
    }

    solar.updateGame(mission.planets, mission.time, mission.time * DAYS_PER_TIME_UNIT);
    missionView.setTarget(planetPosition(target, mission.time), target.captureRadius, seconds);
    if (mission.phase === 'aim') {
      this.drawPlanning(mission);
    } else if (mission.flight) {
      const { probe, fuel } = mission.flight;
      const thrusting = mission.phase === 'flight' && this.steering.isActive && fuel > 0;
      missionView.setProbe(probe.pos, probe.vel, thrusting, mission.phase !== 'lost');
      missionView.setTrail(mission.trail);
    }
    this.tickResult(dt);
    const fuelLeft = mission.flight ? mission.flight.fuel : mission.level.fuel - mission.plan.speed;
    this.hud.setGauges(mission.fuelShare, fuelLeft, mission.elapsed, mission.level.timeLimit);
  }
}
