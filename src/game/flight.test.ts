import { describe, expect, it } from 'vitest';
import {
  HOME_CLEAR_RADIUS,
  LAUNCH_OFFSET,
  STEP,
  THRUST_ACCELERATION,
  aimDirection,
  forecast,
  startFlight,
  stepFlight,
  systemEdge,
  thrustVector,
} from './flight.ts';
import type { Flight, LaunchPlan } from './flight.ts';
import { LEVELS, buildPlanets, getLevel } from './levels.ts';
import type { Level } from './levels.ts';
import { aphelion, distance, perihelion, planetPosition, planetVelocity } from './physics.ts';

const DEG = Math.PI / 180;

function level(id: string): Level {
  const found = getLevel(id);
  if (!found) throw new Error(`missing level ${id}`);
  return found;
}

function fly(target: Level, plan: LaunchPlan): Flight {
  const planets = buildPlanets(target);
  const flight = startFlight(target, planets, plan);
  const steps = Math.ceil(target.timeLimit / STEP) + 10;
  for (let n = 0; n < steps && flight.outcome === 'flying'; n++) stepFlight(flight, target, planets);
  return flight;
}

/** Launch plans found by scripts/solveLevels.ts. They need no steering. */
const SOLUTIONS: Record<string, LaunchPlan> = {
  'first-hop': { windowTime: 5.95, angle: 40 * DEG, speed: 0.12 },
  'inward-bound': { windowTime: 4.9, angle: -144 * DEG, speed: 0.104 },
  'giant-leap': { windowTime: 0.35, angle: -12 * DEG, speed: 0.18 },
  'ring-run': { windowTime: 0.7, angle: -52 * DEG, speed: 0.216 },
  'sun-skimmer': { windowTime: 2.1, angle: 152 * DEG, speed: 0.04 },
  'grand-tour': { windowTime: 0.35, angle: -8 * DEG, speed: 0.196 },
};

describe('levels', () => {
  it('has a known winning launch for every level', () => {
    for (const each of LEVELS) {
      const plan = SOLUTIONS[each.id];
      expect(plan, each.id).toBeDefined();
      expect(plan.speed, each.id).toBeLessThanOrEqual(each.fuel);
      expect(plan.windowTime, each.id).toBeLessThanOrEqual(each.windowSpan);
      expect(fly(each, plan).outcome, each.id).toBe('won');
    }
  }, 60_000);

  it('uses unique ids and real planets', () => {
    expect(new Set(LEVELS.map((each) => each.id)).size).toBe(LEVELS.length);
    for (const each of LEVELS) {
      const ids = buildPlanets(each).map((planet) => planet.id);
      expect(ids).toContain(each.home);
      expect(ids).toContain(each.target);
    }
  });

  it('shows the whole trip in the Mission 1 forecast', () => {
    const first = LEVELS[0];
    const ahead = forecast(first, buildPlanets(first), SOLUTIONS[first.id], first.previewTime);
    expect(ahead.outcome).toBe('won');
  });

  it('keeps later forecasts short so they do not give away the answer', () => {
    for (const each of LEVELS.slice(1)) {
      expect(each.previewTime, each.id).toBeLessThanOrEqual(each.parTime * 0.45);
      const ahead = forecast(each, buildPlanets(each), SOLUTIONS[each.id], each.previewTime);
      expect(ahead.outcome, each.id).not.toBe('won');
    }
  });

  it('keeps par time inside the time limit', () => {
    for (const each of LEVELS) expect(each.parTime).toBeLessThan(each.timeLimit);
  });

  it('keeps capture zones from touching neighbor orbits', () => {
    const planets = buildPlanets(LEVELS[0]);
    for (let n = 1; n < planets.length; n++) {
      const gap = planets[n].orbitRadius - planets[n - 1].orbitRadius;
      expect(gap, planets[n].id).toBeGreaterThan(planets[n].captureRadius);
    }
  });

  it('puts the crash radius inside the capture zone', () => {
    for (const planet of buildPlanets(LEVELS[0])) expect(planet.bodyRadius).toBeLessThan(planet.captureRadius);
  });
});

