import { createRng } from '../rng';
import { SURFACE_RULES, type IslandParams } from '../params/island';
import type { IslandField } from './island';
import type { LandCover } from './cover';
import { poolBasin } from './pools';

/**
 * Grass: where the blades grow and how each one differs. On a real-size island (about 1 km across)
 * blades cannot cover the whole meadow, so they grow only in a disc around a focus point (where the
 * camera looks, or where the walker stands); further out the terrain shader's meadow colour stands
 * in for them. Two steps, so dragging the meadow line or the density only filters: `grassSites`
 * samples the ground in the disc, `placeGrass` keeps the sites that are meadow.
 *
 * Sites sit on a fixed world grid of CELL-metre cells, each cell seeded by its own coordinates, so
 * when the disc moves the blades that stay inside it do not change.
 */
export const GRASS_RADIUS = 40; // metres around the focus that hold blades
const CELL = 2; // metres per grid cell
const TARGET_DENSITY = 60; // candidate blades per square metre in the core
const CORE = 0.3; // share of the radius kept at full density
const EDGE_SHARE = 0.15; // density at the disc's edge, as a share of the core's
const GRASS_SEED_SALT = 0x2c1b3c6d;

export interface GrassSites {
  count: number;
  /** x, y, z of each site: the ground under a blade. */
  position: Float32Array;
  /** Slope (1 - normal.y) at each site. */
  slope: Float32Array;
  /** Per site (RANDOMS values): yaw, height variation, bend, shade variation, grass roll, flower roll, all 0..1. */
  random: Float32Array;
}

const RANDOMS = 6;

export interface GrassBlades {
  count: number;
  /** x, y, z of each blade's root. */
  offset: Float32Array;
  /** Per blade: yaw (radians), height scale, bend, shade (0..1). */
  shape: Float32Array;
}

/** A seed for one grid cell, from the island seed and the cell's coordinates. */
const cellSeed = (seed: number, i: number, j: number) => (((seed ^ GRASS_SEED_SALT) + Math.imul(i, 73856093)) ^ Math.imul(j, 19349663)) >>> 0;

/**
 * Candidate blade sites in a disc of `radius` metres around `focus`: heights on the grid corners,
 * then jittered sites in each cell with height and slope interpolated from its corners: dense in
 * the core, thinning toward the disc's edge (a cell makes only the sites it keeps). Sites in pool
 * bowls are skipped. Pure: same field and focus, same sites.
 */
export function grassSites(field: IslandField, p: IslandParams, focus: [number, number], cover?: LandCover, radius = GRASS_RADIUS): GrassSites {
  const [fx, fz] = focus;
  const i0 = Math.floor((fx - radius) / CELL), j0 = Math.floor((fz - radius) / CELL);
  const n = Math.ceil((2 * radius) / CELL) + 1;
  const row = n + 1;
  const heights = new Float64Array(row * row);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) heights[j * row + i] = field.top((i0 + i) * CELL, (j0 + j) * CELL) ?? NaN;
  }
  const at = (i: number, j: number) => heights[Math.min(Math.max(j, 0), n) * row + Math.min(Math.max(i, 0), n)];
  const slopeAt = (i: number, j: number) => {
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * CELL);
    const dz = (at(i, j + 1) - at(i, j - 1)) / (2 * CELL);
    return 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
  };

  const perCell = Math.round(TARGET_DENSITY * CELL * CELL);
  const position: number[] = [];
  const slope: number[] = [];
  const random: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = (i0 + i + 0.5) * CELL, cz = (j0 + j + 0.5) * CELL;
      const d = Math.hypot(cx - fx, cz - fz) / radius;
      if (d > 1) continue;
      // Meadow grass thins out under the forest and stops at running water (generators/cover.ts).
      const ground = cover ? cover.at(cx, cz) : { forest: 0, water: 0 };
      if (ground.water > 0.3) continue;
      const count = Math.round(perCell * (1 - (1 - EDGE_SHARE) * soft(CORE, 1, d)) * (1 - 0.9 * ground.forest));
      const corners = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)];
      if (!corners.every(Number.isFinite)) continue;
      const slopes = [slopeAt(i, j), slopeAt(i + 1, j), slopeAt(i, j + 1), slopeAt(i + 1, j + 1)];
      if (!slopes.every(Number.isFinite)) continue;
      const rng = createRng(cellSeed(p.seed, i0 + i, j0 + j));
      const inPool = field.pools.some((q) => Math.hypot(cx - q.x, cz - q.z) < q.radius + CELL);
      for (let k = 0; k < count; k++) {
        const u = rng(), v = rng();
        const x = (i0 + i + u) * CELL, z = (j0 + j + v) * CELL;
        const r0 = rng(), r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng();
        if (inPool && poolBasin(field.pools, x, z) > 0) continue;
        const a = (1 - u) * (1 - v), b = u * (1 - v), c = (1 - u) * v, e = u * v;
        position.push(x, corners[0] * a + corners[1] * b + corners[2] * c + corners[3] * e, z);
        slope.push(slopes[0] * a + slopes[1] * b + slopes[2] * c + slopes[3] * e);
        random.push(r0, r1, r2, r3, r4, r5);
      }
    }
  }
  return { count: slope.length, position: new Float32Array(position), slope: new Float32Array(slope), random: new Float32Array(random) };
}

