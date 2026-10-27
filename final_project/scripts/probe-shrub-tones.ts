/** Tone census for shrubs. Usage: npx tsx scripts/probe-shrub-tones.ts 684,5676 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { createDwelling } from '../src/experiments/wonderland-terrain/dwelling';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { shrubLeafMetrics } from '../src/experiments/wonderland-terrain/shrubLSystem';
import { shrubLodTriCounts } from '../src/experiments/wonderland-terrain/ShrubPatches';

const NAMES = ['warm-olive', 'ochre', 'iron-red'];
for (const seed of (process.argv[2] ?? '684,5676').split(',').map(Number)) {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const folds = buildRockFolds(grid, rules.meadow);
  const dwelling = createDwelling({ grid, water, terrace: rules.plate(0), seed, zones });
  const woods = growWoods(zones, grid, seed, dwelling ? siteKeepOuts(dwelling.sites) : []);
  const shrubs = growShrubs(zones, grid, folds, seed, [...woods.trees, ...woods.lone], dwelling ? [dwelling.sites.region] : []);
  const patchTone = [0, 0, 0];
  const plantTone = [0, 0, 0];
  const area = [0, 0, 0];
  for (const p of shrubs.patches) { patchTone[p.tone]++; area[p.tone] += Math.PI * p.r * p.r; }
  for (const p of shrubs.plants) plantTone[p.tone]++;
  console.log(`seed ${seed}: ${shrubs.patches.length} patches, ${shrubs.plants.length} plants`);
  for (let t = 0; t < 3; t++) {
    console.log(`  ${NAMES[t]}: ${patchTone[t]} patches (${area[t].toFixed(0)} m²), ${plantTone[t]} plants (${(100 * plantTone[t] / Math.max(shrubs.plants.length, 1)).toFixed(1)}%)`);
  }
}
const m = shrubLeafMetrics(0.8, 1.5);
const tris = shrubLodTriCounts(0);
console.log(`leaf @0.8 m plant: L ${m.worldLeafL.toFixed(3)} m × W ${m.worldLeafW.toFixed(3)} m; crown ~${m.crownWidth.toFixed(2)} m`);
console.log(`LOD tris (variant 0): near ${tris.near}, mid ${tris.mid}, far ${tris.far}`);
