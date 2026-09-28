import type { Vec3 } from './kepler.ts';

/** Compact squeezes the outer system inward. True keeps distances linear. */
export type ScaleMode = 'compact' | 'true';

/** Scene units per AU. */
export const SCENE_AU = 10;
export const COMPACT_EXPONENT = 0.6;

const EARTH_RADIUS_KM = 6371;
const EARTH_SCENE_RADIUS = 0.18;
const BODY_RADIUS_EXPONENT = 0.5;
const MOON_GAP_BASE = 2.0;
const MOON_GAP_FACTOR = 0.35;
const MOON_GAP_EXPONENT = 0.6;

/** Scene distance from the Sun for a real distance in AU. */
export function orbitRadiusToScene(au: number, mode: ScaleMode): number {
  if (mode === 'true') return SCENE_AU * au;
  return SCENE_AU * Math.pow(au, COMPACT_EXPONENT);
}

/**
 * Map a heliocentric position in ecliptic AU to scene coordinates.
 * Direction is kept, distance is rescaled, and the ecliptic plane becomes XZ.
 */
export function positionToScene(pos: Vec3, mode: ScaleMode): Vec3 {
  const r = Math.hypot(pos.x, pos.y, pos.z);
  if (r === 0) return { x: 0, y: 0, z: 0 };
  const k = orbitRadiusToScene(r, mode) / r;
  return { x: pos.x * k, y: pos.z * k, z: -pos.y * k };
}

/** Visual radius in scene units. Sizes are exaggerated so small worlds stay visible. */
export function bodyRadiusToScene(radiusKm: number): number {
  return EARTH_SCENE_RADIUS * Math.pow(radiusKm / EARTH_RADIUS_KM, BODY_RADIUS_EXPONENT);
}

/**
 * Scene distance of a moon from its parent's center.
 * Order and relative spacing are kept while the gaps are compressed.
 */
export function moonDistanceToScene(orbitKm: number, parentRadiusKm: number, parentSceneRadius: number): number {
  const ratio = orbitKm / parentRadiusKm;
  return parentSceneRadius * (MOON_GAP_BASE + MOON_GAP_FACTOR * Math.pow(ratio, MOON_GAP_EXPONENT));
}
