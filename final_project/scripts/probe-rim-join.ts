/**
 * Measure top-skin vs rim-wall join. Usage: npx tsx scripts/probe-rim-join.ts [seed]
 * Does not prove GPU morph gaps — reports geometric mismatch between rim ring and height/outline field.
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { RIM_JOIN } from '../src/core/terrain/rimJoin';

const seed = Number(process.argv[2] ?? 684);
const params = { ...GROUND_DEFAULTS, seed };
const baked = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, baked.grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, baked.grid, terrace, WATER_DEFAULTS, seed);
// Match worker: re-sample rim Y after water carve
const rim = baked.rim.slice();
for (let k = 0; k < rim.length; k += 3) rim[k + 2] = sampleGrid(baked.grid, rim[k], rim[k + 1]);

const n = rim.length / 3;
let maxHDiff = 0, maxInwardToSolid = 0, sumInward = 0, oddChord = 0;
const samples: { i: number; x: number; z: number; hRim: number; hGrid: number; dh: number; inwardM: number }[] = [];
for (let k = 0; k < n; k++) {
  const x = rim[k * 3], z = rim[k * 3 + 1], hRim = rim[k * 3 + 2];
  const hGrid = sampleGrid(baked.grid, x, z);
  const dh = Math.abs(hRim - hGrid);
  maxHDiff = Math.max(maxHDiff, dh);
  const p = ((k - 1 + n) % n) * 3, q = ((k + 1) % n) * 3;
  const tx = rim[q] - rim[p], tz = rim[q + 1] - rim[p + 1], tl = Math.hypot(tx, tz) || 1;
  const nx = tz / tl, nz = -tx / tl;
  let inward = 0;
  for (let s = 0.1; s <= 4; s += 0.1) {
    const ox = sampleGrid(baked.grid, x - nx * s, z - nz * s, 3);
    if (ox < RIM_JOIN.flangeSolid) { inward = s; break; }
  }
  maxInwardToSolid = Math.max(maxInwardToSolid, inward);
  sumInward += inward;
  if (samples.length < 8 && (dh > 0.05 || inward > 1.2)) {
    samples.push({ i: k, x: +x.toFixed(1), z: +z.toFixed(1), hRim: +hRim.toFixed(3), hGrid: +hGrid.toFixed(3), dh: +dh.toFixed(3), inwardM: +inward.toFixed(2) });
  }
  if (k % 2 === 1) {
    const a = ((k - 1 + n) % n) * 3, b = ((k + 1) % n) * 3;
    const mx = (rim[a] + rim[b]) / 2, mz = (rim[a + 1] + rim[b + 1]) / 2;
    oddChord = Math.max(oddChord, Math.hypot(x - mx, z - mz));
  }
}

const coverOk = maxInwardToSolid <= RIM_JOIN.flangeInsetMax;
console.log(JSON.stringify({
  seed,
  rimPoints: n,
  heightMatch: { maxAbsDiffM: +maxHDiff.toFixed(4), note: 'rim Y vs sampleGrid at same xz after water re-sample' },
  topVsWall: {
    meanInwardToFlangeSolidM: +(sumInward / n).toFixed(3),
    maxInwardM: +maxInwardToSolid.toFixed(3),
    flangeInsetMax: RIM_JOIN.flangeInsetMax,
    outlineKeep: RIM_JOIN.outlineKeep,
    coverOk,
    note: 'Inward until outline<flangeSolid. Need flangeInsetMax ≥ maxInward (+ morph); top keeps to outlineKeep for overlap.',
  },
  undersideStride2: {
    maxOddPointOffChordM: +oddChord.toFixed(3),
    note: 'Legacy metric (STRIDE was 2). undersideMesh now STRIDE=1 — chord gap should be 0 at join.',
  },
  worstSamples: samples,
  layers: {
    top: `CDLOD discard if outline > ${RIM_JOIN.outlineKeep} (RIM_JOIN)`,
    side: `rimWall densified mid-edge + flange to outline < ${RIM_JOIN.flangeSolid}`,
    bottom: 'undersideMesh STRIDE=1 (matches rim density)',
    joinFix: 'shared RIM_JOIN; top overhang + denser flange; no fog/alpha hide',
  },
}, null, 2));
