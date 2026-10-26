import { createNoise2D } from '../../core/noise';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { walkable } from './dwelling';
import type { Water } from './water';

/**
 * The island's zones (docs/wonderland-world-plan.md, section 6): what kind of ground each place is,
 * read from the ground as built, not drawn. On a ZONE_CELL grid, from six measures of each place:
 *
 * - height and slope (the height grid);
 * - distance to water (the streams, the plunge pool, the terrace's pools), by a chamfer transform;
 * - shelter: how far the ground round it (a 24 m ring) stands above it (a hollow, a slope's foot);
 * - ridge: how far it stands above the ground round it (a 14 m ring), high up;
 * - reach: dry, walkable ground (the creature's own test), flood-filled into connected regions.
 *
 * The zone is the first rule that holds: water; terrace; cliff (bare rock, too steep for anything);
 * ridge; rock slope; wet shore (near water, gentle); woodland (where trees would take: moist,
 * sheltered, gentle, and in clumps, with clearings between; groves smaller than `minGrove` left
 * open); habitat (dry, near level, sheltered, within a walk of water, on reachable ground); and the
 * rest open stone, the white ground left empty (留白).
 *
 * Pure: the same ground, water and seed give the same zones.
 */
export const ZONE = { outside: 0, water: 1, terrace: 2, cliff: 3, ridge: 4, rockSlope: 5, wetShore: 6, woodland: 7, habitat: 8, open: 9 } as const;
export const ZONE_NAMES = ['outside', 'water', 'terrace', 'cliff', 'ridge', 'rockSlope', 'wetShore', 'woodland', 'habitat', 'open'] as const;
export const ZONE_CELL = 2; // metres

export interface ZoneParams {
  /** Woodland where its suitability passes this (0 to about 1.3; higher: less woodland). */
  woodland: number;
  /** Groves smaller than this (m²) are left open. */
  minGrove: number;
}
export const ZONE_DEFAULTS: ZoneParams = { woodland: 0.72, minGrove: 300 };

/** The rules' numbers (metres, or rise over run). */
const RULE = {
  outline: 4, // metres in from the island's edge the zones start
  cliff: 1.0, // slope
  rockSlope: 0.45,
  ridge: { rise: 2.5, above: 30, ring: 14 },
  shelterRing: 24,
  wetShore: { reach: 10, slope: 0.3 },
  habitat: { slope: 0.1, water: [8, 70], shelter: 0.6 },
  moisture: { near: 8, fade: 45 }, // full within `near` of water, falling off over `fade`
  minRegion: 400, // m²: dry-land regions smaller than this are not counted
};

export interface Zones {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  zone: Uint8Array;
  /** Woodland suitability over its threshold, 0 (at the edge) to 1 (a grove's heart); 0 elsewhere. */
  grove: Float32Array;
  /** Moisture, 0 to 1. */
  moisture: Float32Array;
  /** Metres to the nearest water (streams, pools, the terrace's pools). */
  toWater: Float32Array;
  /** The dry-land region each cell belongs to (index into `regions`), or -1. */
  region: Int32Array;
  regions: { area: number; x: number; z: number }[];
  /** Area per zone (m²), in ZONE order. */
  area: number[];
  ms: number;
}

