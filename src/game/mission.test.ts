import { describe, expect, it } from 'vitest';
import { getLevel } from './levels.ts';
import { Mission } from './mission.ts';
import type { MissionEvent } from './mission.ts';
import { PROGRESS_KEY, loadProgress, saveResult } from './progress.ts';
import type { KeyValueStore } from './progress.ts';
import { ARRIVAL_POINTS, ASSIST_POINTS, MAX_FUEL_POINTS, MAX_SCORED_ASSISTS, MAX_TIME_POINTS, scoreMission } from './score.ts';

const DEG = Math.PI / 180;
const firstHop = getLevel('first-hop')!;
const ringRun = getLevel('ring-run')!;

function runToEnd(mission: Mission): MissionEvent[] {
  const events: MissionEvent[] = [];
  for (let n = 0; n < 5000 && mission.phase === 'flight'; n++) events.push(...mission.update(0.05));
  return events;
}

describe('Mission', () => {
  it('starts in the aim phase with a legal plan', () => {
    const mission = new Mission(firstHop);
    expect(mission.phase).toBe('aim');
    expect(mission.plan.speed).toBeLessThanOrEqual(firstHop.fuel);
    expect(mission.elapsed).toBe(0);
  });

  it('aims backward by default for inner targets', () => {
    expect(new Mission(getLevel('inward-bound')!).plan.angle).toBeCloseTo(Math.PI, 12);
    expect(new Mission(firstHop).plan.angle).toBe(0);
  });

  it('clamps the plan to legal ranges', () => {
    const mission = new Mission(firstHop);
    mission.setPlan({ windowTime: 999, speed: 999, angle: 3 * Math.PI });
    expect(mission.plan.windowTime).toBe(firstHop.windowSpan);
    expect(mission.plan.speed).toBe(firstHop.fuel);
    expect(mission.plan.angle).toBeCloseTo(Math.PI, 9);
    mission.setPlan({ windowTime: -5, speed: -1 });
    expect(mission.plan.windowTime).toBe(0);
    expect(mission.plan.speed).toBeGreaterThan(0);
  });

  it('keeps other plan values when one changes', () => {
    const mission = new Mission(firstHop);
    mission.setPlan({ angle: 0.5 });
    const speed = mission.plan.speed;
    mission.setPlan({ windowTime: 2 });
    expect(mission.plan.angle).toBeCloseTo(0.5, 12);
    expect(mission.plan.speed).toBe(speed);
  });

  it('moves the planets with the launch day while aiming', () => {
    const mission = new Mission(firstHop);
    mission.setPlan({ windowTime: 3 });
    expect(mission.time).toBe(3);
  });

  it('caches the forecast until the plan changes', () => {
    const mission = new Mission(firstHop);
    const first = mission.getForecast();
    expect(mission.getForecast()).toBe(first);
    mission.setPlan({ angle: 0.2 });
    expect(mission.getForecast()).not.toBe(first);
  });

  it('ignores updates before launch', () => {
    const mission = new Mission(firstHop);
    expect(mission.update(1)).toEqual([]);
    expect(mission.phase).toBe('aim');
  });

  it('wins, scores and reports the end once', () => {
    const mission = new Mission(firstHop);
    mission.setPlan({ windowTime: 5.95, angle: 40 * DEG, speed: 0.12 });
    expect(mission.getForecast().outcome).toBe('won');
    mission.launch();
    const events = runToEnd(mission);
    const ends = events.filter((event) => event.type === 'end');
    expect(mission.phase).toBe('won');
    expect(ends).toHaveLength(1);
    expect(mission.score?.total).toBeGreaterThan(ARRIVAL_POINTS);
    expect(mission.update(1)).toEqual([]);
  });

  it('reports gravity assists as they happen', () => {
    const mission = new Mission(ringRun);
    mission.setPlan({ windowTime: 0.7, angle: -52 * DEG, speed: 0.216 });
    mission.launch();
    const events = runToEnd(mission);
    const assists = events.filter((event) => event.type === 'assist');
    expect(mission.phase).toBe('won');
    expect(assists.length).toBeGreaterThan(0);
    expect(mission.score?.assists).toBeGreaterThanOrEqual(ASSIST_POINTS);
  });

  it('loses without a score when the probe goes astray', () => {
    const mission = new Mission(firstHop);
    mission.setPlan({ windowTime: 0, angle: 180 * DEG, speed: 0.05 });
    mission.launch();
    runToEnd(mission);
    expect(mission.phase).toBe('lost');
    expect(mission.score).toBeUndefined();
  });

  it('cannot change the plan or relaunch after launch', () => {
    const mission = new Mission(firstHop);
    mission.launch();
    const flight = mission.flight;
    mission.setPlan({ angle: 1 });
    mission.launch();
    expect(mission.plan.angle).toBe(0);
    expect(mission.flight).toBe(flight);
  });

  it('records a trail and drains fuel when steering', () => {
    const mission = new Mission(firstHop);
    mission.launch();
    const before = mission.fuelShare;
    mission.update(0.5, { forward: 1, side: 0 });
    expect(mission.trail.length).toBeGreaterThan(5);
    expect(mission.fuelShare).toBeLessThan(before);
  });

  it('survives a huge frame time without freezing', () => {
    const mission = new Mission(firstHop);
    mission.launch();
    mission.update(1000);
    expect(mission.elapsed).toBeLessThan(5);
  });
});

