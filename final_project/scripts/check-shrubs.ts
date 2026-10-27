// Project check (docs/shrubs-and-fold-colour-2026-10-27.md): the shrub patches on several seeds:
// how many patches and plants, where (by zone and place), sizes, none in water, on the terrace or
// steep ground, and the same built twice. Run from final_project: npx tsx scripts/check-shrubs.ts [seeds]
import { createHash } from 'crypto';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { createDwelling, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { buildZones, ZONE_NAMES } from '../src/experiments/wonderland-terrain/zones';

let failures = 0;
for (const seed of (process.argv[2] ?? '684,7,42').split(',').map(Number)) {
  const build = () => {
    const params = { ...GROUND_DEFAULTS, seed };
    const { grid } = bakeGround(params);
    const rules = groundRules(params);
    const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
    const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
    const zones = buildZones(grid, water, rules.plate(0), seed);
    const folds = buildRockFolds(grid, rules.meadow);
    const world = { grid, water, terrace: rules.plate(0), seed, zones };
    const dwelling = createDwelling(world);
    const woods = growWoods(zones, grid, seed, dwelling ? siteKeepOuts(dwelling.sites) : []);
    const shrubs = growShrubs(zones, grid, folds, seed, [...woods.trees, ...woods.lone], dwelling ? [dwelling.sites.region] : []);
    return { grid, world, zones, shrubs };
  };
  const { grid, world, zones, shrubs } = build();
  const byZone = new Map<string, number>();
  let wet = 0, steep = 0;
  for (const p of shrubs.plants) {
    const i = Math.floor((p.x - zones.x0) / zones.cell), j = Math.floor((p.z - zones.z0) / zones.cell);
    const z = ZONE_NAMES[zones.zone[j * zones.nx + i]];
    byZone.set(z, (byZone.get(z) ?? 0) + 1);
    if (waterDepth(world, p.x, p.z) > -0.05) wet++;
    if (Math.hypot(sampleGrid(grid, p.x, p.z, 1), sampleGrid(grid, p.x, p.z, 2)) > 0.62) steep++;
  }
  const radii = shrubs.patches.map((p) => p.r).sort((a, b) => a - b);
  const heights = shrubs.plants.map((p) => p.height).sort((a, b) => a - b);
  console.log(`seed ${seed}: ${shrubs.patches.length} patches (radius ${radii[0]?.toFixed(1)}–${radii[radii.length - 1]?.toFixed(1)} m), ${shrubs.plants.length} plants (height ${heights[0]?.toFixed(2)}–${heights[heights.length - 1]?.toFixed(2)} m), ${shrubs.ms.toFixed(0)} ms`);
  console.log(`  by zone: ${[...byZone].sort((a, b) => b[1] - a[1]).map(([z, c]) => `${z} ${c}`).join(', ')}`);
  if (wet || steep) { failures++; console.log(`  FAIL: ${wet} in or at water, ${steep} on steep ground`); }
  if (!shrubs.patches.length) { failures++; console.log('  FAIL: no patches'); }
  const again = build().shrubs;
  const h = (s: typeof shrubs) => createHash('md5').update(Buffer.from(new Float32Array(s.plants.flatMap((p) => [p.x, p.z, p.height])).buffer)).update(s.ground).digest('hex').slice(0, 10);
  if (h(again) !== h(shrubs)) { failures++; console.log('  FAIL: not reproducible'); } else console.log(`  reproducible (${h(shrubs)})`);
}
console.log(failures ? `${failures} failures` : 'all hold');
process.exit(failures ? 1 : 0);
