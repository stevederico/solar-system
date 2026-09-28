import * as THREE from 'three';
import type { Surface } from '../data/planets.ts';
import { createNoise, createRandom } from './noise.ts';
import { cloudCover, hexToRgb, paintPoint } from './surfaces.ts';
import type { SurfacePoint } from './surfaces.ts';

type PixelPainter = (point: SurfacePoint) => [number, number, number, number];

/** Longest stretch of painting before the page gets a chance to draw a frame. */
const SLICE_MS = 7;

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

async function paintSphere(width: number, height: number, paint: PixelPainter): Promise<HTMLCanvasElement> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(width, height);
  let sliceStart = performance.now();
  for (let row = 0; row < height; row++) {
    if (performance.now() - sliceStart > SLICE_MS) {
      await pause();
      sliceStart = performance.now();
    }
    const lat = (0.5 - (row + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const y = Math.sin(lat);
    for (let col = 0; col < width; col++) {
      const lon = ((col + 0.5) / width) * Math.PI * 2;
      const point = { x: cosLat * Math.cos(lon), y, z: cosLat * Math.sin(lon), lat, lon };
      const [r, g, b, a] = paint(point);
      const offset = (row * width + col) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = a;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** Procedural color map for a body, as an equirectangular texture. Painted in slices. */
export async function createSurfaceTexture(surface: Surface, width: number): Promise<THREE.CanvasTexture> {
  const noise = createNoise(surface.seed);
  const palette = surface.palette.map(hexToRgb);
  const canvas = await paintSphere(width, width / 2, (point) => {
    const [r, g, b] = paintPoint(surface, noise, palette, point);
    return [r, g, b, 255];
  });
  return toTexture(canvas);
}

/** White cloud layer with transparent gaps. */
export async function createCloudTexture(seed: number, width: number): Promise<THREE.CanvasTexture> {
  const noise = createNoise(seed);
  const canvas = await paintSphere(width, width / 2, (point) => [255, 255, 255, cloudCover(noise, point) * 235]);
  return toTexture(canvas);
}

/** Radial strip for planetary rings, with gaps and density bands. */
export function createRingTexture(color: string, seed: number): THREE.CanvasTexture {
  const width = 512;
  const canvas = createCanvas(width, 4);
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(width, 4);
  const noise = createNoise(seed);
  const [r, g, b] = hexToRgb(color);
  for (let col = 0; col < width; col++) {
    const t = col / (width - 1);
    const density = noise.fbm(t * 14, 0.5, 0.5, 4);
    const fine = noise.sample(t * 90, 1.5, 0.5);
    const gap = Math.abs(t - 0.62) < 0.025 ? 0.08 : 1;
    const edge = Math.min(t / 0.06, (1 - t) / 0.06, 1);
    const alpha = Math.max(0, (0.35 + density * 0.9) * (0.7 + fine * 0.3)) * gap * edge;
    const shade = 0.75 + fine * 0.25;
    for (let row = 0; row < 4; row++) {
      const offset = (row * width + col) * 4;
      image.data[offset] = r * shade;
      image.data[offset + 1] = g * shade;
      image.data[offset + 2] = b * shade;
      image.data[offset + 3] = Math.min(255, alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Soft round glow used for the Sun's corona and the probe's engine. */
export function createGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.25, outer);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

export interface StarField {
  positions: Float32Array;
  colors: Float32Array;
}

/** Random stars on a far sphere, denser along a tilted band like the Milky Way. */
export function createStarField(count: number, radius: number, seed: number): StarField {
  const random = createRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tints = [[1, 0.96, 0.9], [0.8, 0.88, 1], [1, 0.85, 0.7], [1, 1, 1]];
  for (let n = 0; n < count; n++) {
    const inBand = random() < 0.45;
    const lon = random() * Math.PI * 2;
    const spread = inBand ? (random() + random() + random() - 1.5) * 0.35 : Math.asin(random() * 2 - 1);
    const x = Math.cos(spread) * Math.cos(lon);
    const y = Math.sin(spread);
    const z = Math.cos(spread) * Math.sin(lon);
    const tilt = 1.05;
    positions[n * 3] = x * radius;
    positions[n * 3 + 1] = (y * Math.cos(tilt) - z * Math.sin(tilt)) * radius;
    positions[n * 3 + 2] = (y * Math.sin(tilt) + z * Math.cos(tilt)) * radius;
    const tint = tints[Math.floor(random() * tints.length)];
    const brightness = 0.35 + Math.pow(random(), 3) * 0.65;
    colors[n * 3] = tint[0] * brightness;
    colors[n * 3 + 1] = tint[1] * brightness;
    colors[n * 3 + 2] = tint[2] * brightness;
  }
  return { positions, colors };
}
