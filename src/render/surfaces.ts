import type { Surface, SurfaceStyle } from '../data/planets.ts';
import type { Noise3D } from './noise.ts';

export type Rgb = [number, number, number];

export interface SurfacePoint {
  /** Unit sphere position. */
  x: number;
  y: number;
  z: number;
  /** Latitude in radians, -PI/2 at the south pole. */
  lat: number;
  /** Longitude in radians, 0 to 2 PI. */
  lon: number;
}

type Painter = (p: SurfacePoint, noise: Noise3D, palette: Rgb[], surface: Surface) => Rgb;

const WHITE: Rgb = [255, 255, 255];
const DEG = Math.PI / 180;

/** Parse a #rrggbb color. */
export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Blend two colors. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(Math.max(t, 0), 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Sample a color ramp at t in [0, 1]. */
export function ramp(colors: Rgb[], t: number): Rgb {
  const k = Math.min(Math.max(t, 0), 1) * (colors.length - 1);
  const index = Math.min(Math.floor(k), colors.length - 2);
  return mix(colors[index], colors[index + 1], k - index);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Stretch noise around its midpoint so textures use the full ramp. */
function contrast(value: number, amount: number): number {
  return Math.min(Math.max((value - 0.5) * amount + 0.5, 0), 1);
}

function craters(p: SurfacePoint, noise: Noise3D, scale: number): number {
  const c = noise.sample(p.x * scale + 40, p.y * scale + 40, p.z * scale + 40);
  const floor = smoothstep(0.7, 0.78, c);
  const rim = smoothstep(0.62, 0.7, c) - floor;
  return rim * 0.25 - floor * 0.3;
}

const rocky: Painter = (p, noise, palette) => {
  const base = contrast(noise.fbm(p.x * 2.4, p.y * 2.4, p.z * 2.4, 6), 2.2);
  const pits = craters(p, noise, 7) + craters(p, noise, 15) * 0.6;
  return ramp(palette, base + pits);
};

const icy: Painter = (p, noise, palette) => {
  const base = contrast(noise.fbm(p.x * 2, p.y * 2, p.z * 2, 5), 1.8);
  const ridge = 1 - Math.abs(noise.fbm(p.x * 5, p.y * 5, p.z * 5, 4) - 0.5) * 2;
  return ramp(palette, base * 0.6 + smoothstep(0.8, 1, ridge) * 0.25 + 0.25 + craters(p, noise, 10));
};

const venus: Painter = (p, noise, palette) => {
  const warp = noise.fbm(p.x * 2, p.y * 2, p.z * 2, 4) - 0.5;
  const swirl = noise.fbm(p.x * 1.4 + warp * 1.6, p.y * 5 + warp * 2.4, p.z * 1.4 + warp * 1.6, 5);
  return ramp(palette, contrast(swirl, 2));
};

const earth: Painter = (p, noise, palette) => {
  const [ocean, forest, desert, ice] = palette;
  const height = noise.fbm(p.x * 1.9 + 3, p.y * 1.9 + 3, p.z * 1.9 + 3, 7);
  const polar = Math.abs(p.lat) / (Math.PI / 2) + (noise.fbm(p.x * 6, p.y * 6, p.z * 6, 3) - 0.5) * 0.18;
  if (polar > 0.86) return ice;
  if (height < 0.53) {
    const depth = smoothstep(0.3, 0.53, height);
    return mix(ocean, [38, 110, 168], depth * depth);
  }
  const dryness = noise.fbm(p.x * 3 + 9, p.y * 3 + 9, p.z * 3 + 9, 4);
  const arid = smoothstep(0.45, 0.62, dryness) * (1 - smoothstep(0.35, 0.7, Math.abs(p.lat)));
  const land = mix(forest, desert, arid);
  const peak = smoothstep(0.66, 0.78, height);
  return mix(mix(land, [110, 98, 84], peak), ice, smoothstep(0.7, 0.86, polar));
};

const mars: Painter = (p, noise, palette) => {
  const base = contrast(noise.fbm(p.x * 2.2, p.y * 2.2, p.z * 2.2, 6), 2.4);
  const dark = smoothstep(0.55, 0.4, noise.fbm(p.x * 1.3 + 5, p.y * 1.3 + 5, p.z * 1.3 + 5, 4));
  const color = mix(ramp(palette, base * 0.7 + 0.3), palette[0], dark * 0.65);
  const cap = Math.abs(p.lat) / (Math.PI / 2) + (noise.sample(p.x * 8, p.y * 8, p.z * 8) - 0.5) * 0.08;
  return mix(color, WHITE, smoothstep(0.84, 0.9, cap) + craters(p, noise, 9) * 0.3);
};

function storm(p: SurfacePoint, latDeg: number, lonDeg: number, width: number, height: number): number {
  const dLat = (p.lat - latDeg * DEG) / (height * DEG);
  let dLon = p.lon - lonDeg * DEG;
  if (dLon > Math.PI) dLon -= Math.PI * 2;
  return 1 - smoothstep(0.6, 1, Math.hypot(dLat, dLon / (width * DEG)));
}

const gas: Painter = (p, noise, palette, surface) => {
  const turbulence = noise.fbm(p.x * 3, p.y * 9, p.z * 3, 5) - 0.5;
  const band = p.lat * 5.5 + turbulence * 0.9;
  const stripes = noise.fbm(band * 1.7 + surface.seed, 0.3, 0.7, 3);
  const wisps = noise.fbm(p.x * 8 + band, p.y * 30, p.z * 8, 4) - 0.5;
  let color = ramp(palette.slice(0, 3), contrast(stripes, 3) + wisps * 0.2);
  const accent = smoothstep(0.55, 0.75, noise.sample(band * 0.9 + 20, 1.5, 2.5));
  color = mix(color, palette[3], accent * 0.45);
  if (surface.seed === 53) color = mix(color, palette[3], storm(p, -22, 200, 14, 7) * 0.9);
  return color;
};

const iceGiant: Painter = (p, noise, palette, surface) => {
  const band = noise.fbm(p.lat * 4 + surface.seed, 0.5, 0.5, 3);
  const haze = noise.fbm(p.x * 2, p.y * 6, p.z * 2, 4) - 0.5;
  let color = ramp(palette, contrast(band, 1.5) * 0.7 + 0.15 + haze * 0.15);
  if (surface.seed === 83) color = mix(color, palette[0], storm(p, -20, 120, 12, 6) * 0.7);
  return color;
};

const io: Painter = (p, noise, palette) => {
  const base = contrast(noise.fbm(p.x * 2.6, p.y * 2.6, p.z * 2.6, 5), 2.2);
  const vents = noise.sample(p.x * 9 + 3, p.y * 9 + 3, p.z * 9 + 3);
  const color = mix(ramp(palette, base * 0.6 + 0.4), [214, 92, 30], smoothstep(0.66, 0.74, vents));
  return mix(color, [30, 20, 14], smoothstep(0.78, 0.84, vents));
};

const europa: Painter = (p, noise, palette) => {
  const base = contrast(noise.fbm(p.x * 2, p.y * 2, p.z * 2, 4), 1.6);
  const crackA = Math.abs(noise.fbm(p.x * 4, p.y * 4, p.z * 4, 4) - 0.5);
  const crackB = Math.abs(noise.fbm(p.x * 7 + 11, p.y * 7 + 11, p.z * 7 + 11, 3) - 0.5);
  const lines = 1 - smoothstep(0, 0.035, Math.min(crackA, crackB));
  return mix(ramp(palette.slice(1), base * 0.5 + 0.5), palette[0], lines * 0.75);
};

const titan: Painter = (p, noise, palette) => {
  const haze = noise.fbm(p.x * 1.6, p.y * 4, p.z * 1.6, 4);
  return ramp(palette, contrast(haze, 1.4) * 0.6 + 0.2 + Math.abs(p.lat) * 0.12);
};

const pluto: Painter = (p, noise, palette) => {
  const base = contrast(noise.fbm(p.x * 2.4, p.y * 2.4, p.z * 2.4, 6), 2);
  const belt = (1 - smoothstep(0.1, 0.45, Math.abs(p.lat + 0.15))) * smoothstep(0.4, 0.6, base);
  const plain = storm(p, 15, 180, 38, 30);
  return mix(mix(ramp(palette, base * 0.6 + 0.3), palette[0], belt * 0.7), [250, 240, 226], plain * 0.85);
};

const sun: Painter = (p, noise, palette) => {
  const cells = noise.fbm(p.x * 6, p.y * 6, p.z * 6, 5);
  return ramp(palette, contrast(cells, 2.4));
};

const PAINTERS: Record<SurfaceStyle, Painter> = {
  sun,
  rocky,
  venus,
  earth,
  mars,
  gas,
  'ice-giant': iceGiant,
  io,
  europa,
  icy,
  titan,
  pluto,
};

/** Color of a surface at one point on the sphere. */
export function paintPoint(surface: Surface, noise: Noise3D, palette: Rgb[], point: SurfacePoint): Rgb {
  return PAINTERS[surface.style](point, noise, palette, surface);
}

/** Cloud cover from 0 to 1 for worlds with a separate cloud layer. */
export function cloudCover(noise: Noise3D, p: SurfacePoint): number {
  const warp = noise.fbm(p.x * 2 + 50, p.y * 2 + 50, p.z * 2 + 50, 3) - 0.5;
  const cover = noise.fbm(p.x * 3 + warp * 2, p.y * 5 + warp, p.z * 3 + warp * 2, 6);
  return smoothstep(0.5, 0.72, cover);
}