describe('gravity assist levels', () => {
  function extremes(target: Level): { farthest: number; nearest: number } {
    const planets = buildPlanets(target);
    let farthest = 0;
    let nearest = Infinity;
    for (let angle = -180; angle < 180; angle += 0.5) {
      const flight = startFlight(target, planets, { windowTime: 0, angle: angle * DEG, speed: target.fuel });
      farthest = Math.max(farthest, aphelion(flight.probe));
      nearest = Math.min(nearest, perihelion(flight.probe));
    }
    return { farthest, nearest };
  }

  it('cannot reach Saturn on fuel alone in Ring Run', () => {
    const target = level('ring-run');
    const saturn = buildPlanets(target).find((planet) => planet.id === 'saturn')!;
    expect(extremes(target).farthest).toBeLessThan(saturn.orbitRadius - saturn.captureRadius);
  });

  it('cannot reach Neptune on fuel alone in Grand Tour', () => {
    const target = level('grand-tour');
    const neptune = buildPlanets(target).find((planet) => planet.id === 'neptune')!;
    expect(extremes(target).farthest).toBeLessThan(neptune.orbitRadius - neptune.captureRadius);
  });

  it('cannot reach Mercury on fuel alone in Sun Skimmer', () => {
    const target = level('sun-skimmer');
    const mercury = buildPlanets(target).find((planet) => planet.id === 'mercury')!;
    expect(extremes(target).nearest).toBeGreaterThan(mercury.orbitRadius + mercury.captureRadius);
  });

  it('can reach Jupiter on fuel alone in Giant Leap', () => {
    const target = level('giant-leap');
    const jupiter = buildPlanets(target).find((planet) => planet.id === 'jupiter')!;
    expect(extremes(target).farthest).toBeGreaterThan(jupiter.orbitRadius);
  });

  it('wins Ring Run with a Jupiter flyby that adds energy', () => {
    const flight = fly(level('ring-run'), SOLUTIONS['ring-run']);
    const jupiter = flight.assists.find((assist) => assist.planetId === 'jupiter');
    expect(jupiter?.energyGain).toBeGreaterThan(0.05);
  });

  it('wins Sun Skimmer with a Venus flyby that removes energy', () => {
    const flight = fly(level('sun-skimmer'), SOLUTIONS['sun-skimmer']);
    const venus = flight.assists.find((assist) => assist.planetId === 'venus');
    expect(venus?.energyGain).toBeLessThan(-0.05);
  });

  it('misses Saturn with the same launch when only the Sun pulls', () => {
    const target = level('ring-run');
    const planets = buildPlanets(target);
    const flight = startFlight(target, planets, SOLUTIONS['ring-run']);
    const steps = Math.ceil(target.timeLimit / STEP) + 10;
    for (let n = 0; n < steps && flight.outcome === 'flying'; n++) {
      stepFlight(flight, target, planets, 0, 0, { sunOnly: true });
    }
    expect(flight.outcome).not.toBe('won');
  });
});

describe('startFlight', () => {
  const target = level('first-hop');
  const planets = buildPlanets(target);
  const home = planets.find((planet) => planet.id === 'earth')!;

  it('starts just outside the home planet', () => {
    const flight = startFlight(target, planets, { windowTime: 1, angle: 0.3, speed: 0.1 });
    expect(distance(flight.probe.pos, planetPosition(home, 1))).toBeCloseTo(LAUNCH_OFFSET, 12);
  });

  it('adds launch speed to the motion of the home planet', () => {
    const flight = startFlight(target, planets, { windowTime: 1, angle: 0, speed: 0.1 });
    const vel = planetVelocity(home, 1);
    expect(Math.hypot(flight.probe.vel.x, flight.probe.vel.y)).toBeCloseTo(Math.hypot(vel.x, vel.y) + 0.1, 9);
  });

  it('spends launch speed from the tank', () => {
    const flight = startFlight(target, planets, { windowTime: 0, angle: 0, speed: 0.1 });
    expect(flight.fuel).toBeCloseTo(target.fuel - 0.1, 12);
  });

  it('caps launch speed at a full tank', () => {
    const flight = startFlight(target, planets, { windowTime: 0, angle: 0, speed: 99 });
    expect(flight.fuel).toBe(0);
  });

  it('aims backward at 180 degrees', () => {
    const forward = aimDirection(home, 2, 0);
    const backward = aimDirection(home, 2, Math.PI);
    expect(forward.x + backward.x).toBeCloseTo(0, 12);
    expect(forward.y + backward.y).toBeCloseTo(0, 12);
  });
});

