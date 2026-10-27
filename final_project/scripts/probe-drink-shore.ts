/**
 * Drink candidates from **real shore samples** between home and current drink.
 * Not "dry land cells near home that lack water".
 * Usage: npx tsx scripts/probe-drink-shore.ts [seed]
 */
import { sampleGrid } from '../src/core/terrain/heightGrid';
import {
  BODY, createDwelling, muzzleFrom, waterDepth, walkable, type DwellWorld, type Stand,
} from '../src/experiments/wonderland-terrain/dwelling';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';

const SITE = { shoreLo: 0.8, shoreHi: 14, sip: 0.12, keepOff: 6 };

const seed = Number(process.argv[2] ?? 5676);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const world: DwellWorld = { grid, water, terrace: rules.plate(0), seed, zones };
const d = createDwelling(world);
if (!d) { console.log('no dwelling'); process.exit(1); }
const home = d.sites.homes[0];
const cur = d.sites.drink;
const homeDrinkDist = Math.hypot(cur.x - home.x, cur.z - home.z);

function waterLevel(x: number, z: number): number | null {
  const f = world.water.field;
  if (!f) return null;
  const i = Math.round((x - f.x0) / f.step), j = Math.round((z - f.z0) / f.step);
  if (i < 0 || j < 0 || i >= f.nx || j >= f.nz) return null;
  const level = f.level[j * f.nx + i];
  return Number.isNaN(level) ? null : level;
}

function bodyOn(x: number, z: number, heading: number, lying: number, drinking: number) {
  const c = Math.cos(heading), s = Math.sin(heading), along = BODY.hips[0][0];
  const y = sampleGrid(grid, x, z);
  const ground = Math.atan2(sampleGrid(grid, x + c * along, z + s * along) - sampleGrid(grid, x - c * along, z - s * along), 2 * along);
  const pitch = (ground - BODY.drinkTip * drinking) * (1 - lying);
  const torso = BODY.torso.stand - BODY.drinkLower * drinking + (BODY.torso.lie - BODY.torso.stand) * lying;
  const of = (a: number, u: number) => {
    const fa = a * Math.cos(pitch) - u * Math.sin(pitch), fu = a * Math.sin(pitch) + u * Math.cos(pitch);
    return [x + c * fa, y + torso + fu, z + s * fa] as [number, number, number];
  };
  return { shoulder: of(...BODY.shoulder) };
}

function tryDrinkStand(shoreX: number, shoreZ: number, ox: number, oz: number): (Stand & { score: number }) | { fail: string; feet?: string; muzzle?: string } {
  const L = Math.hypot(ox, oz) || 1;
  ox /= L; oz /= L;
  const wx = shoreX - ox * SITE.sip, wz = shoreZ - oz * SITE.sip;
  const wy = waterLevel(wx, wz);
  if (wy === null || waterDepth(world, wx, wz) <= 0) {
    return { fail: '嘴点无有效水面', feet: '未检查', muzzle: 'no' };
  }
  const facing = Math.atan2(-oz, -ox);
  let reach = 1.2, neck = 0, ok = true, sx = 0, sz = 0;
  for (let it = 0; it < 4; it++) {
    sx = wx + ox * reach; sz = wz + oz * reach;
    const body = bodyOn(sx, sz, facing, 0, 1);
    const drop = wy - body.shoulder[1];
    let lo = -1.5, hi = BODY.neckUp;
    if (muzzleFrom(lo)[1] > drop) { ok = false; break; }
    for (let b = 0; b < 30; b++) { const m = (lo + hi) / 2; if (muzzleFrom(m)[1] > drop) hi = m; else lo = m; }
    neck = (lo + hi) / 2;
    reach = Math.hypot(body.shoulder[0] - sx, body.shoulder[2] - sz) + muzzleFrom(neck)[0];
  }
  if (!ok) return { fail: '嘴够不到水面（落差／坡）', feet: '未检查', muzzle: 'no' };
  if (!walkable(world, sx, sz)) return { fail: '站位格子不可走', feet: 'no', muzzle: 'yes' };
  const c = Math.cos(facing), s = Math.sin(facing);
  let driest = 0;
  for (let k = 0; k < BODY.hips.length; k++) {
    const [ha, hc] = BODY.hips[k];
    const a = ha + BODY.drinkSplay[k < 2 ? 0 : 1], fx = sx + c * a - s * hc, fz = sz + s * a + c * hc;
    const depth = waterDepth(world, fx, fz);
    if (depth > 0) return { fail: '前／后脚入水', feet: 'no', muzzle: 'yes' };
    if (!walkable({ ...world, water: { ...world.water, field: null } }, fx, fz)) {
      return { fail: '脚点不可站', feet: 'no', muzzle: 'yes' };
    }
    if (k < 2) driest = Math.min(driest, depth);
  }
  const slope = Math.hypot(sampleGrid(grid, sx, sz, 1), sampleGrid(grid, sx, sz, 2));
  const score = -2 * slope + (world.terrace(sx, sz) > SITE.keepOff ? 0.5 : 0) + Math.min(-driest, 1.5);
  return { x: sx, z: sz, facing, neck, water: [wx, wy, wz], score };
}

