/** Dump rule-picked habitat camera frames + disc grass. npx tsx scripts/probe-habitat-views.ts */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildCover, COVER_DEFAULTS } from '../src/experiments/wonderland-terrain/cover';
import { buildSites } from '../src/experiments/wonderland-terrain/CoverGrass';
import { pickHabitatViews, type HabitatView } from '../src/experiments/wonderland-terrain/habitatViews';
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
const views = pickHabitatViews(cover, zones, grid);

function summarize(h: HabitatView | null) {
  if (!h) return null;
  const b = buildSites(cover, grid, seed, h.x, h.z, null, COVER_DEFAULTS.amount);
  return {
    id: h.id,
    zone: h.zone,
    at: { x: +h.x.toFixed(1), z: +h.z.toFixed(1), y: +h.y.toFixed(2) },
    dens: +h.dens.toFixed(3),
    suit: +h.suit.toFixed(3),
    patch: +h.patch.toFixed(3),
    discClumps: b.stats.grassClumps,
    discBlades: b.stats.grassBlades,
    flowers: b.stats.flowerClumps,
    from: h.from.map((n) => +n.toFixed(1)),
    to: h.to.map((n) => +n.toFixed(1)),
  };
}

console.log(JSON.stringify({
  seed,
  wetShore: summarize(views.wetShore),
  woodEdge: summarize(views.woodEdge),
  openIsland: summarize(views.openIsland),
}, null, 2));