describe('scoreMission', () => {
  it('gives full marks for a fast, frugal flight', () => {
    const score = scoreMission(firstHop, firstHop.fuel, 1, 0);
    expect(score.total).toBe(ARRIVAL_POINTS + MAX_FUEL_POINTS + MAX_TIME_POINTS);
    expect(score.stars).toBe(3);
  });

  it('gives only arrival points for a slow flight on fumes', () => {
    const score = scoreMission(firstHop, 0, firstHop.timeLimit, 0);
    expect(score.total).toBe(ARRIVAL_POINTS);
    expect(score.stars).toBe(1);
  });

  it('rewards each flyby up to a cap', () => {
    expect(scoreMission(firstHop, 0, 99, 2).assists).toBe(ASSIST_POINTS * 2);
    expect(scoreMission(firstHop, 0, 99, 50).assists).toBe(ASSIST_POINTS * MAX_SCORED_ASSISTS);
  });

  it('scales the time bonus between par and the limit', () => {
    const middle = (firstHop.parTime + firstHop.timeLimit) / 2;
    expect(scoreMission(firstHop, 0, middle, 0).time).toBe(MAX_TIME_POINTS / 2);
  });

  it('never goes negative on bad input', () => {
    const score = scoreMission(firstHop, -5, 9999, -3);
    expect(score.total).toBe(ARRIVAL_POINTS);
  });
});

describe('progress', () => {
  function memoryStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    if (initial !== undefined) data.set(PROGRESS_KEY, initial);
    return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
  }

  it('starts empty', () => {
    expect(loadProgress(memoryStore())).toEqual({});
  });

  it('saves a first result as the best', () => {
    const store = memoryStore();
    expect(saveResult(store, 'first-hop', { score: 1200, stars: 1 })).toBe(true);
    expect(loadProgress(store)['first-hop']).toEqual({ score: 1200, stars: 1 });
  });

  it('keeps the higher score', () => {
    const store = memoryStore();
    saveResult(store, 'first-hop', { score: 1500, stars: 2 });
    expect(saveResult(store, 'first-hop', { score: 1400, stars: 2 })).toBe(false);
    expect(saveResult(store, 'first-hop', { score: 1700, stars: 3 })).toBe(true);
    expect(loadProgress(store)['first-hop'].score).toBe(1700);
  });

  it('recovers from broken saved data', () => {
    expect(loadProgress(memoryStore('not json'))).toEqual({});
    expect(loadProgress(memoryStore('{"first-hop": {"score": "high"}}'))).toEqual({});
    expect(loadProgress(memoryStore('null'))).toEqual({});
  });

  it('works without any storage', () => {
    expect(loadProgress(undefined)).toEqual({});
    expect(saveResult(undefined, 'first-hop', { score: 1, stars: 1 })).toBe(true);
  });

  it('survives storage that throws', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(saveResult(store, 'first-hop', { score: 1, stars: 1 })).toBe(true);
  });
});
