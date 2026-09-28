import { describe, expect, it } from 'vitest';
import { PLANET_BY_ID, PLANETS } from '../data/bodies.ts';
import {
  eclipticLongitude,
  heliocentricPosition,
  magnitude,
  moonAngle,
  orbitalPeriodDays,
  orbitPath,
  solveKepler,
  wrapAngle,
} from './kepler.ts';
import type { Vec3 } from './kepler.ts';
import { daysSinceJ2000 } from './time.ts';

function planet(id: string) {
  const found = PLANET_BY_ID.get(id);
  if (!found?.elements) throw new Error(`missing planet ${id}`);
  return found.elements;
}

function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return (Math.acos(dot / (magnitude(a) * magnitude(b))) * 180) / Math.PI;
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

describe('solveKepler', () => {
  it('returns the mean anomaly for a circular orbit', () => {
    expect(solveKepler(1.2, 0)).toBeCloseTo(1.2, 12);
  });

  it('satisfies the Kepler equation across eccentricities', () => {
    for (const e of [0.01, 0.2, 0.5, 0.9]) {
      for (let M = -3; M <= 3; M += 0.37) {
        const E = solveKepler(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(wrapAngle(M), 9);
      }
    }
  });

  it('wraps large mean anomalies', () => {
    expect(solveKepler(0.5 + Math.PI * 40, 0.3)).toBeCloseTo(solveKepler(0.5, 0.3), 9);
  });
});

describe('orbitalPeriodDays', () => {
  it('gives Earth a year of about 365.25 days', () => {
    expect(orbitalPeriodDays(planet('earth'))).toBeCloseTo(365.256, 1);
  });

  it('gives Jupiter a year of about 11.86 Earth years', () => {
    expect(orbitalPeriodDays(planet('jupiter')) / 365.25).toBeCloseTo(11.86, 1);
  });

  it('orders the planets by period', () => {
    const periods = PLANETS.map((p) => orbitalPeriodDays(p.elements!));
    expect([...periods].sort((a, b) => a - b)).toEqual(periods);
  });
});

describe('heliocentricPosition', () => {
  it('puts Earth near perihelion in early January', () => {
    const r = magnitude(heliocentricPosition(planet('earth'), daysSinceJ2000(Date.UTC(2024, 0, 3))));
    expect(r).toBeCloseTo(0.9833, 3);
  });

  it('puts Earth near aphelion in early July', () => {
    const r = magnitude(heliocentricPosition(planet('earth'), daysSinceJ2000(Date.UTC(2024, 6, 5))));
    expect(r).toBeCloseTo(1.0167, 3);
  });

  it('keeps every planet between perihelion and aphelion', () => {
    for (const p of PLANETS) {
      const el = p.elements!;
      for (let days = -20000; days <= 20000; days += 1777) {
        const r = magnitude(heliocentricPosition(el, days));
        expect(r).toBeGreaterThan(el.a * (1 - el.e) * 0.995);
        expect(r).toBeLessThan(el.a * (1 + el.e) * 1.005);
      }
    }
  });

  it('lines up Earth and Mars at the October 2020 opposition', () => {
    const days = daysSinceJ2000(Date.UTC(2020, 9, 13, 23));
    const earth = eclipticLongitude(heliocentricPosition(planet('earth'), days));
    const mars = eclipticLongitude(heliocentricPosition(planet('mars'), days));
    expect(Math.abs(earth - mars)).toBeLessThan(0.5);
  });

  it('shows the Jupiter and Saturn great conjunction of December 2020 from Earth', () => {
    const days = daysSinceJ2000(Date.UTC(2020, 11, 21, 18));
    const earth = heliocentricPosition(planet('earth'), days);
    const jupiter = subtract(heliocentricPosition(planet('jupiter'), days), earth);
    const saturn = subtract(heliocentricPosition(planet('saturn'), days), earth);
    expect(angleBetweenDeg(jupiter, saturn)).toBeLessThan(0.5);
  });

  it('returns to the same place after one period', () => {
    const el = planet('venus');
    const start = heliocentricPosition(el, 100);
    const end = heliocentricPosition(el, 100 + orbitalPeriodDays(el));
    expect(magnitude(subtract(start, end))).toBeLessThan(1e-3);
  });

  it('moves counterclockwise seen from ecliptic north', () => {
    const el = planet('earth');
    const a = eclipticLongitude(heliocentricPosition(el, 10));
    const b = eclipticLongitude(heliocentricPosition(el, 20));
    expect(b).toBeGreaterThan(a);
  });
});

describe('orbitPath', () => {
  it('closes the loop', () => {
    const path = orbitPath(planet('mars'), 0, 64);
    expect(path).toHaveLength(65);
    expect(magnitude(subtract(path[0], path[64]))).toBeLessThan(1e-3);
  });
});

describe('moonAngle', () => {
  it('advances one full turn per period', () => {
    const orbit = { periodDays: 27.3217, phaseDeg: 0 };
    expect(moonAngle(orbit, 27.3217)).toBeCloseTo(Math.PI * 2, 9);
  });

  it('runs backward for retrograde moons', () => {
    expect(moonAngle({ periodDays: -5.8769, phaseDeg: 0 }, 1)).toBeLessThan(0);
  });
});
