/**
 * Offline search for launch plans that finish each level without steering.
 * Usage: bun scripts/solveLevels.ts [levelId] [--sun-only]
 * Prints the cheapest hits so levels can be tuned and tests can pin a known solution.
 */
import { STEP, startFlight, stepFlight } from '../src/game/flight.ts';
import type { LaunchPlan } from '../src/game/flight.ts';
import { LEVELS, buildPlanets } from '../src/game/levels.ts';
import type { Level } from '../src/game/levels.ts';

interface Hit {
  plan: LaunchPlan;
  elapsed: number;
  assists: string[];
}

const DEG = Math.PI / 180;
const WINDOW_STEP = 0.35;
const ANGLE_STEP_DEG = 4;
const SPEED_STEPS = 6;
const MIN_SPEED_SHARE = 0.4;
const COARSE_STEP = 0.02;

function fly(level: Level, plan: LaunchPlan, sunOnly: boolean, dt: number): { hit?: Hit; closest: number } {
  const planets = buildPlanets(level);
  const flight = startFlight(level, planets, plan);
  const steps = Math.ceil(level.timeLimit / dt);
  for (let n = 0; n < steps && flight.outcome === 'flying'; n++) {
    stepFlight(flight, level, planets, 0, 0, { sunOnly }, dt);
  }
  if (flight.outcome !== 'won') return { closest: flight.closestToTarget };
  return {
    closest: 0,
    hit: {
      plan,
      elapsed: flight.probe.t - flight.launchTime,
      assists: flight.assists.map((a) => `${a.planetName} ${a.energyGain.toFixed(3)}`),
    },
  };
}

function solve(level: Level, sunOnly: boolean): void {
  const hits: Hit[] = [];
  let closest = Infinity;
  for (let windowTime = 0; windowTime <= level.windowSpan; windowTime += WINDOW_STEP) {
    for (let angleDeg = -180; angleDeg < 180; angleDeg += ANGLE_STEP_DEG) {
      for (let n = 0; n <= SPEED_STEPS; n++) {
        const share = MIN_SPEED_SHARE + ((1 - MIN_SPEED_SHARE) * n) / SPEED_STEPS;
        const plan = { windowTime, angle: angleDeg * DEG, speed: level.fuel * share };
        const coarse = fly(level, plan, sunOnly, COARSE_STEP);
        closest = Math.min(closest, coarse.closest);
        if (!coarse.hit) continue;
        const fine = fly(level, plan, sunOnly, STEP);
        if (fine.hit) hits.push(fine.hit);
      }
    }
  }
  hits.sort((a, b) => a.plan.speed - b.plan.speed || a.elapsed - b.elapsed);
  const withAssist = hits.filter((hit) => hit.assists.length > 0);
  console.log(`\n${level.id}${sunOnly ? ' (sun only)' : ''}: ${hits.length} hits, ${withAssist.length} with assists, closest miss ${closest.toFixed(3)}`);
  const show = [...hits.slice(0, 5), ...withAssist.slice(0, 5)];
  for (const hit of show) {
    const { windowTime, angle, speed } = hit.plan;
    console.log(
      `  window ${windowTime.toFixed(1)} angle ${(angle / DEG).toFixed(0)} speed ${speed.toFixed(4)} ` +
        `(${((speed / level.fuel) * 100).toFixed(0)}%) time ${hit.elapsed.toFixed(1)} assists [${hit.assists.join(', ')}]`,
    );
  }
}

const args = process.argv.slice(2);
const sunOnly = args.includes('--sun-only');
const wanted = args.find((arg) => !arg.startsWith('--'));
for (const level of LEVELS) {
  if (!wanted || level.id === wanted) solve(level, sunOnly);
}
