/**
 * noise.ts
 * --------
 * Self-contained implementations of:
 *  • Perlin noise (classic gradient noise)
 *  • Value  noise (interpolated random grid)
 *  • Worley noise (distance-to-feature-point / cellular)
 * Plus a Fractal Brownian Motion (fBm) wrapper.
 *
 * All functions return values in the range  –1 … +1.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10); // Ken Perlin's 6t⁵−15t⁴+10t³
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// ─── Perlin Noise ────────────────────────────────────────────────────────────

/** Build a seeded permutation table (256 entries, doubled to 512). */
function buildPerm(seed = 42): Uint8Array {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223;
    const j = ((s >>> 16) & 0xff) % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/** 2-D gradient lookup — maps 2-bit hash to one of four (±1, ±1) gradients. */
function grad2(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Classic 2-D Perlin noise in –1 … +1. */
export function perlinNoise(x: number, y: number, perm: Uint8Array): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[X]     + Y];
  const ba = perm[perm[X + 1] + Y];
  const ab = perm[perm[X]     + Y + 1];
  const bb = perm[perm[X + 1] + Y + 1];

  return lerp(
    lerp(grad2(aa, xf,     yf),     grad2(ba, xf - 1, yf),     u),
    lerp(grad2(ab, xf,     yf - 1), grad2(bb, xf - 1, yf - 1), u),
    v
  );
}

// ─── Value Noise ─────────────────────────────────────────────────────────────

/** Integer hash → pseudo-random [0, 1]. */
function intHash(nx: number, ny: number): number {
  let n = (nx * 374761393 + ny * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}

/** Value noise — bicubic-interpolated random grid, returns –1 … +1. */
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = smoothstep(xf);
  const sy = smoothstep(yf);

  const v00 = intHash(xi,     yi);
  const v10 = intHash(xi + 1, yi);
  const v01 = intHash(xi,     yi + 1);
  const v11 = intHash(xi + 1, yi + 1);

  const val =
    v00 * (1 - sx) * (1 - sy) +
    v10 * sx       * (1 - sy) +
    v01 * (1 - sx) * sy       +
    v11 * sx       * sy;

  return val * 2 - 1; // 0…1  →  –1…+1
}

// ─── Worley (Cellular) Noise ──────────────────────────────────────────────────

/** Deterministic but pseudo-random offset for cell (nx, ny). */
function cellPoint(nx: number, ny: number, axis: number): number {
  const v = Math.sin(nx * 127.1 + ny * 311.7 + axis * 43.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Worley / cellular noise.
 * Returns –1 at cell centres (near a feature point) and +1 between cells.
 */
export function worleyNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let minDist = Infinity;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = xi + dx;
      const ny = yi + dy;
      const px = nx + cellPoint(nx, ny, 0);
      const py = ny + cellPoint(nx, ny, 1);
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < minDist) minDist = dist;
    }
  }

  // minDist is typically 0…~1.4; clamp to 0…1 then map to –1…+1
  const t = Math.min(minDist, 1);
  return 1 - t * 2; // 1 at centres, –1 at edges
}

// ─── fBm Wrapper ─────────────────────────────────────────────────────────────

/** Fractal Brownian Motion: stacks `octaves` of the same noise at increasing frequencies. */
export function fbm(
  x: number,
  y: number,
  baseFn: (x: number, y: number) => number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  let value    = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmp    = 0;

  for (let i = 0; i < octaves; i++) {
    value   += baseFn(x * frequency, y * frequency) * amplitude;
    maxAmp  += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmp; // normalised back to –1…+1
}

// ─── Seeded noise factories ───────────────────────────────────────────────────

// ─── Cellular (F2 − F1) Noise ────────────────────────────────────────────────

/**
 * Cellular noise using the F2−F1 metric.
 * F1 = distance to nearest point, F2 = distance to second-nearest point.
 * F2−F1 produces sharp veins/cracks between cells rather than filled blobs.
 * Returns –1…+1.
 */
export function cellularNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = Infinity; // nearest
  let f2 = Infinity; // second-nearest

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = xi + dx;
      const ny = yi + dy;
      const px = nx + cellPoint(nx, ny, 0);
      const py = ny + cellPoint(nx, ny, 1);
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < f1) { f2 = f1; f1 = dist; }
      else if (dist < f2) { f2 = dist; }
    }
  }

  // F2−F1 is in roughly 0…1; clamp and map to –1…+1
  const t = Math.min(f2 - f1, 1);
  return t * 2 - 1;
}

// ─── Seeded noise factories ───────────────────────────────────────────────────

/** Call once to get bound noise functions for a given seed. */
export function createNoiseFunctions(seed = 42) {
  const perm = buildPerm(seed);
  return {
    perlin:   (x: number, y: number) => perlinNoise(x, y, perm),
    value:    (x: number, y: number) => valueNoise(x, y),
    worley:   (x: number, y: number) => worleyNoise(x, y),
    cellular: (x: number, y: number) => cellularNoise(x, y),
  };
}
