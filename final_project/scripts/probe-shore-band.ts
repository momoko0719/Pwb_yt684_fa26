/** Attribute pale bank water fragments for one seed. Usage: npx tsx scripts/probe-shore-band.ts 5676 */
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { createDwelling, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const seed = Number(process.argv[2] ?? 5676);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const world = { grid, water, terrace: rules.plate(0), seed, zones };
const dwelling = createDwelling(world);
const f = water.field!;
const L = f.level;

const shoreAt = (x: number, z: number) => {
  const g = (a: number, b: number) => sampleGrid(grid, a, b), s = grid.texel * 2;
  return (1.6 * g(x, z) + g(x + s, z) + g(x - s, z) + g(x, z + s) + g(x, z - s)
    + 0.65 * (g(x + s, z + s) + g(x - s, z + s) + g(x + s, z - s) + g(x - s, z - s))) / 8.2;
};

let spilling = 0, clipped = 0, visible = 0, worst = 0;
const edgeSamples: { x: number; z: number; over: number; depth: number }[] = [];
for (let j = 1; j + 1 < f.nz; j++) for (let i = 1; i + 1 < f.nx; i++) {
  const t = j * f.nx + i;
  if (Number.isNaN(L[t])) continue;
  if (!(Number.isNaN(L[t - 1]) || Number.isNaN(L[t + 1]) || Number.isNaN(L[t - f.nx]) || Number.isNaN(L[t + f.nx]))) continue;
  const x = f.x0 + i * f.step, z = f.z0 + j * f.step;
  if (sampleGrid(grid, x, z, 3) > -1.5) continue;
  const g = sampleGrid(grid, x, z);
  if (L[t] > g + 0.01) {
    spilling++;
    const sh = shoreAt(x, z);
    if (L[t] < sh + 0.012) clipped++;
    else {
      visible++;
      worst = Math.max(worst, L[t] - sh);
      if (edgeSamples.length < 15) edgeSamples.push({ x: +x.toFixed(1), z: +z.toFixed(1), over: +(L[t] - sh).toFixed(3), depth: +(L[t] - g).toFixed(3) });
    }
  }
}

let underBankWet = 0, underBankVis = 0;
const ub: typeof edgeSamples = [];
for (let j = 0; j < f.nz; j++) for (let i = 0; i < f.nx; i++) {
  const t = j * f.nx + i;
  if (Number.isNaN(L[t]) || f.mask[t] === 1) continue;
  const x = f.x0 + i * f.step, z = f.z0 + j * f.step;
  const g = sampleGrid(grid, x, z);
  if (!(L[t] > g + 0.01)) continue;
  underBankWet++;
  const sh = shoreAt(x, z);
  if (L[t] >= sh + 0.012) {
    underBankVis++;
    if (ub.length < 12) ub.push({ x: +x.toFixed(1), z: +z.toFixed(1), over: +(L[t] - sh).toFixed(3), depth: +(L[t] - g).toFixed(3) });
  }
}

const drink = dwelling?.sites.drink;
const drinkInfo = drink ? {
  stand: { x: +drink.x.toFixed(2), z: +drink.z.toFixed(2), y: +sampleGrid(grid, drink.x, drink.z).toFixed(3) },
  depthAtStand: +waterDepth(world, drink.x, drink.z).toFixed(3),
} : null;

console.log(JSON.stringify({
  seed,
  edge: { spilling, clipped, visibleAboveShore: visible, worstOverShoreM: +worst.toFixed(3), samples: edgeSamples },
  underBank: { wetButMask0: underBankWet, visibleAboveShore: underBankVis, samples: ub },
  drink: drinkInfo,
  maskVsField: {
    note: 'field.mask=1 only where level>ground; UNDER_BANK verts can have level with mask 0',
  },
}, null, 2));
