/**
 * Shore / surface hard-edge diagnosis (seed 684 default).
 * Does not render — measures mask sharpness, bank slope near water, sheet stair edges,
 * and surface-weight jumps so we attribute before "blur colour".
 *
 * Run: npx tsx scripts/probe-shore-edges.ts [seed]
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildSurfaceBlend } from '../src/experiments/wonderland-terrain/surfaceBlend';
import { SEED } from '../src/experiments/wonderland-terrain/layout';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones, ZONE } from '../src/experiments/wonderland-terrain/zones';
import { sampleGrid } from '../src/core/terrain/heightGrid';

const seed = Number(process.argv[2] ?? SEED);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const surface = buildSurfaceBlend(zones, seed);

const { size, texel, data } = grid;
const n = size * size;
const at = (i: number) => (i - (size - 1) / 2) * texel;

/** Soft depth from water sheet field (bilinear-ish nearest). */
function depthAt(x: number, z: number): number {
  const f = water.field;
  if (!f) return -1;
  const i = Math.floor((x - f.x0) / f.step);
  const j = Math.floor((z - f.z0) / f.step);
  if (i < 0 || j < 0 || i >= f.nx || j >= f.nz) return -1;
  const u = j * f.nx + i;
  if (!(f.level[u] > -Infinity) || Number.isNaN(f.level[u])) return -1;
  return f.level[u] - sampleGrid(grid, x, z);
}

// --- A: water mask edge sharpness (baked light.b source) ---
let maskWet = 0, maskEdge = 0, maskHardJump = 0;
for (let j = 1; j < size - 1; j++) {
  for (let i = 1; i < size - 1; i++) {
    const m = water.mask[j * size + i];
    if (m > 8) maskWet++;
    const nbr = [
      water.mask[j * size + i + 1],
      water.mask[j * size + i - 1],
      water.mask[(j + 1) * size + i],
      water.mask[(j - 1) * size + i],
    ];
    const mn = Math.min(...nbr), mx = Math.max(...nbr);
    if (m > 8 && mn < 40) maskEdge++;
    if (Math.abs(m - nbr[0]) > 120 || Math.abs(m - nbr[2]) > 120) maskHardJump++;
  }
}

// --- B: bank slope within 4 m of wet cells (geometry facet risk) ---
const slopes: number[] = [];
let steepNearShore = 0;
for (let j = 2; j < size - 2; j += 2) {
  for (let i = 2; i < size - 2; i += 2) {
    if (water.mask[j * size + i] < 8) continue;
    // Sample 2–4 m out on land (dry neighbour direction)
    for (const [di, dj] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as [number, number][]) {
      const ii = i + di, jj = j + dj;
      if (water.mask[jj * size + ii] > 40) continue;
      const x = at(ii), z = at(jj);
      const gx = sampleGrid(grid, x, z, 1), gz = sampleGrid(grid, x, z, 2);
      const s = Math.hypot(gx, gz);
      slopes.push(s);
      if (s > 0.45) steepNearShore++;
      break;
    }
  }
}
slopes.sort((a, b) => a - b);
const pct = (p: number) => slopes.length ? slopes[Math.min(slopes.length - 1, Math.floor(p * slopes.length))] : 0;

// --- C: water sheet mesh — stair edge length vs soft depth contour ---
const sheet = water.sheets[0];
let edgeTris = 0, stairEdges = 0, meanEdgeLen = 0, edgeSamples = 0;
if (sheet) {
  const pos = sheet.positions;
  const dep = sheet.depths;
  const idx = sheet.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const depths = [dep[a], dep[b], dep[c]];
    const shallow = depths.filter((d) => d < 0.12).length;
    if (shallow === 0 || shallow === 3) continue;
    edgeTris++;
    const verts = [a, b, c];
    for (let e = 0; e < 3; e++) {
      const u = verts[e], v = verts[(e + 1) % 3];
      if (dep[u] >= 0.12 && dep[v] >= 0.12) continue;
      if (dep[u] < 0.02 && dep[v] < 0.02) continue;
      const dx = pos[u * 3] - pos[v * 3], dz = pos[u * 3 + 2] - pos[v * 3 + 2];
      const len = Math.hypot(dx, dz);
      meanEdgeLen += len;
      edgeSamples++;
      // Axis-aligned ~texel step → stair silhouette
      if (Math.abs(dx) < 0.05 || Math.abs(dz) < 0.05) stairEdges++;
    }
  }
}

// --- D: surface wet weight jumps (material block edges) ---
let surfWet = 0, surfHard = 0;
for (let j = 1; j < surface.nz - 1; j++) {
  for (let i = 1; i < surface.nx - 1; i++) {
    const t = j * surface.nx + i;
    const w = surface.rgba[t * 4];
    if (w < 20) continue;
    surfWet++;
    const r = surface.rgba[t * 4 + 4];
    const d = surface.rgba[(t + surface.nx) * 4];
    if (Math.abs(w - r) > 90 || Math.abs(w - d) > 90) surfHard++;
  }
}

// --- E: soft depth samples along a shore transect (field vs hard 0) ---
let softBand = 0, hardZero = 0, samples = 0;
if (water.plunge) {
  const { x: px, z: pz, radius } = water.plunge;
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    for (let r = radius - 2; r < radius + 8; r += 0.5) {
      const x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r;
      const d = depthAt(x, z);
      samples++;
      if (d > 0 && d < 0.14) softBand++;
      if (Math.abs(d) < 0.02) hardZero++;
    }
  }
}

const report = {
  seed,
  texel,
  attributionHints: {
    maskHardJumpsHigh: maskHardJump > maskWet * 0.08,
    steepBanksNearShore: steepNearShore > (slopes.length || 1) * 0.2,
    sheetStairEdges: stairEdges > edgeSamples * 0.4,
    surfaceWetBlocks: surfHard > surfWet * 0.05,
  },
  mask: {
    wetCells: maskWet,
    edgeCells: maskEdge,
    hardNeighbourJumps: maskHardJump,
    hardJumpShare: maskWet ? +(maskHardJump / maskWet).toFixed(3) : 0,
  },
  bankSlopeNearShore: {
    samples: slopes.length,
    p50: +pct(0.5).toFixed(3),
    p90: +pct(0.9).toFixed(3),
    steepAbove045: steepNearShore,
    steepShare: slopes.length ? +(steepNearShore / slopes.length).toFixed(3) : 0,
  },
  waterSheet: {
    edgeTris,
    stairAlignedShoreEdges: stairEdges,
    shoreEdgeSamples: edgeSamples,
    stairShare: edgeSamples ? +(stairEdges / edgeSamples).toFixed(3) : 0,
    meanShoreEdgeLenM: edgeSamples ? +(meanEdgeLen / edgeSamples).toFixed(3) : 0,
  },
  surfaceWet: {
    wetCells: surfWet,
    hardNeighbourJumps: surfHard,
    hardJumpShare: surfWet ? +(surfHard / surfWet).toFixed(3) : 0,
  },
  softDepthBand: { samples, softBand014m: softBand, nearZero: hardZero },
  zonesNearWater: (() => {
    let wet = 0, open = 0, wood = 0, cliff = 0;
    for (let t = 0; t < zones.zone.length; t++) {
      const z = zones.zone[t];
      if (z === ZONE.wetShore) wet++;
      else if (z === ZONE.open) open++;
      else if (z === ZONE.woodland) wood++;
      else if (z === ZONE.cliff || z === ZONE.rockSlope) cliff++;
    }
    return { wetShore: wet, open, woodland: wood, rockOrCliff: cliff };
  })(),
};

console.log(JSON.stringify(report, null, 2));
