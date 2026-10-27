/** Count grove vs lone pines. Usage: npx tsx scripts/probe-lone-pines.ts 684,5676,7,42 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';
import { growWoods } from '../src/experiments/wonderland-terrain/woods';

for (const seed of (process.argv[2] ?? '684,5676,7,42').split(',').map(Number)) {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const w = growWoods(zones, grid, seed, []);
  console.log(`seed ${seed}: grove ${w.trees.length}, lone ${w.lone.length}`);
}
