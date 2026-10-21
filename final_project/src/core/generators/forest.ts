import { BufferGeometry, IcosahedronGeometry } from 'three';
import type { IslandParams } from '../params/island';
import { createRng } from '../rng';
import { SIZES, within } from '../scale';
import type { LandCover } from './cover';
import type { IslandField } from './island';
import { PINE_VARIANTS } from './pine';

/**
 * What grows and lies on the ground, placed from the land cover. Pure: same field and cover,
 * same plants and stones. All on fixed world grids, so each grid cell decides for itself.
 *
 * - Forest pines: one candidate per SIZES.forest.spacing cell (at most 1111 trees/ha), kept by
 *   the cover's forest density. Wetter ground grows taller trees, the peaks' flanks shorter ones.
 * - Rhododendron thickets: where forest meets open ground, and on rocky slopes too steep for trees.
 * - Granite boulders: on rocky ground at the feet and flanks of the peaks; many small, a few large.
 */
export interface Plant {
  x: number;
  y: number;
  z: number;
  /** Height in metres. */
  height: number;
  yaw: number;
  variant: number;
}

const FOREST_SALT = 0x3c6ef372;
const SHRUB_SALT = 0xa54ff53a;
const BOULDER_SALT = 0x510e527f;
const SHRUB_CELL = 5; // metres
const BOULDER_CELL = 22; // metres
const BOULDER_CHANCE = 0.35;
export const BOULDER_VARIANTS = 5;

/** A world grid over the island, calling `visit` with a cell-seeded random function for each cell. */
function eachCell(p: IslandParams, size: number, salt: number, visit: (i: number, j: number, rng: () => number) => void) {
  const extent = p.radius * 1.05;
  const n = Math.ceil(extent / size);
  for (let j = -n; j < n; j++) {
    for (let i = -n; i < n; i++) visit(i, j, createRng((((p.seed ^ salt) + Math.imul(i, 73856093)) ^ Math.imul(j, 19349663)) >>> 0));
  }
}

const slopeAt = (field: IslandField, x: number, z: number, y: number, h = 2) => {
  const yx = field.top(x + h, z) ?? y, yz = field.top(x, z + h) ?? y;
  const g = Math.hypot(yx - y, yz - y) / h;
  return 1 - 1 / Math.sqrt(1 + g * g);
};

export function placeForest(field: IslandField, p: IslandParams, cover: LandCover): Plant[] {
  const trees: Plant[] = [];
  const cell = SIZES.forest.spacing;
  eachCell(p, cell, FOREST_SALT, (i, j, rng) => {
    const x = (i + rng()) * cell, z = (j + rng()) * cell;
    const keep = rng(), size = rng(), yaw = rng(), variant = rng();
    const c = cover.at(x, z);
    if (keep >= c.forest || c.water > 0.1) return;
    const y = field.top(x, z);
    if (y === null) return;
    const onPeak = Math.min(field.lift(x, z) / Math.max(p.peakHeight, 1), 1);
    // Taller where wet and low, shorter up the peaks; then each tree's own variation.
    const site = Math.min(Math.max(0.35 + 0.45 * c.wet - 0.6 * onPeak, 0), 1);
    trees.push({ x, y: y - 0.2, z, height: within(SIZES.forest.height, 0.6 * site + 0.4 * size), yaw: yaw * Math.PI * 2, variant: Math.floor(variant * PINE_VARIANTS) });
  });
  return trees;
}

export function placeShrubs(field: IslandField, p: IslandParams, cover: LandCover): Plant[] {
  const shrubs: Plant[] = [];
  eachCell(p, SHRUB_CELL, SHRUB_SALT, (i, j, rng) => {
    const x = (i + rng()) * SHRUB_CELL, z = (j + rng()) * SHRUB_CELL;
    const keep = rng(), size = rng(), yaw = rng();
    const y = field.top(x, z);
    if (y === null) return;
    const c = cover.at(x, z);
    if (c.water > 0.05) return;
    const slope = slopeAt(field, x, z, y);
    const edge = 4 * c.forest * (1 - c.forest); // 1 where forest meets open ground
    const rocky = slope > 0.3 && slope < 0.7 ? 0.5 : 0; // ledges too steep for trees
    if (keep >= 0.7 * Math.max(edge, rocky)) return;
    shrubs.push({ x, y: y - 0.1, z, height: within(SIZES.shrub.height, size), yaw: yaw * Math.PI * 2, variant: 0 });
  });
  return shrubs;
}

export function placeBoulders(field: IslandField, p: IslandParams, cover: LandCover): Plant[] {
  const stones: Plant[] = [];
  eachCell(p, BOULDER_CELL, BOULDER_SALT, (i, j, rng) => {
    const x = (i + rng()) * BOULDER_CELL, z = (j + rng()) * BOULDER_CELL;
    const keep = rng(), size = rng(), yaw = rng(), variant = rng();
    const y = field.top(x, z);
    if (y === null || cover.at(x, z).water > 0 || field.pools.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius * 1.1)) return;
    const onPeak = field.lift(x, z) / Math.max(p.peakHeight, 1);
    const slope = slopeAt(field, x, z, y, 4);
    // Rocky ground: the feet and flanks of the peaks, and moderate slopes anywhere.
    const rocky = Math.max(onPeak > 0.02 && onPeak < 0.6 ? 1 : 0, slope > 0.15 && slope < 0.6 ? 0.5 : 0);
    if (keep >= BOULDER_CHANCE * rocky) return;
    // Many small, a few large (cubed), up to Flying-Over Rock's 12 m.
    const height = within(SIZES.boulder.size, size ** 3);
    stones.push({ x, y: y - height * 0.25, z, height, yaw: yaw * Math.PI * 2, variant: Math.floor(variant * BOULDER_VARIANTS) });
  });
  return stones;
}

/**
 * A granite boulder, one unit tall, base at 0: a rounded polyhedron with every corner pushed in or
 * out a little (seeded), slightly flattened, so each variant has its own lumpy outline.
 */
export function boulderGeometry(variant: number): BufferGeometry {
  const g = new IcosahedronGeometry(0.5, 1);
  const rng = createRng(0x9b05688c + variant * 7919);
  const pos = g.getAttribute('position');
  const pushed = new Map<string, number>();
  for (let k = 0; k < pos.count; k++) {
    const key = `${pos.getX(k).toFixed(3)},${pos.getY(k).toFixed(3)},${pos.getZ(k).toFixed(3)}`;
    if (!pushed.has(key)) pushed.set(key, 0.8 + 0.4 * rng());
    const s = pushed.get(key)!;
    pos.setXYZ(k, pos.getX(k) * s * 1.15, pos.getY(k) * s * 0.85, pos.getZ(k) * s);
  }
  g.computeBoundingBox();
  const box = g.boundingBox!;
  g.translate(0, -box.min.y, 0);
  g.scale(1, 1 / (box.max.y - box.min.y), 1);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A rhododendron thicket, one unit tall, base at 0: a low rounded mound (scaled wider than tall). */
export function shrubGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(0.5, 0);
  g.translate(0, 0.5, 0);
  g.computeVertexNormals();
  return g;
}
