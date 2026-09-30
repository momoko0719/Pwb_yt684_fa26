import { createRng, type Rng } from './rng';

/** 2D noise function returning values roughly in [-1, 1]. */
export type Noise2D = (x: number, y: number) => number;

const GRADIENTS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** Simplex noise whose permutation table is shuffled by the given rng or seed. */
export function createNoise2D(source: Rng | number): Noise2D {
  const rng = typeof source === 'number' ? createRng(source) : source;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = Array.from({ length: 512 }, (_, i) => p[i & 255]);

  const corner = (i: number, j: number, x: number, y: number) => {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const [gx, gy] = GRADIENTS[perm[i + perm[j]] & 7];
    return t * t * t * t * (gx * x + gy * y);
  };

  return (x, y) => {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const ii = i & 255;
    const jj = j & 255;
    return 70 * (
      corner(ii, jj, x0, y0) +
      corner(ii + i1, jj + j1, x0 - i1 + G2, y0 - j1 + G2) +
      corner(ii + 1, jj + 1, x0 - 1 + 2 * G2, y0 - 1 + 2 * G2)
    );
  };
}

export interface FbmOptions {
  octaves: number;
  lacunarity?: number;
  gain?: number;
}

/** Fractal Brownian motion: layered octaves, normalized back to roughly [-1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, options: FbmOptions): number {
  const { octaves, lacunarity = 2, gain = 0.5 } = options;
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Offsets a sample point by noise so features bend instead of lining up on a grid. */
export function domainWarp(noise: Noise2D, x: number, y: number, strength: number): [number, number] {
  return [
    x + strength * noise(x + 5.2, y + 1.3),
    y + strength * noise(x - 1.7, y + 9.2),
  ];
}
