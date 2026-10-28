import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import { createNoise2D } from '../../core/noise';
import { createRng } from '../../core/rng';
import {
  BODY,
  type Dwelling,
} from './dwelling';
import { cornerObstacles, planCorner, type Corner } from './corner';
import { TREE_CLEARANCE } from './woods';
import { ZONE, zoneAt, type Zones } from './zones';

/**
 * Shore stones, and the obstacle list the shelter is added to. The small resting stone is retired:
 * the lie is the shelter's bed (rockShelter.ts), not a stone beside the old coordinate.
 * Homes and the drink stand are already chosen. These stones do not move them.
 *
 * The closed mesh follows stele.ts (rings, flat-shaded quads, aOcclusion) but the plan is a
 * 6- or 7-sided mound with a wide face and one or two notches, not a tablet pressed flat.
 *
 * Order: homes and drink (already) → candidates → obstacle circles → smoothed route both ways
 * → the meshes the scene draws. A stone that would block a round trip is dropped.
 * Switching homes rebuilds the list. It does not append, so the previous home's stone is gone.
 * If the creature is in the new seat, that stone stays out of the mesh and the obstacle list until
 * the creature has left it. The whole layout is not rebuilt to do that.
 */

export interface StoneShape {
  /** Full plan length, width, and mesh height, metres. Part of the height is buried at placement. */
  length: number;
  width: number;
  height: number;
  /** Metres of the mesh sunk below the lowest ground under it. */
  bury: number;
  sides: number;
  /** Extra scale on +X, so the body is not a symmetric loaf. */
  lean: number;
  /** How far one vertex is pulled in, as a share of its radius. */
  notch: number;
  notchAt: number;
  notch2: number;
  /** Radians: which side of the mound stands higher. */
  face: number;
}

export interface StoneBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

export interface PlacedStone {
  kind: 'rest' | 'shore';
  group: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  meshSeed: number;
  shape: StoneShape;
  /** Horizontal radius of the mesh about its origin, metres. */
  planR: number;
  /** Obstacle circle: the plan plus the body's half-width. Search adds ROUTE_CLEAR on top. */
  obstacleR: number;
  bounds: StoneBounds;
  triangles: number;
  tint: 'warm' | 'shade';
}

export interface HabitatLayout {
  stones: PlacedStone[];
  obstacles: { x: number; z: number; r: number }[];
  /** Rest stone that passed the seat tests, per home. Only the current home is drawn. */
  restByHome: (PlacedStone | null)[];
  restSkip: string | null;
  shoreSkips: string[];
  /** Smoothed home → drink length, metres, before stones and after the stones actually registered. */
  pathBeforeM: number | null;
  pathAfterM: number | null;
  /** With this shore set and that home's rest stone, both smoothed ways exist. */
  homeRoundTrip: boolean[];
  shoreView: { from: [number, number, number]; to: [number, number, number] } | null;
  triangles: number;
  /** Corner for the home this layout was built at (pines, cameras). */
  corner: Corner;
  /**
   * The current home's rest stone, withheld because the creature was in the seat when the home
   * changed. Absent from `stones` and `obstacles` until `revealHeld` is set.
   */
  heldRest: PlacedStone | null;
  /** Why a home has no rest stone, empty when it has one. */
  seatNotes: string[];
}

/** Body half-width added inside a shore stone's circle, metres. The path search adds ROUTE_CLEAR. */
const BODY_MARGIN = BODY.torso.across + 0.08;
const SHORE = {
  groups: 5,
  apart: 48,
  tries: 16,
  band: [2.6, 8.5] as [number, number],
  slope: 0.2,
  /** Metres a shore stone's edge keeps from a home. The old 4.5 m rule, measured to the mesh. */
  home: 4.5,
  /** Metres the mesh stays off the straight home–drink segment, before the route is rechecked. */
  way: 3.2,
};