/** No sites: the camera is too far away for single blades to show. */
export const NO_SITES: GrassSites = { count: 0, position: new Float32Array(), slope: new Float32Array(), random: new Float32Array() };

/**
 * Keeps the sites that are meadow, by the same rule as the terrain shader: flatter than
 * grassSlope and below the meadow line, with the same soft edges, so the grass thins out where
 * the painted meadow fades. `density` (0..1) keeps that share of the rest.
 */
export function placeGrass(sites: GrassSites, lineHeight: number, density: number): GrassBlades {
  return keepSites(sites, (s, r) => r[4] < meadowChance(sites, s, lineHeight) * density);
}

/**
 * Zhuyu, the luminous herb of the Shanhaijing's Mount Zhaoyao: a few flowers among the grass.
 * They grow in clumps (low-frequency noise decides where) and gather along the pools, on the
 * same meadow as the grass. `density` (0..1) scales how many.
 */
export function placeFlowers(sites: GrassSites, field: IslandField, lineHeight: number, density: number): GrassBlades {
  return keepSites(sites, (s, r) => {
    const x = sites.position[s * 3];
    const z = sites.position[s * 3 + 2];
    const clump = soft(0.15, 0.6, field.noise(x / CLUMP_SIZE + 71, z / CLUMP_SIZE - 29));
    const shore = Math.max(0, ...field.pools.map((q) => 1 - soft(q.radius, q.radius * SHORE_REACH, Math.hypot(x - q.x, z - q.z))));
    return r[5] < meadowChance(sites, s, lineHeight) * density * FLOWER_SHARE * Math.max(clump, shore);
  });
}

const CLUMP_SIZE = 12; // metres: about the size of a flower clump
const SHORE_REACH = 1.8; // flowers gather out to this many pool radii from a pool's center
const FLOWER_SHARE = 0.1; // at density 1, this share of the meadow sites inside a clump holds a flower

/** Chance the terrain shader paints this site as meadow: the same slope and meadow-line rule. */
function meadowChance(sites: GrassSites, s: number, lineHeight: number): number {
  const grass = SURFACE_RULES.grassSlope;
  const blend = SURFACE_RULES.lineBlend;
  const level = 1 - soft(grass * 0.5, grass * 1.5, sites.slope[s]);
  return level * (1 - soft(lineHeight - blend, lineHeight + blend, sites.position[s * 3 + 1]));
}

/** The sites `keep` accepts, with each one's yaw, height scale, bend and shade. */
function keepSites(sites: GrassSites, keep: (s: number, r: Float32Array) => boolean): GrassBlades {
  const offset = new Float32Array(sites.count * 3);
  const shape = new Float32Array(sites.count * 4);
  let n = 0;
  for (let s = 0; s < sites.count; s++) {
    const r = sites.random.subarray(s * RANDOMS, (s + 1) * RANDOMS);
    if (!keep(s, r)) continue;
    offset.set(sites.position.subarray(s * 3, s * 3 + 3), n * 3);
    shape.set([r[0] * Math.PI * 2, 0.6 + 0.8 * r[1], r[2], r[3]], n * 4);
    n++;
  }
  return { count: n, offset: offset.subarray(0, n * 3), shape: shape.subarray(0, n * 4) };
}

function soft(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Blades that do not stand in `avoid` (the footpath, the pavilion's ground). */
export function clearBlades(blades: GrassBlades, avoid: (x: number, z: number) => boolean): GrassBlades {
  const keep: number[] = [];
  for (let i = 0; i < blades.count; i++) if (!avoid(blades.offset[i * 3], blades.offset[i * 3 + 2])) keep.push(i);
  const offset = new Float32Array(keep.length * 3);
  const shape = new Float32Array(keep.length * 4);
  keep.forEach((k, i) => {
    offset.set(blades.offset.subarray(k * 3, k * 3 + 3), i * 3);
    shape.set(blades.shape.subarray(k * 4, k * 4 + 4), i * 4);
  });
  return { count: keep.length, offset, shape };
}
