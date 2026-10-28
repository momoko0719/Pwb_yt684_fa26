// Project check (docs/wonderland-handoff.md): the dwelling simulated headless, its marks checked and drawn to a PNG.
// Run from final_project: npx tsx scripts/check-dwelling.ts [seed] [cycles] [home] [out.png]
import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { BODY, createDwelling, siteSkips, walkable, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { placeHabitat } from '../src/experiments/wonderland-terrain/habitatStones';
import { placeShelter } from '../src/experiments/wonderland-terrain/rockShelter';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const png = (w: number, h: number, rgb: Uint8Array) => {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; }); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

const seed = Number(process.argv[2] ?? 684), cycles = Number(process.argv[3] ?? 30), homeAt = Number(process.argv[4] ?? 0);
const outPath = process.argv[5] ?? 'scripts/out/dwell.png';
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const world = { grid, water, terrace: rules.plate(0), seed, zones };
const t0 = performance.now();
const d = createDwelling(world);
if (!d) { console.log('no sites', siteSkips()); process.exit(1); }
console.log(`site skips: ${siteSkips().length} (${siteSkips().slice(0, 4).map((s) => `#${s.region} ${s.reason}`).join('; ')})`);
console.log(`sites in ${(performance.now() - t0).toFixed(0)} ms: drink (${d.sites.drink.x.toFixed(1)}, ${d.sites.drink.z.toFixed(1)}); homes ${d.sites.homes.map((h) => `(${h.x.toFixed(1)}, ${h.z.toFixed(1)})`).join(' ')}; square ${d.sites.region.size} m, ${d.map.cells}² cells`);
d.home = homeAt;
const woods = growWoods(zones, grid, seed, siteKeepOuts(d.sites));
const trees = [...woods.trees, ...woods.lone];
const folds = buildRockFolds(grid, rules.meadow);
const shrubs = growShrubs(zones, grid, folds, seed, trees, [d.sites.region]);
const layout = placeHabitat({
  seed, dwelling: d, zones, trees,
  shrubs: shrubs.plants.map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 })),
  pose: { x: d.pose.x, z: d.pose.z },
});
const shelter = placeShelter({ dwelling: d, obstacles: layout.obstacles, seed });
if (shelter.plan) {
  d.setRestPlace({ bed: shelter.plan.bed, mouth: shelter.plan.mouth });
  d.setObstacles(shelter.plan.obstacles);
}
const obstacles = shelter.plan?.obstacles ?? layout.obstacles;
d.reset();
console.log(`stones ${layout.stones.length}, tris ${layout.triangles}; shelter ${shelter.plan ? 'yes' : shelter.skip}; path ${layout.pathBeforeM?.toFixed(1)} → ${layout.pathAfterM?.toFixed(1)} m`);
let inside = 0;
let bad = 0, wet = 0, steps = 0, stepMs = 0, slip = 0, footWet = 0, sideways = 0, drinks = 0;
let legMin = Infinity, legMax = 0, muzzleWorst = 0;
const legs = { walk: [Infinity, 0], drink: [Infinity, 0] };
let worstAt = '', legSamples = 0;
const legOff = [0, 0, 0];
const standLeg = BODY.torso.stand - BODY.hipDrop;
const trail: [number, number][] = [];
const counts = { rest: 0, walk: 0, drink: 0 };
let was = d.pose.feet.map((f) => [...f]), wasPlanted = [...d.pose.planted], px = d.pose.x, pz = d.pose.z;
const DT = 0.05;
while (d.cycles < cycles && d.time < cycles * 400) {
  const s = performance.now();
  d.step(DT);
  stepMs = Math.max(stepMs, performance.now() - s);
  steps++;
  const p = d.pose;
  counts[p.activity]++;
  if (!walkable(world, p.x, p.z)) bad++;
  if (waterDepth(world, p.x, p.z) > 0) wet++;
  if ([[p.x, p.z], ...p.feet.map((f) => [f[0], f[2]])].some(([x, z]) => obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r - 0.3))) inside++;
  // A foot planted before and after this step must not have moved (no sliding).
  p.feet.forEach((f, k) => {
    if (wasPlanted[k] && p.planted[k]) slip = Math.max(slip, Math.hypot(f[0] - was[k][0], f[2] - was[k][2]));
    if (p.planted[k] && waterDepth(world, f[0], f[2]) > 0) footWet++;
    if (p.lying === 0) {
      const l = Math.hypot(p.hips[k][0] - f[0], p.hips[k][1] - f[1], p.hips[k][2] - f[2]) / standLeg;
      const key = p.drinking > 0 ? 'drink' : 'walk';
      legs[key][0] = Math.min(legs[key][0], l); legs[key][1] = Math.max(legs[key][1], l);
      if (l > legMax) worstAt = `${p.activity} lying ${p.lying.toFixed(2)} drinking ${p.drinking.toFixed(2)} foot ${k} planted ${p.planted[k]} hip→foot (${(f[0] - p.hips[k][0]).toFixed(2)}, ${(f[1] - p.hips[k][1]).toFixed(2)}, ${(f[2] - p.hips[k][2]).toFixed(2)}) heading ${p.heading.toFixed(2)} t ${d.time.toFixed(1)}`;
      legMin = Math.min(legMin, l); legMax = Math.max(legMax, l);
      legSamples++; if (l > 1.15 || l < 0.85) legOff[p.drinking > 0 ? 2 : p.planted[k] ? 0 : 1]++;
    }
  });
  // Moving: its body faces the way it moves (never more than 35° off).
  const mx = p.x - px, mz = p.z - pz;
  if (Math.hypot(mx, mz) > 0.01) { const off = Math.abs(Math.atan2(Math.sin(Math.atan2(mz, mx) - p.heading), Math.cos(Math.atan2(mz, mx) - p.heading))); if (off > 0.6) sideways++; }
  // Drinking, head down: the muzzle at the water's surface, over water.
  if (p.activity === 'drink' && p.drinking >= 1) {
    drinks++;
    const [mx2, my, mz2] = p.muzzle, depth = waterDepth(world, mx2, mz2);
    const surface = depth > 0 ? grid ? my - (depth + sampleGrid(grid, mx2, mz2)) : 0 : Infinity;
    muzzleWorst = Math.max(muzzleWorst, Math.abs(surface));
  }
  was = p.feet.map((f) => [...f]); wasPlanted = [...p.planted]; px = p.x; pz = p.z;
  if (steps % 20 === 0) trail.push([p.x, p.z]);
}
const m = d.map, n = m.cells * m.cells;
const stat = (a: Float32Array) => { let max = 0, over = 0; for (let t = 0; t < n; t++) { max = Math.max(max, a[t]); if (a[t] > 0.3) over++; } return `max ${max.toFixed(2)}, ${(over * m.texel * m.texel).toFixed(1)} m² over 0.3`; };
let offGround = 0;
for (let t = 0; t < n; t++) if (!m.ground[t] && (m.walk[t] || m.drink[t] || m.rest[t])) offGround++;
console.log(`${d.cycles} cycles in ${(d.time / 60).toFixed(1)} min simulated (${steps} steps; slowest step ${stepMs.toFixed(1)} ms: a route); time resting ${(counts.rest / steps * 100).toFixed(0)}%, walking ${(counts.walk / steps * 100).toFixed(0)}%, drinking ${(counts.drink / steps * 100).toFixed(0)}%`);
console.log(`positions off walkable ground ${bad}, in water ${wet}, in a tree or the stone ${inside}; planted feet in water ${footWet}; marks off the ground ${offGround}`);
console.log(`planted feet sliding at most ${(slip * 100).toFixed(1)} cm; legs ${legMin.toFixed(2)}–${legMax.toFixed(2)} of their standing length (walking or standing ${legs.walk.map((v) => v.toFixed(2)).join('–')}, drinking ${legs.drink.map((v) => v.toFixed(2)).join('–')}); steps moving > 35° off its heading ${sideways}; drinking steps ${drinks}, muzzle off the water's surface at most ${(muzzleWorst * 100).toFixed(1)} cm`);
console.log(`longest leg: ${worstAt}`);
console.log(`leg samples beyond ±15%: ${(legOff[0] / legSamples * 100).toFixed(2)}% planted, ${(legOff[1] / legSamples * 100).toFixed(2)}% in the air (not drinking); ${(legOff[2] / legSamples * 100).toFixed(2)}% drinking (the forelegs bent as it bows)`);
console.log(`walk ${stat(m.walk)}; drink ${stat(m.drink)}; rest ${stat(m.rest)}`);
// The map: stone white; walk red, drink green, rest blue; water and closed ground grey; its trail dark.
const rgb = new Uint8Array(n * 3);
for (let j = 0; j < m.cells; j++) for (let i = 0; i < m.cells; i++) {
  const t = j * m.cells + i, o = ((m.cells - 1 - j) * m.cells + i) * 3;
  if (!m.ground[t]) { rgb.set([150, 160, 170], o); continue; }
  rgb.set([255 - 200 * Math.max(m.drink[t], m.rest[t]), 255 - 200 * Math.max(m.walk[t], m.rest[t]), 255 - 200 * Math.max(m.walk[t], m.drink[t])], o);
}
for (const [x, z] of trail) {
  const i = Math.floor((x - m.x0) / m.texel), j = Math.floor((z - m.z0) / m.texel);
  if (i >= 0 && j >= 0 && i < m.cells && j < m.cells) rgb.set([40, 40, 40], ((m.cells - 1 - j) * m.cells + i) * 3);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png(m.cells, m.cells, rgb));
console.log(`map → ${outPath}`);
// Fail on real wetting or leaving the ground (do not silence foot-in-water counts).
if (bad || wet || footWet || muzzleWorst > 0.02) {
  console.log('FAIL: positions or feet entered water / left walkable ground, or muzzle missed the surface');
  process.exit(1);
}
