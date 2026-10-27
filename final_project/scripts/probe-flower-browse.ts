/**
 * Ordinary browse flower census at habitatViews (not flower-hotspot picks).
 * Usage: npx tsx scripts/probe-flower-browse.ts [seeds]
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';
import { buildCover } from '../src/experiments/wonderland-terrain/cover';
import { pickHabitatViews } from '../src/experiments/wonderland-terrain/habitatViews';

const NEAR = 16; // metres — ordinary near ground view

for (const seed of (process.argv[2] ?? '684,5676,7,42').split(',').map(Number)) {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const cover = buildCover(zones, grid, seed);
  const views = pickHabitatViews(cover, zones, grid);
  console.log(`\nseed ${seed} · island clumps ${cover.flowerAnchors.length}`);
  for (const key of ['wetShore', 'woodEdge', 'openIsland'] as const) {
    const v = views[key];
    if (!v) {
      console.log(`  ${key}: no habitat view`);
      continue;
    }
    const near = cover.flowerAnchors.filter((a) => Math.hypot(a.x - v.x, a.z - v.z) <= NEAR);
    const heads = near.reduce((s, a) => s + (a.heads ?? 0), 0);
    console.log(
      `  ${key} @ (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) dens=${v.dens.toFixed(2)} · `
      + `clumps≤${NEAR}m=${near.length} heads=${heads} ${near.length >= 2 && heads >= 5 ? 'OK' : 'THIN'}`,
    );
  }
}
