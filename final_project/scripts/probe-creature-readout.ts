/**
 * One leave → drink → return, printed from the simulation the page runs.
 * Not a picture. Usage: npx tsx scripts/probe-creature-readout.ts [seeds]
 */
import { createDwelling, type Dwelling } from '../src/experiments/wonderland-terrain/dwelling';
import { placeHabitat } from '../src/experiments/wonderland-terrain/habitatStones';
import { placeShelter } from '../src/experiments/wonderland-terrain/rockShelter';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const seeds = (process.argv[2] ?? '684,42').split(',').map(Number);

function boot(seed: number): Dwelling | null {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const dwelling = createDwelling({ grid, water, terrace: rules.plate(0), seed, zones });
  if (!dwelling) return null;
  const woods = growWoods(zones, grid, seed, siteKeepOuts(dwelling.sites));
  const trees = [...woods.trees, ...woods.lone];
  const folds = buildRockFolds(grid, rules.meadow);
  const shrubs = growShrubs(zones, grid, folds, seed, trees, [dwelling.sites.region]);
  const layout = placeHabitat({
    seed, dwelling, zones, trees,
    shrubs: shrubs.plants.map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 })),
    pose: { x: dwelling.pose.x, z: dwelling.pose.z },
  });
  const shelter = placeShelter({ dwelling, obstacles: layout.obstacles, seed });
  if (shelter.plan) {
    dwelling.setRestPlace({ bed: shelter.plan.bed, mouth: shelter.plan.mouth });
    dwelling.setObstacles(shelter.plan.obstacles);
  }
  dwelling.reset();
  return dwelling;
}

function line(d: Dwelling, tag: string) {
  const p = d.pose;
  const feet = p.feet.map((f, k) => `${k}${p.planted[k] ? 'down' : 'up'}(${f[0].toFixed(1)},${f[2].toFixed(1)})`).join(' ');
  const goal = `${d.intent.kind} (${d.intent.x.toFixed(1)}, ${d.intent.z.toFixed(1)})`;
  const route = d.way ? `${d.way.length} pts` : 'none';
  console.log(`${tag} t=${d.time.toFixed(1)}s ${p.activity} goal=${goal} heading=${(p.heading * 180 / Math.PI).toFixed(0)}° move=(${d.intent.vx.toFixed(2)},${d.intent.vz.toFixed(2)}) route=${route} feet=${feet}`);
}

function until(d: Dwelling, activity: 'drink' | 'rest', cap: number) {
  const start = d.time;
  while (d.pose.activity !== activity && d.time - start < cap) d.step(0.25);
}

for (const seed of seeds) {
  const d = boot(seed);
  if (!d) { console.log(`seed ${seed}: no dwelling`); continue; }
  const home = d.sites.homes[0];
  const bed = d.restPlace?.bed;
  console.log(`\nseed ${seed} home A (${home.x.toFixed(1)}, ${home.z.toFixed(1)}) lie ${bed ? `(${bed.x.toFixed(1)}, ${bed.z.toFixed(1)})` : 'anchor'} drink (${d.sites.drink.x.toFixed(1)}, ${d.sites.drink.z.toFixed(1)}) water y=${d.sites.drink.water[1].toFixed(2)}`);
  line(d, 'rest');
  d.headFor('drink');
  line(d, 'leave');
  until(d, 'drink', 180);
  d.step(2);
  line(d, 'drink');
  const w = d.stand?.water;
  if (w) {
    const gap = Math.hypot(d.pose.muzzle[0] - w[0], d.pose.muzzle[1] - w[1], d.pose.muzzle[2] - w[2]);
    console.log(`  muzzle to water ${gap.toFixed(2)} m (drinking ${d.pose.drinking.toFixed(2)})`);
  }
  d.headFor('rest');
  line(d, 'return');
  until(d, 'rest', 180);
  line(d, 'home');
  const walk = d.map.walk.reduce((s, v) => s + v, 0);
  console.log(`  contact sum walk=${walk.toFixed(1)} (route line is separate from this map)`);
}
