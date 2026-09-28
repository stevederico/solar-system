/** Small seeded random generator (mulberry32). Returns values in [0, 1). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TABLE_SIZE = 256;
const TABLE_MASK = TABLE_SIZE - 1;

export interface Noise3D {
  /** Smooth value noise in [0, 1]. */
  sample(x: number, y: number, z: number): number;
  /** Layered noise in [0, 1]. Each octave doubles the detail. */
  fbm(x: number, y: number, z: number, octaves: number): number;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Build a seeded 3D value noise sampler. */
export function createNoise(seed: number): Noise3D {
  const random = createRandom(seed);
  const values = new Float32Array(TABLE_SIZE);
  const perm = new Uint8Array(TABLE_SIZE * 2);
  const order = Array.from({ length: TABLE_SIZE }, (_, n) => n);
  for (let n = TABLE_SIZE - 1; n > 0; n--) {
    const swap = Math.floor(random() * (n + 1));
    [order[n], order[swap]] = [order[swap], order[n]];
  }
  for (let n = 0; n < TABLE_SIZE; n++) {
    values[n] = random();
    perm[n] = perm[n + TABLE_SIZE] = order[n];
  }

  const corner = (x: number, y: number, z: number): number =>
    values[perm[perm[perm[x & TABLE_MASK] + (y & TABLE_MASK)] + (z & TABLE_MASK)]];

  const sample = (x: number, y: number, z: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const u = fade(x - x0);
    const v = fade(y - y0);
    const w = fade(z - z0);
    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
    const near = lerp(
      lerp(corner(x0, y0, z0), corner(x0 + 1, y0, z0), u),
      lerp(corner(x0, y0 + 1, z0), corner(x0 + 1, y0 + 1, z0), u),
      v,
    );
    const far = lerp(
      lerp(corner(x0, y0, z0 + 1), corner(x0 + 1, y0, z0 + 1), u),
      lerp(corner(x0, y0 + 1, z0 + 1), corner(x0 + 1, y0 + 1, z0 + 1), u),
      v,
    );
    return lerp(near, far, w);
  };

  const fbm = (x: number, y: number, z: number, octaves: number): number => {
    let total = 0;
    let weight = 0.5;
    let scale = 1;
    let norm = 0;
    for (let n = 0; n < octaves; n++) {
      total += weight * sample(x * scale + n * 17.1, y * scale + n * 9.3, z * scale + n * 5.7);
      norm += weight;
      weight *= 0.5;
      scale *= 2;
    }
    return total / norm;
  };

  return { sample, fbm };
}
