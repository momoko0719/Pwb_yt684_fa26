// Project check (docs/wonderland-handoff.md): the whole island's rules on several seeds. The layout's
// constraints, the water, the zones, the woods, the creature's sites and a short run of its days,
// and that the same seed builds the same island twice. Exits 1 if a rule fails.
// Run from final_project: npx tsx scripts/check-world.ts [seeds, comma-separated] [maps dir]
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { outlineRadius } from '../src/core/terrain/basinMesh';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { createDwelling, siteSkips, walkable, waterDepth } from '../src/experiments/wonderland-terrain/dwelling';
import { placeHabitat } from '../src/experiments/wonderland-terrain/habitatStones';
import { placeShelter } from '../src/experiments/wonderland-terrain/rockShelter';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { growWoods, siteKeepOuts } from '../src/experiments/wonderland-terrain/woods';
import { buildZones, ZONE, ZONE_NAMES } from '../src/experiments/wonderland-terrain/zones';

const SEEDS = (process.argv[2] ?? '684,7,42,1234,2026,9001,5,333').split(',').map(Number);
const MAPS = process.argv[3];
const CYCLES = 10;

const png = (w: number, h: number, rgb: Uint8Array) => {
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.subarray(y * w * 3, (y + 1) * w * 3)).copy(raw, y * (w * 3 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
// Map colours (the check's own: not the page's).
const COLOURS = [[40, 44, 52], [70, 160, 185], [150, 205, 215], [95, 90, 88], [150, 140, 130], [195, 188, 176], [120, 170, 140], [70, 110, 80], [230, 170, 80], [245, 242, 235]];

function build(seed: number) {
  const t0 = performance.now();
  const params = { ...GROUND_DEFAULTS, seed };
  const { grid } = bakeGround(params);
  const rules = groundRules(params);
  const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
  const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
  const tGround = performance.now() - t0;
  const zones = buildZones(grid, water, rules.plate(0), seed);
  const world = { grid, water, terrace: rules.plate(0), seed, zones };
  const dwelling = createDwelling(world);
  const keep = dwelling ? siteKeepOuts(dwelling.sites) : [];
  const t1 = performance.now();
  const woods = growWoods(zones, grid, seed, keep);
  const tWoods = performance.now() - t1;
  return { params, grid, rules, terrace, water, zones, world, dwelling, woods, tGround, tWoods };
}

const hash = (...arrays: ArrayBufferView[]) => {
  const h = createHash('md5');
  for (const a of arrays) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  return h.digest('hex').slice(0, 10);
};

let failures = 0;
const fail = (seed: number, what: string) => { failures++; console.log(`  FAIL seed ${seed}: ${what}`); };

for (const seed of SEEDS) {
  const b = build(seed);
  const { grid, rules, water, zones, dwelling, woods } = b;
  const f = rules.frame;
  console.log(`seed ${seed}: back ${((f.back * 180) / Math.PI).toFixed(1)}°, basin (${f.basin.map((v) => v.toFixed(0)).join(', ')}); ground+terrace+water ${b.tGround.toFixed(0)} ms, zones ${zones.ms.toFixed(0)} ms, woods ${b.tWoods.toFixed(0)} ms`);
  // The layout's constraints.
  const ring = (k: number) => Array.from({ length: 90 }, (_, i) => {
    const a = (i / 90) * 2 * Math.PI, c = rules.plates[k].centre, r = outlineRadius(c, rules.plate(k), a, 0);
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  });
  for (let k = 1; k < rules.plates.length; k++) {
    const worst = Math.max(...ring(k).map(([x, z]) => rules.plate(k - 1)(x, z)));
    if (worst > -8) fail(seed, `plate ${k} not 8 m inside plate ${k - 1} (worst ${worst.toFixed(1)} m)`);
  }
  const edge = Math.max(...ring(0).map(([x, z]) => rules.outline(x, z)));
  if (edge > -30) fail(seed, `the terrace comes within 30 m of the island's edge (${(-edge).toFixed(0)} m)`);
  const front = f.back + Math.PI, main = rules.outlets[0][0];
  const off = Math.abs(Math.atan2(Math.sin(main.angle - front), Math.cos(main.angle - front)));
  if (off > Math.PI / 6) fail(seed, `the pass is ${((off * 180) / Math.PI).toFixed(0)}° off the range's open side`);
  let covered = 0;
  for (const [x, z] of ring(0)) {
    const ox = x - f.basin[0], oz = z - f.basin[1], l = Math.hypot(ox, oz) || 1, px = x + (ox / l) * 3, pz = z + (oz / l) * 3;
    if (sampleGrid(grid, px, pz) - rules.meadow(px, pz, -100) > 1) covered++;
  }
  if (covered > 9) fail(seed, `the range stands against the terrace on ${covered} of 90 points round it`);
  // The water.
  if (!water.plunge.radius) fail(seed, 'no plunge pool');
  console.log(`  water: ${water.ways.length} ways, plunge pool r ${water.plunge.radius.toFixed(1)} m (continuity: scripts/check-water.ts)`);
  // The zones.
  const land = zones.area.reduce((s, a, k) => s + (k ? a : 0), 0);
  const pct = (k: number) => ((zones.area[k] / land) * 100).toFixed(1);
  console.log(`  zones: ${ZONE_NAMES.slice(1).map((name, k) => `${name} ${pct(k + 1)}%`).join(', ')}`);
  const groves: number[] = [];
  {
    const seen = new Uint8Array(zones.zone.length);
    for (let t = 0; t < zones.zone.length; t++) {
      if (zones.zone[t] !== ZONE.woodland || seen[t]) continue;
      let c = 0;
      const stack = [t];
      seen[t] = 1;
      while (stack.length) {
        const u = stack.pop()!, i = u % zones.nx, j = (u - i) / zones.nx;
        c++;
        for (const v of [i + 1 < zones.nx ? u + 1 : -1, i ? u - 1 : -1, j + 1 < zones.nz ? u + zones.nx : -1, j ? u - zones.nx : -1]) if (v >= 0 && zones.zone[v] === ZONE.woodland && !seen[v]) { seen[v] = 1; stack.push(v); }
      }
      groves.push(c * zones.cell * zones.cell);
    }
    groves.sort((a, b2) => b2 - a);
  }
  const open = zones.area[ZONE.open] / land;
  if (open < 0.2) fail(seed, `open stone only ${(open * 100).toFixed(0)}% (the white ground left empty should stay at least 20%)`);
  if (!groves.length) fail(seed, 'no woodland');
  console.log(`  groves ${groves.length} (largest ${groves.slice(0, 3).map((a) => a.toFixed(0)).join(', ')} m², smallest ${groves.length ? groves[groves.length - 1].toFixed(0) : '-'} m²); dry-land regions ${zones.regions.length} (${zones.regions.slice().sort((a, b2) => b2.area - a.area).slice(0, 4).map((r) => (r.area / 1e4).toFixed(2)).join(', ')} ha …)`);
  // The woods.
  const inWater = [...woods.trees, ...woods.lone].filter((t) => waterDepth(b.world, t.x, t.z) > -0.05).length;
  if (inWater) fail(seed, `${inWater} trees in water`);
  console.log(`  woods: ${woods.trees.length} grove trees (${(woods.trees.length / Math.max(zones.area[ZONE.woodland] / 1e4, 1e-6)).toFixed(0)} per ha of woodland), ${woods.lone.length} lone pines`);
  // The creature: its sites, and a short run of its days among the corner's things and the trees by its home.
  if (!dwelling) {
    fail(seed, `no sites for the creature (${siteSkips().map((s) => `#${s.region}:${s.reason}`).join('; ') || 'no skips'})`);
    continue;
  }
  const skipped = siteSkips().filter((s) => s.reason);
  if (skipped.length) console.log(`  site skips: ${skipped.length} regions (${skipped.slice(0, 3).map((s) => `#${s.region} ${s.reason}`).join('; ')}${skipped.length > 3 ? '…' : ''})`);
  const trees = [...woods.trees, ...woods.lone];
  const folds = buildRockFolds(grid, rules.meadow);
  const shrubs = growShrubs(zones, grid, folds, seed, trees, [dwelling.sites.region]);
  const layout = placeHabitat({
    seed,
    dwelling,
    zones,
    trees,
    shrubs: shrubs.plants.map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 })),
    pose: { x: dwelling.pose.x, z: dwelling.pose.z },
  });
  if (!layout.homeRoundTrip.every(Boolean)) fail(seed, 'a home cannot make the smoothed round trip once stones are obstacles');
  const shelter = placeShelter({ dwelling, obstacles: layout.obstacles, seed });
  if (shelter.plan) {
    dwelling.setRestPlace({ bed: shelter.plan.bed, mouth: shelter.plan.mouth });
    dwelling.setObstacles(shelter.plan.obstacles);
    const p = shelter.plan;
    console.log(`  shelter: lie ${p.fromHome.toFixed(1)} m from the home anchor, mouth align ${p.drinkAlign.toFixed(2)}, headroom ${p.headroomMin.toFixed(2)} m, exterior ${p.exterior.along.toFixed(2)} × ${p.exterior.across.toFixed(2)} × ${p.exterior.height.toFixed(2)} m`);
  } else console.log(`  shelter skipped (${shelter.skip})`);
  dwelling.reset();
  let off2 = 0, wet = 0, slip = 0;
  let was = dwelling.pose.feet.map((q) => [...q]), wasPlanted = [...dwelling.pose.planted];
  while (dwelling.cycles < CYCLES && dwelling.time < CYCLES * 400) {
    dwelling.step(0.05);
    const p = dwelling.pose;
    if (!walkable(b.world, p.x, p.z)) off2++;
    if (waterDepth(b.world, p.x, p.z) > 0) wet++;
    p.feet.forEach((q, k) => { if (wasPlanted[k] && p.planted[k]) slip = Math.max(slip, Math.hypot(q[0] - was[k][0], q[2] - was[k][2])); });
    was = p.feet.map((q) => [...q]); wasPlanted = [...p.planted];
  }
  if (dwelling.cycles < CYCLES) fail(seed, `the creature finished ${dwelling.cycles} of ${CYCLES} cycles`);
  if (off2 || wet) fail(seed, `the creature off walkable ground ${off2} steps, in water ${wet}`);
  if (slip > 0.01) fail(seed, `planted feet slid ${(slip * 100).toFixed(1)} cm`);
  console.log(`  creature: drink + ${dwelling.sites.homes.length} homes; ${dwelling.cycles} cycles, off ground ${off2}, in water ${wet}, foot slip ${(slip * 100).toFixed(1)} cm`);
  // The same seed, the same island.
  if (seed === SEEDS[0] || seed === SEEDS[1]) {
    const again = build(seed);
    const one = hash(grid.data, zones.zone, new Float32Array(woods.trees.flatMap((t) => [t.x, t.z, t.height])));
    const two = hash(again.grid.data, again.zones.zone, new Float32Array(again.woods.trees.flatMap((t) => [t.x, t.z, t.height])));
    if (one !== two) fail(seed, `built twice, it differs (${one} / ${two})`);
    console.log(`  reproducible: ${one === two ? 'yes' : 'NO'} (${one})`);
  }
  if (MAPS) {
    const { nx, nz } = zones, rgb = new Uint8Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) rgb.set(COLOURS[zones.zone[j * nx + i]], ((nz - 1 - j) * nx + i) * 3);
    const dot = (x: number, z: number, c: number[], r = 0) => {
      const i = Math.floor((x - zones.x0) / zones.cell), j = Math.floor((z - zones.z0) / zones.cell);
      for (let a = -r; a <= r; a++) for (let q = -r; q <= r; q++) { const u = i + a, v = j + q; if (u >= 0 && v >= 0 && u < nx && v < nz) rgb.set(c, ((nz - 1 - v) * nx + u) * 3); }
    };
    for (const t of woods.trees) dot(t.x, t.z, [30, 60, 40]);
    for (const t of woods.lone) dot(t.x, t.z, [20, 40, 30], 1);
    dot(dwelling.sites.drink.x, dwelling.sites.drink.z, [200, 40, 40], 2);
    for (const h of dwelling.sites.homes) dot(h.x, h.z, [120, 40, 160], 2);
    writeFileSync(`${MAPS}/world-${seed}.png`, png(nx, nz, rgb));
  }
}
console.log(failures ? `${failures} failures` : 'all rules hold');
process.exit(failures ? 1 : 0);