/** The island's zones for this ground, water and seed. `terrace` is the lowest plate's signed distance. */
export function buildZones(grid: HeightGrid, water: Water, terrace: (x: number, z: number) => number, seed: number, p: ZoneParams = ZONE_DEFAULTS): Zones {
  const t0 = performance.now();
  const cell = ZONE_CELL, half = ((grid.size - 1) * grid.texel) / 2;
  const nx = Math.floor((2 * half) / cell), nz = nx, n = nx * nz;
  const x0 = -half, z0 = -half;
  const at = (i: number) => x0 + (i + 0.5) * cell, atZ = (j: number) => z0 + (j + 0.5) * cell;
  const world = { grid, water, terrace, seed };
  // The water mask is per texel of the height grid.
  const wetAt = (x: number, z: number) => {
    const i = Math.round(x / grid.texel + (grid.size - 1) / 2), j = Math.round(z / grid.texel + (grid.size - 1) / 2);
    return i >= 0 && j >= 0 && i < grid.size && j < grid.size && water.mask[j * grid.size + i] > 0;
  };
  const inside = new Uint8Array(n), wet = new Uint8Array(n), onTerrace = new Uint8Array(n);
  const h = new Float32Array(n), slope = new Float32Array(n);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = at(i), z = atZ(j), t = j * nx + i;
    inside[t] = sampleGrid(grid, x, z, 3) < -RULE.outline ? 1 : 0;
    if (!inside[t]) continue;
    h[t] = sampleGrid(grid, x, z);
    slope[t] = Math.hypot(sampleGrid(grid, x, z, 1), sampleGrid(grid, x, z, 2));
    onTerrace[t] = terrace(x, z) < 0 ? 1 : 0;
    wet[t] = wetAt(x, z) ? 1 : 0;
  }
  // Distance to water (a two-pass chamfer transform).
  const toWater = new Float32Array(n).fill(1e9);
  for (let t = 0; t < n; t++) if (wet[t] || onTerrace[t]) toWater[t] = 0;
  const D = cell * Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i;
    if (i) toWater[t] = Math.min(toWater[t], toWater[t - 1] + cell);
    if (j) toWater[t] = Math.min(toWater[t], toWater[t - nx] + cell);
    if (i && j) toWater[t] = Math.min(toWater[t], toWater[t - nx - 1] + D);
    if (i + 1 < nx && j) toWater[t] = Math.min(toWater[t], toWater[t - nx + 1] + D);
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const t = j * nx + i;
    if (i + 1 < nx) toWater[t] = Math.min(toWater[t], toWater[t + 1] + cell);
    if (j + 1 < nz) toWater[t] = Math.min(toWater[t], toWater[t + nx] + cell);
    if (i + 1 < nx && j + 1 < nz) toWater[t] = Math.min(toWater[t], toWater[t + nx + 1] + D);
    if (i && j + 1 < nz) toWater[t] = Math.min(toWater[t], toWater[t + nx - 1] + D);
  }
  const ring = (x: number, z: number, r: number) => {
    let s = 0;
    for (let a = 0; a < 12; a++) s += sampleGrid(grid, x + Math.cos((a / 12) * 2 * Math.PI) * r, z + Math.sin((a / 12) * 2 * Math.PI) * r);
    return s / 12;
  };
  // Dry-land regions: the creature's walkable ground, connected (four ways).
  const region = new Int32Array(n).fill(-1);
  const walk = new Uint8Array(n);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i;
    walk[t] = inside[t] && !wet[t] && !onTerrace[t] && walkable(world, at(i), atZ(j)) ? 1 : 0;
  }
  const regions: Zones['regions'] = [];
  {
    const label = new Int32Array(n).fill(-1);
    let next = 0;
    const comps: { cells: number[] }[] = [];
    for (let t = 0; t < n; t++) {
      if (!walk[t] || label[t] >= 0) continue;
      const cells: number[] = [], stack = [t];
      label[t] = next;
      while (stack.length) {
        const u = stack.pop()!, i = u % nx, j = (u - i) / nx;
        cells.push(u);
        for (const v of [i + 1 < nx ? u + 1 : -1, i ? u - 1 : -1, j + 1 < nz ? u + nx : -1, j ? u - nx : -1]) {
          if (v >= 0 && walk[v] && label[v] < 0) { label[v] = next; stack.push(v); }
        }
      }
      comps.push({ cells });
      next++;
    }
    for (const c of comps) {
      const area = c.cells.length * cell * cell;
      if (area < RULE.minRegion) continue;
      let sx = 0, sz = 0;
      for (const u of c.cells) { sx += at(u % nx); sz += atZ(Math.floor(u / nx)); region[u] = regions.length; }
      regions.push({ area, x: sx / c.cells.length, z: sz / c.cells.length });
    }
  }
  // The zones.
  const noise = createNoise2D(seed + 91);
  const zone = new Uint8Array(n), grove = new Float32Array(n), moisture = new Float32Array(n);
  const shelterOf = new Float32Array(n);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i, x = at(i), z = atZ(j);
    if (!inside[t]) continue;
    moisture[t] = Math.exp(-Math.max(toWater[t] - RULE.moisture.near, 0) / RULE.moisture.fade);
    if (wet[t]) { zone[t] = ZONE.water; continue; }
    if (onTerrace[t]) { zone[t] = ZONE.terrace; continue; }
    const s = slope[t];
    if (s > RULE.cliff) { zone[t] = ZONE.cliff; continue; }
    if (h[t] > RULE.ridge.above && h[t] - ring(x, z, RULE.ridge.ring) > RULE.ridge.rise) { zone[t] = ZONE.ridge; continue; }
    if (s > RULE.rockSlope) { zone[t] = ZONE.rockSlope; continue; }
    if (toWater[t] < RULE.wetShore.reach && s < RULE.wetShore.slope) { zone[t] = ZONE.wetShore; continue; }
    const shelter = ring(x, z, RULE.shelterRing) - h[t];
    shelterOf[t] = shelter;
    // Where trees would take: moisture most, then shelter and gentle ground; in clumps (a broad
    // noise, about 80 m, and half as much at 40 m: groves with clearings, not a scatter).
    const suit = 0.55 * moisture[t] + 0.25 * Math.min(Math.max(shelter / 4, 0), 1) + 0.2 * (1 - s / RULE.rockSlope)
      + 0.45 * (noise(x / 80, z / 80) + 0.4 * noise(x / 40 + 17, z / 40 - 9));
    if (suit > p.woodland) { zone[t] = ZONE.woodland; grove[t] = Math.min((suit - p.woodland) / 0.25, 1); continue; }
    zone[t] = habitatOrOpen(t);
  }
  function habitatOrOpen(t: number) {
    const H = RULE.habitat;
    return region[t] >= 0 && slope[t] < H.slope && toWater[t] > H.water[0] && toWater[t] < H.water[1] && shelterOf[t] > H.shelter ? ZONE.habitat : ZONE.open;
  }
  // Groves too small to read as woodland are left open.
  {
    const seen = new Uint8Array(n);
    for (let t = 0; t < n; t++) {
      if (zone[t] !== ZONE.woodland || seen[t]) continue;
      const cells: number[] = [], stack = [t];
      seen[t] = 1;
      while (stack.length) {
        const u = stack.pop()!, i = u % nx, j = (u - i) / nx;
        cells.push(u);
        for (const v of [i + 1 < nx ? u + 1 : -1, i ? u - 1 : -1, j + 1 < nz ? u + nx : -1, j ? u - nx : -1]) {
          if (v >= 0 && zone[v] === ZONE.woodland && !seen[v]) { seen[v] = 1; stack.push(v); }
        }
      }
      if (cells.length * cell * cell < p.minGrove) for (const u of cells) { zone[u] = habitatOrOpen(u); grove[u] = 0; }
    }
  }
  const area = new Array(ZONE_NAMES.length).fill(0);
  for (let t = 0; t < n; t++) area[zone[t]] += cell * cell;
  return { x0, z0, cell, nx, nz, zone, grove, moisture, toWater, region, regions, area, ms: performance.now() - t0 };
}

/** The zone at (x, z). */
export function zoneAt(z: Zones, x: number, y: number): number {
  const i = Math.floor((x - z.x0) / z.cell), j = Math.floor((y - z.z0) / z.cell);
  return i >= 0 && j >= 0 && i < z.nx && j < z.nz ? z.zone[j * z.nx + i] : ZONE.outside;
}
