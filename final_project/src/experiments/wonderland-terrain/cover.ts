import { createNoise2D } from '../../core/noise';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { createRng } from '../../core/rng';
import { blurField } from './surfaceBlend';
import { ZONE, type Zones } from './zones';

/**
 * Ground cover — three layers, shared by far tint and near blades/flowers:
 *
 * 1. **suit** [0,1]: can this place support vegetation? (zone + moisture + micro-relief × amount)
 * 2. **patch** [0,1]: where patches exist inside suitable land (留白 between)
 * 3. **density** = suit × (0.12 + 0.88×patch): far tint + flower bake
 *
 * Near blades use **patch interior density** separately: ~`clumpsPerM2` inside a full patch
 * (see CoverGrass), not suit×patch stacked through another RNG kill.
 *
 * Hard exclude (never suit): outside, water, cliff. Terrace / rockSlope may get rare niches.
 */
export interface CoverField {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  density: Float32Array;
  suit: Float32Array;
  patch: Float32Array;
  at: (x: number, z: number) => number;
  suitAt: (x: number, z: number) => number;
  patchAt: (x: number, z: number) => number;
  zoneAt: (x: number, z: number) => number;
  flowerAnchors: { x: number; y: number; z: number; heads: number }[];
}

export const COVER_DEFAULTS = {
  amount: 0.78,
  /** Soft floor for wet/wood patches (above → readable sheet). Lower = larger connected sheets. */
  patchFloor: 0.22,
  /**
   * Target clumps / m² **inside** a full patch (patch≈1, suit ok).
   * Prefer larger/connected patches over raising this further.
   */
  clumpsPerM2: 2.15,
  /** Island-wide flower clump cap (performance); coverage before stacking. */
  flowerMax: 144,
  flowerMinDens: 0.07,
  /** Min spacing between clumps — keep gaps, expand which patches get any flower. */
  flowerSep: 4.6,
};

export function coverFieldStats(cover: CoverField) {
  let sum = 0, n = 0, peak = 0, above = 0, patchCells = 0;
  for (let i = 0; i < cover.density.length; i++) {
    const d = cover.density[i];
    if (cover.patch[i] > 0.4 && cover.suit[i] >= 0.05) patchCells++;
    if (d <= 0) continue;
    n++;
    sum += d;
    peak = Math.max(peak, d);
    if (d >= 0.08) above++;
  }
  return {
    cellsWithCover: n,
    meanWherePresent: n ? sum / n : 0,
    peak,
    cellsAbove008: above,
    patchCells,
    flowerAnchors: cover.flowerAnchors.length,
  };
}

function soft(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function bilinear(field: Float32Array, nx: number, nz: number, x0: number, z0: number, cell: number, x: number, z: number) {
  const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell);
  if (i < 0 || j < 0 || i + 1 >= nx || j + 1 >= nz) return 0;
  const fx = (x - x0) / cell - i, fz = (z - z0) / cell - j;
  const a = field[j * nx + i], b = field[j * nx + i + 1], c = field[(j + 1) * nx + i], d = field[(j + 1) * nx + i + 1];
  return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
}

function nearestZone(zone: Uint8Array, nx: number, nz: number, x0: number, z0: number, cell: number, x: number, z: number) {
  const i = Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / cell)));
  const j = Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / cell)));
  return zone[j * nx + i];
}

/** Metres lower than local neighbours — micro hollow / toe of slope. */
function depression(grid: HeightGrid, x: number, z: number, r = 2.5): number {
  const y = sampleGrid(grid, x, z);
  if (!(y > -50)) return 0;
  let sum = 0, n = 0;
  for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7]] as [number, number][]) {
    const yy = sampleGrid(grid, x + dx, z + dz);
    if (yy > -50) { sum += yy; n++; }
  }
  if (!n) return 0;
  return Math.max(0, sum / n - y);
}

