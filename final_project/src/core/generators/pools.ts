import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createRng } from '../rng';
import { SIZES } from '../scale';
import type { IslandParams } from '../params/island';
import type { IslandField } from './island';

/**
 * Standing water on the plateau: one lake and a few rock pools. Each sits in a natural hollow,
 * which is then carved a little deeper into a bowl. The lake takes the hollow with room for the
 * widest bowl; the pools take the rest.
 */
const GRID = 40; // hollow search grid, cells across the radius
const SEARCH_EDGE = 0.72; // only search inside this fraction of the rim, clear of the shoulder
const PEAK_CLEAR = 0.05; // skip ground lifted by the peaks more than this fraction of peakHeight
const POOL_RADIUS = SIZES.pool.radius; // bowl radius in metres (core/scale.ts)
const POOL_FLOOR = 0.55; // the bowl is flat out to this fraction of its radius, then rises to the rim
const POOL_DEPTH = 0.35; // world units of water at the deepest point
const SHORE_MARGIN = 0.05; // world units the water stays below the lowest point of the bowl's rim
const SPACING = 1.3; // pools stay this many summed radii apart
const SHRINK = 0.8; // a bowl that does not fit is tried again this much smaller
const SIZE_TRIES = 3;
const JITTER = 0.5; // how much the seeded random term competes with hollow depth when picking
const RIM_SAMPLES = 96; // points around the bowl's rim checked for the lowest one, dense enough to catch narrow dips
const RAYS = 48; // shoreline directions per pool, at least
const SHORE_SPACING = 4; // metres of shore per direction on a large pool
const RINGS = 6; // rings from the center to the shore
const MARCH = 32; // steps when searching for the shore along a ray
const LIFT = 0.02; // world units the water sits above its level, so it never flickers with the ground
const POOL_SEED_SALT = 0x165667b1;
const LAKE_RADIUS = SIZES.lake.radius; // metres (core/scale.ts)
const LAKE_DEPTH = SIZES.lake.depth; // metres of water at the deepest point
const LAKE_PEAK_CLEAR = 0.15; // the lake's shore may reach the foot of a peak, lifted up to this share of peakHeight
const LAKE_TRIES = 6; // radii tried, widest first, before the lake gives up on a hollow

export interface Pool {
  x: number;
  z: number;
  /** Bowl radius, world units. */
  radius: number;
  /** How deep the bowl is carved at its center, world units. */
  depth: number;
  /** Water surface height. */
  level: number;
  /** The island's lake (the first entry), rather than a rock pool. */
  lake: boolean;
  /** Phases of the lake's wavy outline (a few sines around it), so it is not a circle. */
  shape?: [number, number, number];
}

type Height = (x: number, z: number) => number | null;

/**
 * Picks pool sites on the uncarved top surface: hollows (lower than the mean of their 8
 * neighbours) on the open plateau, away from the peaks, deepest first with a seeded random term,
 * kept apart. A bowl that does not fit is tried smaller. The water level sits just under the
 * lowest point of the bowl's rim, so a pool can never spill.
 */
