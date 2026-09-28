import type { Surface } from './planets.ts';

export interface MoonData {
  id: string;
  name: string;
  parent: string;
  radiusKm: number;
  /** Mean distance from the parent's center in km. */
  orbitKm: number;
  /** Sidereal period in days. Negative for retrograde. */
  periodDays: number;
  /** Mean longitude at J2000 in degrees. */
  phaseDeg: number;
  /** Orbit plane. Most large moons circle above the parent's equator. */
  plane: 'equatorial' | 'ecliptic';
  /** Extra tilt of the orbit plane in degrees. */
  inclination: number;
  surface: Surface;
  blurb: string;
  funFact: string;
}

export const MOONS: MoonData[] = [
  {
    id: 'moon', name: 'Moon', parent: 'earth', radiusKm: 1737.4, orbitKm: 384_400, periodDays: 27.3217,
    phaseDeg: 218.32, plane: 'ecliptic', inclination: 5.14,
    surface: { style: 'rocky', palette: ['#3d3d40', '#8d8c8a', '#d6d3cc'], seed: 101 },
    blurb: 'Our only natural satellite, and the only other world people have walked on.',
    funFact: 'The Moon drifts away from Earth by about 3.8 centimeters each year.',
  },
  {
    id: 'phobos', name: 'Phobos', parent: 'mars', radiusKm: 11.3, orbitKm: 9376, periodDays: 0.3189,
    phaseDeg: 35, plane: 'equatorial', inclination: 1.1,
    surface: { style: 'rocky', palette: ['#2e2823', '#6b5d52', '#9a897a'], seed: 103 },
    blurb: 'A small, dark, lumpy moon that skims low over Mars.',
    funFact: 'It orbits faster than Mars spins, so it rises in the west.',
  },
  {
    id: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6.2, orbitKm: 23_463, periodDays: 1.2624,
    phaseDeg: 190, plane: 'equatorial', inclination: 1.8,
    surface: { style: 'rocky', palette: ['#3a322b', '#7d6e60', '#ab9a88'], seed: 107 },
    blurb: 'The smaller and farther of the two Martian moons.',
    funFact: 'Its gravity is so weak you could jump off it.',
  },
  {
    id: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1821.6, orbitKm: 421_700, periodDays: 1.7691,
    phaseDeg: 106, plane: 'equatorial', inclination: 0.04,
    surface: { style: 'io', palette: ['#6b3a12', '#d9a62e', '#f4e27a'], seed: 109 },
    blurb: 'The most volcanic world known, painted yellow and orange by sulfur.',
    funFact: 'Tides from Jupiter flex its surface by up to 100 meters.',
  },
  {
    id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1560.8, orbitKm: 671_034, periodDays: 3.5512,
    phaseDeg: 176, plane: 'equatorial', inclination: 0.47,
    surface: { style: 'europa', palette: ['#8a5a3c', '#d9cdb8', '#f7f3ea'], seed: 113 },
    blurb: 'An ice shell laced with cracks, hiding a salty global ocean.',
    funFact: 'Its ocean may hold twice the water of all the seas on Earth.',
  },
  {
    id: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2634.1, orbitKm: 1_070_412, periodDays: 7.1546,
    phaseDeg: 121, plane: 'equatorial', inclination: 0.2,
    surface: { style: 'icy', palette: ['#4a4038', '#8f8377', '#d1c8bb'], seed: 127 },
    blurb: 'The largest moon in the solar system, bigger than Mercury.',
    funFact: 'It is the only moon known to make its own magnetic field.',
  },
  {
    id: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2410.3, orbitKm: 1_882_709, periodDays: 16.689,
    phaseDeg: 85, plane: 'equatorial', inclination: 0.19,
    surface: { style: 'rocky', palette: ['#2b2621', '#5e5449', '#a3978a'], seed: 131 },
    blurb: 'A dark, ancient moon with one of the most cratered surfaces known.',
    funFact: 'Its surface has barely changed in about four billion years.',
  },
  {
    id: 'mimas', name: 'Mimas', parent: 'saturn', radiusKm: 198.2, orbitKm: 185_539, periodDays: 0.9424,
    phaseDeg: 15, plane: 'equatorial', inclination: 1.57,
    surface: { style: 'icy', palette: ['#77746f', '#b9b6b0', '#ecebe7'], seed: 137 },
    blurb: 'A small ice moon marked by one huge impact crater.',
    funFact: 'The crater Herschel spans almost a third of its width.',
  },
  {
    id: 'enceladus', name: 'Enceladus', parent: 'saturn', radiusKm: 252.1, orbitKm: 237_948, periodDays: 1.3702,
    phaseDeg: 200, plane: 'equatorial', inclination: 0.02,
    surface: { style: 'icy', palette: ['#b9c7d1', '#e6eef3', '#ffffff'], seed: 139 },
    blurb: 'A brilliant white moon that sprays water ice into space.',
    funFact: 'Its geysers feed one of the rings of Saturn.',
  },
  {
    id: 'tethys', name: 'Tethys', parent: 'saturn', radiusKm: 531.1, orbitKm: 294_619, periodDays: 1.8878,
    phaseDeg: 285, plane: 'equatorial', inclination: 1.12,
    surface: { style: 'icy', palette: ['#8b8984', '#c9c7c1', '#f1f0ec'], seed: 149 },
    blurb: 'A mid-sized moon made almost entirely of water ice.',
    funFact: 'A canyon system runs three quarters of the way around it.',
  },
  {
    id: 'dione', name: 'Dione', parent: 'saturn', radiusKm: 561.4, orbitKm: 377_396, periodDays: 2.7369,
    phaseDeg: 60, plane: 'equatorial', inclination: 0.02,
    surface: { style: 'icy', palette: ['#7c7a76', '#bdbab4', '#e9e7e2'], seed: 151 },
    blurb: 'An icy moon streaked with bright cliffs of fractured ice.',
    funFact: 'It shares its orbit with two tiny companion moons.',
  },
  {
    id: 'rhea', name: 'Rhea', parent: 'saturn', radiusKm: 763.8, orbitKm: 527_108, periodDays: 4.5182,
    phaseDeg: 140, plane: 'equatorial', inclination: 0.35,
    surface: { style: 'icy', palette: ['#76736e', '#b5b2ab', '#e4e2dc'], seed: 157 },
    blurb: 'The second largest moon of Saturn, heavily cratered and cold.',
    funFact: 'It has a thin atmosphere of oxygen and carbon dioxide.',
  },
  {
    id: 'titan', name: 'Titan', parent: 'saturn', radiusKm: 2574.7, orbitKm: 1_221_870, periodDays: 15.945,
    phaseDeg: 250, plane: 'equatorial', inclination: 0.35,
    surface: { style: 'titan', palette: ['#8a5a1e', '#d99a3a', '#f2c46a'], seed: 163, atmosphere: '#ffb347' },
    blurb: 'A moon with a thick orange atmosphere and lakes of liquid methane.',
    funFact: 'It is the only moon with a dense atmosphere, thicker than the air on Earth.',
  },
  {
    id: 'iapetus', name: 'Iapetus', parent: 'saturn', radiusKm: 734.5, orbitKm: 3_560_820, periodDays: 79.3215,
    phaseDeg: 320, plane: 'equatorial', inclination: 15.47,
    surface: { style: 'rocky', palette: ['#1f1a16', '#7d746a', '#eae5dc'], seed: 167 },
    blurb: 'A two-toned moon with one bright side and one coal-dark side.',
    funFact: 'A mountain ridge runs along its equator like a seam.',
  },
  {
    id: 'miranda', name: 'Miranda', parent: 'uranus', radiusKm: 235.8, orbitKm: 129_390, periodDays: 1.4135,
    phaseDeg: 30, plane: 'equatorial', inclination: 4.34,
    surface: { style: 'icy', palette: ['#5f6266', '#a4a8ad', '#dadde0'], seed: 173 },
    blurb: 'A small moon with a patchwork surface of ridges and canyons.',
    funFact: 'One cliff, Verona Rupes, may be 20 kilometers tall.',
  },
  {
    id: 'ariel', name: 'Ariel', parent: 'uranus', radiusKm: 578.9, orbitKm: 191_020, periodDays: 2.5204,
    phaseDeg: 115, plane: 'equatorial', inclination: 0.04,
    surface: { style: 'icy', palette: ['#6e7072', '#b4b6b8', '#e6e7e8'], seed: 179 },
    blurb: 'The brightest of the large moons of Uranus.',
    funFact: 'Its valleys look like they were once flooded by icy lava.',
  },
  {
    id: 'umbriel', name: 'Umbriel', parent: 'uranus', radiusKm: 584.7, orbitKm: 266_300, periodDays: 4.1442,
    phaseDeg: 205, plane: 'equatorial', inclination: 0.13,
    surface: { style: 'rocky', palette: ['#25262a', '#55575c', '#8d9096'], seed: 181 },
    blurb: 'The darkest of the large moons of Uranus.',
    funFact: 'A single bright ring marks the floor of one of its craters.',
  },
  {
    id: 'titania', name: 'Titania', parent: 'uranus', radiusKm: 788.4, orbitKm: 435_910, periodDays: 8.7059,
    phaseDeg: 290, plane: 'equatorial', inclination: 0.08,
    surface: { style: 'icy', palette: ['#5d5a57', '#a29d98', '#d7d2cc'], seed: 191 },
    blurb: 'The largest moon of Uranus, cut by huge fault valleys.',
    funFact: 'It may hide a thin layer of liquid water deep inside.',
  },
  {
    id: 'oberon', name: 'Oberon', parent: 'uranus', radiusKm: 761.4, orbitKm: 583_520, periodDays: 13.4632,
    phaseDeg: 10, plane: 'equatorial', inclination: 0.07,
    surface: { style: 'rocky', palette: ['#3b3432', '#7f7571', '#b9afa9'], seed: 193 },
    blurb: 'The outermost large moon of Uranus, old and heavily cratered.',
    funFact: 'Some crater floors are coated with a dark mystery material.',
  },
  {
    id: 'triton', name: 'Triton', parent: 'neptune', radiusKm: 1353.4, orbitKm: 354_759, periodDays: -5.8769,
    phaseDeg: 75, plane: 'equatorial', inclination: 23,
    surface: { style: 'icy', palette: ['#8a6f6a', '#d3b9b0', '#f4e6e0'], seed: 197 },
    blurb: 'A captured world that orbits Neptune backward.',
    funFact: 'Nitrogen geysers erupt from its surface at -235 °C.',
  },
  {
    id: 'charon', name: 'Charon', parent: 'pluto', radiusKm: 606, orbitKm: 19_591, periodDays: 6.3872,
    phaseDeg: 150, plane: 'equatorial', inclination: 0,
    surface: { style: 'rocky', palette: ['#443a36', '#8d827c', '#c9c0b9'], seed: 199 },
    blurb: 'Half the width of Pluto, close enough to be called a double world.',
    funFact: 'Pluto and Charon always show each other the same face.',
  },
];
