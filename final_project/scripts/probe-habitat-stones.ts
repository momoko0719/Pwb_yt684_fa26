/**
 * Habitat stones: seats, shore groups, smoothed round trips, obstacle swap on A/B/C.
 * Usage: npx tsx scripts/probe-habitat-stones.ts [seeds comma-separated]
 */
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { obstaclesWithHeld, placeHabitat, stoneGeometry, stonesWithHeld } from '../src/experiments/wonderland-terrain/habitatStones';
import { createDwelling, siteSkips, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const seeds = (process.argv[2] ?? '684,5676,7,42').split(',').map(Number);

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
  const shrubCircles = shrubs.plants.map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 }));
  return { grid, world, dwelling, zones, trees, shrubCircles };
}

function fmt(s: { x: number; z: number; bounds: { size: number[] }; planR: number; obstacleR: number; shape: { length: number; width: number; height: number; bury: number }; triangles: number; y: number }) {
  const box = s.bounds.size.map((v) => v.toFixed(2)).join(' × ');
  return `(${s.x.toFixed(1)}, ${s.z.toFixed(1)}) mesh ${box} m, bury ${s.shape.bury.toFixed(2)} m, plan r ${s.planR.toFixed(2)}, obstacle r ${s.obstacleR.toFixed(2)}, y ${s.y.toFixed(2)}, tris ${s.triangles}`;
}

