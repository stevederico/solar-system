import { STEP, forecast, startFlight, stepFlight } from './flight.ts';
import type { Assist, Flight, Forecast, LaunchPlan, Outcome } from './flight.ts';
import { buildPlanets } from './levels.ts';
import type { Level } from './levels.ts';
import type { GamePlanet, Vec2 } from './physics.ts';
import { scoreMission } from './score.ts';
import type { ScoreBreakdown } from './score.ts';

export type MissionPhase = 'aim' | 'flight' | 'won' | 'lost';

export type MissionEvent =
  | { type: 'assist'; assist: Assist }
  | { type: 'end'; outcome: Outcome; score?: ScoreBreakdown };

export interface SteerInput {
  /** 1 speeds up along the path, -1 brakes. */
  forward: number;
  /** 1 pushes left of the path, -1 pushes right. */
  side: number;
}

const MAX_DEFAULT_SPEED_SHARE = 0.9;
const TRANSFER_MARGIN = 1.1;
const MIN_SPEED_SHARE = 0.05;
const TRAIL_SAMPLE_STEPS = 6;
const MAX_TRAIL_POINTS = 4000;
const MAX_STEPS_PER_UPDATE = 400;

/** One attempt at a level: aim, launch, fly, then win or lose. */
export class Mission {
  readonly level: Level;
  readonly planets: GamePlanet[];
  phase: MissionPhase = 'aim';
  plan: LaunchPlan;
  flight?: Flight;
  trail: Vec2[] = [];
  score?: ScoreBreakdown;
  private carry = 0;
  private stepCount = 0;
  private cachedForecast?: { key: string; value: Forecast };

  constructor(level: Level) {
    this.level = level;
    this.planets = buildPlanets(level);
    const home = this.planet(level.home);
    const target = this.planet(level.target);
    const inward = target.orbitRadius < home.orbitRadius;
    // Start from the push a simple transfer orbit would need, so the first forecast is sensible.
    const r1 = home.orbitRadius;
    const r2 = target.orbitRadius;
    const transfer = Math.abs(Math.sqrt((2 * r2) / (r1 * (r1 + r2))) - Math.sqrt(1 / r1)) * TRANSFER_MARGIN;
    const speed = Math.min(Math.max(transfer, level.fuel * MIN_SPEED_SHARE), level.fuel * MAX_DEFAULT_SPEED_SHARE);
    this.plan = { windowTime: 0, angle: inward ? Math.PI : 0, speed };
  }

  /** Look up a planet in this mission. Throws for unknown ids. */
  planet(id: string): GamePlanet {
    const found = this.planets.find((planet) => planet.id === id);
    if (!found) throw new Error(`Unknown planet ${id}`);
    return found;
  }

  /** World time used to place the planets. */
  get time(): number {
    return this.flight ? this.flight.probe.t : this.plan.windowTime;
  }

  /** Time since launch, in time units. */
  get elapsed(): number {
    return this.flight ? this.flight.probe.t - this.flight.launchTime : 0;
  }

  /** Fuel left, as a share of the full tank. */
  get fuelShare(): number {
    const fuel = this.flight ? this.flight.fuel : this.level.fuel - this.plan.speed;
    return Math.min(Math.max(fuel / this.level.fuel, 0), 1);
  }

  /** Change the launch plan while aiming. Values are clamped to legal ranges. */
  setPlan(change: Partial<LaunchPlan>): void {
    if (this.phase !== 'aim') return;
    const next = { ...this.plan, ...change };
    next.windowTime = Math.min(Math.max(next.windowTime, 0), this.level.windowSpan);
    next.speed = Math.min(Math.max(next.speed, this.level.fuel * MIN_SPEED_SHARE), this.level.fuel);
    next.angle = Math.atan2(Math.sin(next.angle), Math.cos(next.angle));
    this.plan = next;
  }

  /** Dotted path for the current plan. Cached until the plan changes. */
  getForecast(): Forecast {
    const key = `${this.plan.windowTime}|${this.plan.angle}|${this.plan.speed}`;
    if (this.cachedForecast?.key !== key) {
      const value = forecast(this.level, this.planets, this.plan, this.level.previewTime);
      this.cachedForecast = { key, value };
    }
    return this.cachedForecast.value;
  }

  /** Leave the home planet with the current plan. */
  launch(): void {
    if (this.phase !== 'aim') return;
    this.flight = startFlight(this.level, this.planets, this.plan);
    this.trail = [{ ...this.flight.probe.pos }];
    this.phase = 'flight';
  }

  /** Advance the flight by a span of game time and report what happened. */
  update(dt: number, steer: SteerInput = { forward: 0, side: 0 }): MissionEvent[] {
    const flight = this.flight;
    if (this.phase !== 'flight' || !flight) return [];
    const events: MissionEvent[] = [];
    this.carry += dt;
    let steps = 0;
    while (this.carry >= STEP && steps < MAX_STEPS_PER_UPDATE && flight.outcome === 'flying') {
      const assistsBefore = flight.assists.length;
      stepFlight(flight, this.level, this.planets, steer.forward, steer.side);
      this.carry -= STEP;
      steps++;
      this.stepCount++;
      if (this.stepCount % TRAIL_SAMPLE_STEPS === 0) this.pushTrail(flight.probe.pos);
      for (const assist of flight.assists.slice(assistsBefore)) events.push({ type: 'assist', assist });
    }
    if (steps === MAX_STEPS_PER_UPDATE) this.carry = 0;
    if (flight.outcome !== 'flying') events.push(this.finish(flight));
    return events;
  }

  private pushTrail(pos: Vec2): void {
    this.trail.push({ ...pos });
    if (this.trail.length > MAX_TRAIL_POINTS) this.trail.splice(0, this.trail.length - MAX_TRAIL_POINTS);
  }

  private finish(flight: Flight): MissionEvent {
    this.pushTrail(flight.probe.pos);
    if (flight.outcome === 'won') {
      this.phase = 'won';
      this.score = scoreMission(this.level, flight.fuel, this.elapsed, flight.assists.length);
      return { type: 'end', outcome: flight.outcome, score: this.score };
    }
    this.phase = 'lost';
    return { type: 'end', outcome: flight.outcome };
  }
}
