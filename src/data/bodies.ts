import { orbitalPeriodDays } from '../sim/kepler.ts';
import { DAYS_PER_YEAR } from '../sim/time.ts';
import { MOONS } from './moons.ts';
import type { MoonData } from './moons.ts';
import { PLANETS, SUN } from './planets.ts';
import type { PlanetData } from './planets.ts';

export { MOONS, PLANETS, SUN };
export type { MoonData, PlanetData };

export interface FactRow {
  label: string;
  value: string;
}

export interface BodyInfo {
  id: string;
  name: string;
  kindLabel: string;
  blurb: string;
  funFact: string;
  rows: FactRow[];
}

const KM_PER_AU = 149_597_870.7;

/** All planets and dwarf planets, keyed by id. */
export const PLANET_BY_ID = new Map(PLANETS.map((planet) => [planet.id, planet]));
export const MOON_BY_ID = new Map(MOONS.map((moon) => [moon.id, moon]));

/** Moons that orbit a given planet, nearest first. */
export function moonsOf(parentId: string): MoonData[] {
  return MOONS.filter((moon) => moon.parent === parentId).sort((a, b) => a.orbitKm - b.orbitKm);
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Human label for a period given in days. */
export function formatPeriod(days: number): string {
  const abs = Math.abs(days);
  const suffix = days < 0 ? ', backward' : '';
  if (abs < 2) return `${(abs * 24).toFixed(1)} hours${suffix}`;
  if (abs < 700) return `${abs.toFixed(1)} days${suffix}`;
  return `${(abs / DAYS_PER_YEAR).toFixed(1)} years${suffix}`;
}

function planetInfo(planet: PlanetData): BodyInfo {
  const rows: FactRow[] = [{ label: 'Diameter', value: `${formatNumber(planet.facts.diameterKm)} km` }];
  if (planet.elements) {
    const au = planet.elements.a;
    rows.push({ label: 'From Sun', value: `${au.toFixed(2)} AU (${formatNumber((au * KM_PER_AU) / 1e6)} M km)` });
    rows.push({ label: 'Year', value: formatPeriod(orbitalPeriodDays(planet.elements)) });
  }
  rows.push({ label: 'Day', value: planet.facts.dayLength });
  rows.push({ label: 'Gravity', value: planet.facts.gravity });
  rows.push({ label: 'Temperature', value: planet.facts.temperature });
  if (planet.facts.moons) rows.push({ label: 'Moons', value: planet.facts.moons });
  const kindLabel = planet.kind === 'star' ? 'Star' : planet.kind === 'dwarf' ? 'Dwarf Planet' : 'Planet';
  return { id: planet.id, name: planet.name, kindLabel, blurb: planet.facts.blurb, funFact: planet.facts.funFact, rows };
}

function moonInfo(moon: MoonData): BodyInfo {
  const parent = PLANET_BY_ID.get(moon.parent);
  return {
    id: moon.id,
    name: moon.name,
    kindLabel: `Moon Of ${parent?.name ?? 'Unknown'}`,
    blurb: moon.blurb,
    funFact: moon.funFact,
    rows: [
      { label: 'Diameter', value: `${formatNumber(moon.radiusKm * 2)} km` },
      { label: 'From Parent', value: `${formatNumber(moon.orbitKm)} km` },
      { label: 'Orbit', value: formatPeriod(moon.periodDays) },
    ],
  };
}

/** Facts for any body id, or undefined when the id is unknown. */
export function getBodyInfo(id: string): BodyInfo | undefined {
  if (id === SUN.id) return planetInfo(SUN);
  const planet = PLANET_BY_ID.get(id);
  if (planet) return planetInfo(planet);
  const moon = MOON_BY_ID.get(id);
  return moon ? moonInfo(moon) : undefined;
}
