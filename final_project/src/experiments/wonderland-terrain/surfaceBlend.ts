import { createNoise2D } from '../../core/noise';
import { ZONE, ZONE_CELL, type Zones } from './zones';

/**
 * Continuous surface material weights from discrete zone labels.
 * Labels stay discrete for rules; visible wet/litter/terrace/rock mixes use these soft weights
 * (LinearFilter in the shader) with a metre-scale edge and low-freq world noise — not ID lerp.
 */
export const SURFACE_BLEND_M = 14;
const WET_BLEND_M = 5;

export interface SurfaceBlend {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  /** RGBA bytes: R=wet, G=litter, B=terrace, A=rock (cliff+ridge+rockSlope). */
  rgba: Uint8Array;
}

/**
 * A field blurred in place over about `widthM` metres (three box passes each way, near a gaussian).
 * For tints read from zone-grid fields: a value that jumps at a zone's edge otherwise draws the
 * 2 m cells as a staircase.
 */
export function blurField(values: Float32Array, nx: number, nz: number, cell: number, widthM: number): Float32Array {
  const r = Math.max(1, Math.round(widthM / cell / 2));
  const tmp = new Float32Array(values.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let s = 0, c = 0;
      for (let k = Math.max(i - r, 0); k <= Math.min(i + r, nx - 1); k++) { s += values[j * nx + k]; c++; }
      tmp[j * nx + i] = s / c;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let s = 0, c = 0;
      for (let k = Math.max(j - r, 0); k <= Math.min(j + r, nz - 1); k++) { s += tmp[k * nx + i]; c++; }
      values[j * nx + i] = s / c;
    }
  }
  return values;
}

function soft(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Chamfer distance (metres) to cells matching `want`. */
function distTo(zone: Uint8Array, nx: number, nz: number, cell: number, want: (z: number) => boolean): Float32Array {
  const n = nx * nz;
  const dist = new Float32Array(n).fill(1e9);
  for (let t = 0; t < n; t++) if (want(zone[t])) dist[t] = 0;
  const d1 = cell, d2 = cell * Math.SQRT2;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const t = j * nx + i;
      if (i) dist[t] = Math.min(dist[t], dist[t - 1] + d1);
      if (j) dist[t] = Math.min(dist[t], dist[t - nx] + d1);
      if (i && j) dist[t] = Math.min(dist[t], dist[t - nx - 1] + d2);
      if (i + 1 < nx && j) dist[t] = Math.min(dist[t], dist[t - nx + 1] + d2);
    }
  }
  for (let j = nz - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const t = j * nx + i;
      if (i + 1 < nx) dist[t] = Math.min(dist[t], dist[t + 1] + d1);
      if (j + 1 < nz) dist[t] = Math.min(dist[t], dist[t + nx] + d1);
      if (i + 1 < nx && j + 1 < nz) dist[t] = Math.min(dist[t], dist[t + nx + 1] + d2);
      if (i && j + 1 < nz) dist[t] = Math.min(dist[t], dist[t + nx - 1] + d2);
    }
  }
  return dist;
}

function weightFromDist(dist: Float32Array, nx: number, nz: number, x0: number, z0: number, cell: number, blendM: number, noise: (x: number, z: number) => number, wobble = 1): Float32Array {
  const out = new Float32Array(dist.length);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const t = j * nx + i;
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      // Strong low-freq warp (±~8 m) so soft edges do not keep the zone blob's stair outline.
      const warp = (noise(x / 36, z / 36) * 8 + noise(x / 18 + 4, z / 18 - 3) * 3) * wobble;
      out[t] = 1 - soft(0, blendM, dist[t] + warp);
    }
  }
  return out;
}

/** Soft material weights for the zone grid. Water / outside stay zero (hard exclude). */
export function buildSurfaceBlend(zones: Zones, seed: number): SurfaceBlend {
  const { x0, z0, cell, nx, nz, zone } = zones;
  const n = nx * nz;
  const noise = createNoise2D(seed + 911);
  // The wet shore kept close to its zone (a 5 m edge, wandering ±3 m): wider, it washed the
  // meadow grey-green far from any grass.
  const wet = weightFromDist(distTo(zone, nx, nz, cell, (z) => z === ZONE.wetShore), nx, nz, x0, z0, cell, WET_BLEND_M, noise, 0.27);
  const litter = weightFromDist(distTo(zone, nx, nz, cell, (z) => z === ZONE.woodland), nx, nz, x0, z0, cell, SURFACE_BLEND_M, (x, z) => noise(x / 28 + 3, z / 28 - 2));
  const terrace = weightFromDist(distTo(zone, nx, nz, cell, (z) => z === ZONE.terrace), nx, nz, x0, z0, cell, SURFACE_BLEND_M * 0.85, (x, z) => noise(x / 32 - 1, z / 32 + 4));
  const rock = weightFromDist(
    distTo(zone, nx, nz, cell, (z) => z === ZONE.cliff || z === ZONE.ridge || z === ZONE.rockSlope),
    nx, nz, x0, z0, cell, SURFACE_BLEND_M * 0.7,
    (x, z) => noise(x / 22 + 8, z / 22),
  );
  const rgba = new Uint8Array(n * 4);
  for (let t = 0; t < n; t++) {
    const z = zone[t];
    // Hard exclude: never paint surface mixes into water / void (keeps shore / cliff crisp where needed).
    if (z === ZONE.outside || z === ZONE.water) continue;
    rgba[t * 4] = Math.round(Math.min(wet[t], 1) * 255);
    rgba[t * 4 + 1] = Math.round(Math.min(litter[t], 1) * 255);
    rgba[t * 4 + 2] = Math.round(Math.min(terrace[t], 1) * 255);
    rgba[t * 4 + 3] = Math.round(Math.min(rock[t], 1) * 255);
  }
  return { x0, z0, cell: cell || ZONE_CELL, nx, nz, rgba };
}
