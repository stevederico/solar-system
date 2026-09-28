import type { OrbitalElements } from '../sim/kepler.ts';

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon';

export type SurfaceStyle =
  | 'sun'
  | 'rocky'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'gas'
  | 'ice-giant'
  | 'io'
  | 'europa'
  | 'icy'
  | 'titan'
  | 'pluto';

export interface Surface {
  style: SurfaceStyle;
  /** Main colors, darkest first. */
  palette: string[];
  /** Seed for the procedural texture. */
  seed: number;
  atmosphere?: string;
}

export interface BodyFacts {
  diameterKm: number;
  gravity: string;
  temperature: string;
  moons?: string;
  dayLength: string;
  blurb: string;
  funFact: string;
}

export interface PlanetData {
  id: string;
  name: string;
  kind: BodyKind;
  radiusKm: number;
  /** Axial tilt in degrees. */
  tilt: number;
  /** Sidereal rotation in hours. Negative spins backward. */
  rotationHours: number;
  elements?: OrbitalElements;
  surface: Surface;
  ring?: { inner: number; outer: number; color: string; opacity: number };
  facts: BodyFacts;
}

export const SUN: PlanetData = {
  id: 'sun',
  name: 'Sun',
  kind: 'star',
  radiusKm: 695_700,
  tilt: 7.25,
  rotationHours: 609,
  surface: { style: 'sun', palette: ['#ff7a1a', '#ffc04d', '#fff3c4'], seed: 1 },
  facts: {
    diameterKm: 1_391_400,
    gravity: '274 m/s²',
    temperature: '5,500 °C surface',
    dayLength: '25 days at the equator',
    blurb: 'A middle-aged star that holds 99.8 percent of the mass in the solar system.',
    funFact: 'Light from the surface takes about 8 minutes and 20 seconds to reach Earth.',
  },
};

