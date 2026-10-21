import type { IslandParams } from '../params/island';
import type { IslandField } from './island';
import { poolBasin } from './pools';
import type { WaterSystem } from './water';

/**
 * What covers the ground, as a map (Class 03 masks, combined): running water, forest and how wet
 * the ground is. The terrain shader paints from it (forest floor, streams); grass, trees and shrubs
 * place themselves by it. Pure: same field and water, same map.
 *
 * Forest grows on gentle and moderate ground; it thins on the peaks (their upper flanks are bare
 * granite with a few lone pines) and on the cliff edge, opens into meadow clearings where a
 * low-frequency noise says so, and closes in again along the streams, where the ground is wet.
 * Penglai keeps forest to 10–20% of its top (owner's choice: Huangshan's scenic area is 98% forest,
 * but here the meadow, the rock and open space come first).
 */
export const COVER_SIZE = 512; // texels across: about 2.7 m each on a 500 m island
const CLEARING_SIZE = 140; // metres: about the size of a meadow clearing
const FOREST_SHARE = 0.72; // where the clearing noise is below this, the ground stays open
const BARE_SLOPE: [number, number] = [0.35, 0.7]; // slope (1 - normal.y) over which forest gives way to rock
const BARE_PEAK: [number, number] = [0.2, 0.55]; // share of the peak's height over which forest gives way to rock
const OPEN_RIM: [number, number] = [0.86, 0.96]; // share of the rim radius over which the edge opens
const WET_AREA: [number, number] = [2000, 40000]; // m² upstream from damp to wet ground
const WET_FOREST = 0.25; // how much forest the wettest ground holds outside the groves

export interface LandCover {
  size: number;
  /** Half-width of the square the map covers, metres. */
  extent: number;
  /** RGBA bytes: R running water (coverage), G forest density, B wetness, A unused. */
  data: Uint8Array;
  /** Bilinear lookup, 0..1 each. */
  at(x: number, z: number): { water: number; forest: number; wet: number };
}

export function createLandCover(field: IslandField, p: IslandParams, water: WaterSystem): LandCover {
  const size = COVER_SIZE;
  const extent = p.radius * 1.4;
  const texel = (2 * extent) / size;
  const data = new Uint8Array(size * size * 4);
  const centre = (i: number) => -extent + (i + 0.5) * texel;
  // Ground heights once per texel; slopes from the neighbouring texels.
  const heights = new Float64Array(size * size).fill(NaN);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) heights[j * size + i] = field.top(centre(i), centre(j)) ?? NaN;
  const hAt = (i: number, j: number, fallback: number) => {
    const v = heights[Math.min(Math.max(j, 0), size - 1) * size + Math.min(Math.max(i, 0), size - 1)];
    return Number.isNaN(v) ? fallback : v;
  };

  // Forest and wetness, texel by texel.
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = centre(i), z = centre(j);
      const y = heights[j * size + i];
      if (Number.isNaN(y)) continue;
      const gx = (hAt(i + 1, j, y) - hAt(i - 1, j, y)) / (2 * texel), gz = (hAt(i, j + 1, y) - hAt(i, j - 1, y)) / (2 * texel);
      const g = Math.hypot(gx, gz);
      const slope = 1 - 1 / Math.sqrt(1 + g * g);
      const onPeak = field.lift(x, z) / Math.max(p.peakHeight, 1);
      const rho = Math.hypot(x, z) / field.rim(Math.atan2(z, x));
      const area = water.areaAt(x, z);
      const wet = smooth(Math.log(WET_AREA[0]), Math.log(WET_AREA[1]), Math.log(area + 1));
      const clearing = smooth(FOREST_SHARE - 0.1, FOREST_SHARE + 0.1, field.noise(x / CLEARING_SIZE + 17, z / CLEARING_SIZE - 41) * 0.5 + 0.5);
      const ground = (1 - smooth(BARE_SLOPE[0], BARE_SLOPE[1], slope)) * (1 - smooth(BARE_PEAK[0], BARE_PEAK[1], onPeak)) * (1 - smooth(OPEN_RIM[0], OPEN_RIM[1], rho));
      const forest = poolBasin(field.pools, x, z) > 0 ? 0 : ground * Math.max(clearing, wet * WET_FOREST);
      const k = (j * size + i) * 4;
      data[k + 1] = Math.round(forest * 255);
      data[k + 2] = Math.round(wet * 255);
      data[k + 3] = 255;
    }
  }

  // Running water: each stream segment covers the texels within half its width (soft by a texel).
  const toTexel = (v: number) => (v + extent) / texel - 0.5;
  for (const line of water.streams) {
    for (let s = 0; s < line.length - 1; s++) {
      const a = line[s], b = line[s + 1];
      const half = Math.max(a.width, b.width) / 2;
      const reach = half / texel + 1.5;
      const ax = toTexel(a.x), az = toTexel(a.z), bx = toTexel(b.x), bz = toTexel(b.z);
      const i0 = Math.max(Math.floor(Math.min(ax, bx) - reach), 0), i1 = Math.min(Math.ceil(Math.max(ax, bx) + reach), size - 1);
      const j0 = Math.max(Math.floor(Math.min(az, bz) - reach), 0), j1 = Math.min(Math.ceil(Math.max(az, bz) + reach), size - 1);
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const t = Math.min(Math.max(((i - ax) * dx + (j - az) * dz) / len2, 0), 1);
          const d = Math.hypot(i - (ax + dx * t), j - (az + dz * t)) * texel;
          const w = (a.width + (b.width - a.width) * t) / 2;
          // Coverage of a texel by the channel: a channel narrower than a texel still shows, fainter.
          const cover = Math.min(Math.max((w - d) / texel + 0.5, 0), 1) * Math.min(1, (2 * w) / texel + 0.3);
          const k = (j * size + i) * 4;
          data[k] = Math.max(data[k], Math.round(cover * 255));
          data[k + 1] = Math.round(data[k + 1] * (1 - cover)); // no trees standing in the water
        }
      }
    }
  }

  const at = (x: number, z: number) => {
    const fx = toTexel(x), fz = toTexel(z);
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= size - 1 || j >= size - 1) return { water: 0, forest: 0, wet: 0 };
    const u = fx - i, v = fz - j;
    const c = (ch: number) => {
      const s = (ii: number, jj: number) => data[(jj * size + ii) * 4 + ch];
      return ((s(i, j) * (1 - u) + s(i + 1, j) * u) * (1 - v) + (s(i, j + 1) * (1 - u) + s(i + 1, j + 1) * u) * v) / 255;
    };
    return { water: c(0), forest: c(1), wet: c(2) };
  };
  return { size, extent, data, at };
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
