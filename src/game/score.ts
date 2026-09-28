import type { Level } from './levels.ts';

export interface ScoreBreakdown {
  arrival: number;
  fuel: number;
  time: number;
  assists: number;
  total: number;
  stars: number;
}

export const ARRIVAL_POINTS = 1000;
export const MAX_FUEL_POINTS = 500;
export const MAX_TIME_POINTS = 500;
export const ASSIST_POINTS = 250;
export const MAX_SCORED_ASSISTS = 3;
const THREE_STAR_TOTAL = 1600;
const TWO_STAR_TOTAL = 1300;

/** Score a completed mission. Spare fuel, speed and flybys all add points. */
export function scoreMission(level: Level, fuelLeft: number, elapsed: number, assistCount: number): ScoreBreakdown {
  const fuelShare = Math.min(Math.max(fuelLeft / level.fuel, 0), 1);
  const fuel = Math.round(MAX_FUEL_POINTS * fuelShare);

  const late = Math.max(0, elapsed - level.parTime);
  const slack = Math.max(level.timeLimit - level.parTime, 1e-6);
  const time = Math.round(MAX_TIME_POINTS * Math.max(0, 1 - late / slack));

  const assists = ASSIST_POINTS * Math.min(Math.max(assistCount, 0), MAX_SCORED_ASSISTS);
  const total = ARRIVAL_POINTS + fuel + time + assists;
  const stars = total >= THREE_STAR_TOTAL ? 3 : total >= TWO_STAR_TOTAL ? 2 : 1;
  return { arrival: ARRIVAL_POINTS, fuel, time, assists, total, stars };
}