function pathLen(from: [number, number], to: [number, number]): number | null {
  const cell = 1, pad = 10;
  const minX = Math.min(from[0], to[0]) - pad, minZ = Math.min(from[1], to[1]) - pad;
  const size = Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) + 2 * pad);
  const n = Math.max(8, Math.round(size / cell));
  const idx = (x: number, z: number) => [
    Math.min(Math.max(Math.floor((x - minX) / cell), 0), n - 1),
    Math.min(Math.max(Math.floor((z - minZ) / cell), 0), n - 1),
  ];
  const at = (i: number, j: number): [number, number] => [minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell];
  const [si, sj] = idx(...from), [ti, tj] = idx(...to);
  const start = sj * n + si, goal = tj * n + ti;
  const blocked = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const [x, z] = at(i, j);
    blocked[j * n + i] = walkable(world, x, z) ? 0 : 1;
  }
  blocked[start] = 0; blocked[goal] = 0;
  const gScore = new Float32Array(n * n).fill(Infinity), closed = new Uint8Array(n * n);
  const heap: [number, number][] = [[0, start]];
  gScore[start] = 0;
  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0]);
    const [, t] = heap.shift()!;
    if (closed[t]) continue;
    closed[t] = 1;
    if (t === goal) break;
    const i = t % n, j = (t / n) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const u = jj * n + ii;
      if (closed[u] || blocked[u]) continue;
      if (di && dj && (blocked[j * n + ii] || blocked[jj * n + i])) continue;
      const step = Math.hypot(di, dj);
      if (gScore[t] + step < gScore[u]) {
        gScore[u] = gScore[t] + step;
        heap.push([gScore[u] + Math.hypot(ii - ti, jj - tj), u]);
      }
    }
  }
  return closed[goal] ? gScore[goal] : null;
}

/** Real shore: dry cell with toWater in band AND a wet neighbour (actual water edge). */
function shoreNormal(i: number, j: number): { ox: number; oz: number } | null {
  const { cell, nx, nz, toWater } = zones;
  let ox = 0, oz = 0, found = false;
  for (let a = 0; a < 8; a++) {
    const di = Math.round(Math.cos((a * Math.PI) / 4));
    const dj = Math.round(Math.sin((a * Math.PI) / 4));
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
    const x = zones.x0 + (ii + 0.5) * cell, z = zones.z0 + (jj + 0.5) * cell;
    if (waterDepth(world, x, z) > 0) { ox -= di; oz -= dj; found = true; }
  }
  if (!found) {
    const twX = toWater[j * nx + Math.min(i + 1, nx - 1)] - toWater[j * nx + Math.max(i - 1, 0)];
    const twZ = toWater[Math.min(j + 1, nz - 1) * nx + i] - toWater[Math.max(j - 1, 0) * nx + i];
    if (twX * twX + twZ * twZ < 1e-8) return null;
    return { ox: twX, oz: twZ };
  }
  if (ox * ox + oz * oz < 1e-8) return null;
  return { ox, oz };
}

