/** Time one full cover disc build (cache miss). npx tsx scripts/probe-cover-build.ts */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildCover } from '../src/experiments/wonderland-terrain/cover';
import { buildSites } from '../src/experiments/wonderland-terrain/CoverGrass';
import { SEED } from '../src/experiments/wonderland-terrain/layout';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const seed = Number(process.argv[2] ?? SEED);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const cover = buildCover(zones, grid, seed);

const runs = [];
for (const [x, z] of [[-20, 0], [-100, -40], [50, -80]] as [number, number][]) {
  const t0 = performance.now();
  const s = buildSites(cover, grid, seed, x, z, null, 0.7);
  runs.push({
    at: { x, z },
    blades: s.stats.grassBlades,
    clumps: s.stats.grassClumps,
    chunks: s.stats.pipe.chunks,
    buildMs_internal: +s.stats.pipe.buildMs.toFixed(2),
    wallMs: +(performance.now() - t0).toFixed(2),
  });
}
console.log(JSON.stringify({ seed, note: 'Full disc rebuild cost (cache miss). Runtime cache builds only new chunks.', runs }, null, 2));