export function placePools(
  top: Height,
  lift: (x: number, z: number) => number,
  rim: (angle: number) => number,
  p: IslandParams,
): Pool[] {
  const count = Math.max(Math.round(p.poolCount), 0);
  const rng = createRng((p.seed ^ POOL_SEED_SALT) >>> 0);
  const cell = p.radius / GRID;
  const neighbours = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  const candidates: { x: number; z: number; h: number; score: number }[] = [];
  for (let gi = -GRID; gi <= GRID; gi++) {
    for (let gj = -GRID; gj <= GRID; gj++) {
      const x = gi * cell;
      const z = gj * cell;
      if (Math.hypot(x, z) > SEARCH_EDGE * rim(Math.atan2(z, x))) continue;
      const h = top(x, z);
      if (h === null || lift(x, z) > PEAK_CLEAR * p.peakHeight) continue;
      let sum = 0;
      let open = true;
      for (const [i, j] of neighbours) {
        const n = top(x + i * cell, z + j * cell);
        if (n === null) open = false;
        else sum += n;
      }
      if (open && sum / neighbours.length > h) candidates.push({ x, z, h, score: sum / neighbours.length - h });
    }
  }
  const deepest = Math.max(...candidates.map((c) => c.score), 1e-6);
  const ranked = candidates
    .map((c) => ({ c, rank: c.score / deepest + JITTER * rng() }))
    .sort((a, b) => b.rank - a.rank);

  // The whole bowl must sit on open plateau, clear of peaks and the shoulder; returns its lowest rim point.
  const rimLow = (cx: number, cz: number, radius: number, peakClear = PEAK_CLEAR) => {
    let low = Infinity;
    for (let k = 0; k < RIM_SAMPLES; k++) {
      const a = (k / RIM_SAMPLES) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius;
      const z = cz + Math.sin(a) * radius;
      const h = top(x, z);
      if (h === null || lift(x, z) > peakClear * p.peakHeight || Math.hypot(x, z) > SEARCH_EDGE * rim(Math.atan2(z, x))) return null;
      low = Math.min(low, h);
    }
    return low;
  };

  const pools: Pool[] = [];
  // The lake first: the best-ranked hollow that has room for a wide bowl.
  for (const { c } of p.lake === false ? [] : ranked) {
    let placed = false;
    for (let k = 0; k < LAKE_TRIES && !placed; k++) {
      const radius = LAKE_RADIUS[1] - ((LAKE_RADIUS[1] - LAKE_RADIUS[0]) * k) / (LAKE_TRIES - 1);
      const low = rimLow(c.x, c.z, radius, LAKE_PEAK_CLEAR);
      if (low === null) continue;
      const level = low - SHORE_MARGIN;
      pools.push({ x: c.x, z: c.z, radius, level, depth: LAKE_DEPTH, lake: true, shape: [rng() * 6.28, rng() * 6.28, rng() * 6.28] });
      placed = true;
    }
    if (placed) break;
  }
  for (const { c } of ranked) {
    if (pools.filter((q) => !q.lake).length >= count) break;
    let radius = POOL_RADIUS[0] + (POOL_RADIUS[1] - POOL_RADIUS[0]) * rng();
    for (let attempt = 0; attempt < SIZE_TRIES; attempt++, radius *= SHRINK) {
      if (!pools.every((q) => Math.hypot(q.x - c.x, q.z - c.z) >= SPACING * (q.radius + radius))) continue;
      const low = rimLow(c.x, c.z, radius);
      if (low === null) continue;
      const level = low - SHORE_MARGIN;
      pools.push({ x: c.x, z: c.z, radius, level, depth: Math.max(c.h - level, 0) + POOL_DEPTH, lake: false });
      break;
    }
  }
  return pools;
}

/**
 * How much the pool bowls lower the ground at a point: flat-bottomed, rising smoothly to the rim.
 * The lake is different: its bed is only ever cut down to below its water (level minus its depth,
 * shallowing to the shore), never into dry ground above it, so no carved wall shows above the
 * water; its outline wavers around the island's centre so it is not a circle. Without `ground`,
 * the lake answers whether the point is inside its outline (1) or not (0).
 */
