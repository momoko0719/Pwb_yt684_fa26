/**
 * Verify cover stream focus: buildSites at remote wetShore / woodland / open vs drink.
 * Run: npx tsx scripts/probe-cover-stream.ts [seed]
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildCover, COVER_DEFAULTS } from '../src/experiments/wonderland-terrain/cover';
import { buildSites, COVER_NEAR } from '../src/experiments/wonderland-terrain/CoverGrass';
import { SEED } from '../src/experiments/wonderland-terrain/layout';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones, ZONE, ZONE_NAMES } from '../src/experiments/wonderland-terrain/zones';
import { createDwelling } from '../src/experiments/wonderland-terrain/dwelling';

const seed = Number(process.argv[2] ?? SEED);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const cover = buildCover(zones, grid, seed, COVER_DEFAULTS.amount);
const dwelling = createDwelling({ grid, water, terrace: rules.plate(0), seed, zones });

function pick(want: number) {
  let best = { x: 0, z: 0, score: -1 };
  for (let j = 2; j < cover.nz - 2; j++) {
    for (let i = 2; i < cover.nx - 2; i++) {
      const t = j * cover.nx + i;
      if (zones.zone[t] !== want) continue;
      const d = cover.density[t];
      if (want !== ZONE.open && d < 0.05) continue;
      const x = cover.x0 + (i + 0.5) * cover.cell, z = cover.z0 + (j + 0.5) * cover.cell;
      if (d >= best.score) best = { x, z, score: d };
    }
  }
  return best;
}

const drink = dwelling?.sites.drink ?? { x: 0, z: 0 };
const wet = pick(ZONE.wetShore);
const wood = pick(ZONE.woodland);
const open = pick(ZONE.open);

function at(label: string, x: number, z: number) {
  const s = buildSites(cover, grid, seed, x, z, null, COVER_DEFAULTS.amount);
  const distDrink = Math.hypot(x - drink.x, z - drink.z);
  return {
    label, x: +x.toFixed(1), z: +z.toFixed(1), distToDrink_m: +distDrink.toFixed(1),
    blades: s.stats.grassBlades, clumps: s.stats.grassClumps, flowers: s.stats.flowerHeads,
    chunks: s.stats.pipe.chunks, focus: s.stats.focus,
  };
}

const out = {
  seed,
  stream: { radius: COVER_NEAR.radius, chunk: COVER_NEAR.chunk, lookAhead: COVER_NEAR.lookAhead },
  drink: { x: drink.x, z: drink.z },
  samples: [
    at('atDrink', drink.x, drink.z),
    at('remoteWetShore', wet.x, wet.z),
    at('remoteWoodland', wood.x, wood.z),
    at('remoteOpen', open.x, open.z),
  ],
  note: 'If remoteWetShore/woodland have blades while far from drink, stream is camera-centred not creature-centred.',
};
console.log(JSON.stringify(out, null, 2));
