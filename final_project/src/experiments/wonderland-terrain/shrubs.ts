import { createNoise2D } from '../../core/noise';
import { createRng } from '../../core/rng';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import type { RockFolds } from './rockFolds';
import { blurField } from './surfaceBlend';
import { ZONE, type Zones } from './zones';

/**
 * Patches of low shrubs (docs/shrubs-and-fold-colour-2026-10-27.md): the living mass between the
 * pines and the grass, where life would settle first, where soil and water gather. One kind, grey-green.
 *
 * Where a patch is first, then the plants in it:
 *
 * - Patch centres: one candidate per PATCH.cell of a fixed world grid (each cell its own seeded
 *   chance). Its suitability is the best of three places: the range's foot (the fold field's
 *   mountain weight low but rising, the ground gentle), a woodland's edge (woodland near, not its
 *   heart), a damp hollow (moisture high, the water a few metres off). A broad noise lets some
 *   stretches have none, so the patches gather in a few places instead of spreading evenly.
 *   Radius by suitability, 6–15 m; a few small satellites beside the larger ones.
 * - Plants: a jittered grid inside each patch, kept densest at its heart, thinning to its edge, with
 *   gaps (a fine noise); larger plants toward the heart.
 * - Never in water or within KEEP.water of it, on steep ground, the terrace, cliff, ridge, outside,
 *   within a tree's trunk, or in the squares given (the creature's dwelling ground: its routes do
 *   not treat shrubs as obstacles, so none stand there this round).
 *
 * Also a soft field over the zone grid, where the patches lie (their edge frayed and blurred), for
 * the ground under them: one tint per patch, not a disc per plant.
 *
 * Pure: the same zones, ground, folds, trees and seed give the same shrubs.
 */
export const PATCH = { cell: 18, radius: [6, 15] as [number, number], least: 0.35, satellites: 2 };
const PLANT = { spacing: 1.4, height: [0.4, 1.2] as [number, number], width: [1.3, 1.8] as [number, number] };
const KEEP = { water: 3, slope: 0.6, trunk: 1.1 };

/** Colour class: warm grey-olive / ochre / dark iron-red (patch-seeded target weights). */
export type ShrubTone = 0 | 1 | 2;
/** Target rolls: olive 30% · ochre 65% · iron-red 5% (actual patch counts vary by seed). */
export const SHRUB_TONE_WEIGHTS = [0.30, 0.65, 0.05] as const;
/** Shape LOD distances (m, camera→plant): near branch mesh / mid volume / far hull. */
export const SHRUB_LOD = [28, 90] as const;

export interface Shrub {
  x: number;
  y: number;
  z: number;
  height: number;
  /** Width over height. */
  width: number;
  yaw: number;
  /** 0 light to 1 dark within its tone. */
  shade: number;
  /** Shape seed 0..SHRUB_VARIANTS-1. */
  variant: number;
  /** Patch colour class (artistic plant, not a botanical season system). */
  tone: ShrubTone;
}
export interface ShrubPatch { x: number; z: number; r: number; tone: ShrubTone }
export interface ShrubField {
  patches: ShrubPatch[];
  plants: Shrub[];
  /** On the zone grid: how much each cell lies in a patch, 0 to 1 (bytes). */
  ground: Uint8Array;
  ms: number;
}
export const SHRUB_VARIANTS = 3;

/** Configured height range used by generators + resource atlas (metres). */
export const SHRUB_HEIGHT = PLANT.height;
export const SHRUB_WIDTH_RATIO = PLANT.width;

function pickTone(roll: number): ShrubTone {
  if (roll < SHRUB_TONE_WEIGHTS[0]) return 0;
  if (roll < SHRUB_TONE_WEIGHTS[0] + SHRUB_TONE_WEIGHTS[1]) return 1;
  return 2;
}

