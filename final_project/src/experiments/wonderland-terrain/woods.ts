import type { Plant } from '../../core/generators/forest';
import { PINE_VARIANTS } from '../../core/generators/pine';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { createRng } from '../../core/rng';
import { SIZES, within } from '../../core/scale';
import { ZONE, type Zones } from './zones';

/**
 * The island's trees, from its zones (zones.ts): Penglai's pines (the same L-system), grown where
 * the zones say trees take, so the woodland reads as groves with clearings and the white stone
 * stays open.
 *
 * - Grove trees: one candidate per GROVE.spacing cell of a fixed world grid (each cell its own
 *   seeded chance, so a tree does not move when another rule changes), kept by the grove's
 *   strength there: dense at a grove's heart, thinning to its edge. Taller where moist and deep in
 *   the grove (a stand's own shelter), shorter at the edge.
 * - Lone pines: up the range, on ledges (a gentle spot in steep ground), sparse and wind-stunted.
 * - Nothing within `keep` of the places given (the creature's home, stands, ways; set by the
 *   page), nor within DRY of water, on the terrace or on wet shore.
 *
 * Pure: the same zones, ground and seed give the same trees.
 */
const GROVE = { spacing: 4, least: 0.15, most: 0.85 }; // metres between candidates; the share kept at a grove's edge, at its heart
const DRY = 4; // metres any tree keeps from water (its zone cell is 2 m: a cell's tree could stand at the water's edge)
/** Lone pines: prefer rock shoulders / local platforms — not sharp summit tips. */
const LONE = {
  spacing: 22,
  /** Lower than before (0.45) so fewer tip-of-peak singles. */
  chance: 0.28,
  /** Max slope on the chosen ledge (gentler = more platform-like). */
  ledge: 0.42,
  /** Reject if site sticks this many metres above the 6–10 m neighbourhood mean (sharp tip). */
  tipAbove: 3.2,
  /** Need at least this many of 8 ring samples within tipAbove of site height (support shelf). */
  supportHits: 3,
};
const SALT = { grove: 0x2545f491, lone: 0x9e3779b9 };

/** A keep-out: no tree within r metres of (x, z), or of the segment to (x2, z2) if given. */
export interface KeepOut { x: number; z: number; r: number; x2?: number; z2?: number }

const CLEAR = { home: 6, way: 3, stand: 5 }; // metres trees keep from a creature's home, the way from it to the water, its stands

/** What trees keep off for a creature's sites: its homes, its stands, the ways between. */
export function siteKeepOuts(sites: { drink: { x: number; z: number }; stands: { x: number; z: number }[]; homes: { x: number; z: number }[] }): KeepOut[] {
  const D = sites.drink;
  return [
    ...sites.homes.flatMap((h) => [{ x: h.x, z: h.z, r: CLEAR.home }, { x: h.x, z: h.z, x2: D.x, z2: D.z, r: CLEAR.way }]),
    ...sites.stands.map((s) => ({ x: s.x, z: s.z, r: CLEAR.stand })),
  ];
}

/**
 * Shared pine view bands for Wonderland (metres): grove + lone pines (`Vegetation.tsx`) and the
 * two corner pines (`corner.tsx`) use the same thresholds — grown L-system within the first,
 * mid stand-in within the second, far stand-in beyond.
 * Vegetation applies ±12 m hysteresis around these edges. Silhouette fixes belong in
 * `forestPineModel`, not in pushing these numbers out.
 */
export const WOODS_LOD: [number, number] = [90, 260];
/** Hysteresis used by Vegetation (documented here for handoff). */
export const WOODS_LOD_HYST = 12;

/** The creature keeps this far from a tree's trunk (metres). */
export const TREE_CLEARANCE = 1.4;