const { cell, nx, nz, x0, z0, toWater, region } = zones;
const hi = Math.floor((home.x - x0) / cell), hj = Math.floor((home.z - z0) / cell);
const homeRegion = region[hj * nx + hi];
const searchR = homeDrinkDist + 8;
const sampleStep = 2; // coarse spacing along shore cells (zone cell often 2 m)
const refineStep = 1;

type ShoreCand = { x: number; z: number; i: number; j: number; straight: number };
const shores: ShoreCand[] = [];
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const t = j * nx + i;
  if (region[t] !== homeRegion) continue;
  const tw = toWater[t];
  if (tw < SITE.shoreLo || tw > SITE.shoreHi) continue;
  const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
  const straight = Math.hypot(x - home.x, z - home.z);
  if (straight > searchR) continue;
  if (!shoreNormal(i, j)) continue; // must be a real edge (wet neighbour or tw gradient)
  // Subsample by spacing
  if (shores.some((s) => Math.hypot(s.x - x, s.z - z) < sampleStep)) continue;
  shores.push({ x, z, i, j, straight });
}
shores.sort((a, b) => a.straight - b.straight);

const curPath = pathLen([home.x, home.z], [cur.x, cur.z]);
const curStraight = Math.hypot(cur.x - home.x, cur.z - home.z);

type Row = {
  shore: string; straight: number; path: string; feet: string; muzzle: string; inList: string; stepFail: string;
};
const rows: Row[] = [{
  shore: `CURRENT (${cur.x.toFixed(1)}, ${cur.z.toFixed(1)})`,
  straight: +curStraight.toFixed(1),
  path: curPath != null ? curPath.toFixed(1) : 'none',
  feet: 'yes',
  muzzle: 'yes',
  inList: 'yes — primary',
  stepFail: `配对胜出；path=${curPath?.toFixed(1)}`,
}];

let checked = 0;
let validNearer = 0;
const nearerValid: { x: number; z: number; straight: number; path: number; score: number }[] = [];

function evaluateShore(sc: ShoreCand, refined: boolean) {
  checked++;
  const nrm = shoreNormal(sc.i, sc.j);
  if (!nrm) {
    rows.push({
      shore: `(${sc.x.toFixed(1)}, ${sc.z.toFixed(1)})${refined ? '·密' : ''}`,
      straight: +sc.straight.toFixed(1), path: '—', feet: '未检查', muzzle: '未检查',
      inList: 'no', stepFail: '无出水方向／非岸缘',
    });
    return;
  }
  const stand = tryDrinkStand(sc.x, sc.z, nrm.ox, nrm.oz);
  if ('fail' in stand) {
    rows.push({
      shore: `(${sc.x.toFixed(1)}, ${sc.z.toFixed(1)})${refined ? '·密' : ''}`,
      straight: +sc.straight.toFixed(1), path: '—',
      feet: stand.feet ?? '未检查', muzzle: stand.muzzle ?? '未检查',
      inList: 'no', stepFail: stand.fail,
    });
    return;
  }
  const path = pathLen([home.x, home.z], [stand.x, stand.z]);
  if (path == null) {
    rows.push({
      shore: `(${stand.x.toFixed(1)}, ${stand.z.toFixed(1)})${refined ? '·密' : ''}`,
      straight: +sc.straight.toFixed(1), path: '—', feet: 'yes', muzzle: 'yes',
      inList: 'no', stepFail: '无干路可达',
    });
    return;
  }
  if (sc.straight < curStraight - 1) {
    validNearer++;
    nearerValid.push({ x: stand.x, z: stand.z, straight: sc.straight, path, score: stand.score });
  }
  const shorter = curPath != null && path < curPath * 0.85;
  rows.push({
    shore: `(${stand.x.toFixed(1)}, ${stand.z.toFixed(1)})${refined ? '·密' : ''}`,
    straight: +sc.straight.toFixed(1),
    path: path.toFixed(1),
    feet: 'yes', muzzle: 'yes',
    inList: Math.hypot(stand.x - cur.x, stand.z - cur.z) < 3 ? 'near current' : 'no',
    stepFail: shorter
      ? `合法且步行更短 — 可能漏选／配对未含回家路径`
      : `合法；standScore=${stand.score.toFixed(2)}；步行未明显更短`,
  });
}

