/**
 * Rule-picked camera frames for representative habitats (seed-stable).
 * Does not change generation — only chooses where to look.
 */
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import type { CoverField } from './cover';
import { ZONE, ZONE_NAMES, type Zones } from './zones';

export type HabitatView = {
  id: 'wetShore' | 'woodEdge' | 'openIsland';
  labelKey: string;
  zone: string;
  x: number;
  z: number;
  y: number;
  /** Camera from / look-at — ground-facing, not sky-heavy. */
  from: [number, number, number];
  to: [number, number, number];
  dens: number;
  suit: number;
  patch: number;
};

function cellAt(cover: CoverField, i: number, j: number) {
  return j * cover.nx + i;
}

function frame(x: number, z: number, y: number, yaw = 0.9): { from: [number, number, number]; to: [number, number, number] } {
  const dist = 7.5;
  const eye = 3.4;
  const fx = x + Math.cos(yaw) * dist;
  const fz = z + Math.sin(yaw) * dist;
  return {
    from: [fx, y + eye, fz],
    to: [x, y + 0.35, z],
  };
}

function scoreWet(cover: CoverField, zones: Zones, t: number) {
  if (zones.zone[t] !== ZONE.wetShore) return -1;
  const d = cover.density[t], p = cover.patch[t], s = cover.suit[t];
  if (s < 0.12 || p < 0.35) return -1;
  // Prefer open stream banks (near water, not cliff/terrace folds / mountain creases).
  const tw = zones.toWater[t];
  if (tw < 0.8 || tw > 14) return -1;
  const i = t % cover.nx, j = (t - i) / cover.nx;
  let cliffN = 0, openN = 0;
  for (const o of [-1, 1, -cover.nx, cover.nx]) {
    const u = t + o;
    if (u < 0 || u >= zones.zone.length) continue;
    const z = zones.zone[u];
    if (z === ZONE.cliff || z === ZONE.ridge || z === ZONE.terrace) cliffN++;
    if (z === ZONE.open || z === ZONE.habitat || z === ZONE.wetShore) openN++;
  }
  if (cliffN >= 2) return -1;
  void i; void j;
  return d * 2.5 + p + s + openN * 0.2 - Math.abs(tw - 4) * 0.08;
}

function scoreWoodEdge(cover: CoverField, zones: Zones, t: number) {
  if (zones.zone[t] !== ZONE.woodland) return -1;
  const g = zones.grove[t];
  // Prefer true edge band (not deep heart, not fringe zero).
  if (g < 0.06 || g > 0.55) return -1;
  const d = cover.density[t], p = cover.patch[t], s = cover.suit[t];
  if (s < 0.08) return -1;
  return d * 2.5 + p + (1 - Math.abs(g - 0.22) * 2);
}

function scoreOpenIsland(cover: CoverField, zones: Zones, t: number) {
  const z = zones.zone[t];
  if (z !== ZONE.open && z !== ZONE.habitat && z !== ZONE.rockSlope) return -1;
  const d = cover.density[t], p = cover.patch[t], s = cover.suit[t];
  // Must be a real grass island, not bilinear bleed.
  if (s < 0.1 || p < 0.45 || d < 0.08) return -1;
  return d * 2 + p * 1.5 + s;
}

function pickBest(
  cover: CoverField,
  zones: Zones,
  grid: HeightGrid,
  id: HabitatView['id'],
  labelKey: string,
  score: (t: number) => number,
): HabitatView | null {
  let best = { t: -1, score: -1 };
  const step = 2;
  for (let j = 2; j < cover.nz - 2; j += step) {
    for (let i = 2; i < cover.nx - 2; i += step) {
      const t = cellAt(cover, i, j);
      const sc = score(t);
      if (sc > best.score) best = { t, score: sc };
    }
  }
  if (best.t < 0 || best.score < 0) return null;
  const i = best.t % cover.nx, j = (best.t - i) / cover.nx;
  const x = cover.x0 + (i + 0.5) * cover.cell;
  const z = cover.z0 + (j + 0.5) * cover.cell;
  const y = sampleGrid(grid, x, z);
  if (!(y > -50)) return null;
  const { from, to } = frame(x, z, y, (i * 0.37 + j * 0.19) % (Math.PI * 2));
  return {
    id,
    labelKey,
    zone: ZONE_NAMES[zones.zone[best.t]] ?? '?',
    x, z, y,
    from, to,
    dens: cover.density[best.t],
    suit: cover.suit[best.t],
    patch: cover.patch[best.t],
  };
}

/** Three representative views from the same cover field the scene uses. */
export function pickHabitatViews(cover: CoverField, zones: Zones, grid: HeightGrid): {
  wetShore: HabitatView | null;
  woodEdge: HabitatView | null;
  openIsland: HabitatView | null;
} {
  return {
    wetShore: pickBest(cover, zones, grid, 'wetShore', 'leva.coverLookWet', (t) => scoreWet(cover, zones, t)),
    woodEdge: pickBest(cover, zones, grid, 'woodEdge', 'leva.coverLookWood', (t) => scoreWoodEdge(cover, zones, t)),
    openIsland: pickBest(cover, zones, grid, 'openIsland', 'leva.coverLookOpen', (t) => scoreOpenIsland(cover, zones, t)),
  };
}
