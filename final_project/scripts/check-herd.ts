// Generated from check-dwelling.ts's set-up: two creatures on one island (docs/plan-2026-11-18-school-herd.md).
// Run from final_project: npx tsx scripts/check-herd.ts [seed] [seconds]
// Project check (docs/wonderland-handoff.md): the dwelling simulated headless, its marks checked and drawn to a PNG.
// Run from final_project: npx tsx scripts/check-dwelling.ts [seed] [cycles] [home] [out.png]
import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { BODY, createDwelling, siteSkips, walkable, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { placeHabitat } from '../src/experiments/wonderland-terrain/habitatStones';
import { placeShelter, shelterLocal, type ShelterPlan } from '../src/experiments/wonderland-terrain/rockShelter';
import { shellField } from '../src/experiments/wonderland-terrain/rockShell';
import type { Dwelling } from '../src/experiments/wonderland-terrain/dwelling';
import { dwellerForm } from '../src/experiments/wonderland-terrain/dwellerNames';
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

// Two creatures (docs/plan-2026-11-18-school-herd.md): the second has its own home, den and
// grazing; both share the drinking stands, the contact map and each other's company.
if (d.sites.homes.length < 2) { console.log('only one home: no second creature'); process.exit(1); }
// Each with its own seeded form (head and neck from it); FORMS=sculpt keeps the one sculpt.
const formOf = (i: number) => (process.env.FORMS === 'sculpt' ? undefined : dwellerForm(seed, i));
if (formOf(0)) d.setForm(formOf(0)!);
const d2 = createDwelling(world, { id: 1, sites: d.sites, map: d.map, home: 1, axes: formOf(1) })!;
let shelter2 = placeShelter({ dwelling: d2, obstacles: shelter.plan?.obstacles ?? layout.obstacles, seed });
// As the page does: the first of the other homes where a den fits.
for (const h of [1, 0, 2].filter((h) => h !== d.home && h < d.sites.homes.length)) {
  d2.home = h;
  shelter2 = placeShelter({ dwelling: d2, obstacles: shelter.plan?.obstacles ?? layout.obstacles, seed });
  if (shelter2.plan) break;
}
if (shelter2.plan) { d2.setRestPlace({ bed: shelter2.plan.bed, mouth: shelter2.plan.mouth }); d2.setObstacles(shelter2.plan.obstacles); }
// A grazing patch near each home (the page picks it from the grass cover; here, a dry spot 6 m off).
const grazeNear = (c: Dwelling) => {
  const h = c.sites.homes[c.home];
  for (let k = 0; k < 24; k++) {
    const a = k * 2.4, x = h.x + Math.cos(a) * 7, z = h.z + Math.sin(a) * 7, gx = x + Math.cos(a + Math.PI) * 0.95, gz = z + Math.sin(a + Math.PI) * 0.95;
    if (c.dry(x, z) && c.dry(gx, gz)) return { x: gx, z: gz, radius: 2.6, biomass: 1, version: 0, stand: { x, z, facing: a + Math.PI } };
  }
  return null;
};
d.setGrazing(grazeNear(d)); d2.setGrazing(grazeNear(d2));
d.companions = [d2]; d2.companions = [d];
d.reset(); d2.reset();
const herd = [d, d2];
if (process.env.HERD_DEBUG) console.log('stands', d.sites.stands.map((st) => `${st.x.toFixed(1)},${st.z.toFixed(1)}`).join(' '), 'homes', d.sites.homes.map((h) => `${h.x.toFixed(0)},${h.z.toFixed(0)}`).join(' '));
const plans = [shelter.plan, shelter2.plan];
const fields = plans.map((pl) => (pl ? shellField(pl.formSeed) : null));
const T = Number(process.argv[3] ?? 3000), DT = 0.05;
let dry = 0, sipWorst = 0, together = 0, close = 0, overlap = 0, samples = 0, sameStand = 0, follows = 0, rockHits = 0;
const drinks = [0, 0], meals = [0, 0], rests = [0, 0], low = [0, 0];
const was = herd.map((c) => c.pose.activity);
const goalOf = herd.map(() => null as string | null);
let lastSet = [-1e9, -1e9] as number[], lastKind = [null, null] as (string | null)[];
for (let t = 0; t < T; t += DT) {
  for (const c of herd) c.step(DT);
  samples++;
  const gap = Math.hypot(d.pose.x - d2.pose.x, d.pose.z - d2.pose.z);
  if (gap < 2.5) close++;
  if (gap < 4 && d.pose.activity === 'eat' && d2.pose.activity === 'eat') together++;
  if (gap < 1.1) { overlap++; if (process.env.HERD_DEBUG && overlap % 40 === 1) console.log(`overlap t ${t.toFixed(0)} ${d.pose.activity}/${d2.pose.activity} kinds ${d.intent.kind}/${d2.intent.kind} at ${d.pose.x.toFixed(1)},${d.pose.z.toFixed(1)} stands ${d.stand?.x.toFixed(1)},${d.stand?.z.toFixed(1)} / ${d2.stand?.x.toFixed(1)},${d2.stand?.z.toFixed(1)}`); }
  if (d.pose.activity === 'drink' && d2.pose.activity === 'drink' && d.stand && d2.stand && Math.hypot(d.stand.x - d2.stand.x, d.stand.z - d2.stand.z) < 1.6) sameStand++;
  herd.forEach((c, i) => {
    const a = c.pose.activity;
    if (a !== was[i]) {
      if (a === 'drink') drinks[i]++;
      if (a === 'eat') meals[i]++;
      if (a === 'rest') rests[i]++;
      if (a === 'walk') {
        // Set out within 8 s of the other, for the same thing: went together.
        const j = 1 - i;
        if (t - lastSet[j] < 8 && lastKind[j] === c.intent.kind && c.intent.kind !== 'rest') follows++;
        lastSet[i] = t; lastKind[i] = c.intent.kind;
      }
      was[i] = a;
    }
    if (c.needs.thirst < 0.1 || c.needs.hunger < 0.05) low[i]++;
    // Fully bowed to drink: the muzzle at the water (within 6 cm), over water.
    if (c.pose.activity === 'drink' && c.pose.drinking >= 1 && c.stand) {
      const gap = Math.abs(c.pose.muzzle[1] - c.stand.water[1]);
      sipWorst = Math.max(sipWorst, gap);
      if (gap > 0.06 || waterDepth(world, c.pose.muzzle[0], c.pose.muzzle[2]) <= 0) dry++;
    }
    // Body points against both dens' rock.
    fields.forEach((f, k) => {
      const pl = plans[k] as ShelterPlan | null;
      if (!f || !pl) return;
      const [lx, lz] = shelterLocal(pl, c.pose.x, c.pose.z);
      if (f.rock(lx, c.pose.y + 0.9 * (1 - c.pose.lying) + 0.35 * c.pose.lying - pl.originY, lz) < -0.05) { rockHits++; if (process.env.HERD_DEBUG && rockHits % 4 === 1) console.log(`rock: creature ${i + 1} in den ${k + 1} at local ${lx.toFixed(1)},${lz.toFixed(1)} (${c.pose.activity} to ${c.intent.kind}, lying ${c.pose.lying.toFixed(2)})`); }
    });
  });
}
const faults: string[] = [];
herd.forEach((c, i) => { if (drinks[i] < 3) faults.push(`creature ${i + 1} drank only ${drinks[i]} times`); if (rests[i] < 3) faults.push(`creature ${i + 1} rested only ${rests[i]} times`); });
if (overlap / samples > 0.002) faults.push(`bodies overlapping ${(100 * overlap / samples).toFixed(2)}% of the time`);
if (sameStand) faults.push(`both at one stand for ${(sameStand * DT).toFixed(0)} s`);
if (dry) faults.push(`muzzle off the water for ${(dry * DT).toFixed(0)} s (worst ${(sipWorst * 100).toFixed(0)} cm)`);
if (rockHits) faults.push(`${rockHits} body samples in a den's rock`);
if (low.some((v) => v * DT > 60)) faults.push(`a need near empty for over a minute`);
console.log(`herd ${seed}: dens ${plans.map((pl) => (pl ? 'yes' : 'no')).join('/')} · traits ${herd.map((c) => `roam ${c.traits.roam.toFixed(2)} bold ${c.traits.bold.toFixed(2)}`).join(' | ')}`);
console.log(`  drinks ${drinks.join('/')} · meals ${meals.join('/')} · rests ${rests.join('/')} · went together ${follows} times · grazed side by side ${(together * DT).toFixed(0)} s · within 2.5 m ${(100 * close / samples).toFixed(1)}% · sip ${(sipWorst * 100).toFixed(1)} cm · ${faults.length ? faults.join('; ') : 'ok'}`);
process.exit(faults.length ? 1 : 0);