function bakeFlowerSites(
  density: Float32Array, zone: Uint8Array, x0: number, z0: number, cell: number, nx: number, nz: number,
  grid: HeightGrid, seed: number,
): { x: number; y: number; z: number; heads: number }[] {
  const rng = createRng(seed * 13 + 71);
  // Finer scan than before so wet shore / wood edge / open islands are not skipped by step=2.
  const step = 1;
  const cands: { x: number; z: number; score: number }[] = [];
  for (let j = 0; j < nz; j += step) {
    for (let i = 0; i < nx; i += step) {
      const t = j * nx + i, d = density[t], zid = zone[t];
      if (d < COVER_DEFAULTS.flowerMinDens) continue;
      // Prefer ordinary browse niches; skip bare rock / terrace seats.
      let niche = 0;
      if (zid === ZONE.wetShore) niche = 1.15;
      else if (zid === ZONE.woodland) niche = 1.0;
      else if (zid === ZONE.open || zid === ZONE.habitat) niche = 0.95;
      else continue;
      const x = x0 + (i + 0.5 + (rng() - 0.5) * 0.35) * cell;
      const z = z0 + (j + 0.5 + (rng() - 0.5) * 0.35) * cell;
      if (!(sampleGrid(grid, x, z) > -50) || sampleGrid(grid, x, z, 3) > -1.5) continue;
      // Higher accept rate so many suitable patches get *some* flower, not only density peaks.
      if (rng() > 0.42 + 0.55 * d * niche) continue;
      cands.push({ x, z, score: d * niche + rng() * 0.05 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const out: { x: number; y: number; z: number; heads: number }[] = [];
  for (const c of cands) {
    if (out.length >= COVER_DEFAULTS.flowerMax) break;
    if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < COVER_DEFAULTS.flowerSep)) continue;
    // Small clusters: 2–4 heads (readable, not giant blooms).
    const heads = 2 + Math.floor(rng() * 3);
    out.push({ x: c.x, y: sampleGrid(grid, c.x, c.z), z: c.z, heads });
  }
  return out;
}

export function buildCover(zones: Zones, grid: HeightGrid, seed: number, amount = COVER_DEFAULTS.amount): CoverField {
  const { x0, z0, cell, nx, nz, zone, grove, moisture, toWater } = zones;
  const n = nx * nz;
  const suit = new Float32Array(n);
  const patch = new Float32Array(n);
  const density = new Float32Array(n);
  const noise = createNoise2D(seed + 407);
  const atX = (i: number) => x0 + (i + 0.5) * cell;
  const atZ = (j: number) => z0 + (j + 0.5) * cell;

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const t = j * nx + i, z = zone[t];
      // Hard exclude: sea, water sheet, vertical cliff. (Terrace / rockSlope handled below.)
      if (z === ZONE.outside || z === ZONE.water || z === ZONE.cliff) continue;
      if (z === ZONE.ridge) continue; // keep ridge bare — wind / crest
      const x = atX(i), zz = atZ(j);
      const slope = Math.hypot(sampleGrid(grid, x, zz, 1), sampleGrid(grid, x, zz, 2));
      const hollow = depression(grid, x, zz);
      const moist = moisture[t];
      const tw = toWater[t];

      // Shared patch noise (wet/wood vs rarer open islands use different floors).
      const raw = 0.55 * (noise(x / 30, zz / 30) * 0.5 + 0.5) + 0.45 * (noise(x / 12 + 9, zz / 12 - 4) * 0.5 + 0.5);

      let s = 0;
      let patchW = 0;

      if (z === ZONE.wetShore) {
        // Steep banks → wet bare stone; gentle + concave → continuous readable grass sheets.
        // Proxies: toWater, slope, hollow — not hydrology/sediment simulation.
        if (slope > 0.52) continue; // keep steep bare; allow slightly steeper toes into sheet
        const bank = soft(0.5, 0.1, slope);
        const reach = soft(0.2, 10, tw) * (1 - soft(14, 26, tw) * 0.3);
        const bowl = 0.5 + 0.5 * soft(0.015, 0.32, hollow);
        // Continuity: two patch scales so sheets connect without equal-width ribbon.
        const sheet = soft(COVER_DEFAULTS.patchFloor - 0.04, COVER_DEFAULTS.patchFloor + 0.28, raw);
        const bridge = soft(0.35, 0.72, noise(x / 55 + 1, zz / 55 - 2) * 0.5 + 0.5);
        s = Math.min(1, 1.05 * moist * bank * reach * bowl);
        patchW = Math.max(sheet, bridge * soft(0.18, 0.42, bank * reach));
      } else if (z === ZONE.woodland) {
        if (slope > 0.42) continue;
        const g = grove[t];
        // Edge: canopy → litter (shader) + grass understorey; heart: sparse understorey only.
        const edge = soft(0.01, 0.38, g) * (1 - soft(0.38, 0.92, g));
        const heart = soft(0.28, 0.9, g) * 0.22;
        s = (0.95 * edge + heart) * (0.38 + 0.62 * moist);
        patchW = soft(COVER_DEFAULTS.patchFloor, COVER_DEFAULTS.patchFloor + 0.34, raw);
      } else if (z === ZONE.habitat) {
        if (slope > 0.3) continue;
        const niche = soft(0.28, 0.9, moist) * (0.3 + 0.7 * soft(0.02, 0.28, hollow));
        if (niche < 0.1) continue;
        s = 0.55 * niche;
        patchW = soft(0.4, 0.78, raw);
      } else if (z === ZONE.open) {
        if (slope > 0.34) continue;
        // Size variety: large (~48 m) + medium (~22 m) islands; hollows prefer larger.
        const large = soft(0.5, 0.78, noise(x / 48, zz / 48) * 0.5 + 0.5);
        const mid = soft(0.55, 0.82, noise(x / 22 + 5, zz / 22 - 3) * 0.5 + 0.5);
        const island = Math.max(large, mid * 0.85);
        const moistOk = soft(0.22, 0.88, moist);
        const hollowBoost = 0.5 + 0.5 * soft(0.015, 0.25, hollow);
        if (island * moistOk < 0.1) continue;
        s = 0.82 * island * moistOk * hollowBoost;
        patchW = island;
      } else if (z === ZONE.rockSlope) {
        // Toe / hollow with moisture → few grass islands; steep faces stay bare.
        if (slope > 0.55) continue;
        const island = soft(0.58, 0.86, noise(x / 40 + 2, zz / 40 - 1) * 0.5 + 0.5);
        const niche = soft(0.04, 0.32, hollow) * soft(0.25, 0.82, moist) * soft(0.55, 0.22, slope);
        if (island * niche < 0.09) continue;
        s = 0.6 * island * niche;
        patchW = island;
      } else if (z === ZONE.terrace) {
        // Pool bund / thin water sheet stay bare; wider dry seat may take sparse cover.
        if (tw < 1.2 || slope > 0.14) continue;
        const drySeat = soft(2.5, 10, tw) * soft(0.14, 0.04, slope);
        if (drySeat < 0.15) continue;
        s = 0.14 * drySeat * soft(0.25, 0.75, moist);
        patchW = soft(0.58, 0.9, raw);
      } else {
        continue;
      }

      suit[t] = Math.min(s * amount, 1);
      patch[t] = patchW;
      density[t] = Math.min(suit[t] * (0.12 + 0.88 * patchW), 1);
    }
  }

  const flowerAnchors = bakeFlowerSites(density, zone, x0, z0, cell, nx, nz, grid, seed);
  return {
    x0, z0, cell, nx, nz, density, suit, patch, flowerAnchors,
    at: (x, z) => bilinear(density, nx, nz, x0, z0, cell, x, z),
    suitAt: (x, z) => bilinear(suit, nx, nz, x0, z0, cell, x, z),
    patchAt: (x, z) => bilinear(patch, nx, nz, x0, z0, cell, x, z),
    zoneAt: (x, z) => nearestZone(zone, nx, nz, x0, z0, cell, x, z),
  };
}

