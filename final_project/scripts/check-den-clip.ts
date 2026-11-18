// Generated from check-dwelling.ts's set-up: the creature against the one-rock den.
// Project check (docs/wonderland-handoff.md): the dwelling simulated headless, its marks checked and drawn to a PNG.
// Run from final_project: npx tsx scripts/check-dwelling.ts [seed] [cycles] [home] [out.png]
import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { BODY, createDwelling, siteSkips, walkable, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { placeHabitat } from '../src/experiments/wonderland-terrain/habitatStones';
import { placeShelter, shelterLocal } from '../src/experiments/wonderland-terrain/rockShelter';
import { shellField } from '../src/experiments/wonderland-terrain/rockShell';
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

// Does the body ever pass into the den's rock? Each step: the body's line (rump to chest, at its
// height), the four feet, the muzzle and the crown, in the den's frame, against its field.
const plan = shelter.plan;
if (!plan) { console.log('no den placed: ' + shelter.skip); process.exit(1); }
const { rock } = shellField(plan.formSeed);
let worst = 0, hits = 0, samples = 0, where = '';
const probe = (x: number, y: number, z: number, what: string) => {
  const [lx, lz] = shelterLocal(plan, x, z);
  const v = rock(lx, y - plan.originY, lz);
  samples++;
  if (v < -0.05) { hits++; if (-v > worst) { worst = -v; where = what + ' at ' + lx.toFixed(1) + ', ' + (y - plan.originY).toFixed(1) + ', ' + lz.toFixed(1) + ' (' + d.pose.activity + ')'; } }
};
const T = Number(process.argv[3] ?? 1500);
while (d.time < T) {
  d.step(0.05);
  const p = d.pose, c = Math.cos(p.heading), s = Math.sin(p.heading);
  const up = BODY.torso.stand * (1 - p.lying) + BODY.torso.lie * p.lying;
  for (const k of [-1, -0.5, 0, 0.5, 1]) for (const w of [-0.25, 0, 0.25]) for (const h of [-0.2, 0, 0.2]) {
    probe(p.x + c * BODY.torso.along * 0.9 * k - s * w, p.y + up + h, p.z + s * BODY.torso.along * 0.9 * k + c * w, 'body');
  }
  p.feet.forEach((f: number[]) => probe(f[0], f[1] + 0.05, f[2], 'foot'));
  probe(p.muzzle[0], p.muzzle[1], p.muzzle[2], 'muzzle');
  probe(p.muzzle[0] - c * 0.15, p.muzzle[1] + 0.45, p.muzzle[2] - s * 0.15, 'crown');
}
console.log('den ' + plan.formSeed + ': ' + samples + ' samples, ' + hits + ' inside the rock' + (hits ? ', worst ' + (worst * 100).toFixed(0) + ' cm: ' + where : ''));
process.exit(hits ? 1 : 0);
