import type { Plant } from '../../core/generators/forest';
import { PINE_VARIANTS } from '../../core/generators/pine';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { createRng } from '../../core/rng';
import { SIZES, within } from '../../core/scale';
import { PLANT, plantZones, ZONE, type Zones } from './zones';

/**
 * The island's trees, from its zones (zones.ts): Penglai's pines (the same L-system), grown where
 * the zones say trees take, so the woodland reads as groves with clearings and the white stone
 * stays open.
 *
 * - Grove trees: one candidate per GROVE.spacing cell of a fixed world grid (each cell its own
 *   seeded chance, so a tree does not move when another rule changes), kept by the grove's
 *   strength there: dense at a grove's heart, thinning to its edge. Taller where moist and deep in
 *   the grove (a stand's own shelter), shorter at the edge.
 * - No lone pines up the range any more (owner, 2026-11-21: one stick on a peak looked odd).
 * - Nothing within `keep` of the places given (the creature's home, stands, ways; set by the
 *   page), nor within DRY of water, on the terrace or on wet shore.
 *
 * Pure: the same zones, ground and seed give the same trees.
 */
const GROVE = { spacing: 4, least: 0.15, most: 0.85 }; // metres between candidates; the share kept at a grove's edge, at its heart
const DRY = 4; // metres any tree keeps from water (its zone cell is 2 m: a cell's tree could stand at the water's edge)
const SALT = { grove: 0x2545f491 };

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

export function growWoods(zones: Zones, grid: HeightGrid, seed: number, keep: KeepOut[] = []): { trees: Plant[] } {
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
  return { trees };
}

/**
 * The broadleaf trees (broadleaf.ts), each where its rule says, after the pines, read from the same
 * map the zones layer draws (zones.ts, plantZones), so what the map shows is what grows:
 * - Parasol trees in the woodland's edge band (woodland colour, outside the pines' own ground),
 *   gentle, dry; one candidate per BROAD.parasol.spacing cell, kept by chance.
 * - Weeping trees on the shore (shore colour), at least `shore[0]` m from the water, gentle; one
 *   per BROAD.weeping.spacing cell, kept by chance.
 * Both keep `clear` m from every pine and from each other's trunks, and off the creature's places.
 * Pure: the same zones, ground, pines and seed give the same trees.
 */
const BROAD = {
  parasol: { spacing: 16, chance: 0.6, dry: 6, slope: 0.3 },
  weeping: { spacing: 13, chance: 0.6, shore: [2.5, 10] as [number, number], slope: 0.35 },
  clear: 6,
  variants: 4,
};
const BROAD_SALT = { parasol: 0x1b873593, weeping: 0xcc9e2d51 };

export const BROADLEAF_VARIANTS = BROAD.variants;

export function growBroadleaves(zones: Zones, grid: HeightGrid, seed: number, pines: Plant[], keep: KeepOut[] = [], heights: { parasol: [number, number]; weeping: [number, number] }): { parasol: Plant[]; weeping: Plant[] } {
  const cellOf = (x: number, z: number) => {
    const i = Math.floor((x - zones.x0) / zones.cell), j = Math.floor((z - zones.z0) / zones.cell);
    return i >= 0 && j >= 0 && i < zones.nx && j < zones.nz ? j * zones.nx + i : -1;
  };
  const kept = (x: number, z: number) => keep.every((k) => {
    if (k.x2 === undefined || k.z2 === undefined) return Math.hypot(x - k.x, z - k.z) >= k.r;
    const lx = k.x2 - k.x, lz = k.z2 - k.z, l2 = lx * lx + lz * lz || 1;
    const t = Math.min(Math.max(((x - k.x) * lx + (z - k.z) * lz) / l2, 0), 1);
    return Math.hypot(x - k.x - lx * t, z - k.z - lz * t) >= k.r;
  });
  const placed: Plant[] = [];
  const clear = (x: number, z: number) => pines.every((p) => Math.hypot(p.x - x, p.z - z) >= BROAD.clear) && placed.every((p) => Math.hypot(p.x - x, p.z - z) >= BROAD.clear);
  const slope = (x: number, z: number) => Math.hypot(sampleGrid(grid, x, z, 1), sampleGrid(grid, x, z, 2));
  const plants = plantZones(zones);
  const span = (zones.nx * zones.cell) / 2;
  const each = (size: number, salt: number, visit: (x: number, z: number, rng: () => number) => void) => {
    const n = Math.ceil(span / size);
    for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
      const rng = createRng((((seed ^ salt) + Math.imul(i, 73856093)) ^ Math.imul(j, 19349663)) >>> 0);
      visit((i + rng()) * size, (j + rng()) * size, rng);
    }
  };
  const tree = (x: number, z: number, [lo, hi]: [number, number], size: number, yaw: number, variant: number): Plant =>
    ({ x, y: sampleGrid(grid, x, z) - 0.15, z, height: lo + (hi - lo) * size, yaw: yaw * 2 * Math.PI, variant: Math.floor(variant * BROAD.variants) });

  const weeping: Plant[] = [];
  const W = BROAD.weeping;
  each(W.spacing, BROAD_SALT.weeping, (x, z, rng) => {
    const chance = rng(), size = rng(), yaw = rng(), variant = rng();
    const t = cellOf(x, z);
    if (t < 0 || chance >= W.chance) return;
    if (plants[t] !== PLANT.shore) return;
    if (zones.toWater[t] < W.shore[0] || slope(x, z) > W.slope || !kept(x, z) || !clear(x, z)) return;
    const p = tree(x, z, heights.weeping, size, yaw, variant);
    weeping.push(p); placed.push(p);
  });
  const parasol: Plant[] = [];
  const P = BROAD.parasol;
  each(P.spacing, BROAD_SALT.parasol, (x, z, rng) => {
    const chance = rng(), size = rng(), yaw = rng(), variant = rng();
    const t = cellOf(x, z);
    if (t < 0 || chance >= P.chance) return;
    // The edge band: woodland colour on the map, but not the pines' own ground.
    if (plants[t] !== PLANT.wood || zones.zone[t] === ZONE.woodland) return;
    if (zones.toWater[t] < P.dry || slope(x, z) > P.slope || !kept(x, z) || !clear(x, z)) return;
    const p = tree(x, z, heights.parasol, size, yaw, variant);
    parasol.push(p); placed.push(p);
  });
  return { parasol, weeping };
}