const pushTri = (pos: number[], nor: number[], idx: number[], occ: number[], A: number[], B: number[], C: number[], o: number) => {
  const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2];
  const bx = C[0] - A[0], by = C[1] - A[1], bz = C[2] - A[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const L = Math.hypot(nx, ny, nz) || 1;
  nx /= L; ny /= L; nz /= L;
  const b = pos.length / 3;
  for (const p of [A, B, C]) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); occ.push(o); }
  idx.push(b, b + 1, b + 2);
};

const quad = (pos: number[], nor: number[], idx: number[], occ: number[], a: number[], b: number[], c: number[], d: number[], o: number) => {
  pushTri(pos, nor, idx, occ, a, b, c, o);
  pushTri(pos, nor, idx, occ, a, c, d, o);
};

/** A low asymmetric mound. Local y = 0 is the buried base; +X is the long axis. Pure for seed + shape. */
export function stoneGeometry(seed: number, shape: StoneShape): BufferGeometry {
  const rng = createRng(seed * 13 + 7);
  const n = shape.sides < 7 ? 6 : 7;
  const notchAt = shape.notchAt % n;
  const notch2At = (notchAt + 3) % n;
  const ringAt = (y: number, scale: number, occ: number): { p: number[][]; o: number } => {
    const p: number[][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.15;
      let rad = 1;
      if (k === notchAt) rad -= shape.notch;
      else if (k === notch2At) rad -= shape.notch2;
      rad *= scale;
      let x = Math.cos(a) * shape.length * 0.5 * rad;
      const z = Math.sin(a) * shape.width * 0.5 * rad;
      x *= x >= 0 ? 1 + shape.lean : 1 - shape.lean * 0.35;
      const jitter = (rng() - 0.5) * 0.03 * shape.length;
      p.push([x + jitter, y, z + jitter * 0.6]);
    }
    return { p, o: occ };
  };
  const heightOf = (k: number) => {
    const a = (k / n) * Math.PI * 2;
    return shape.height * (0.84 + 0.16 * Math.cos(a - shape.face));
  };
  const base = ringAt(0, 1.04, 0.48);
  const foot = ringAt(shape.height * 0.18, 0.96, 0.62);
  const belly = ringAt(shape.height * 0.55, 1, 0.78);
  const shoulder = ringAt(shape.height * 0.82, 0.9, 0.74);
  const topP: number[][] = [];
  for (let k = 0; k < n; k++) {
    const src = shoulder.p[k];
    topP.push([src[0] * 0.58, heightOf(k), src[2] * 0.58]);
  }
  const top = { p: topP, o: 1 };
  const rings = [base, foot, belly, shoulder, top];
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const occ: number[] = [];
  const mid = (ring: number[][]): number[] => {
    const c = [0, 0, 0];
    for (const p of ring) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    return [c[0] / ring.length, c[1] / ring.length, c[2] / ring.length];
  };
  const botC = mid(base.p), topC = mid(top.p);
  for (let k = 0; k < n; k++) {
    const n1 = (k + 1) % n;
    pushTri(pos, nor, idx, occ, botC, base.p[n1], base.p[k], 0.42);
    pushTri(pos, nor, idx, occ, topC, top.p[k], top.p[n1], top.o);
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let k = 0; k < n; k++) {
      const n1 = (k + 1) % n;
      const o = Math.min(A.o, B.o) * (k === notchAt ? 0.92 : 1);
      quad(pos, nor, idx, occ, A.p[k], A.p[n1], B.p[n1], B.p[k], o);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('aOcclusion', new BufferAttribute(new Float32Array(occ), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function measureStone(seed: number, shape: StoneShape): { planR: number; triangles: number; bounds: StoneBounds } {
  const g = stoneGeometry(seed, shape);
  const box = g.boundingBox!;
  const p = g.getAttribute('position');
  let planR = 0;
  for (let i = 0; i < p.count; i++) planR = Math.max(planR, Math.hypot(p.getX(i), p.getZ(i)));
  const bounds: StoneBounds = {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    size: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
  };
  const triangles = (g.getIndex()?.count ?? 0) / 3;
  g.dispose();
  return { planR, triangles, bounds };
}

function shapeFrom(seed: number, size: Pick<StoneShape, 'length' | 'width' | 'height' | 'bury'>): StoneShape {
  const rng = createRng(seed);
  return {
    ...size,
    sides: rng() < 0.45 ? 6 : 7,
    lean: 0.12 + rng() * 0.26,
    notch: 0.22 + rng() * 0.14,
    notchAt: Math.floor(rng() * 7),
    notch2: 0.08 + rng() * 0.08,
    face: rng() * Math.PI * 2,
  };
}

const polyLen = (pts: [number, number][]) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
};

const hitsEllipse = (x: number, z: number, r: number, ex: number, ez: number, facing: number, a: number, b: number) => {
  const dx = x - ex, dz = z - ez, c = Math.cos(facing), s = Math.sin(facing);
  const u = (dx * c + dz * s) / a, v = (-dx * s + dz * c) / b;
  const pad = r / Math.min(a, b);
  return u * u + v * v < (1 + pad) * (1 + pad);
};

const distToSeg = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
};

/** Drinking pose as one ellipse: body, splayed feet, and the muzzle's water point, plus a margin. */
function drinkEllipse(stand: Dwelling['sites']['drink']) {
  const fx = Math.cos(stand.facing), fz = Math.sin(stand.facing);
  const reach = Math.hypot(stand.water[0] - stand.x, stand.water[2] - stand.z);
  const fore = Math.max(reach, BODY.shoulder[0] + BODY.head.front) + 0.45;
  const hind = Math.abs(BODY.hips[2][0] + BODY.drinkSplay[1]) + 0.4;
  const across = BODY.torso.across + 0.5;
  const shift = (fore - hind) / 2;
  return { x: stand.x + fx * shift, z: stand.z + fz * shift, facing: stand.facing, a: (fore + hind) / 2, b: across };
}

type Circle = { x: number; z: number; r: number };

/**
 * Shore groups are the same for every home. The drawn resting stone is only the current home's.
 * `pose`, when set, is where the creature is now: that seat is not filled.
 */
export function placeHabitat(input: {
  seed: number;
  dwelling: Dwelling;
  zones: Zones;
  trees: { x: number; z: number }[];
  shrubs: { x: number; z: number; r: number }[];
  pose: { x: number; z: number } | null;
}): HabitatLayout {
  const { seed, dwelling, zones, trees, shrubs, pose } = input;
  const savedHome = Math.min(dwelling.home, dwelling.sites.homes.length - 1);
  dwelling.home = savedHome;
  const homes = dwelling.sites.homes;
  const region = dwelling.sites.region;
  const inRegion = (x: number, z: number) => x > region.x0 - 2 && z > region.z0 - 2 && x < region.x0 + region.size + 2 && z < region.z0 + region.size + 2;
  const regionTrees: Circle[] = trees.filter((t) => inRegion(t.x, t.z)).map((t) => ({ x: t.x, z: t.z, r: TREE_CLEARANCE }));
  const allTrees: Circle[] = trees.map((t) => ({ x: t.x, z: t.z, r: TREE_CLEARANCE }));

  dwelling.setObstacles([]);
  const corners: Corner[] = [];
  for (let i = 0; i < homes.length; i++) {
    dwelling.home = i;
    corners.push(planCorner(dwelling));
  }
  dwelling.home = savedHome;
  const pineObs = corners.map((c) => cornerObstacles(c));
  const blockers: Circle[] = [...allTrees, ...pineObs.flat(), ...shrubs];

  const ground = dwelling.groundAt;
  const toWaterAt = (x: number, z: number) => {
    const i = Math.floor((x - zones.x0) / zones.cell), j = Math.floor((z - zones.z0) / zones.cell);
    if (i < 0 || j < 0 || i >= zones.nx || j >= zones.nz) return 1e9;
    return zones.toWater[j * zones.nx + i];
  };
  const samplesOf = (x: number, z: number, yaw: number, length: number, width: number): [number, number][] => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const pts: [number, number][] = [[x, z]];
    for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.75, 0.75], [-0.75, 0.65]] as [number, number][]) {
      const lx = u * length * 0.42, lz = v * width * 0.42;
      pts.push([x + c * lx - s * lz, z + s * lx + c * lz]);
    }
    return pts;
  };
  const support = (x: number, z: number, yaw: number, shape: StoneShape) => {
    const hs = samplesOf(x, z, yaw, shape.length, shape.width).map(([px, pz]) => ground(px, pz));
    const minH = Math.min(...hs), maxH = Math.max(...hs);
    const rise = shape.height - shape.bury - (maxH - minH);
    if (rise < 0.1 || maxH - minH > shape.height * 0.7) return null;
    const y = minH - shape.bury;
    if (!(y < minH - 0.04) || !(y + shape.height > maxH + 0.04)) return null;
    return y;
  };
  const clearOf = (x: number, z: number, planR: number, extra: Circle[] = []) =>
    [...blockers, ...extra].every((o) => Math.hypot(x - o.x, z - o.z) >= o.r + planR + 0.15);

  const drinkEllipses = dwelling.sites.stands.map(drinkEllipse);

  const roundTrip = (homeIndex: number, extra: Circle[]) => {
    dwelling.setObstacles([...pineObs[homeIndex], ...regionTrees, ...extra]);
    const h = homes[homeIndex], drink = dwelling.sites.drink;
    if (!dwelling.dry(h.x, h.z) || !dwelling.dry(drink.x, drink.z)) return null;
    if (dwelling.sites.stands.some((s) => !dwelling.dry(s.x, s.z))) return null;
    const out = dwelling.wayBetween([h.x, h.z], [drink.x, drink.z]);
    const back = dwelling.wayBetween([drink.x, drink.z], [h.x, h.z]);
    if (!out || !back) return null;
    if (!out.every(([x, z]) => dwelling.dry(x, z)) || !back.every(([x, z]) => dwelling.dry(x, z))) return null;
    return { out: polyLen(out), back: polyLen(back) };
  };

  // The small rest stone is retired. restByHome stays so older checks can see that it is gone.
  const restByHome: (PlacedStone | null)[] = homes.map(() => null);
  const restWhy = homes.map(() => 'small rest stone retired; the shelter is the lie');

  const restObs = (i: number): Circle[] => {
    const s = restByHome[i];
    return s ? [{ x: s.x, z: s.z, r: s.obstacleR }] : [];
  };

  // Shore scan uses trunks and shrubs as blocked ground, then the route test puts back only
  // the obstacles the creature actually keeps (pines, region trees, stones).
  dwelling.setObstacles(blockers);
  const noise = createNoise2D(seed + 1200);
  const rng = createRng(seed * 19 + 5);
  const shoreSkips: string[] = [];
  const groups: PlacedStone[][] = [];
  const step = zones.cell * 4;
  const cands: { x: number; z: number; score: number; inland: [number, number] }[] = [];
  for (let z = zones.z0 + step; z < zones.z0 + zones.nz * zones.cell; z += step) {
    for (let x = zones.x0 + step; x < zones.x0 + zones.nx * zones.cell; x += step) {
      const tw = toWaterAt(x, z);
      if (tw < SHORE.band[0] || tw > SHORE.band[1]) continue;
      const zone = zoneAt(zones, x, z);
      if (zone === ZONE.water || zone === ZONE.outside || zone === ZONE.cliff || zone === ZONE.ridge || zone === ZONE.terrace || zone === ZONE.rockSlope) continue;
      const n = noise(x / 55, z / 55);
      if (n < 0.08) continue;
      const slope = Math.hypot(ground(x + 0.5, z) - ground(x - 0.5, z), ground(x, z + 0.5) - ground(x, z - 0.5));
      if (slope > SHORE.slope || !dwelling.dry(x, z)) continue;
      const ix = toWaterAt(x + 2, z) - toWaterAt(x - 2, z);
      const iz = toWaterAt(x, z + 2) - toWaterAt(x, z - 2);
      const il = Math.hypot(ix, iz) || 1;
      const inland: [number, number] = [ix / il, iz / il];
      if (!dwelling.dry(x + inland[0] * 2, z + inland[1] * 2)) continue;
      const mid = 1 - Math.min(Math.abs(tw - 5) / 4, 1);
      cands.push({ x, z, inland, score: n * (0.4 + 0.6 * mid) * (1 - slope / SHORE.slope) });
    }
  }
  cands.sort((a, b) => b.score - a.score);

  const taken = (): Circle[] => groups.flat().map((s) => ({ x: s.x, z: s.z, r: s.planR }));
  const shoreStone = (x: number, z: number, yaw: number, meshSeed: number, scale: number, tint: 'warm' | 'shade', group: number, primary: Pick<StoneShape, 'length' | 'width' | 'height' | 'bury'>): PlacedStone | null => {
    dwelling.setObstacles(blockers);
    const size = {
      length: primary.length * scale,
      width: primary.width * scale,
      height: Math.max(0.22, primary.height * scale),
      bury: Math.min(primary.bury, primary.height * scale * 0.45),
    };
    const shape = shapeFrom(meshSeed, size);
    const measured = measureStone(meshSeed, shape);
    const y = support(x, z, yaw, shape);
    if (y === null) return null;
    const pts = samplesOf(x, z, yaw, shape.length, shape.width);
    if (pts.some(([px, pz]) => !dwelling.dry(px, pz) || toWaterAt(px, pz) < 1.6)) return null;
    if (!clearOf(x, z, measured.planR, taken())) return null;
    if (homes.some((h) => Math.hypot(x - h.x, z - h.z) < SHORE.home + measured.planR)) return null;
    if (drinkEllipses.some((e) => hitsEllipse(x, z, measured.planR, e.x, e.z, e.facing, e.a, e.b))) return null;
    const drink = dwelling.sites.drink;
    if (homes.some((h) => distToSeg(x, z, h.x, h.z, drink.x, drink.z) < SHORE.way + measured.planR)) return null;
    return {
      kind: 'shore', group, x, y, z, yaw, meshSeed, shape, planR: measured.planR,
      obstacleR: measured.planR + BODY_MARGIN, bounds: measured.bounds, triangles: measured.triangles, tint,
    };
  };

  let looked = 0;
  for (const c of cands) {
    if (groups.length >= SHORE.groups || looked >= SHORE.tries) break;
    if (groups.some((g) => Math.hypot(g[0].x - c.x, g[0].z - c.z) < SHORE.apart)) continue;
    looked++;
    const primarySize = {
      length: 1.2 + rng() * 0.85,
      width: 0.58 + rng() * 0.36,
      height: 0.34 + rng() * 0.32,
      bury: 0.12 + rng() * 0.08,
    };
    const tangent: [number, number] = [-c.inland[1], c.inland[0]];
    const yaw0 = Math.atan2(tangent[1], tangent[0]) + (rng() - 0.5) * 0.4;
    const mesh0 = seed * 17 + looked * 13 + 1;
    const primary = shoreStone(c.x, c.z, yaw0, mesh0, 1, 'warm', groups.length, primarySize);
    if (!primary) { shoreSkips.push(`bank (${c.x.toFixed(0)}, ${c.z.toFixed(0)}): no supported primary on dry ground`); continue; }
    const group: PlacedStone[] = [primary];
    for (const sign of [1, -1] as const) {
      if (group.length >= 3) break;
      const dist = 1.5 + rng() * 0.85;
      const along = (rng() - 0.5) * 0.45;
      const x = c.x + tangent[0] * sign * dist + c.inland[0] * along;
      const z = c.z + tangent[1] * sign * dist + c.inland[1] * along;
      const yaw = yaw0 + sign * (0.4 + rng() * 0.6);
      const stone = shoreStone(x, z, yaw, mesh0 + sign + 5, 0.42 + rng() * 0.22, 'shade', groups.length, primarySize);
      if (stone && Math.hypot(stone.x - primary.x, stone.z - primary.z) > primary.planR + stone.planR + 0.12) group.push(stone);
    }
    if (group.length < 2) { shoreSkips.push(`bank (${c.x.toFixed(0)}, ${c.z.toFixed(0)}): primary had no secondary`); continue; }
    const extra = [...groups.flat(), ...group].map((s) => ({ x: s.x, z: s.z, r: s.obstacleR }));
    let open = true;
    for (let hi = 0; hi < homes.length; hi++) {
      if (!roundTrip(hi, [...extra, ...restObs(hi)])) { open = false; break; }
    }
    if (!open) { shoreSkips.push(`bank (${c.x.toFixed(0)}, ${c.z.toFixed(0)}): blocked a smoothed home–drink way`); continue; }
    groups.push(group);
  }

  const shore = groups.flat();
  const currentRest = restByHome[savedHome] ?? null;
  let restSkip: string | null = currentRest ? null : `home ${savedHome}: ${restWhy[savedHome] ?? 'no seat'}`;
  let shownRest = currentRest;
  let heldRest: PlacedStone | null = null;
  if (shownRest && pose && Math.hypot(pose.x - shownRest.x, pose.z - shownRest.z) < shownRest.planR + BODY.torso.across + 0.2) {
    restSkip = 'creature is in the seat; stone waits until it has left';
    heldRest = shownRest;
    shownRest = null;
  }
  const stones = [...(shownRest ? [shownRest] : []), ...shore];
  const stoneObs = stones.map((s) => ({ x: s.x, z: s.z, r: s.obstacleR }));
  const before = roundTrip(savedHome, []);
  const after = roundTrip(savedHome, stoneObs);
  const homeRoundTrip = homes.map((_, hi) => roundTrip(hi, [...shore.map((s) => ({ x: s.x, z: s.z, r: s.obstacleR })), ...restObs(hi)]) !== null);
  const obstacles = [...pineObs[savedHome], ...regionTrees, ...stoneObs];
  dwelling.setObstacles(obstacles);
  dwelling.home = savedHome;

  let shoreView: HabitatLayout['shoreView'] = null;
  for (const s of shore) {
    if (s.tint !== 'warm') continue;
    const ix = toWaterAt(s.x + 2, s.z) - toWaterAt(s.x - 2, s.z);
    const iz = toWaterAt(s.x, s.z + 2) - toWaterAt(s.x, s.z - 2);
    const il = Math.hypot(ix, iz) || 1;
    const ixn = ix / il, izn = iz / il;
    const tx = -izn, tz = ixn;
    // Along the bank: the stream sits to one side of the group, not behind a rise.
    const ex = s.x + tx * 5.5 + ixn * 1.2, ez = s.z + tz * 5.5 + izn * 1.2;
    const wx = s.x - tx * 1.5 - ixn * 2.4, wz = s.z - tz * 1.5 - izn * 2.4;
    if (toWaterAt(wx, wz) >= toWaterAt(s.x, s.z)) continue;
    const gy = ground(s.x, s.z);
    if (Math.abs(ground(ex, ez) - gy) > 1.2) continue;
    shoreView = {
      from: [ex, ground(ex, ez) + 1.6, ez],
      to: [wx, ground(wx, wz) + 0.15, wz],
    };
    break;
  }

  return {
    stones,
    obstacles,
    restByHome,
    restSkip,
    shoreSkips,
    pathBeforeM: before ? before.out : null,
    pathAfterM: after ? after.out : null,
    homeRoundTrip,
    shoreView,
    triangles: stones.reduce((n, s) => n + s.triangles, 0),
    corner: corners[savedHome],
    heldRest,
    seatNotes: restWhy.map((w, i) => (restByHome[i] ? '' : w)),
  };
}

/** Obstacle list once a withheld rest stone is allowed on. The same flag drives the mesh. */
export function obstaclesWithHeld(layout: HabitatLayout, reveal: boolean) {
  if (!reveal || !layout.heldRest) return layout.obstacles;
  const s = layout.heldRest;
  return [...layout.obstacles, { x: s.x, z: s.z, r: s.obstacleR }];
}

/** Meshes for the same flag as `obstaclesWithHeld`. */
export function stonesWithHeld(layout: HabitatLayout, reveal: boolean): PlacedStone[] {
  if (!reveal || !layout.heldRest) return layout.stones;
  return [...layout.stones, layout.heldRest];
}
