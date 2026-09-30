import { createRng } from '../rng';
import { SURFACE_RULES, type IslandParams } from '../params/island';
import type { IslandField } from './island';
import { poolBasin } from './pools';

/**
 * Grass: where the blades grow and how each one differs. Two steps, so dragging the meadow line
 * or the density only filters: `grassSites` samples the ground once per island, `placeGrass`
 * keeps the sites that are meadow.
 */
const GRID = 160; // height samples across the island's diameter
const FRAME = 1.3; // the grid covers this many radii each way, enough for the widest headland
const TARGET_DENSITY = 30; // candidate blades per square world unit
const PER_CELL: [number, number] = [1, 24]; // blades per grid cell, at least and at most
const MAX_SITES = 120000; // the per-cell count shrinks so no island has more candidates than this
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

/**
 * Candidate blade sites: heights on a square grid over the top surface, then several jittered
 * sites per cell, with height and slope interpolated from the cell's corners. Sites in pool bowls
 * are skipped. Pure function: same field, same sites.
 */
export function grassSites(field: IslandField, p: IslandParams): GrassSites {
  const rng = createRng((p.seed ^ GRASS_SEED_SALT) >>> 0);
  const extent = p.radius * FRAME;
  const cell = (2 * extent) / GRID;
  const row = GRID + 1;
  const heights = new Float64Array(row * row).fill(NaN);
  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) heights[j * row + i] = field.top(-extent + i * cell, -extent + j * cell) ?? NaN;
  }
  const at = (i: number, j: number) => heights[Math.min(Math.max(j, 0), GRID) * row + Math.min(Math.max(i, 0), GRID)];
  // Slope at a grid node from central differences.
  const slopes = new Float64Array(row * row);
  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell);
      const dz = (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      slopes[j * row + i] = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
    }
  }

  const inside: number[] = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const corners = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)];
      const cornerSlopes = [slopes[j * row + i], slopes[j * row + i + 1], slopes[(j + 1) * row + i], slopes[(j + 1) * row + i + 1]];
      if (corners.every(Number.isFinite) && cornerSlopes.every(Number.isFinite)) inside.push(j * GRID + i);
    }
  }
  const wanted = Math.round(TARGET_DENSITY * cell * cell);
  const perCell = Math.max(PER_CELL[0], Math.min(PER_CELL[1], wanted, Math.floor(MAX_SITES / Math.max(inside.length, 1))));

  const count = inside.length * perCell;
  const position = new Float32Array(count * 3);
  const slope = new Float32Array(count);
  const random = new Float32Array(count * RANDOMS);
  let n = 0;
  for (const c of inside) {
    const i = c % GRID;
    const j = Math.floor(c / GRID);
    for (let k = 0; k < perCell; k++) {
      const u = rng();
      const v = rng();
      const x = -extent + (i + u) * cell;
      const z = -extent + (j + v) * cell;
      const bilinear = (f: (a: number, b: number) => number) =>
        (f(i, j) * (1 - u) + f(i + 1, j) * u) * (1 - v) + (f(i, j + 1) * (1 - u) + f(i + 1, j + 1) * u) * v;
      const roll = Array.from({ length: RANDOMS }, () => rng());
      if (poolBasin(field.pools, x, z) > 0) continue;
      position.set([x, bilinear(at), z], n * 3);
      slope[n] = bilinear((a, b) => slopes[b * row + a]);
      random.set(roll, n * RANDOMS);
      n++;
    }
  }
  return { count: n, position: position.subarray(0, n * 3), slope: slope.subarray(0, n), random: random.subarray(0, n * RANDOMS) };
}

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
export function placeFlowers(sites: GrassSites, field: IslandField, p: IslandParams, lineHeight: number, density: number): GrassBlades {
  return keepSites(sites, (s, r) => {
    const x = sites.position[s * 3];
    const z = sites.position[s * 3 + 2];
    const clump = soft(0.15, 0.6, field.noise((x / p.radius) * CLUMP_FREQ + 71, (z / p.radius) * CLUMP_FREQ - 29));
    const shore = Math.max(0, ...field.pools.map((q) => 1 - soft(q.radius, q.radius * SHORE_REACH, Math.hypot(x - q.x, z - q.z))));
    return r[5] < meadowChance(sites, s, lineHeight) * density * FLOWER_SHARE * Math.max(clump, shore);
  });
}

const CLUMP_FREQ = 5; // flower clumps across the island's radius
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
