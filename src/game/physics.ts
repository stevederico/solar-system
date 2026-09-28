/**
 * Arcade orbital physics for the mission mode.
 * Everything lives on the ecliptic plane. Distances are in game AU, where
 * Earth's orbit has radius 1 and the Sun's gravity parameter is 1, so Earth
 * moves at speed 1 and one Earth year lasts 2 PI time units.
 */
export interface Vec2 {
  x: number;
  y: number;
}

export interface GamePlanet {
  id: string;
  name: string;
  orbitRadius: number;
  /** Gravity parameter. Exaggerated so flybys bend the path visibly. */
  mu: number;
  bodyRadius: number;
  captureRadius: number;
  /** Angle on the orbit at time zero, in radians. */
  phase: number;
}

export interface ProbeState {
  pos: Vec2;
  vel: Vec2;
  t: number;
}

export interface GravityOptions {
  /** Planet whose pull is skipped, used while the probe leaves home. */
  ignoreId?: string;
  /** Only the Sun pulls. Used to prove a level needs an assist. */
  sunOnly?: boolean;
}

export const SUN_MU = 1;
export const SUN_RADIUS = 0.2;
export const SOFTENING = 0.012;
export const TIME_UNITS_PER_YEAR = Math.PI * 2;
export const DAYS_PER_TIME_UNIT = 365.25 / TIME_UNITS_PER_YEAR;
export const KM_S_PER_SPEED_UNIT = 29.78;

const NO_THRUST: Vec2 = { x: 0, y: 0 };
const PARABOLIC_ENERGY = 1e-9;

/** Angular speed of a circular orbit, from Kepler's third law. */
export function angularRate(orbitRadius: number): number {
  return Math.sqrt(SUN_MU / Math.pow(orbitRadius, 3));
}

/** Position of a planet on its circular orbit. */
export function planetPosition(planet: GamePlanet, t: number): Vec2 {
  const angle = planet.phase + angularRate(planet.orbitRadius) * t;
  return { x: planet.orbitRadius * Math.cos(angle), y: planet.orbitRadius * Math.sin(angle) };
}

/** Velocity of a planet on its circular orbit. */
export function planetVelocity(planet: GamePlanet, t: number): Vec2 {
  const rate = angularRate(planet.orbitRadius);
  const angle = planet.phase + rate * t;
  const speed = planet.orbitRadius * rate;
  return { x: -speed * Math.sin(angle), y: speed * Math.cos(angle) };
}

/** Distance between two points. */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Acceleration from the Sun and planets at a point and time. */
export function gravityAt(pos: Vec2, t: number, planets: GamePlanet[], options: GravityOptions = {}): Vec2 {
  const r2 = pos.x * pos.x + pos.y * pos.y + SOFTENING * SOFTENING;
  const sunPull = -SUN_MU / (r2 * Math.sqrt(r2));
  let ax = pos.x * sunPull;
  let ay = pos.y * sunPull;
  if (options.sunOnly) return { x: ax, y: ay };

  for (const planet of planets) {
    if (planet.id === options.ignoreId) continue;
    const at = planetPosition(planet, t);
    const dx = at.x - pos.x;
    const dy = at.y - pos.y;
    const d2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
    const pull = planet.mu / (d2 * Math.sqrt(d2));
    ax += dx * pull;
    ay += dy * pull;
  }
  return { x: ax, y: ay };
}

/**
 * Advance the probe by one step with fourth order Runge-Kutta.
 * Thrust is an acceleration held constant over the step.
 */
export function stepProbe(
  state: ProbeState,
  dt: number,
  planets: GamePlanet[],
  thrust: Vec2 = NO_THRUST,
  options: GravityOptions = {},
): ProbeState {
  const { pos, vel, t } = state;
  const half = dt / 2;

  const a1 = gravityAt(pos, t, planets, options);
  const v2 = { x: vel.x + (a1.x + thrust.x) * half, y: vel.y + (a1.y + thrust.y) * half };
  const p2 = { x: pos.x + vel.x * half, y: pos.y + vel.y * half };

  const a2 = gravityAt(p2, t + half, planets, options);
  const v3 = { x: vel.x + (a2.x + thrust.x) * half, y: vel.y + (a2.y + thrust.y) * half };
  const p3 = { x: pos.x + v2.x * half, y: pos.y + v2.y * half };

  const a3 = gravityAt(p3, t + half, planets, options);
  const v4 = { x: vel.x + (a3.x + thrust.x) * dt, y: vel.y + (a3.y + thrust.y) * dt };
  const p4 = { x: pos.x + v3.x * dt, y: pos.y + v3.y * dt };

  const a4 = gravityAt(p4, t + dt, planets, options);

  return {
    pos: {
      x: pos.x + (dt / 6) * (vel.x + 2 * v2.x + 2 * v3.x + v4.x),
      y: pos.y + (dt / 6) * (vel.y + 2 * v2.y + 2 * v3.y + v4.y),
    },
    vel: {
      x: vel.x + (dt / 6) * (a1.x + 2 * a2.x + 2 * a3.x + a4.x) + thrust.x * dt,
      y: vel.y + (dt / 6) * (a1.y + 2 * a2.y + 2 * a3.y + a4.y) + thrust.y * dt,
    },
    t: t + dt,
  };
}

/** Orbital energy per unit mass relative to the Sun. Negative means bound. */
export function solarEnergy(state: ProbeState): number {
  const speed2 = state.vel.x * state.vel.x + state.vel.y * state.vel.y;
  return speed2 / 2 - SUN_MU / Math.hypot(state.pos.x, state.pos.y);
}

/** Farthest distance from the Sun on the current orbit. Infinity when unbound. */
export function aphelion(state: ProbeState): number {
  const energy = solarEnergy(state);
  if (energy >= 0) return Infinity;
  const a = -SUN_MU / (2 * energy);
  const h = state.pos.x * state.vel.y - state.pos.y * state.vel.x;
  const e = Math.sqrt(Math.max(0, 1 - (h * h) / (SUN_MU * a)));
  return a * (1 + e);
}

/** Closest distance to the Sun on the current orbit. */
export function perihelion(state: ProbeState): number {
  const energy = solarEnergy(state);
  const h = state.pos.x * state.vel.y - state.pos.y * state.vel.x;
  if (Math.abs(energy) < PARABOLIC_ENERGY) return (h * h) / (2 * SUN_MU);
  if (energy > 0) {
    // Open path: the closest point still follows from energy and angular momentum.
    return (-SUN_MU + Math.sqrt(SUN_MU * SUN_MU + 2 * energy * h * h)) / (2 * energy);
  }
  const a = -SUN_MU / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 - (h * h) / (SUN_MU * a)));
  return a * (1 - e);
}
