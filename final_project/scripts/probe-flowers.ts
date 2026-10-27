/** Flower anchor census. Usage: npx tsx scripts/probe-flowers.ts 684,5676,7,42 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';
import { buildCover, coverFieldStats } from '../src/experiments/wonderland-terrain/cover';

for (const seed of (process.argv[2] ?? '684,5676,7,42').split(',').map(Number)) {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const cover = buildCover(zones, grid, seed);
  const st = coverFieldStats(cover);
  const heads = cover.flowerAnchors.reduce((s, a) => s + (a.heads ?? 0), 0);
  console.log(`seed ${seed}: clumps ${st.flowerAnchors}, heads ${heads}, patchCells ${st.patchCells}`);
}