const ease = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function growShrubs(zones: Zones, grid: HeightGrid, folds: RockFolds, seed: number, trees: { x: number; z: number }[], away: { x0: number; z0: number; size: number }[] = []): ShrubField {
  const t0 = performance.now();
  const { x0, z0, cell, nx, nz, zone, moisture, toWater } = zones;
  const cellOf = (x: number, z: number) => {
    const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < nz ? j * nx + i : -1;
  };
  const slope = (x: number, z: number) => Math.hypot(sampleGrid(grid, x, z, 1), sampleGrid(grid, x, z, 2));
  const mountainAt = (x: number, z: number) => {
    const i = Math.round(x / grid.texel + (grid.size - 1) / 2), j = Math.round(z / grid.texel + (grid.size - 1) / 2);
    return i >= 0 && j >= 0 && i < folds.size && j < folds.size ? folds.rgba[(j * folds.size + i) * 4] / 255 : 0;
  };
  // Woodland nearness: the woodland cells blurred over about 10 m (0 far off, ~0.5 at its edge, 1 deep in).
  const wood = new Float32Array(zone.length);
  for (let t = 0; t < zone.length; t++) wood[t] = zone[t] === ZONE.woodland ? 1 : 0;
  blurField(wood, nx, nz, cell, 10);
  const ground = (x: number, z: number) => {
    const t = cellOf(x, z);
    if (t < 0) return false;
    const k = zone[t];
    if (k === ZONE.outside || k === ZONE.water || k === ZONE.terrace || k === ZONE.cliff || k === ZONE.ridge) return false;
    if (toWater[t] < KEEP.water || slope(x, z) > KEEP.slope) return false;
    return !away.some((a) => x > a.x0 && z > a.z0 && x < a.x0 + a.size && z < a.z0 + a.size);
  };
  const noise = createNoise2D(seed + 733);
  const suitability = (x: number, z: number) => {
    const t = cellOf(x, z);
    if (t < 0 || !ground(x, z)) return 0;
    const m = mountainAt(x, z), s = slope(x, z);
    const foot = ease(0.02, 0.12, m) * (1 - ease(0.35, 0.65, m)) * (1 - ease(0.35, 0.6, s));
    const w = wood[t];
    const edge = ease(0.08, 0.3, w) * (1 - ease(0.55, 0.85, w));
    const damp = ease(0.72, 0.95, moisture[t]) * ease(KEEP.water, KEEP.water + 4, toWater[t]);
    // Gathered: a broad noise (about 70 m) leaves whole stretches without.
    const gather = ease(-0.15, 0.35, noise(x / 70, z / 70));
    return Math.max(foot, 0.9 * edge, 0.75 * damp) * gather;
  };
  const span = (nx * cell) / 2;
  const patches: ShrubPatch[] = [];
  const n = Math.ceil(span / PATCH.cell);
  for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
    const rng = createRng((((seed ^ 0x6a09e667) + Math.imul(i, 73856093)) ^ Math.imul(j, 19349663)) >>> 0);
    const x = (i + rng()) * PATCH.cell, z = (j + rng()) * PATCH.cell;
    const s = suitability(x, z), take = rng(), size = rng();
    if (s < PATCH.least || take > s) continue;
    const r = PATCH.radius[0] + (PATCH.radius[1] - PATCH.radius[0]) * Math.min(s * (0.5 + 0.5 * size), 1);
    const tone = pickTone(rng());
    patches.push({ x, z, r, tone });
    // A few small ones beside it (same colour class as the parent patch).
    const k = Math.floor(rng() * (PATCH.satellites + 1));
    for (let q = 0; q < k; q++) {
      const a = 2 * Math.PI * rng(), d = r + 2 + 6 * rng(), sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
      if (suitability(sx, sz) > PATCH.least * 0.6) patches.push({ x: sx, z: sz, r: 3 + 3 * rng(), tone });
    }
  }
  // Trees' trunks and plants already placed, by a hash of 2 m cells.
  const key = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  const trunks = new Map<string, { x: number; z: number }[]>();
  for (const t of trees) { const k = key(t.x, t.z); (trunks.get(k) ?? trunks.set(k, []).get(k)!).push(t); }
  const nearTrunk = (x: number, z: number) => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      for (const t of trunks.get(`${Math.floor(x / 2) + di},${Math.floor(z / 2) + dj}`) ?? []) if (Math.hypot(t.x - x, t.z - z) < KEEP.trunk) return true;
    }
    return false;
  };
  const taken = new Set<string>();
  const gaps = createNoise2D(seed + 811);
  const plants: Shrub[] = [];
  patches.forEach((p, pi) => {
    const step = PLANT.spacing, m = Math.ceil(p.r / step);
    for (let gj = -m; gj <= m; gj++) for (let gi = -m; gi <= m; gi++) {
      const rng = createRng((((seed ^ 0xbb67ae85) + Math.imul(pi, 2654435761) + Math.imul(gi, 73856093)) ^ Math.imul(gj, 19349663)) >>> 0);
      const x = p.x + (gi + rng() - 0.5) * step, z = p.z + (gj + rng() - 0.5) * step;
      const d = Math.hypot(x - p.x, z - p.z) / p.r;
      if (d >= 1) continue;
      const keep = 0.9 * (1 - d * d) * ease(-0.35, 0.1, gaps(x / 5, z / 5));
      const roll = rng(), size = rng(), wide = rng(), yaw = rng(), shade = rng(), variant = rng();
      if (roll > keep) continue;
      const slot = `${Math.round(x / step)},${Math.round(z / step)}`;
      if (taken.has(slot) || !ground(x, z) || nearTrunk(x, z)) continue;
      taken.add(slot);
      const h = PLANT.height[0] + (PLANT.height[1] - PLANT.height[0]) * Math.min(0.25 + 0.55 * (1 - d) + 0.35 * size, 1);
      plants.push({
        x, y: sampleGrid(grid, x, z) - 0.06, z, height: h,
        width: PLANT.width[0] + (PLANT.width[1] - PLANT.width[0]) * wide,
        yaw: 2 * Math.PI * yaw, shade, variant: Math.floor(variant * SHRUB_VARIANTS), tone: p.tone,
      });
    }
  });
  // The ground under the patches: each patch's disc, its edge frayed, then blurred.
  const field = new Float32Array(zone.length);
  for (const p of patches) {
    const reach = p.r * 1.25, i0 = Math.max(Math.floor((p.x - reach - x0) / cell), 0), i1 = Math.min(Math.ceil((p.x + reach - x0) / cell), nx - 1);
    const j0 = Math.max(Math.floor((p.z - reach - z0) / cell), 0), j1 = Math.min(Math.ceil((p.z + reach - z0) / cell), nz - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      const fray = 2.5 * noise(x / 9 + 3, z / 9 - 7);
      const v = 1 - ease(0.55 * p.r, 1.1 * p.r, Math.hypot(x - p.x, z - p.z) + fray);
      const t = j * nx + i;
      if (v > field[t]) field[t] = v;
    }
  }
  blurField(field, nx, nz, cell, 4);
  const bytes = new Uint8Array(zone.length);
  for (let t = 0; t < zone.length; t++) bytes[t] = zone[t] === ZONE.outside ? 0 : Math.round(Math.min(field[t], 1) * 255);
  return { patches, plants, ground: bytes, ms: performance.now() - t0 };
}
