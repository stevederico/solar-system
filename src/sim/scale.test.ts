import { describe, expect, it } from 'vitest';
import { MOONS, PLANET_BY_ID, PLANETS, SUN, getBodyInfo, moonsOf } from '../data/bodies.ts';
import { SCENE_AU, bodyRadiusToScene, moonDistanceToScene, orbitRadiusToScene, positionToScene } from './scale.ts';
import { dateFromDays, daysForYear, daysSinceJ2000, formatDays } from './time.ts';

describe('orbitRadiusToScene', () => {
  it('keeps Earth at the same distance in both modes', () => {
    expect(orbitRadiusToScene(1, 'compact')).toBeCloseTo(SCENE_AU);
    expect(orbitRadiusToScene(1, 'true')).toBeCloseTo(SCENE_AU);
  });

  it('is linear in true mode', () => {
    expect(orbitRadiusToScene(30, 'true')).toBeCloseTo(300);
  });

  it('pulls the outer planets inward in compact mode', () => {
    expect(orbitRadiusToScene(30, 'compact')).toBeLessThan(100);
  });

  it('keeps the planet order in compact mode', () => {
    const radii = PLANETS.map((p) => orbitRadiusToScene(p.elements!.a, 'compact'));
    expect([...radii].sort((a, b) => a - b)).toEqual(radii);
  });
});

describe('positionToScene', () => {
  it('maps ecliptic north to scene up', () => {
    const scene = positionToScene({ x: 0, y: 0, z: 2 }, 'true');
    expect(scene.y).toBeCloseTo(20);
  });

  it('keeps the direction in compact mode', () => {
    const scene = positionToScene({ x: 3, y: 4, z: 0 }, 'compact');
    expect(scene.x / -scene.z).toBeCloseTo(3 / 4);
  });

  it('handles the origin', () => {
    expect(positionToScene({ x: 0, y: 0, z: 0 }, 'compact')).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('body sizes', () => {
  it('draws Jupiter larger than Earth and smaller than the Sun', () => {
    const earth = bodyRadiusToScene(PLANET_BY_ID.get('earth')!.radiusKm);
    const jupiter = bodyRadiusToScene(PLANET_BY_ID.get('jupiter')!.radiusKm);
    expect(jupiter).toBeGreaterThan(earth);
    expect(bodyRadiusToScene(SUN.radiusKm)).toBeGreaterThan(jupiter);
  });

  it('keeps the Sun inside the orbit of Mercury', () => {
    const mercury = PLANET_BY_ID.get('mercury')!.elements!;
    const perihelion = mercury.a * (1 - mercury.e);
    expect(bodyRadiusToScene(SUN.radiusKm)).toBeLessThan(orbitRadiusToScene(perihelion, 'true'));
  });
});

describe('moons', () => {
  it('places every moon outside its parent and any rings', () => {
    for (const moon of MOONS) {
      const parent = PLANET_BY_ID.get(moon.parent)!;
      const parentRadius = bodyRadiusToScene(parent.radiusKm);
      const distance = moonDistanceToScene(moon.orbitKm, parent.radiusKm, parentRadius);
      const clear = (parent.ring?.outer ?? 1) * parentRadius + bodyRadiusToScene(moon.radiusKm);
      expect(distance, moon.name).toBeGreaterThan(clear);
    }
  });

  it('keeps moons in order of real distance', () => {
    const saturn = PLANET_BY_ID.get('saturn')!;
    const distances = moonsOf('saturn').map((m) => moonDistanceToScene(m.orbitKm, saturn.radiusKm, 1));
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('gives every moon a known parent and facts', () => {
    for (const moon of MOONS) {
      expect(PLANET_BY_ID.has(moon.parent), moon.name).toBe(true);
      expect(getBodyInfo(moon.id)?.rows.length).toBeGreaterThan(2);
    }
  });
});

describe('getBodyInfo', () => {
  it('describes the Sun', () => {
    expect(getBodyInfo('sun')?.kindLabel).toBe('Star');
  });

  it('reports the length of a Mars year', () => {
    const year = getBodyInfo('mars')?.rows.find((row) => row.label === 'Year');
    expect(year?.value).toBe('687.0 days');
  });

  it('returns undefined for unknown ids', () => {
    expect(getBodyInfo('vulcan')).toBeUndefined();
  });
});

describe('time', () => {
  it('starts at zero on the J2000 epoch', () => {
    expect(daysSinceJ2000(Date.UTC(2000, 0, 1, 12))).toBe(0);
  });

  it('round trips through dates', () => {
    expect(daysSinceJ2000(dateFromDays(1234.5))).toBeCloseTo(1234.5, 6);
  });

  it('formats a short label', () => {
    expect(formatDays(daysForYear(2026))).toBe('1 Jan 2026');
  });
});
