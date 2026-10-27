/**
 * Attribute ground seams: sample height continuity and estimate CDLOD patch sides near a focus.
 * Usage: npx tsx scripts/probe-terrain-seam.ts [seed] [x] [z]
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { sampleGrid } from '../src/core/terrain/heightGrid';

const seed = Number(process.argv[2] ?? 684);
const fx = Number(process.argv[3] ?? -80);
const fz = Number(process.argv[4] ?? 40);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);

const root = 1024; // CDLOD root metres (default wonderland)
const levels = 5;
const finestSide = root / 2 ** levels; // ~32 m at level 5? wait levels count
// Actual settings from Scene — probe grid texel continuity instead.

let maxJump = 0, jumpAt: { x: number; z: number; d: number } | null = null;
const step = grid.texel;
for (let dz = -40; dz <= 40; dz += step) {
  for (let dx = -40; dx <= 40; dx += step) {
    const x = fx + dx, z = fz + dz;
    const h = sampleGrid(grid, x, z);
    const hx = sampleGrid(grid, x + step, z);
    const hz = sampleGrid(grid, x, z + step);
    const jx = Math.abs(hx - h), jz = Math.abs(hz - h);
    if (jx > maxJump) { maxJump = jx; jumpAt = { x, z, d: jx }; }
    if (jz > maxJump) { maxJump = jz; jumpAt = { x, z: z, d: jz }; }
  }
}

// Soft shore vs ground at focus ring (water sheet vs terrain)
let wetNear = 0, shoreGap = 0;
if (water.field) {
  const f = water.field;
  for (let a = 0; a < 36; a++) {
    const rad = (a / 36) * Math.PI * 2;
    for (const r of [2, 5, 10, 20]) {
      const x = fx + Math.cos(rad) * r, z = fz + Math.sin(rad) * r;
      const i = Math.round((x - f.x0) / f.step), j = Math.round((z - f.z0) / f.step);
      if (i < 0 || j < 0 || i >= f.nx || j >= f.nz) continue;
      const L = f.level[j * f.nx + i];
      if (Number.isNaN(L)) continue;
      wetNear++;
      const g = sampleGrid(grid, x, z);
      shoreGap = Math.max(shoreGap, L - g);
    }
  }
}

const eyeY = sampleGrid(grid, fx, fz) + 1.6;
console.log(JSON.stringify({
  seed, focus: { x: fx, z: fz, groundY: +sampleGrid(grid, fx, fz).toFixed(3), eyeY: +eyeY.toFixed(3) },
  heightField: {
    texel: grid.texel,
    maxNeighbourJumpM: +maxJump.toFixed(4),
    at: jumpAt,
    note: 'CPU height field is continuous bilinear; CDLOD morph cracks are GPU-only and need wireframe eye check',
  },
  waterNearFocus: { samplesWithLevel: wetNear, maxLevelAboveGroundM: +shoreGap.toFixed(3) },
  cameras: {
    orbitNear: 0.5, walkNear: 0.05, far: 5000,
    walkDepthRatio: 5000 / 0.05,
    orbitDepthRatio: 5000 / 0.5,
  },
  classifyHint: [
    '1 neighbour height jump on CPU grid → unlikely (bilinear)',
    '2 crack moves with wire patch borders / distance → CDLOD morph',
    '3 disappears when water hidden → sheet junction',
    '4 walk-only + grazing → near-clip / depth precision',
    '5 colour only under solid wire → material/weather not geometry',
  ],
}, null, 2));
