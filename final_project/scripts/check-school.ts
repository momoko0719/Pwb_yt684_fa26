// The school (docs/plan-2026-11-18-school-herd.md): run the streamlings by their own rules
// (streamFish.ts stepFish, schoolRules.ts) for ten minutes at the island's default 10× and check:
// none leaves deep water, none overlaps another, the school stays together (no fish far from the
// rest for long), none sticks still while the school roams, and both states (roam, hold) happen.
// Run from final_project: npx tsx scripts/check-school.ts [seeds, comma-separated] [seconds]
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { createStreamFish, stepFish } from '../src/experiments/wonderland-terrain/streamFish';
import { schoolShape } from '../src/experiments/wonderland-terrain/schoolRules';

const SEEDS = (process.argv[2] ?? '684,7,42').split(',').map(Number);
const SECONDS = Number(process.argv[3] ?? 600);
const DT = 1 / 30, SPEED = 10;
let bad = 0;
for (const seed of SEEDS) {
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const fish = createStreamFish(seed, water, grid);
  if (!fish.length) { console.log(`seed ${seed}: no fish`); bad++; continue; }
  let shallow = 0, overlap = 0, steps = 0, apart = 0, holdSteps = 0, switches = 0, orderSum = 0, spreadSum = 0, spreadMax = 0;
  const lone = new Array(fish.length).fill(0), still = new Array(fish.length).fill(0);
  let worstLone = 0, worstStill = 0, last = fish[0].state;
  for (let t = 0; t < SECONDS; t += DT) {
    for (const f of fish) stepFish(f, fish, DT, DT * SPEED);
    steps++;
    const shape = schoolShape(fish.map((f) => ({ x: f.now.x, z: f.now.z, heading: f.now.heading, length: f.length })));
    orderSum += shape.order; spreadSum += shape.spread; spreadMax = Math.max(spreadMax, shape.spread);
    if (fish[0].state === 'hold') holdSteps++;
    if (fish[0].state !== last) { switches++; last = fish[0].state; }
    fish.forEach((f, i) => {
      if (!f.pool.deepAt(f.now.x, f.now.z)) shallow++;
      // Nearest other fish.
      let near = Infinity;
      for (const o of fish) if (o !== f) near = Math.min(near, Math.hypot(o.now.x - f.now.x, o.now.z - f.now.z));
      if (near < f.length * 0.35) overlap++;
      // Alone: no fish within the attract zone.
      if (near > f.length * f.pool.school.params.attract) { lone[i] += DT; apart++; } else lone[i] = 0;
      worstLone = Math.max(worstLone, lone[i]);
      if (f.state === 'explore' && f.now.speed < 0.02) still[i] += DT; else still[i] = 0;
      worstStill = Math.max(worstStill, still[i]);
    });
  }
  const n = fish.length, faults: string[] = [];
  if (shallow) faults.push(`${shallow} fish-steps in shallow water`);
  if (overlap / (steps * n) > 0.01) faults.push(`overlapping ${(100 * overlap / (steps * n)).toFixed(1)}% of the time`);
  if (worstLone > 30) faults.push(`a fish alone for ${worstLone.toFixed(0)} s`);
  if (worstStill > 20) faults.push(`a fish still while roaming for ${worstStill.toFixed(0)} s`);
  if (switches < 2) faults.push(`school never switched between roam and hold (${switches})`);
  if (faults.length) bad++;
  console.log(`seed ${seed}: ${n} fish · order ${(orderSum / steps).toFixed(2)} · spread ${(spreadSum / steps).toFixed(1)} m (max ${spreadMax.toFixed(1)}) · holding ${(100 * holdSteps / steps).toFixed(0)}% · ${switches} switches · alone ${(100 * apart / (steps * n)).toFixed(1)}% · ${faults.length ? faults.join('; ') : 'ok'}`);
}
console.log(bad ? `${bad} seeds fail` : 'all seeds hold');
process.exit(bad ? 1 : 0);
