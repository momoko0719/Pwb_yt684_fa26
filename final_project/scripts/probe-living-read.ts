/**
 * Read-only checks for the living-island plan. Does not change the simulation rules.
 * Memory-off is done here by clearing the walk channel before each step, so route()
 * never sees worn ground. The panel and dwelling.ts defaults stay as they are.
 *
 * Usage: npx tsx scripts/probe-living-read.ts [seed]
 * Writes docs/living-island-routes-684.svg
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORCELAIN } from '../src/core/palette';
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { COVER_DEFAULTS, buildCover } from '../src/experiments/wonderland-terrain/cover';
import { COVER_NEAR, buildChunk, buildSites } from '../src/experiments/wonderland-terrain/CoverGrass';
import { cornerObstacles, planCorner } from '../src/experiments/wonderland-terrain/corner';
import { createDwelling, siteSkips, walkable, waterDepth, type Dwelling } from '../src/experiments/wonderland-terrain/dwelling';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildRockFolds } from '../src/experiments/wonderland-terrain/rockFolds';
import { growShrubs } from '../src/experiments/wonderland-terrain/shrubs';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { siteKeepOuts, TREE_CLEARANCE, growWoods } from '../src/experiments/wonderland-terrain/woods';
import { ZONE, ZONE_NAMES, buildZones } from '../src/experiments/wonderland-terrain/zones';

const seed = Number(process.argv[2] ?? 684);
const SIM_S = 1800;
const DT = 0.25;
const here = dirname(fileURLToPath(import.meta.url));

const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const world = { grid, water, terrace: rules.plate(0), seed, zones };
const d = createDwelling(world);
if (!d) {
  console.log(JSON.stringify({ error: 'no sites', skips: siteSkips() }, null, 2));
  process.exit(1);
}

const woods = growWoods(zones, grid, seed, siteKeepOuts(d.sites));
const trees = [...woods.trees, ...woods.lone];
const folds = buildRockFolds(grid, rules.meadow);
const shrubs = growShrubs(zones, grid, folds, seed, trees, [d.sites.region]);
const cover = buildCover(zones, grid, seed, COVER_DEFAULTS.amount);

function arm(dwelling: Dwelling, homeIndex: number) {
  dwelling.home = homeIndex;
  const corner = planCorner(dwelling);
  const { x0, z0, size } = dwelling.sites.region;
  const mine = trees.filter((t) => t.x > x0 - 2 && t.z > z0 - 2 && t.x < x0 + size + 2 && t.z < z0 + size + 2);
  dwelling.setObstacles([...cornerObstacles(corner), ...mine.map((t) => ({ x: t.x, z: t.z, r: TREE_CLEARANCE }))]);
  dwelling.reset();
  return corner;
}

function shelterOf(x: number, z: number) {
  const h = sampleGrid(grid, x, z);
  let around = 0;
  for (let a = 0; a < 8; a++) {
    around += sampleGrid(grid, x + Math.cos((a * Math.PI) / 4) * 7, z + Math.sin((a * Math.PI) / 4) * 7);
  }
  const slope = Math.hypot(sampleGrid(grid, x, z, 1), sampleGrid(grid, x, z, 2));
  return { height: h, shelterM: around / 8 - h, slope };
}

function pathLen(pts: [number, number][]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

function raster(trips: [number, number][][]) {
  const cells = new Map<string, number>();
  for (const way of trips) {
    for (let i = 1; i < way.length; i++) {
      const [ax, az] = way[i - 1], [bx, bz] = way[i];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 0.5));
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        const key = `${Math.round(x)}:${Math.round(z)}`;
        cells.set(key, (cells.get(key) ?? 0) + 1);
      }
    }
  }
  return cells;
}

function overlap(a: Map<string, number>, b: Map<string, number>) {
  let inter = 0, onlyB = 0, bCount = 0;
  for (const [k, n] of b) {
    bCount += n;
    if (a.has(k)) inter += n;
    else onlyB += n;
  }
  const union = new Set([...a.keys(), ...b.keys()]).size;
  const shared = [...a.keys()].filter((k) => b.has(k)).length;
  return {
    sharedCells: shared,
    unionCells: union,
    jaccard: union ? shared / union : 0,
    lateLengthOnEarlyCells: bCount ? inter / bCount : 0,
    lateLengthOffEarly: bCount ? onlyB / bCount : 0,
  };
}

type Trip = { kind: 'toDrink' | 'toRest'; length: number; way: [number, number][] };

function run(memory: boolean): { trips: Trip[]; maxWalk: number; time: number; cycles: number } {
  arm(d, 0);
  const trips: Trip[] = [];
  let prev = d.pose.activity;
  const t0 = performance.now();
  while (d.time < SIM_S) {
    if (!memory) d.map.walk.fill(0);
    d.step(DT);
    if (prev !== 'walk' && d.pose.activity === 'walk' && d.way && d.way.length > 1) {
      const kind = d.stand && Math.hypot(d.way[d.way.length - 1][0] - d.stand.x, d.way[d.way.length - 1][1] - d.stand.z) < 3
        ? 'toDrink' as const
        : 'toRest' as const;
      trips.push({ kind, length: pathLen(d.way), way: d.way.map((p) => [p[0], p[1]] as [number, number]) });
    }
    prev = d.pose.activity;
  }
  let maxWalk = 0;
  for (let i = 0; i < d.map.walk.length; i++) maxWalk = Math.max(maxWalk, d.map.walk[i]);
  console.error(`sim ${memory ? 'memory' : 'no-memory'} ${((performance.now() - t0) / 1000).toFixed(1)}s wall, trips ${trips.length}`);
  return { trips, maxWalk, time: d.time, cycles: d.cycles };
}

const withMem = run(true);
const noMem = run(false);

function summarise(label: string, trips: Trip[]) {
  const out = trips.filter((t) => t.kind === 'toDrink');
  const back = trips.filter((t) => t.kind === 'toRest');
  const mid = Math.max(1, Math.floor(out.length / 2));
  const early = out.slice(0, mid);
  const late = out.slice(mid);
  const eCells = raster(early.map((t) => t.way));
  const lCells = raster(late.map((t) => t.way));
  const all = raster(out.map((t) => t.way));
  let maxC = 0, sumC = 0;
  for (const n of all.values()) { maxC = Math.max(maxC, n); sumC += n; }
  const mean = (xs: number[]) => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
  return {
    label,
    tripsOut: out.length,
    tripsBack: back.length,
    meanOutM: +mean(out.map((t) => t.length)).toFixed(2),
    meanBackM: +mean(back.map((t) => t.length)).toFixed(2),
    firstOutM: out[0] ? +out[0].length.toFixed(2) : null,
    lastOutM: out.length ? +out[out.length - 1].length.toFixed(2) : null,
    earlyUniqueCells: eCells.size,
    lateUniqueCells: lCells.size,
    ...overlap(eCells, lCells),
    busiestCellShare: sumC ? +(maxC / sumC).toFixed(3) : 0,
    jaccard: +overlap(eCells, lCells).jaccard.toFixed(3),
    lateLengthOnEarlyCells: +overlap(eCells, lCells).lateLengthOnEarlyCells.toFixed(3),
  };
}

const routeReport = {
  seed,
  simSeconds: SIM_S,
  step: DT,
  note: 'Memory-off clears map.walk before every step. Same dwelling, same reset seed, home A, same obstacles.',
  memory: summarise('memory', withMem.trips),
  noMemory: summarise('no-memory', noMem.trips),
  maxWalkAfterMemoryRun: +withMem.maxWalk.toFixed(3),
  maxWalkAfterClearedRun: +noMem.maxWalk.toFixed(3),
  cyclesMemory: withMem.cycles,
  cyclesNoMemory: noMem.cycles,
};

function svg() {
  const ways = [
    ...withMem.trips.filter((t) => t.kind === 'toDrink').map((t) => ({ panel: 0, way: t.way })),
    ...noMem.trips.filter((t) => t.kind === 'toDrink').map((t) => ({ panel: 1, way: t.way })),
  ];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const w of ways) for (const [x, z] of w.way) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const pad = 8;
  minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
  const W = 520, H = 460, gap = 36;
  const sx = (x: number) => ((x - minX) / (maxX - minX)) * (W - 40) + 20;
  const sz = (z: number) => ((z - minZ) / (maxZ - minZ)) * (H - 50) + 30;
  const panels = ['有路径记忆（走得多的格子更便宜）', '禁用路径记忆（每步清掉走路接触）'];
  const sets = [withMem.trips.filter((t) => t.kind === 'toDrink'), noMem.trips.filter((t) => t.kind === 'toDrink')];
  let body = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2 + gap}" height="${H}" font-family="sans-serif">`;
  body += `<rect width="100%" height="100%" fill="#f6f3ee"/>`;
  sets.forEach((trips, p) => {
    const ox = p * (W + gap);
    body += `<text x="${ox + 16}" y="22" font-size="14">${panels[p]}</text>`;
    const drink = d.sites.drink, home = d.sites.homes[0];
    trips.forEach((t, i) => {
      const u = trips.length <= 1 ? 1 : i / (trips.length - 1);
      const col = `rgb(${Math.round(40 + 180 * u)}, ${Math.round(90 - 40 * u)}, ${Math.round(160 - 100 * u)})`;
      const pts = t.way.map(([x, z]) => `${(ox + sx(x)).toFixed(1)},${sz(z).toFixed(1)}`).join(' ');
      body += `<polyline fill="none" stroke="${col}" stroke-width="${i < 2 ? 1 : 1.6}" opacity="0.85" points="${pts}"/>`;
    });
    body += `<circle cx="${ox + sx(home.x)}" cy="${sz(home.z)}" r="5" fill="#c49a3c"/>`;
    body += `<circle cx="${ox + sx(drink.x)}" cy="${sz(drink.z)}" r="5" fill="#2e86c1"/>`;
  });
  body += `<text x="16" y="${H - 12}" font-size="12">金点是家 A，蓝点是饮水站。线从早（偏蓝）到晚（偏红），只画出门去喝水的路线。种子 ${seed}，模拟 ${SIM_S} 秒。</text>`;
  body += `</svg>`;
  const file = join(here, '..', 'docs', `living-island-routes-${seed}.svg`);
  writeFileSync(file, body);
  return file;
}

const drink = d.sites.drink;
const homes = d.sites.homes.map((h, index) => {
  const corner = arm(d, index);
  let length = 0;
  let guard = 0;
  while (d.pose.activity !== 'walk' && guard < 800) { d.step(DT); guard++; }
  if (d.way) length = pathLen(d.way);
  const sh = shelterOf(h.x, h.z);
  const nearTrees = trees.filter((t) => Math.hypot(t.x - h.x, t.z - h.z) < 12).length;
  const nearShrubs = shrubs.plants.filter((p) => Math.hypot(p.x - h.x, p.z - h.z) < 8).length;
  const cornerPines = corner.pines.filter((p) => Math.hypot(p.x - h.x, p.z - h.z) < 14).length;
  const straight = Math.hypot(h.x - drink.x, h.z - drink.z);
  // Shore census: inputs the stand search uses. Not a second legality test.
  let closerInBand = 0, closerUnwalkable = 0, nearerWater = Infinity, nearerToWater = Infinity, nearestBand = Infinity;
  const { cell, nx, nz, x0, z0, toWater, region } = zones;
  const homeCell = (() => {
    let best = 0, bd = Infinity;
    for (let t = 0; t < region.length; t++) {
      const x = x0 + ((t % nx) + 0.5) * cell, z = z0 + (Math.floor(t / nx) + 0.5) * cell;
      const dd = Math.hypot(x - h.x, z - h.z);
      if (dd < bd) { bd = dd; best = t; }
    }
    return region[best];
  })();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i;
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    const dist = Math.hypot(x - h.x, z - h.z);
    if (dist > 50) continue;
    const depth = waterDepth(world, x, z);
    if (depth > 0 && dist < nearerWater) { nearerWater = dist; nearerToWater = toWater[t]; }
    if (dist + 1 >= straight) continue;
    const tw = toWater[t];
    if (tw < 0.8 || tw > 14) continue;
    if (region[t] !== homeCell) continue;
    if (!walkable(world, x, z)) { closerUnwalkable++; continue; }
    nearestBand = Math.min(nearestBand, dist);
    if (dist + 1 < straight) closerInBand++;
  }
  const zoneAt = (() => {
    let best = 0, bd = Infinity;
    for (let t = 0; t < zones.zone.length; t++) {
      const x = x0 + ((t % nx) + 0.5) * cell, z = z0 + (Math.floor(t / nx) + 0.5) * cell;
      const dd = Math.hypot(x - h.x, z - h.z);
      if (dd < bd) { bd = dd; best = zones.zone[t]; }
    }
    return ZONE_NAMES[best] ?? String(best);
  })();
  return {
    name: 'ABC'[index],
    x: +h.x.toFixed(1),
    z: +h.z.toFixed(1),
    zone: zoneAt,
    shelterM: +sh.shelterM.toFixed(2),
    slope: +sh.slope.toFixed(3),
    straightM: +straight.toFixed(1),
    firstPathM: +length.toFixed(1),
    treesWithin12m: nearTrees,
    cornerPinesWithin14m: cornerPines,
    shrubsWithin8m: nearShrubs,
    watchStoneShown: false,
    closerShoreCellsInBand: closerInBand,
    closerShoreCellsUnwalkable: closerUnwalkable,
    nearestWaterM: Number.isFinite(nearerWater) ? +nearerWater.toFixed(1) : null,
    nearestWaterToWaterField: Number.isFinite(nearerToWater) ? +nearerToWater.toFixed(1) : null,
    nearestWalkableShoreBandM: Number.isFinite(nearestBand) ? +nearestBand.toFixed(1) : null,
  };
});

function medianSample(zoneId: number) {
  const hits: { x: number; z: number; d: number }[] = [];
  const { x0, z0, cell, nx, nz, density } = cover;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    if (cover.zoneAt(x, z) !== zoneId) continue;
    const dens = density[j * nx + i];
    if (dens < COVER_DEFAULTS.flowerMinDens) continue;
    const slope = Math.hypot(sampleGrid(grid, x, z, 1), sampleGrid(grid, x, z, 2));
    if (slope > 0.35) continue;
    hits.push({ x, z, d: dens });
  }
  hits.sort((a, b) => a.d - b.d);
  return hits.length ? { ...hits[Math.floor(hits.length / 2)], n: hits.length } : null;
}

// cover.zoneAt exists on CoverField
function sampleFlowers(zoneId: number, label: string) {
  const spot = medianSample(zoneId);
  if (!spot) return { label, none: true };
  const anchors15 = cover.flowerAnchors.filter((a) => Math.hypot(a.x - spot.x, a.z - spot.z) < 15);
  const heads15 = anchors15.reduce((s, a) => s + a.heads, 0);
  // Camera foot 7 m east of the sample, eye not used for loading (load uses XZ foot).
  const foot = { x: spot.x + 7, z: spot.z };
  const loaded = buildSites(cover, grid, seed, foot.x, foot.z, null, COVER_DEFAULTS.amount);
  const look = { x: spot.x - foot.x, z: spot.z - foot.z };
  const lookL = Math.hypot(look.x, look.z) || 1;
  let inCone = 0;
  const heads = loaded.flowers.offset;
  for (let i = 0; i < heads.length; i += 3) {
    const x = heads[i], z = heads[i + 2];
    const vx = x - foot.x, vz = z - foot.z;
    const dist = Math.hypot(vx, vz);
    const dot = (vx * look.x + vz * look.z) / (dist * lookL || 1);
    if (dist < 16 && dot > Math.cos(28 * Math.PI / 180)) inCone++;
  }
  const chunk = buildChunk(cover, grid, seed, Math.floor(spot.x / COVER_NEAR.chunk), Math.floor(spot.z / COVER_NEAR.chunk));
  // Fractional position inside the 0.72 m trial cell, for clumps near the sample.
  const fracs: number[] = [];
  // Rebuild centres from blade groups is indirect; use a local scan of clumpTrial via accepted spacing.
  // Report blade count in the chunk and spacing of unique rounded centres.
  const blades: [number, number][] = [];
  for (let i = 0; i < chunk.go.length; i += 3) {
    const x = chunk.go[i], z = chunk.go[i + 2];
    if (Math.hypot(x - spot.x, z - spot.z) > 8) continue;
    blades.push([x, z]);
  }
  const centres: [number, number][] = [];
  for (const b of blades) {
    if (centres.some((c) => Math.hypot(c[0] - b[0], c[1] - b[1]) < 0.45)) continue;
    centres.push(b);
  }
  const frac = (v: number) => ((v / COVER_NEAR.clumpCell) % 1 + 1) % 1;
  for (const [x, z] of centres) fracs.push(frac(x), frac(z));
  let nn = 0, nnN = 0;
  for (let i = 0; i < centres.length; i++) {
    let best = Infinity;
    for (let j = 0; j < centres.length; j++) if (i !== j) best = Math.min(best, Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]));
    if (Number.isFinite(best)) { nn += best; nnN++; }
  }
  const meanFrac = fracs.length ? fracs.reduce((s, v) => s + v, 0) / fracs.length : 0;
  return {
    label,
    method: 'median density cell of this zone with density≥flowerMinDens and slope≤0.35; not the densest cell',
    sample: { x: +spot.x.toFixed(1), z: +spot.z.toFixed(1), density: +spot.d.toFixed(3), candidates: spot.n },
    cameraFoot: { x: +foot.x.toFixed(1), z: +foot.z.toFixed(1), eye: 'ground+1.6 (not used for loading)' },
    lookCone: '28° half-angle, 16 m, from the foot toward the sample',
    worldAnchorsWithin15m: anchors15.length,
    worldHeadsWithin15m: heads15,
    loadedHeadsIn48mDisc: loaded.stats.flowerHeads,
    loadedClumpsIn48mDisc: loaded.stats.flowerClumps,
    headsInLookCone: inCone,
    grassBladesInDisc: loaded.stats.grassBlades,
    localClumps8m: centres.length,
    meanNearestClumpM: nnN ? +(nn / nnN).toFixed(2) : null,
    meanCellFraction: +meanFrac.toFixed(2),
  };
}

const flowers = {
  islandAnchors: cover.flowerAnchors.length,
  islandHeads: cover.flowerAnchors.reduce((s, a) => s + a.heads, 0),
  loadRadiusM: COVER_NEAR.radius,
  fadeNearM: COVER_NEAR.fadeNear,
  fadeFarM: COVER_NEAR.fadeFar,
  headM: COVER_NEAR.head,
  stemM: COVER_NEAR.stemH,
  clumpCellM: COVER_NEAR.clumpCell,
  samples: [
    sampleFlowers(ZONE.wetShore, '湿岸'),
    sampleFlowers(ZONE.woodland, '林缘／林地'),
    sampleFlowers(ZONE.open, '开敞草地'),
  ],
};

const svgFile = svg();
const out = {
  routes: routeReport,
  drink: { x: +drink.x.toFixed(1), z: +drink.z.toFixed(1), stands: d.sites.stands.length },
  homes,
  flowers,
  jade: {
    body: PORCELAIN.body,
    water: PORCELAIN.water,
    jadeWalk: PORCELAIN.jadeWalk,
    jadeDrink: PORCELAIN.jadeDrink,
    jadeRest: PORCELAIN.jadeRest,
  },
  svg: svgFile,
};
console.log(JSON.stringify(out, null, 2));