describe('stepFlight', () => {
  const target = level('first-hop');
  const planets = buildPlanets(target);

  it('ignores home gravity until the probe clears home', () => {
    const flight = startFlight(target, planets, { windowTime: 0, angle: 0, speed: 0.15 });
    expect(flight.homeCleared).toBe(false);
    for (let n = 0; n < 2000 && !flight.homeCleared; n++) stepFlight(flight, target, planets);
    const home = planets.find((planet) => planet.id === 'earth')!;
    expect(flight.homeCleared).toBe(true);
    expect(distance(flight.probe.pos, planetPosition(home, flight.probe.t))).toBeGreaterThan(HOME_CLEAR_RADIUS);
  });

  it('does not count leaving home as a flyby', () => {
    const flight = startFlight(target, planets, { windowTime: 0, angle: 0, speed: 0.15 });
    for (let n = 0; n < 500; n++) stepFlight(flight, target, planets);
    expect(flight.assists).toHaveLength(0);
  });

  it('burns fuel while steering and none while coasting', () => {
    const flight = startFlight(target, planets, { windowTime: 0, angle: 0, speed: 0.1 });
    const before = flight.fuel;
    stepFlight(flight, target, planets);
    expect(flight.fuel).toBe(before);
    stepFlight(flight, target, planets, 1, 0);
    expect(flight.fuel).toBeCloseTo(before - THRUST_ACCELERATION * STEP, 12);
  });

  it('cannot steer on an empty tank', () => {
    const steered = startFlight(target, planets, { windowTime: 0, angle: 0, speed: target.fuel });
    const coasting = startFlight(target, planets, { windowTime: 0, angle: 0, speed: target.fuel });
    for (let n = 0; n < 50; n++) {
      stepFlight(steered, target, planets, 1, 1);
      stepFlight(coasting, target, planets);
    }
    expect(steered.probe.pos).toEqual(coasting.probe.pos);
  });

  it('loses the probe in the Sun', () => {
    const flight = fly(target, { windowTime: 0, angle: 180 * DEG, speed: target.fuel });
    const dive = startFlight(target, planets, { windowTime: 0, angle: 180 * DEG, speed: 0 });
    dive.probe.vel = { x: -0.2, y: 0 };
    for (let n = 0; n < 5000 && dive.outcome === 'flying'; n++) stepFlight(dive, target, planets);
    expect(dive.outcome).toBe('sun');
    expect(flight.outcome).not.toBe('flying');
  });

  it('loses the probe past the edge of the system', () => {
    const flight = startFlight(target, planets, { windowTime: 0, angle: 0, speed: 0 });
    flight.probe.vel = { x: 3, y: 3 };
    for (let n = 0; n < 5000 && flight.outcome === 'flying'; n++) stepFlight(flight, target, planets);
    expect(flight.outcome).toBe('lost');
    expect(Math.hypot(flight.probe.pos.x, flight.probe.pos.y)).toBeGreaterThan(systemEdge(planets, target));
  });

  it('times out on a parking orbit', () => {
    const flight = fly(target, { windowTime: 0, angle: 0, speed: 0.001 });
    expect(['timeout', 'crash']).toContain(flight.outcome);
  });

  it('stops changing once the flight has ended', () => {
    const flight = fly(target, SOLUTIONS['first-hop']);
    const frozen = { ...flight.probe.pos };
    stepFlight(flight, target, planets, 1, 1);
    expect(flight.probe.pos).toEqual(frozen);
  });
});

describe('thrustVector', () => {
  const probe = { pos: { x: 1, y: 0 }, vel: { x: 0, y: 2 }, t: 0 };

  it('pushes along the path when boosting', () => {
    const thrust = thrustVector(probe, 1, 0);
    expect(thrust.x).toBeCloseTo(0, 12);
    expect(thrust.y).toBeCloseTo(THRUST_ACCELERATION, 12);
  });

  it('pushes to the left of travel for positive side input', () => {
    const thrust = thrustVector(probe, 0, 1);
    expect(thrust.x).toBeCloseTo(-THRUST_ACCELERATION, 12);
  });

  it('keeps the same strength on diagonals', () => {
    const thrust = thrustVector(probe, 1, 1);
    expect(Math.hypot(thrust.x, thrust.y)).toBeCloseTo(THRUST_ACCELERATION, 12);
  });

  it('is zero without input', () => {
    expect(thrustVector(probe, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('forecast', () => {
  it('matches the real flight for the same plan', () => {
    const target = level('first-hop');
    const planets = buildPlanets(target);
    const plan = SOLUTIONS['first-hop'];
    const ahead = forecast(target, planets, plan, target.timeLimit);
    const flight = fly(target, plan);
    expect(ahead.outcome).toBe('won');
    const last = ahead.points[ahead.points.length - 1];
    expect(distance(last, flight.probe.pos)).toBeLessThan(1e-9);
  });

  it('stops at the preview horizon', () => {
    const target = level('grand-tour');
    const ahead = forecast(target, buildPlanets(target), SOLUTIONS['grand-tour'], 2);
    expect(ahead.outcome).toBe('flying');
    expect(ahead.points.length).toBeGreaterThan(50);
  });
});
