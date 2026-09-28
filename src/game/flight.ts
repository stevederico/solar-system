import type { Level } from './levels.ts';
import { SUN_RADIUS, distance, planetPosition, planetVelocity, solarEnergy, stepProbe } from './physics.ts';
import type { GamePlanet, GravityOptions, ProbeState, Vec2 } from './physics.ts';

export type Outcome = 'flying' | 'won' | 'sun' | 'crash' | 'lost' | 'timeout';

export interface LaunchPlan {
  /** Launch time inside the window, in time units. */
  windowTime: number;
  /** Aim angle in radians, measured from the direction the home planet moves. */
  angle: number;
  /** Launch speed added on top of the home planet's motion. */
  speed: number;
}

export interface Assist {
  planetId: string;
  planetName: string;
  /** Change in orbital energy. Positive sped the probe up. */
  energyGain: number;
}

export interface Flight {
  probe: ProbeState;
  launchTime: number;
  fuel: number;
  homeCleared: boolean;
  outcome: Outcome;
  crashedInto?: string;
  assists: Assist[];
  /** Planets whose flyby zone the probe is inside, with the energy on entry. */
  zones: Map<string, number>;
  closestToTarget: number;
  /** Clock time of the closest pass to the target. */
  closestTime: number;
  /** Radius past which the probe is lost. */
  edge: number;
}

export const STEP = 0.004;
export const LAUNCH_OFFSET = 0.07;
export const HOME_CLEAR_RADIUS = 0.24;
export const THRUST_ACCELERATION = 0.06;
export const FLYBY_ZONE_FACTOR = 2.6;
export const ASSIST_ENERGY_THRESHOLD = 0.008;
const SYSTEM_EDGE_FACTOR = 1.35;
const SYSTEM_EDGE_MARGIN = 1.5;

/** Radius past which the probe counts as lost in deep space. */
export function systemEdge(planets: GamePlanet[], level: Level): number {
  const target = planets.find((planet) => planet.id === level.target);
  const reach = (target?.orbitRadius ?? 1) * SYSTEM_EDGE_FACTOR + SYSTEM_EDGE_MARGIN;
  return Math.max(reach, 4);
}

/** Unit vector for an aim angle measured from the home planet's direction of travel. */
export function aimDirection(home: GamePlanet, windowTime: number, angle: number): Vec2 {
  const vel = planetVelocity(home, windowTime);
  const speed = Math.hypot(vel.x, vel.y);
  const px = vel.x / speed;
  const py = vel.y / speed;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: px * cos - py * sin, y: px * sin + py * cos };
}

/** Start a flight from the home planet. Launch speed is capped by the fuel tank. */
export function startFlight(level: Level, planets: GamePlanet[], plan: LaunchPlan): Flight {
  const home = planets.find((planet) => planet.id === level.home);
  if (!home) throw new Error(`Level ${level.id} has no home planet ${level.home}`);
  const speed = Math.min(Math.max(plan.speed, 0), level.fuel);
  const dir = aimDirection(home, plan.windowTime, plan.angle);
  const at = planetPosition(home, plan.windowTime);
  const vel = planetVelocity(home, plan.windowTime);
  return {
    probe: {
      pos: { x: at.x + dir.x * LAUNCH_OFFSET, y: at.y + dir.y * LAUNCH_OFFSET },
      vel: { x: vel.x + dir.x * speed, y: vel.y + dir.y * speed },
      t: plan.windowTime,
    },
    launchTime: plan.windowTime,
    fuel: level.fuel - speed,
    homeCleared: false,
    outcome: 'flying',
    assists: [],
    zones: new Map(),
    closestToTarget: Infinity,
    closestTime: plan.windowTime,
    edge: systemEdge(planets, level),
  };
}

/** Thrust acceleration for steering input, relative to the direction of travel. */
export function thrustVector(probe: ProbeState, forward: number, side: number): Vec2 {
  const speed = Math.hypot(probe.vel.x, probe.vel.y);
  if (speed === 0 || (forward === 0 && side === 0)) return { x: 0, y: 0 };
  const px = probe.vel.x / speed;
  const py = probe.vel.y / speed;
  const length = Math.hypot(forward, side);
  const f = (forward / length) * THRUST_ACCELERATION;
  const s = (side / length) * THRUST_ACCELERATION;
  return { x: px * f - py * s, y: py * f + px * s };
}

