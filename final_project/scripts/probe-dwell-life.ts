/**
 * One rest→drink→rest life cycle log in plain stages.
 * Usage: npx tsx scripts/probe-dwell-life.ts [seed] [home]
 */
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { cornerObstacles, planCorner } from '../src/experiments/wonderland-terrain/corner';
import { createDwelling, siteSkips } from '../src/experiments/wonderland-terrain/dwelling';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const seed = Number(process.argv[2] ?? 5676);
const homeAt = Number(process.argv[3] ?? 0);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const world = { grid, water, terrace: rules.plate(0), seed, zones };
const d = createDwelling(world);
if (!d) { console.log('no sites', siteSkips()); process.exit(1); }
d.home = Math.min(homeAt, d.sites.homes.length - 1);
const corner = planCorner(d);
d.setObstacles(cornerObstacles(corner));
d.reset();

const home = d.sites.homes[d.home];
const distHome = () => Math.hypot(d.pose.x - home.x, d.pose.z - home.z);
type Row = { stage: string; pos: string; goal: string; distHome: string; why: string; t: number };
const rows: Row = [] as unknown as Row[];
const log: Row[] = [];
let prev = d.pose.activity;
let prevNext = 'drink';
log.push({
  stage: '休息（开始）',
  pos: `(${d.pose.x.toFixed(1)}, ${d.pose.z.toFixed(1)})`,
  goal: '—',
  distHome: `${distHome().toFixed(2)} m`,
  why: 'reset 后在选定家园躺下；休息计时 50–90 s',
  t: d.time,
});

const DT = 0.05;
let sawWalkToDrink = false, sawDrink = false, sawWalkHome = false, sawRest2 = false;
while (d.time < 400 && !(sawRest2 && d.cycles >= 1)) {
  const before = d.pose.activity;
  const beforeWay = d.way;
  d.step(DT);
  const after = d.pose.activity;
  if (before === 'rest' && after === 'walk' && !sawWalkToDrink) {
    sawWalkToDrink = true;
    const g = d.stand ?? d.sites.drink;
    log.push({
      stage: '出发去饮水',
      pos: `(${d.pose.x.toFixed(1)}, ${d.pose.z.toFixed(1)})`,
      goal: `(${g.x.toFixed(1)}, ${g.z.toFixed(1)})`,
      distHome: `${distHome().toFixed(2)} m`,
      why: '休息计时结束；在附近饮水站中随机选一个，算干路行走路线',
      t: d.time,
    });
  }
  if (before === 'walk' && after === 'drink' && !sawDrink) {
    sawDrink = true;
    const g = d.stand ?? d.sites.drink;
    log.push({
      stage: '饮水',
      pos: `(${d.pose.x.toFixed(1)}, ${d.pose.z.toFixed(1)})`,
      goal: `水面 (${g.water[0].toFixed(1)}, ${g.water[2].toFixed(1)})`,
      distHome: `${distHome().toFixed(2)} m`,
      why: '走到站位；低头使嘴够到预先算好的有效水面点；饮水 15–26 s',
      t: d.time,
    });
  }
  if (before === 'drink' && after === 'walk' && sawDrink && !sawWalkHome) {
    sawWalkHome = true;
    log.push({
      stage: '返回家园',
      pos: `(${d.pose.x.toFixed(1)}, ${d.pose.z.toFixed(1)})`,
      goal: `(${home.x.toFixed(1)}, ${home.z.toFixed(1)}) ±0.7 m`,
      distHome: `${distHome().toFixed(2)} m`,
      why: '饮水计时结束；目标为当前家园附近 0.7 m 内可站立点（nearHome），不是改家园编号',
      t: d.time,
    });
  }
  if (before === 'walk' && after === 'rest' && sawWalkHome && !sawRest2) {
    sawRest2 = true;
    log.push({
      stage: '再休息',
      pos: `(${d.pose.x.toFixed(1)}, ${d.pose.z.toFixed(1)})`,
      goal: '—',
      distHome: `${distHome().toFixed(2)} m`,
      why: `回到家园附近并躺下；cycles=${d.cycles}`,
      t: d.time,
    });
  }
  void beforeWay; void prev; void prevNext;
}

console.log(`seed ${seed} home ${d.home}/${d.sites.homes.length}`);
console.log(`homes: ${d.sites.homes.map((h, i) => `${'ABC'[i]} (${h.x.toFixed(1)},${h.z.toFixed(1)})`).join(' ')}`);
console.log(`drink: (${d.sites.drink.x.toFixed(1)}, ${d.sites.drink.z.toFixed(1)}) stands=${d.sites.stands.length}`);
console.table(log.map((r) => ({ ...r, t: `${r.t.toFixed(1)}s` })));