export const PLANETS: PlanetData[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    kind: 'planet',
    radiusKm: 2439.7,
    tilt: 0.03,
    rotationHours: 1407.6,
    elements: {
      a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.2503235, lp: 77.45779628, node: 48.33076593,
      rates: { a: 0.00000037, e: 0.00001906, i: -0.00594749, L: 149472.67411175, lp: 0.16047689, node: -0.12534081 },
    },
    surface: { style: 'rocky', palette: ['#4a433d', '#8c8279', '#c9beb0'], seed: 11 },
    facts: {
      diameterKm: 4879,
      gravity: '3.7 m/s²',
      temperature: '-180 to 430 °C',
      moons: 'None',
      dayLength: '59 Earth days',
      blurb: 'The smallest planet and the closest to the Sun, scarred by craters.',
      funFact: 'One day-night cycle lasts two full Mercury years.',
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'planet',
    radiusKm: 6051.8,
    tilt: 177.4,
    rotationHours: -5832.5,
    elements: {
      a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.9790995, lp: 131.60246718, node: 76.67984255,
      rates: { a: 0.0000039, e: -0.00004107, i: -0.0007889, L: 58517.81538729, lp: 0.00268329, node: -0.27769418 },
    },
    surface: { style: 'venus', palette: ['#b98a4a', '#e3c27f', '#f6e7bd'], seed: 23, atmosphere: '#ffd9a0' },
    facts: {
      diameterKm: 12_104,
      gravity: '8.9 m/s²',
      temperature: '465 °C',
      moons: 'None',
      dayLength: '243 Earth days, backward',
      blurb: 'A runaway greenhouse world wrapped in thick sulfuric acid clouds.',
      funFact: 'Venus spins so slowly that its day is longer than its year.',
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    kind: 'planet',
    radiusKm: 6371,
    tilt: 23.44,
    rotationHours: 23.934,
    elements: {
      a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, lp: 102.93768193, node: 0,
      rates: { a: 0.00000562, e: -0.00004392, i: -0.01294668, L: 35999.37244981, lp: 0.32327364, node: 0 },
    },
    surface: { style: 'earth', palette: ['#0b2a5c', '#2f6f3a', '#c2a36b', '#ffffff'], seed: 37, atmosphere: '#6fb4ff' },
    facts: {
      diameterKm: 12_742,
      gravity: '9.8 m/s²',
      temperature: '15 °C average',
      moons: '1',
      dayLength: '23 h 56 min',
      blurb: 'The only world known to host life, with oceans covering most of its surface.',
      funFact: 'Earth travels around the Sun at about 30 kilometers every second.',
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    kind: 'planet',
    radiusKm: 3389.5,
    tilt: 25.19,
    rotationHours: 24.623,
    elements: {
      a: 1.52371034, e: 0.0933941, i: 1.84969142, L: -4.55343205, lp: -23.94362959, node: 49.55953891,
      rates: { a: 0.00001847, e: 0.00007882, i: -0.00813131, L: 19140.30268499, lp: 0.44441088, node: -0.29257343 },
    },
    surface: { style: 'mars', palette: ['#5a2414', '#b4532a', '#e0a070'], seed: 41, atmosphere: '#ffb18a' },
    facts: {
      diameterKm: 6779,
      gravity: '3.7 m/s²',
      temperature: '-63 °C average',
      moons: '2',
      dayLength: '24 h 37 min',
      blurb: 'A cold desert world with the tallest volcano and deepest canyon known.',
      funFact: 'Olympus Mons rises about 22 kilometers, nearly three times Everest.',
    },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'planet',
    radiusKm: 69_911,
    tilt: 3.13,
    rotationHours: 9.925,
    elements: {
      a: 5.202887, e: 0.04838624, i: 1.30439695, L: 34.39644051, lp: 14.72847983, node: 100.47390909,
      rates: { a: -0.00011607, e: -0.00013253, i: -0.00183714, L: 3034.74612775, lp: 0.21252668, node: 0.20469106 },
    },
    surface: { style: 'gas', palette: ['#8a5a3a', '#c99b6d', '#efe0c4', '#b5502f'], seed: 53 },
    facts: {
      diameterKm: 139_820,
      gravity: '24.8 m/s²',
      temperature: '-110 °C cloud tops',
      moons: '95+ known',
      dayLength: '9 h 56 min',
      blurb: 'The giant of the system, more massive than all other planets combined.',
      funFact: 'Its great red storm has raged for centuries and is wider than Earth.',
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'planet',
    radiusKm: 58_232,
    tilt: 26.73,
    rotationHours: 10.656,
    elements: {
      a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, lp: 92.59887831, node: 113.66242448,
      rates: { a: -0.0012506, e: -0.00050991, i: 0.00193609, L: 1222.49362201, lp: -0.41897216, node: -0.28867794 },
    },
    surface: { style: 'gas', palette: ['#a88a5a', '#d9c08a', '#f3e6bf', '#c9a873'], seed: 67 },
    ring: { inner: 1.24, outer: 2.27, color: '#e6d3a3', opacity: 0.9 },
    facts: {
      diameterKm: 116_460,
      gravity: '10.4 m/s²',
      temperature: '-140 °C cloud tops',
      moons: 'Nearly 300 known',
      dayLength: '10 h 39 min',
      blurb: 'A gas giant crowned by bright rings of ice and rock.',
      funFact: 'Saturn is less dense than water. The rings are often only tens of meters thick.',
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    kind: 'planet',
    radiusKm: 25_362,
    tilt: 97.77,
    rotationHours: -17.24,
    elements: {
      a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, lp: 170.9542763, node: 74.01692503,
      rates: { a: -0.00196176, e: -0.00004397, i: -0.00242939, L: 428.48202785, lp: 0.40805281, node: 0.04240589 },
    },
    surface: { style: 'ice-giant', palette: ['#7fc4cf', '#a9e1e6', '#d6f5f5'], seed: 71, atmosphere: '#b8f2f5' },
    ring: { inner: 1.6, outer: 2.0, color: '#9fb6bd', opacity: 0.35 },
    facts: {
      diameterKm: 50_724,
      gravity: '8.9 m/s²',
      temperature: '-195 °C',
      moons: '29 known',
      dayLength: '17 h 14 min, backward',
      blurb: 'An ice giant tipped on its side, rolling around the Sun.',
      funFact: 'Each pole gets about 42 years of sunlight, then 42 years of dark.',
    },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    kind: 'planet',
    radiusKm: 24_622,
    tilt: 28.32,
    rotationHours: 16.11,
    elements: {
      a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, lp: 44.96476227, node: 131.78422574,
      rates: { a: 0.00026291, e: 0.00005105, i: 0.00035372, L: 218.45945325, lp: -0.32241464, node: -0.00508664 },
    },
    surface: { style: 'ice-giant', palette: ['#1d3fa8', '#3f6fe0', '#8fb4ff'], seed: 83, atmosphere: '#6f9bff' },
    facts: {
      diameterKm: 49_244,
      gravity: '11.2 m/s²',
      temperature: '-200 °C',
      moons: '16 known',
      dayLength: '16 h 7 min',
      blurb: 'The most distant planet, deep blue and swept by supersonic winds.',
      funFact: 'Winds reach about 2,000 kilometers per hour, the fastest in the system.',
    },
  },
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf',
    radiusKm: 1188.3,
    tilt: 122.5,
    rotationHours: -153.3,
    elements: {
      a: 39.48211675, e: 0.2488273, i: 17.14001206, L: 238.92903833, lp: 224.06891629, node: 110.30393684,
      rates: { a: -0.00031596, e: 0.0000517, i: 0.00004818, L: 145.20780515, lp: -0.04062942, node: -0.01183482 },
    },
    surface: { style: 'pluto', palette: ['#5b4636', '#b89a7a', '#f1e4d0'], seed: 97 },
    facts: {
      diameterKm: 2377,
      gravity: '0.62 m/s²',
      temperature: '-230 °C',
      moons: '5',
      dayLength: '6.4 Earth days, backward',
      blurb: 'A dwarf planet of nitrogen ice plains and water ice mountains.',
      funFact: 'Pluto has not finished one orbit since it was found in 1930.',
    },
  },
];