/**
 * Soft density bytes for the far-tint texture only (LinearFilter + metre soft edge).
 * Near blade sampling still uses sharp suit/patch + hard excludes.
 */
export function softCoverDensityBytes(cover: CoverField, blendM = 12): Uint8Array {
  const { density, nx, nz, cell, x0, z0 } = cover;
  const n = nx * nz;
  const at = (t: number) => {
    const i = t % nx, j = (t - i) / nx;
    return cover.zoneAt(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell);
  };
  const dist = new Float32Array(n).fill(1e9);
  const peak = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    const z = at(t);
    if (z === ZONE.outside || z === ZONE.water) continue;
    if (density[t] >= 0.06) { dist[t] = 0; peak[t] = density[t]; }
  }
  const d1 = cell, d2 = cell * Math.SQRT2;
  const relax = (ti: number, t: number, d: number) => {
    if (ti < 0 || ti >= n) return;
    const nd = dist[ti] + d;
    if (nd < dist[t]) { dist[t] = nd; peak[t] = peak[ti]; }
    else if (Math.abs(nd - dist[t]) < 1e-6) peak[t] = Math.max(peak[t], peak[ti]);
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i;
    if (i) relax(t - 1, t, d1);
    if (j) relax(t - nx, t, d1);
    if (i && j) relax(t - nx - 1, t, d2);
    if (i + 1 < nx && j) relax(t - nx + 1, t, d2);
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const t = j * nx + i;
    if (i + 1 < nx) relax(t + 1, t, d1);
    if (j + 1 < nz) relax(t + nx, t, d1);
    if (i + 1 < nx && j + 1 < nz) relax(t + nx + 1, t, d2);
    if (i && j + 1 < nz) relax(t + nx - 1, t, d2);
  }
  const noise = createNoise2D((cover.x0 * 13 + cover.z0 * 17) | 0);
  const soft2 = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    const z = at(t);
    if (z === ZONE.outside || z === ZONE.water) continue;
    const i = t % nx, j = (t - i) / nx;
    const x = x0 + (i + 0.5) * cell, zz = z0 + (j + 0.5) * cell;
    const warp = noise(x / 34, zz / 34) * 7 + noise(x / 17 + 2, zz / 17) * 3;
    const edge = 1 - soft(0, blendM, dist[t] + warp);
    soft2[t] = Math.min(Math.max(density[t], peak[t] * edge * 0.85), 1);
  }
  // Blurred: each cell outside a patch takes its nearest patch cell's density (`peak`), and
  // neighbouring cells can take different ones; on the zones' 2 m cells that drew stepped edges.
  blurField(soft2, nx, nz, cell, BLUR_M);
  const out = new Uint8Array(n);
  for (let t = 0; t < n; t++) {
    const z = at(t);
    // (Water cells keep the blurred value: zeroed after the blur, they cut a stepped edge into it.)
    out[t] = z === ZONE.outside ? 0 : Math.round(Math.min(soft2[t], 1) * 255);
  }
  return out;
}

const BLUR_M = 4; // metres: the width of each box pass in the tint's blur
