import { describe, expect, it } from 'vitest';
import {
  TIME_UNITS_PER_YEAR,
  angularRate,
  aphelion,
  distance,
  gravityAt,
  perihelion,
  planetPosition,
  planetVelocity,
  solarEnergy,
  stepProbe,
} from './physics.ts';
import type { GamePlanet, ProbeState } from './physics.ts';

const EARTH: GamePlanet = { id: 'earth', name: 'Earth', orbitRadius: 1, mu: 0.0007, bodyRadius: 0.03, captureRadius: 0.08, phase: 0 };
const GIANT: GamePlanet = { id: 'giant', name: 'Giant', orbitRadius: 2.5, mu: 0.006, bodyRadius: 0.1, captureRadius: 0.2, phase: 1 };

function circularOrbit(radius: number): ProbeState {
  return { pos: { x: radius, y: 0 }, vel: { x: 0, y: Math.sqrt(1 / radius) }, t: 0 };
}

function coast(state: ProbeState, time: number, planets: GamePlanet[] = [], dt = 0.004): ProbeState {
  let next = state;
  for (let n = 0; n < Math.round(time / dt); n++) next = stepProbe(next, dt, planets);
  return next;
}

describe('planets on rails', () => {
  it('gives Earth a year of 2 PI time units', () => {
    expect((Math.PI * 2) / angularRate(1)).toBeCloseTo(TIME_UNITS_PER_YEAR, 12);
  });

  it('follows Kepler: farther planets take longer', () => {
    expect(angularRate(2.5)).toBeLessThan(angularRate(1));
    expect(angularRate(4) / angularRate(1)).toBeCloseTo(1 / 8, 12);
  });

  it('keeps a planet on its circle', () => {
    for (const t of [0, 1.3, 9.9, 40]) {
      const at = planetPosition(GIANT, t);
      expect(Math.hypot(at.x, at.y)).toBeCloseTo(GIANT.orbitRadius, 12);
    }
  });

  it('moves a planet at circular speed, at right angles to its radius', () => {
    const at = planetPosition(GIANT, 3);
    const vel = planetVelocity(GIANT, 3);
    expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(Math.sqrt(1 / GIANT.orbitRadius), 12);
    expect(at.x * vel.x + at.y * vel.y).toBeCloseTo(0, 12);
  });

  it('matches velocity to the change in position', () => {
    const h = 1e-5;
    const a = planetPosition(EARTH, 2 - h);
    const b = planetPosition(EARTH, 2 + h);
    const vel = planetVelocity(EARTH, 2);
    expect((b.x - a.x) / (2 * h)).toBeCloseTo(vel.x, 6);
    expect((b.y - a.y) / (2 * h)).toBeCloseTo(vel.y, 6);
  });
});

describe('gravityAt', () => {
  it('pulls toward the Sun with inverse square strength', () => {
    const near = gravityAt({ x: 1, y: 0 }, 0, []);
    const far = gravityAt({ x: 2, y: 0 }, 0, []);
    expect(near.x).toBeLessThan(0);
    expect(near.x / far.x).toBeCloseTo(4, 2);
  });

  it('adds the pull of planets', () => {
    const point = { x: 1.2, y: 0 };
    const alone = gravityAt(point, 0, []);
    const withEarth = gravityAt(point, 0, [EARTH]);
    expect(withEarth.x).toBeLessThan(alone.x);
  });

  it('skips an ignored planet and honors sun only mode', () => {
    const point = { x: 1.2, y: 0 };
    const alone = gravityAt(point, 0, []);
    expect(gravityAt(point, 0, [EARTH], { ignoreId: 'earth' })).toEqual(alone);
    expect(gravityAt(point, 0, [EARTH, GIANT], { sunOnly: true })).toEqual(alone);
  });

  it('stays finite at the center of a planet', () => {
    const pull = gravityAt(planetPosition(EARTH, 0), 0, [EARTH]);
    expect(Number.isFinite(pull.x) && Number.isFinite(pull.y)).toBe(true);
  });
});

describe('stepProbe', () => {
  it('holds a circular orbit and returns after one year', () => {
    const end = coast(circularOrbit(1), TIME_UNITS_PER_YEAR);
    expect(distance(end.pos, { x: 1, y: 0 })).toBeLessThan(2e-3);
  });

  it('conserves energy while coasting around the Sun', () => {
    const start: ProbeState = { pos: { x: 1, y: 0 }, vel: { x: 0.2, y: 1.15 }, t: 0 };
    const end = coast(start, 12);
    expect(solarEnergy(end)).toBeCloseTo(solarEnergy(start), 4);
  });

  it('gains speed from forward thrust', () => {
    const start = circularOrbit(1);
    const pushed = stepProbe(start, 0.1, [], { x: 0, y: 0.5 });
    const free = stepProbe(start, 0.1, []);
    expect(pushed.vel.y - free.vel.y).toBeCloseTo(0.05, 3);
  });

  it('advances the clock', () => {
    expect(stepProbe(circularOrbit(1), 0.25, []).t).toBeCloseTo(0.25, 12);
  });

  it('changes orbital energy during a planet flyby', () => {
    // Start behind the giant on a crossing path, so its pull can do work on the probe.
    const at = planetPosition(GIANT, 0);
    const vel = planetVelocity(GIANT, 0);
    const start: ProbeState = { pos: { x: at.x + 0.3, y: at.y - 0.45 }, vel: { x: vel.x * 0.4, y: vel.y * 0.4 + 0.25 }, t: 0 };
    const withGiant = coast(start, 3, [GIANT]);
    const without = coast(start, 3, []);
    expect(Math.abs(solarEnergy(withGiant) - solarEnergy(start))).toBeGreaterThan(0.01);
    expect(solarEnergy(without)).toBeCloseTo(solarEnergy(start), 4);
  });
});

describe('orbit shape', () => {
  it('reports the radius for a circular orbit', () => {
    expect(aphelion(circularOrbit(1.5))).toBeCloseTo(1.5, 6);
    expect(perihelion(circularOrbit(1.5))).toBeCloseTo(1.5, 6);
  });

  it('matches a transfer orbit between two circles', () => {
    const r1 = 1;
    const r2 = 2.69;
    const speed = Math.sqrt((2 * r2) / (r1 * (r1 + r2)));
    const state: ProbeState = { pos: { x: r1, y: 0 }, vel: { x: 0, y: speed }, t: 0 };
    expect(aphelion(state)).toBeCloseTo(r2, 9);
    expect(perihelion(state)).toBeCloseTo(r1, 9);
  });

  it('reports no aphelion for an escape path', () => {
    const state: ProbeState = { pos: { x: 1, y: 0 }, vel: { x: 0, y: 1.5 }, t: 0 };
    expect(aphelion(state)).toBe(Infinity);
    expect(perihelion(state)).toBeCloseTo(1, 9);
  });

  it('handles the exact escape speed', () => {
    const state: ProbeState = { pos: { x: 1, y: 0 }, vel: { x: 0, y: Math.SQRT2 }, t: 0 };
    expect(perihelion(state)).toBeCloseTo(1, 6);
  });
});
