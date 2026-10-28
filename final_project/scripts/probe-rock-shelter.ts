/**
 * Rock shelter: one home on seed 684 must be enterable, and the lie must be inside.
 * Other homes and seeds may skip. Usage: npx tsx scripts/probe-rock-shelter.ts [seeds]
 */
import { BODY, createDwelling, siteSkips, walkable, type Dwelling, type Pose } from '../src/experiments/wonderland-terrain/dwelling';
import { placeHabitat } from '../src/experiments/wonderland-terrain/habitatStones';
import { shelterClearance, shelterContains, shelterFormFault, shelterLocal, placeShelter, type ShelterPlan } from '../src/experiments/wonderland-terrain/rockShelter';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const seeds = (process.argv[2] ?? '684').split(',').map(Number);
const form = shelterFormFault();
console.log(form ? `FORM FAULT: ${form}` : 'form: bed and centre line stay outside inflated walls');

function boot(seed: number) {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const world = { grid, water, terrace: rules.plate(0), seed, zones };
  const dwelling = createDwelling(world);
  if (!dwelling) return null;
  const woods = growWoods(zones, grid, seed, siteKeepOuts(dwelling.sites));
  const trees = [...woods.trees, ...woods.lone];
  const folds = buildRockFolds(grid, rules.meadow);
  const shrubs = growShrubs(zones, grid, folds, seed, trees, [dwelling.sites.region]);
  return { world, dwelling, zones, trees, shrubs };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function restAt(d: Dwelling, x: number, z: number) {
  const m = d.map;
  const i = Math.floor((x - m.x0) / m.texel), j = Math.floor((z - m.z0) / m.texel);
  if (i < 0 || j < 0 || i >= m.cells || j >= m.cells) return 0;
  return m.rest[j * m.cells + i];
}

/** Body, muzzle, and a point above the muzzle for the horns. */
function hitsStone(plan: ShelterPlan, p: Pose) {
  const pts: [number, number, number][] = [
    [p.x, p.y + p.torso + BODY.torso.up * (p.lying > 0.5 ? 0.4 : 1), p.z],
    [p.muzzle[0], p.muzzle[1], p.muzzle[2]],
    [p.muzzle[0], p.muzzle[1] + 0.32 * (1 - p.lying), p.muzzle[2]],
  ];
  return pts.some(([x, y, z]) => shelterContains(plan, x, y, z));
}

function play(dwelling: Dwelling, plan: ShelterPlan, world: Parameters<typeof walkable>[0]) {
  const fail: string[] = [];
  dwelling.setRestPlace({ bed: plan.bed, mouth: plan.mouth });
  dwelling.setObstacles(plan.obstacles);
  dwelling.reset();
  const p = dwelling.pose;
  const atBed = Math.hypot(p.x - plan.bed.x, p.z - plan.bed.z);
  if (atBed > 0.05) fail.push(`reset is ${atBed.toFixed(2)} m off the bed`);
  if (hitsStone(plan, p)) fail.push('lying pose starts inside stone');
  const [lx0, lz0] = shelterLocal(plan, p.x, p.z);
  if (lx0 < -1.2 || lx0 > 0.5 || Math.abs(lz0) > 1.1) fail.push(`lie local (${lx0.toFixed(2)}, ${lz0.toFixed(2)}) is not in the hollow`);

  // Out through the mouth, then back in, then out again.
  dwelling.headFor('drink');
  let left = false, clips = 0, off = 0, steps = 0;
  while (steps < 8000 && dwelling.pose.activity !== 'drink') {
    dwelling.step(0.05);
    steps++;
    if (hitsStone(plan, dwelling.pose)) clips++;
    if (!walkable(world, dwelling.pose.x, dwelling.pose.z)) off++;
    const [lx] = shelterLocal(plan, dwelling.pose.x, dwelling.pose.z);
    if (lx > 2.4 && dwelling.pose.lying < 0.05) left = true;
  }
  if (!left) fail.push('did not leave through the mouth');
  if (dwelling.pose.activity !== 'drink') fail.push('did not reach the drink');

  const before = restAt(dwelling, plan.bed.x, plan.bed.z);
  dwelling.headFor('rest');
  let sawMouth = false, stood = false, lay = false, headLow = false;
  steps = 0;
  while (steps < 8000 && !lay) {
    dwelling.step(0.05);
    steps++;
    const pose = dwelling.pose;
    if (hitsStone(plan, pose)) clips++;
    if (!walkable(world, pose.x, pose.z)) off++;
    const [lx, lz] = shelterLocal(plan, pose.x, pose.z);
    if (Math.hypot(pose.x - plan.mouth.x, pose.z - plan.mouth.z) < 1.6 && pose.activity === 'walk') sawMouth = true;
    if (pose.activity === 'rest' && pose.lying < 0.2 && Math.hypot(lx, lz) < 0.45) {
      stood = true;
      const clear = shelterClearance(plan, pose.x, pose.z, pose.y);
      if (clear < 2.05) headLow = true;
    }
    if (pose.activity === 'rest' && pose.lying >= 1 && Math.hypot(pose.x - plan.bed.x, pose.z - plan.bed.z) < 0.25) lay = true;
  }
  if (!sawMouth) fail.push('return did not pass the mouth');
  if (!stood) fail.push('did not stand inside before lying');
  if (!lay) fail.push('did not lie on the bed');
  if (headLow) fail.push('standing clearance under 2.05 m');
  const headingOff = Math.abs(wrap(dwelling.pose.heading - plan.bed.facing));
  if (lay && headingOff > 0.2) fail.push(`lie heading off by ${headingOff.toFixed(2)} rad`);
  // A little time lying, so the ground mark is the bed and not only the anchor.
  for (let i = 0; i < 40; i++) dwelling.step(0.05);
  const mark = restAt(dwelling, plan.bed.x, plan.bed.z);
  if (mark <= before) fail.push('no rest mark on the bed');
  const [lx1, lz1] = shelterLocal(plan, dwelling.pose.x, dwelling.pose.z);
  if (lx1 > 0.55) fail.push('lie is past the roof lip');

  dwelling.headFor('drink');
  let leftAgain = false;
  steps = 0;
  while (steps < 4000 && !leftAgain) {
    dwelling.step(0.05);
    steps++;
    if (hitsStone(plan, dwelling.pose)) clips++;
    if (!walkable(world, dwelling.pose.x, dwelling.pose.z)) off++;
    const [lx] = shelterLocal(plan, dwelling.pose.x, dwelling.pose.z);
    if (lx > 2.4 && dwelling.pose.lying < 0.05 && dwelling.pose.activity === 'walk') leftAgain = true;
  }
  if (!leftAgain) fail.push('did not get up and leave');
  if (clips) fail.push(`stone clipped the body on ${clips} steps`);
  if (off) fail.push(`off walkable ground on ${off} steps`);
  return { fail, mark, local: [lx1, lz1] as [number, number] };
}

let bad = 0;
for (const seed of seeds) {
  const b = boot(seed);
  if (!b) { console.log(`\nseed ${seed}: no sites`, siteSkips()); bad++; continue; }
  console.log(`\nseed ${seed}`);
  for (let hi = 0; hi < b.dwelling.sites.homes.length; hi++) {
    b.dwelling.home = hi;
    const layout = placeHabitat({
      seed, dwelling: b.dwelling, zones: b.zones, trees: b.trees,
      shrubs: b.shrubs.plants.map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 })),
      pose: null,
    });
    const found = placeShelter({ dwelling: b.dwelling, obstacles: layout.obstacles, seed });
    const home = b.dwelling.sites.homes[hi];
    if (!found.plan) {
      const line = `  home ${'ABC'[hi]} (${home.x.toFixed(1)}, ${home.z.toFixed(1)}): skipped — ${found.skip}`;
      console.log(line);
      if ((seed === 684 || seed === 42) && hi === 0) bad++;
      continue;
    }
    const p = found.plan;
    console.log(`  home ${'ABC'[hi]} anchor (${home.x.toFixed(1)}, ${home.z.toFixed(1)}) lie (${p.bed.x.toFixed(1)}, ${p.bed.z.toFixed(1)}) ${p.fromHome.toFixed(1)} m off, mirror ${p.mirror ? 'yes' : 'no'}`);
    console.log(`    exterior ${p.exterior.along.toFixed(2)} × ${p.exterior.across.toFixed(2)} × ${p.exterior.height.toFixed(2)} m mesh (bury 0.22), interior width ${p.interiorWidth.toFixed(2)} m, headroom ${p.headroomMin.toFixed(2)} m`);
    console.log(`    mouth (${p.mouth.x.toFixed(1)}, ${p.mouth.z.toFixed(1)}), drink align ${p.drinkAlign.toFixed(2)}, slope ${p.slope.toFixed(2)} m, walls ${p.walls.length}, tris ${p.triangles}`);
    if ((seed === 684 || seed === 42) && hi === 0) {
      const played = play(b.dwelling, p, b.world);
      console.log(`    lie local (${played.local[0].toFixed(2)}, ${played.local[1].toFixed(2)}), rest mark ${played.mark.toFixed(4)}`);
      if (played.fail.length) {
        bad++;
        for (const f of played.fail) console.log(`    FAIL ${f}`);
      } else console.log('    sequence: leave, return through the mouth, stand, lie, leave — ok');
    }
  }
}
if (form) bad++;
console.log(bad ? `\n${bad} shelter check(s) failed` : '\nshelter checks passed');
process.exit(bad ? 1 : 0);