for (const seed of seeds) {
  const b = boot(seed);
  if (!b) { console.log(`seed ${seed}: no sites`, siteSkips()); continue; }
  const { grid, world, dwelling, zones, trees, shrubCircles } = b;
  const place = (home: number, pose: { x: number; z: number } | null) => {
    dwelling.home = home;
    return placeHabitat({ seed, dwelling, zones, trees, shrubs: shrubCircles, pose });
  };
  const layouts = [0, 1, 2, 0].map((h) => place(h, { x: dwelling.pose.x, z: dwelling.pose.z }));
  const a = layouts[0];
  const shoreKey = (layout: typeof a) => layout.stones.filter((s) => s.kind === 'shore').map((s) => `${s.x.toFixed(2)},${s.z.toFixed(2)}`).join('|');
  const shoreSame = layouts.every((l) => shoreKey(l) === shoreKey(a));
  const restMoves = layouts.slice(0, 3).map((l) => l.stones.find((s) => s.kind === 'rest')?.x ?? null);
  console.log(`\nseed ${seed}`);
  console.log(`  homes ${dwelling.sites.homes.map((h) => `(${h.x.toFixed(1)}, ${h.z.toFixed(1)})`).join(' ')}`);
  console.log(`  drink (${dwelling.sites.drink.x.toFixed(1)}, ${dwelling.sites.drink.z.toFixed(1)}) stands ${dwelling.sites.stands.length}`);
  console.log(`  stones ${a.stones.length}  triangles ${a.triangles}  draws ${a.stones.length} (no LOD)`);
  console.log(`  rest skip: ${a.restSkip ?? 'none'}`);
  console.log(`  path before ${a.pathBeforeM?.toFixed(1) ?? '—'} m  after ${a.pathAfterM?.toFixed(1) ?? '—'} m`);
  console.log(`  round trip A/B/C ${a.homeRoundTrip.map((v) => v ? 'yes' : 'NO').join(' ')}`);
  console.log(`  shore identical across A/B/C/A: ${shoreSame ? 'yes' : 'NO'}`);
  console.log(`  rest x by home ${restMoves.map((v) => v === null ? '—' : v.toFixed(1)).join(' ')}`);
  for (let hi = 0; hi < 3; hi++) {
    const s = a.restByHome[hi];
    const home = dwelling.sites.homes[hi];
    if (!s) { console.log(`  rest ${'ABC'[hi]}: none (${a.seatNotes[hi]})`); continue; }
    const g = (x: number, z: number) => sampleGrid(grid, x, z);
    const yaw = s.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
    const hs: number[] = [];
    for (const [u, v] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7]] as [number, number][]) {
      const x = s.x + c * u * s.shape.length * 0.42 - sn * v * s.shape.width * 0.42;
      const z = s.z + sn * u * s.shape.length * 0.42 + c * v * s.shape.width * 0.42;
      hs.push(g(x, z));
    }
    const minH = Math.min(...hs), maxH = Math.max(...hs), mid = g(s.x, s.z);
    const top = s.y + s.bounds.max[1], base = s.y + s.bounds.min[1];
    const fx = Math.cos(home.facing), fz = Math.sin(home.facing);
    const dx = s.x - home.x, dz = s.z - home.z;
    const along = dx * fx + dz * fz, across = -dx * fz + dz * fx;
    const longX = Math.cos(s.yaw), longZ = Math.sin(s.yaw);
    const longAlong = Math.abs(longX * fx + longZ * fz);
    console.log(
      `  rest ${'ABC'[hi]} total ${s.shape.height.toFixed(2)} bury ${s.shape.bury.toFixed(2)} plan r ${s.planR.toFixed(2)} y ${s.y.toFixed(2)} ground mid/min/max ${mid.toFixed(2)}/${minH.toFixed(2)}/${maxH.toFixed(2)} exposed mid/min/max ${(top - mid).toFixed(2)}/${(top - minH).toFixed(2)}/${(top - maxH).toFixed(2)} base-vs-min ${(minH - base).toFixed(2)} along ${along.toFixed(2)} across ${across.toFixed(2)} long∥facing ${longAlong.toFixed(2)}`,
    );
  }
  const seatB = a.restByHome[1];
  if (seatB) {
    const held = place(1, { x: seatB.x, z: seatB.z });
    const mesh = held.stones.some((s) => s.kind === 'rest');
    const obs = held.obstacles.some((o) => Math.hypot(o.x - seatB.x, o.z - seatB.z) < 0.05);
    const shown = stonesWithHeld(held, true);
    const shownObs = obstaclesWithHeld(held, true);
    const meshOn = shown.some((s) => s.kind === 'rest');
    const obsOn = shownObs.some((o) => Math.hypot(o.x - seatB.x, o.z - seatB.z) < 0.05);
    console.log(`  hold while inside B's seat: mesh ${mesh ? 'SHOWN' : 'hidden'} obstacle ${obs ? 'ON' : 'off'} held ${held.heldRest ? 'yes' : 'no'}`);
    console.log(`  reveal without rebuilding: mesh ${meshOn ? 'yes' : 'NO'} obstacle ${obsOn ? 'yes' : 'NO'}`);
    place(1, { x: dwelling.sites.homes[1].x, z: dwelling.sites.homes[1].z });
  }
  for (const s of a.stones) {
    let wet = 0, float = 0;
    const yaw = s.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const [u, v] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const x = s.x + c * u * s.shape.length * 0.35 - sn * v * s.shape.width * 0.35;
      const z = s.z + sn * u * s.shape.length * 0.35 + c * v * s.shape.width * 0.35;
      if (waterDepth(world, x, z) >= -0.02) wet++;
      const g = sampleGrid(grid, x, z);
      if (g < s.y + 0.02) float++;
    }
    console.log(`  ${s.kind} g${s.group} ${fmt(s)} wet ${wet} float ${float}`);
  }
  if (a.shoreSkips.length) console.log(`  shore skips (${a.shoreSkips.length}): ${a.shoreSkips.slice(0, 6).join(' | ')}`);
  // One rest → drink → home, obstacles already set by the last place() which is home A again.
  dwelling.home = 0;
  place(0, { x: dwelling.sites.homes[0].x, z: dwelling.sites.homes[0].z });
  dwelling.reset();
  const t0 = performance.now();
  while (dwelling.cycles < 1 && dwelling.time < 400) dwelling.step(0.25);
  const home = dwelling.sites.homes[0];
  console.log(`  cycle ${dwelling.cycles} in ${dwelling.time.toFixed(0)} s sim, ${(performance.now() - t0).toFixed(0)} ms, back within ${Math.hypot(dwelling.pose.x - home.x, dwelling.pose.z - home.z).toFixed(2)} m of home, activity ${dwelling.pose.activity}`);
  // Switching must not leave the previous rest obstacle behind.
  const obs = (homeIndex: number) => {
    const layout = place(homeIndex, null);
    return layout.obstacles.map((o) => `${o.x.toFixed(1)},${o.z.toFixed(1)},${o.r.toFixed(2)}`).sort().join(';');
  };
  const o0 = obs(0), o1 = obs(1), back = obs(0);
  console.log(`  obstacle list A then B then A restored: ${o0 === back ? 'yes' : 'NO'}  A≠B ${o0 !== o1 ? 'yes' : 'same'}`);
}

// A few mesh boxes, not tied to a world coordinate.
const sizes = [
  { length: 2.05, width: 1.08, height: 0.78, bury: 0.16 },
  { length: 1.55, width: 0.86, height: 0.62, bury: 0.12 },
  { length: 1.15, width: 0.64, height: 0.52, bury: 0.1 },
];
console.log('\nmesh variants (local AABB, metres)');
for (let i = 0; i < sizes.length; i++) {
  const seed = 684 * 17 + i * 13 + 3;
  const g = stoneGeometry(seed, { ...sizes[i], sides: 7, lean: 0.2, notch: 0.3, notchAt: 1, notch2: 0.1, face: 0.4 });
  g.computeBoundingBox();
  const box = g.boundingBox!;
  console.log(`  ${sizes[i].length.toFixed(2)}×${sizes[i].width.toFixed(2)}×${sizes[i].height.toFixed(2)} bury ${sizes[i].bury} → AABB ${(box.max.x - box.min.x).toFixed(2)} × ${(box.max.y - box.min.y).toFixed(2)} × ${(box.max.z - box.min.z).toFixed(2)} m, tris ${(g.getIndex()?.count ?? 0) / 3}`);
  g.dispose();
}
