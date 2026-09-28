import { describe, expect, it } from 'vitest';
import { PICK_RADIUS, pickBody } from './pick.ts';
import type { ScreenPoint } from './pick.ts';

function point(x: number, y: number, depth: number, radius: number, visible = true): ScreenPoint {
  return { x, y, depth, radius, visible };
}

describe('pickBody', () => {
  it('picks a planet under the pointer', () => {
    const points = new Map([['jupiter', point(400, 300, 50, 120)]]);
    expect(pickBody(points, 450, 320)).toBe('jupiter');
  });

  it('returns nothing on empty space', () => {
    const points = new Map([['jupiter', point(400, 300, 50, 120)]]);
    expect(pickBody(points, 10, 10)).toBeUndefined();
  });

  it('gives tiny bodies a generous tap area', () => {
    const points = new Map([['phobos', point(100, 100, 30, 1)]]);
    expect(pickBody(points, 100 + PICK_RADIUS - 2, 100)).toBe('phobos');
  });

  it('picks a moon in front of its planet', () => {
    const points = new Map([
      ['jupiter', point(400, 300, 50, 120)],
      ['io', point(430, 300, 48, 6)],
    ]);
    expect(pickBody(points, 432, 301)).toBe('io');
  });

  it('picks a moon beside its planet even if the moon is farther away', () => {
    const points = new Map([
      ['earth', point(400, 300, 20, 60)],
      ['moon', point(470, 300, 21, 8)],
    ]);
    expect(pickBody(points, 462, 300)).toBe('moon');
  });

  it('skips a moon hidden behind its planet', () => {
    const points = new Map([
      ['jupiter', point(400, 300, 50, 120)],
      ['io', point(430, 300, 52, 6)],
    ]);
    expect(pickBody(points, 430, 300)).toBe('jupiter');
  });

  it('ignores bodies that are not visible', () => {
    const points = new Map([
      ['jupiter', point(400, 300, 50, 120)],
      ['io', point(430, 300, 48, 6, false)],
    ]);
    expect(pickBody(points, 430, 300)).toBe('jupiter');
  });

  it('prefers the nearer of two equal hit areas', () => {
    const points = new Map([
      ['far', point(100, 100, 90, 2)],
      ['near', point(104, 100, 10, 2)],
    ]);
    expect(pickBody(points, 102, 100)).toBe('near');
  });
});