function trackFlybys(flight: Flight, level: Level, planets: GamePlanet[]): void {
  for (const planet of planets) {
    if (planet.id === level.target) continue;
    if (planet.id === level.home && !flight.homeCleared) continue;
    const d = distance(flight.probe.pos, planetPosition(planet, flight.probe.t));
    const inside = d < planet.captureRadius * FLYBY_ZONE_FACTOR;
    const entryEnergy = flight.zones.get(planet.id);
    if (inside && entryEnergy === undefined) {
      flight.zones.set(planet.id, solarEnergy(flight.probe));
    } else if (!inside && entryEnergy !== undefined) {
      flight.zones.delete(planet.id);
      const energyGain = solarEnergy(flight.probe) - entryEnergy;
      if (Math.abs(energyGain) >= ASSIST_ENERGY_THRESHOLD) {
        flight.assists.push({ planetId: planet.id, planetName: planet.name, energyGain });
      }
    }
  }
}

function judge(flight: Flight, level: Level, planets: GamePlanet[]): void {
  const { pos, t } = flight.probe;
  const fromSun = Math.hypot(pos.x, pos.y);
  if (fromSun < SUN_RADIUS) {
    flight.outcome = 'sun';
    return;
  }
  for (const planet of planets) {
    const d = distance(pos, planetPosition(planet, t));
    if (planet.id === level.target) {
      if (d < flight.closestToTarget) {
        flight.closestToTarget = d;
        flight.closestTime = t;
      }
      if (d < planet.captureRadius) {
        flight.outcome = 'won';
        return;
      }
    } else if (d < planet.bodyRadius && (planet.id !== level.home || flight.homeCleared)) {
      flight.outcome = 'crash';
      flight.crashedInto = planet.name;
      return;
    }
  }
  if (fromSun > flight.edge) flight.outcome = 'lost';
  else if (t - flight.launchTime > level.timeLimit) flight.outcome = 'timeout';
}

/**
 * Advance a flight by one fixed step. Steering burns fuel.
 * Does nothing once the flight has ended.
 */
export function stepFlight(
  flight: Flight,
  level: Level,
  planets: GamePlanet[],
  forward = 0,
  side = 0,
  gravity: GravityOptions = {},
  dt = STEP,
): void {
  if (flight.outcome !== 'flying') return;
  let thrust: Vec2 = { x: 0, y: 0 };
  if (flight.fuel > 0 && (forward !== 0 || side !== 0)) {
    thrust = thrustVector(flight.probe, forward, side);
    flight.fuel = Math.max(0, flight.fuel - THRUST_ACCELERATION * dt);
  }
  const options: GravityOptions = { ...gravity };
  if (!flight.homeCleared) options.ignoreId = level.home;
  flight.probe = stepProbe(flight.probe, dt, planets, thrust, options);

  if (!flight.homeCleared) {
    const home = planets.find((planet) => planet.id === level.home);
    if (home && distance(flight.probe.pos, planetPosition(home, flight.probe.t)) > HOME_CLEAR_RADIUS) {
      flight.homeCleared = true;
    }
  }
  trackFlybys(flight, level, planets);
  judge(flight, level, planets);
}

export interface Forecast {
  points: Vec2[];
  outcome: Outcome;
  closestToTarget: number;
  /** Clock time of the closest pass inside the forecast. */
  closestTime: number;
  /** Planet the path runs into, when it ends in a crash. */
  crashedInto?: string;
}

/** Coast a launch plan forward without steering, sampling the path. */
export function forecast(
  level: Level,
  planets: GamePlanet[],
  plan: LaunchPlan,
  duration: number,
  sampleEvery = 5,
  gravity: GravityOptions = {},
): Forecast {
  const flight = startFlight(level, planets, plan);
  const points: Vec2[] = [{ ...flight.probe.pos }];
  const steps = Math.ceil(duration / STEP);
  for (let n = 1; n <= steps && flight.outcome === 'flying'; n++) {
    stepFlight(flight, level, planets, 0, 0, gravity);
    if (n % sampleEvery === 0 || flight.outcome !== 'flying') points.push({ ...flight.probe.pos });
  }
  return {
    points,
    outcome: flight.outcome,
    closestToTarget: flight.closestToTarget,
    closestTime: flight.closestTime,
    crashedInto: flight.crashedInto,
  };
}
