import { DAYS_PER_CENTURY } from './time.ts';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Keplerian elements at J2000 plus linear rates per Julian century.
 * Angles are in degrees, distances in AU.
 */
export interface OrbitalElements {
  a: number;
  e: number;
  i: number;
  /** Mean longitude. */
  L: number;
  /** Longitude of perihelion. */
  lp: number;
  /** Longitude of the ascending node. */
  node: number;
  rates: { a: number; e: number; i: number; L: number; lp: number; node: number };
}

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const MAX_ITERATIONS = 30;

/** Wrap an angle in radians to the range [-PI, PI). */
export function wrapAngle(rad: number): number {
  const wrapped = ((((rad + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
  return wrapped;
}

/**
 * Solve Kepler's equation M = E - e sin(E) for the eccentric anomaly E.
 * Uses Newton iteration, which converges for every elliptical orbit here.
 */
export function solveKepler(meanAnomaly: number, e: number, tolerance = 1e-12): number {
  const M = wrapAngle(meanAnomaly);
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let n = 0; n < MAX_ITERATIONS; n++) {
    const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < tolerance) break;
  }
  return E;
}

/** Orbital period in days, from the mean longitude rate. */
export function orbitalPeriodDays(el: OrbitalElements): number {
  return (360 / el.rates.L) * DAYS_PER_CENTURY;
}

/**
 * Heliocentric position in AU, in J2000 ecliptic coordinates
 * (x toward the vernal equinox, z toward ecliptic north).
 */
export function heliocentricPosition(el: OrbitalElements, days: number): Vec3 {
  const T = days / DAYS_PER_CENTURY;
  const a = el.a + el.rates.a * T;
  const e = el.e + el.rates.e * T;
  const inc = (el.i + el.rates.i * T) * DEG;
  const L = (el.L + el.rates.L * T) * DEG;
  const lp = (el.lp + el.rates.lp * T) * DEG;
  const node = (el.node + el.rates.node * T) * DEG;

  const argPeri = lp - node;
  const E = solveKepler(L - lp, e);
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cosW = Math.cos(argPeri);
  const sinW = Math.sin(argPeri);
  const cosN = Math.cos(node);
  const sinN = Math.sin(node);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);

  return {
    x: (cosW * cosN - sinW * sinN * cosI) * xOrb + (-sinW * cosN - cosW * sinN * cosI) * yOrb,
    y: (cosW * sinN + sinW * cosN * cosI) * xOrb + (-sinW * sinN + cosW * cosN * cosI) * yOrb,
    z: sinW * sinI * xOrb + cosW * sinI * yOrb,
  };
}

/** Points along one full orbit, for drawing the orbit line. */
export function orbitPath(el: OrbitalElements, days: number, segments: number): Vec3[] {
  const period = orbitalPeriodDays(el);
  const points: Vec3[] = [];
  for (let n = 0; n <= segments; n++) {
    points.push(heliocentricPosition(el, days + (period * n) / segments));
  }
  return points;
}

/** Length of a vector. */
export function magnitude(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** Ecliptic longitude of a vector, in degrees from 0 to 360. */
export function eclipticLongitude(v: Vec3): number {
  return ((Math.atan2(v.y, v.x) / DEG) + 360) % 360;
}

export interface MoonOrbit {
  /** Sidereal period in days. Negative for retrograde moons. */
  periodDays: number;
  /** Mean longitude at J2000, in degrees. */
  phaseDeg: number;
}

/** Angle of a moon around its parent, in radians, for a circular orbit. */
export function moonAngle(orbit: MoonOrbit, days: number): number {
  return orbit.phaseDeg * DEG + (TWO_PI * days) / orbit.periodDays;
}