// Nearest-to-home shores + evenly spaced mid-range shores (avoid only checking dry-adjacent home cells).
const picked: ShoreCand[] = [];
const take = (sc: ShoreCand) => {
  if (picked.some((p) => Math.hypot(p.x - sc.x, p.z - sc.z) < sampleStep * 0.9)) return;
  picked.push(sc);
};
for (const sc of shores.slice(0, 5)) take(sc);
if (shores.length > 5) {
  const bands = 6;
  for (let b = 1; b <= bands; b++) {
    const target = (b / (bands + 1)) * curStraight;
    let best: ShoreCand | null = null, bestD = Infinity;
    for (const sc of shores) {
      if (sc.straight >= curStraight - 1) continue;
      const d = Math.abs(sc.straight - target);
      if (d < bestD) { bestD = d; best = sc; }
    }
    if (best) take(best);
  }
}
// Shores nearer the current drink but still closer to home than the stand
const nearDrink = shores
  .filter((s) => s.straight < curStraight - 1)
  .sort((a, b) => Math.hypot(a.x - cur.x, a.z - cur.z) - Math.hypot(b.x - cur.x, b.z - cur.z))
  .slice(0, 4);
for (const sc of nearDrink) take(sc);
for (const sc of picked) evaluateShore(sc, false);

// If no valid nearer, refine along the 3 nearest shore segments
if (validNearer === 0 && shores.length) {
  for (const sc of shores.slice(0, 3)) {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = sc.i + di, j = sc.j + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const t = j * nx + i;
      const tw = toWater[t];
      if (tw < SITE.shoreLo || tw > SITE.shoreHi) continue;
      if (!shoreNormal(i, j)) continue;
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      const straight = Math.hypot(x - home.x, z - home.z);
      if (straight > searchR || straight >= curStraight - 0.5) continue;
      if (rows.some((r) => r.shore.includes(`(${x.toFixed(1)}`))) continue;
      evaluateShore({ x, z, i, j, straight }, true);
    }
  }
}

const better = nearerValid.filter((v) => curPath != null && v.path < curPath * 0.85);
console.log(`seed ${seed} home A (${home.x.toFixed(1)}, ${home.z.toFixed(1)}) drink (${cur.x.toFixed(1)}, ${cur.z.toFixed(1)})`);
console.log(JSON.stringify({
  searchRadiusM: +searchR.toFixed(1),
  sampleSpacingM: sampleStep,
  refineSpacingM: refineStep,
  shoreCandidatesFound: shores.length,
  shoreSegmentsChecked: checked,
  validNearerCount: validNearer,
  betterShorterPath: better.length,
}, null, 2));
console.table(rows);
console.log(JSON.stringify({
  plainZh: better.length
    ? `在家到饮水距离内的真实岸线上，发现 ${better.length} 处可安全饮水且步行更短；配对未强制最短回家路径，可能漏选。`
    : validNearer
      ? `真实岸线上有更近合法站，但步行并不明显更短。`
      : `在搜索半径 ${searchR.toFixed(0)} m 内检查了 ${checked} 段真实岸缘后，未找到比当前站更近且合法的饮水站（失败步骤见表）。此结论限于本采样密度，不宣称「附近唯一」。`,
  weights: {
    drinkStand: '−2×坡度 + (离梯田>6m ? +0.5 : 0) + min(脚干裕度, 1.5)',
    homeCand: '栖息地+2 + 3×周围抬升遮蔽 − 10×坡度 − 直线距/200',
    pairTotal: 'drinkStand分 + 家园个数 + 各家园分之和；不含回家路径长',
  },
}, null, 2));