export function growWoods(zones: Zones, grid: HeightGrid, seed: number, keep: KeepOut[] = []): { trees: Plant[]; lone: Plant[] } {
  const kept = (x: number, z: number) => keep.every((k) => {
    if (k.x2 === undefined || k.z2 === undefined) return Math.hypot(x - k.x, z - k.z) >= k.r;
    const lx = k.x2 - k.x, lz = k.z2 - k.z, l2 = lx * lx + lz * lz || 1;
    const t = Math.min(Math.max(((x - k.x) * lx + (z - k.z) * lz) / l2, 0), 1);
    return Math.hypot(x - k.x - lx * t, z - k.z - lz * t) >= k.r;
  });
  const cellOf = (x: number, z: number) => {
    const i = Math.floor((x - zones.x0) / zones.cell), j = Math.floor((z - zones.z0) / zones.cell);
    return i >= 0 && j >= 0 && i < zones.nx && j < zones.nz ? j * zones.nx + i : -1;
  };
  const span = (zones.nx * zones.cell) / 2;
  const each = (size: number, salt: number, visit: (x: number, z: number, rng: () => number) => void) => {
    const n = Math.ceil(span / size);
    for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
      const rng = createRng((((seed ^ salt) + Math.imul(i, 73856093)) ^ Math.imul(j, 19349663)) >>> 0);
      visit((i + rng()) * size, (j + rng()) * size, rng);
    }
  };
  const trees: Plant[] = [];
  each(GROVE.spacing, SALT.grove, (x, z, rng) => {
    const keepIt = rng(), size = rng(), yaw = rng(), variant = rng();
    const t = cellOf(x, z);
    if (t < 0 || zones.zone[t] !== ZONE.woodland) return;
    const g = zones.grove[t];
    if (keepIt >= GROVE.least + (GROVE.most - GROVE.least) * g || zones.toWater[t] < DRY || !kept(x, z)) return;
    const site = Math.min(0.25 + 0.45 * zones.moisture[t] + 0.3 * g, 1);
    trees.push({ x, y: sampleGrid(grid, x, z) - 0.2, z, height: within(SIZES.forest.height, 0.65 * site + 0.35 * size), yaw: yaw * 2 * Math.PI, variant: Math.floor(variant * PINE_VARIANTS) });
  });
  const lone: Plant[] = [];
  each(LONE.spacing, SALT.lone, (x, z, rng) => {
    const stand = rng(), size = rng(), yaw = rng(), variant = rng();
    const t = cellOf(x, z);
    if (t < 0 || stand >= LONE.chance) return;
    const zone = zones.zone[t];
    if (zone !== ZONE.cliff && zone !== ZONE.ridge && zone !== ZONE.rockSlope) return;
    // Prefer a rock shoulder / local platform: gentlest spot within 4 m.
    let bx = x, bz = z, best = Infinity;
    for (let a = 0; a < 12; a++) for (const r of [0, 1.5, 3, 4]) {
      const px = x + Math.cos((a / 12) * 2 * Math.PI) * r, pz = z + Math.sin((a / 12) * 2 * Math.PI) * r;
      const s = Math.hypot(sampleGrid(grid, px, pz, 1), sampleGrid(grid, px, pz, 2));
      if (s < best) { best = s; bx = px; bz = pz; }
    }
    const u = cellOf(bx, bz);
    if (best > LONE.ledge || u < 0 || zones.toWater[u] < DRY || !kept(bx, bz)) return;
    const hy = sampleGrid(grid, bx, bz);
    // Neighbourhood support: reject sharp summit tips that stand alone above the massif.
    let mean = 0, n = 0, support = 0;
    for (let a = 0; a < 8; a++) {
      const px = bx + Math.cos((a / 8) * 2 * Math.PI) * 8;
      const pz = bz + Math.sin((a / 8) * 2 * Math.PI) * 8;
      const h = sampleGrid(grid, px, pz);
      if (!(h > -50)) continue;
      mean += h; n++;
      if (Math.abs(h - hy) <= LONE.tipAbove) support++;
    }
    if (n > 0 && hy - mean / n > LONE.tipAbove) return;
    if (support < LONE.supportHits) return;
    lone.push({ x: bx, y: hy - 0.3, z: bz, height: within(SIZES.pine.edge, size), yaw: yaw * 2 * Math.PI, variant: Math.floor(variant * PINE_VARIANTS) });
  });
  return { trees, lone };
}