export function poolBasin(pools: Pool[], x: number, z: number, ground?: number): number {
  let cut = 0;
  for (const q of pools) {
    if (q.lake) {
      const a = Math.atan2(z - q.z, x - q.x);
      const [p1, p2, p3] = q.shape ?? [0, 0, 0];
      const reach = q.radius * (1 + 0.16 * Math.sin(2 * a + p1) + 0.1 * Math.sin(3 * a + p2) + 0.06 * Math.sin(5 * a + p3)) * 0.8;
      const u = Math.hypot(x - q.x, z - q.z) / reach;
      if (u >= 1) continue;
      if (ground === undefined) { cut = Math.max(cut, 1); continue; }
      const t = Math.min(Math.max((u - POOL_FLOOR) / (1 - POOL_FLOOR), 0), 1);
      const bed = q.level - q.depth * (1 - t * t * (3 - 2 * t)) - SHORE_MARGIN * 4;
      // Toward the outline the cut eases off, so the bank slopes into the water instead of stepping.
      const ease = 1 - Math.min(Math.max((u - 0.8) / 0.2, 0), 1) ** 2;
      cut = Math.max(cut, (ground - bed) * ease);
      continue;
    }
    const u = Math.hypot(x - q.x, z - q.z) / q.radius;
    if (u >= 1) continue;
    const t = Math.min(Math.max((u - POOL_FLOOR) / (1 - POOL_FLOOR), 0), 1);
    cut = Math.max(cut, q.depth * (1 - t * t * (3 - 2 * t)));
  }
  return cut;
}

/**
 * Flat water sheets whose shore follows the carved ground: along each direction the sheet ends
 * where the ground rises above the water level. A direction that never meets the shore (a
 * narrow dip in the rim between samples) takes the reach of its nearest neighbours, so the
 * water never runs out along a channel. Attributes: `aShore` is 0 at the center, 1 at the
 * outer ring; `aDepth` is the water depth over the ground at that vertex (negative past the
 * shore), which the shader uses to fade the edge. Pure function: same params, same geometry.
 */
export function createPools(field: IslandField): BufferGeometry {
  const positions: number[] = [];
  const shores: number[] = [];
  const depths: number[] = [];
  const indices: number[] = [];
  field.pools.forEach(({ x, z, radius, level }) => {
    const start = positions.length / 3;
    const y = level + LIFT;
    const push = (px: number, pz: number, shore: number) => {
      positions.push(px, y, pz);
      shores.push(shore);
      depths.push(level - (field.top(px, pz) ?? level + 1));
    };
    push(x, z, 0);
    const rays = Math.min(Math.max(Math.round((Math.PI * 2 * radius) / SHORE_SPACING), RAYS), 256);
    const angles = Array.from({ length: rays }, (_, r) => (r / rays) * Math.PI * 2);
    const found = angles.map((a) => shoreDistance(field.top, x, z, a, level, radius));
    const reaches = found.map((reach, r) => {
      if (reach !== null) return reach;
      for (let o = 1; o < rays; o++) {
        const near = [found[(r + o) % rays], found[(r - o + rays) % rays]].filter((v): v is number => v !== null);
        if (near.length) return Math.min(...near);
      }
      return radius * POOL_FLOOR;
    });
    angles.forEach((a, r) => {
      for (let k = 1; k <= RINGS; k++) {
        const d = (reaches[r] * k) / RINGS;
        push(x + Math.cos(a) * d, z + Math.sin(a) * d, k / RINGS);
      }
    });
    // Center fan to the first ring, then quads ring to ring.
    const at = (r: number, k: number) => start + 1 + (r % rays) * RINGS + (k - 1);
    for (let r = 0; r < rays; r++) {
      indices.push(start, at(r + 1, 1), at(r, 1));
      for (let k = 1; k < RINGS; k++) indices.push(at(r, k), at(r + 1, k), at(r, k + 1), at(r + 1, k), at(r + 1, k + 1), at(r, k + 1));
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aShore', new Float32BufferAttribute(shores, 1));
  geometry.setAttribute('aDepth', new Float32BufferAttribute(depths, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Distance from (x, z) along angle a to where the ground rises above the water level, or null if
 * it never does within `max`.
 */
function shoreDistance(top: Height, x: number, z: number, a: number, level: number, max: number): number | null {
  const step = max / MARCH;
  for (let s = 1; s <= MARCH; s++) {
    const h = top(x + Math.cos(a) * s * step, z + Math.sin(a) * s * step);
    // Just past the crossing, so the sheet reaches under the ground and the depth fade ends at the shore.
    if (h === null || h >= level) return (s - 0.4) * step;
  }
  return null;
}
