import { PLANETS } from '../data/planets.ts';
import { COMPACT_EXPONENT, SCENE_AU, bodyRadiusToScene } from '../sim/scale.ts';
import type { GamePlanet } from './physics.ts';

export interface Level {
  id: string;
  name: string;
  brief: string;
  hint: string;
  home: string;
  target: string;
  /** Total delta-v for launch and steering, in speed units. */
  fuel: number;
  /** Mission clock limit in time units. */
  timeLimit: number;
  /** Arrive faster than this for a full time bonus. */
  parTime: number;
  /**
   * How far ahead the dotted forecast reaches, in time units.
   * Mission 1 shows the whole trip. Later missions show about 40 percent of par, so steering matters.
   */
  previewTime: number;
  /** Range of the launch day slider, in time units. */
  windowSpan: number;
  /** Planet angles at time zero, in degrees. Unlisted planets use a default. */
  phases: Record<string, number>;
}

const MIN_CAPTURE_RADIUS = 0.08;
const CAPTURE_RADIUS_FACTOR = 1.7;
/** Planets are drawn larger in missions so they read from far away. */
export const GAME_BODY_SCALE = 2.2;
/** The crash radius sits just inside the drawn surface. */
const CRASH_RADIUS_SHARE = 0.9;
/** Far targets get a wider capture zone, like a real sphere of influence. */
const CAPTURE_PER_ORBIT_RADIUS = 0.035;
/** Ringed planets capture from just outside their rings, so the target ring stays visible. */
const RING_CLEARANCE = 1.05;

/** Gravity parameters, tuned for play rather than realism. */
const PLANET_MU: Record<string, number> = {
  mercury: 0.00015,
  venus: 0.0006,
  earth: 0.0007,
  mars: 0.00025,
  jupiter: 0.006,
  saturn: 0.004,
  uranus: 0.002,
  neptune: 0.002,
};

const DEFAULT_PHASES: Record<string, number> = {
  mercury: 200,
  venus: 95,
  earth: 0,
  mars: 310,
  jupiter: 140,
  saturn: 235,
  uranus: 20,
  neptune: 285,
};

export const LEVELS: Level[] = [
  {
    id: 'first-hop',
    name: 'First Hop',
    brief: 'Reach Mars. Lead the target, because it keeps moving while you fly.',
    hint: 'Aim a little ahead of Earth. Slide the launch day until the dotted path meets the ring.',
    home: 'earth',
    target: 'mars',
    fuel: 0.3,
    timeLimit: 14,
    parTime: 5,
    previewTime: 5,
    windowSpan: 6,
    phases: { mars: 150 },
  },
  {
    id: 'inward-bound',
    name: 'Inward Bound',
    brief: 'Reach Venus. To fall toward the Sun you must slow down.',
    hint: 'Launch backward along the orbit of Earth to drop inward.',
    home: 'earth',
    target: 'venus',
    fuel: 0.26,
    timeLimit: 12,
    parTime: 4,
    previewTime: 1.6,
    windowSpan: 5,
    phases: { venus: 220 },
  },
  {
    id: 'giant-leap',
    name: 'Giant Leap',
    brief: 'Cross the asteroid belt and reach Jupiter.',
    hint: 'A long trip needs a big push. Save a little fuel for steering near the end.',
    home: 'earth',
    target: 'jupiter',
    fuel: 0.3,
    timeLimit: 24,
    parTime: 9,
    previewTime: 3.6,
    windowSpan: 14,
    phases: { jupiter: 95 },
  },
  {
    id: 'ring-run',
    name: 'Ring Run',
    brief: 'Reach Saturn. Your tank cannot get there alone, so steal speed from Jupiter.',
    hint: 'Pass just behind Jupiter as it moves. Its pull flings you outward.',
    home: 'earth',
    target: 'saturn',
    fuel: 0.24,
    timeLimit: 40,
    parTime: 18,
    previewTime: 7.2,
    windowSpan: 14,
    phases: { jupiter: 95, saturn: 150 },
  },
  {
    id: 'sun-skimmer',
    name: 'Sun Skimmer',
    brief: 'Reach Mercury, deep in the gravity well. Venus can help you brake.',
    hint: 'Pass in front of Venus to lose speed and fall inward.',
    home: 'earth',
    target: 'mercury',
    fuel: 0.085,
    timeLimit: 24,
    parTime: 8,
    previewTime: 3.2,
    windowSpan: 12,
    phases: { venus: 300, mercury: 200 },
  },
  {
    id: 'grand-tour',
    name: 'Grand Tour',
    brief: 'Reach Neptune at the edge of the system. Chain the giants together.',
    hint: 'Use Jupiter first. A second pass by Saturn adds even more speed.',
    home: 'earth',
    target: 'neptune',
    fuel: 0.3,
    timeLimit: 70,
    parTime: 34,
    previewTime: 13.6,
    windowSpan: 14,
    phases: { jupiter: 95, saturn: 150, neptune: 210 },
  },
];

/** Planets for a level, on compact circular orbits with the level's start angles. */
export function buildPlanets(level: Level): GamePlanet[] {
  return PLANETS.filter((planet) => planet.kind === 'planet').map((planet) => {
    const bodyRadius = (bodyRadiusToScene(planet.radiusKm) * GAME_BODY_SCALE * CRASH_RADIUS_SHARE) / SCENE_AU;
    const phaseDeg = level.phases[planet.id] ?? DEFAULT_PHASES[planet.id] ?? 0;
    const orbitRadius = Math.pow(planet.elements!.a, COMPACT_EXPONENT);
    const drawnRadius = (bodyRadiusToScene(planet.radiusKm) * GAME_BODY_SCALE) / SCENE_AU;
    const ringReach = planet.ring ? drawnRadius * planet.ring.outer * RING_CLEARANCE : 0;
    return {
      id: planet.id,
      name: planet.name,
      orbitRadius,
      mu: PLANET_MU[planet.id] ?? 0.0002,
      bodyRadius,
      captureRadius: Math.max(
        MIN_CAPTURE_RADIUS,
        bodyRadius * CAPTURE_RADIUS_FACTOR,
        orbitRadius * CAPTURE_PER_ORBIT_RADIUS,
        ringReach,
      ),
      phase: (phaseDeg * Math.PI) / 180,
    };
  });
}

/** Find a level by id. */
export function getLevel(id: string): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}
