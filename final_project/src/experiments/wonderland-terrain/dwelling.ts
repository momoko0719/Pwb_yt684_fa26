import { createNoise2D, type Noise2D } from '../../core/noise';
import { createRng, type Rng } from '../../core/rng';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { birthAxes, resolveMorph, type MorphAxes } from './creatureMorph';
import type { Water } from './water';
import type { Zones } from './zones';

// Zone indices (zones.ts ZONE): avoid a runtime import cycle with zones → walkable → dwelling.
const Z_HABITAT = 8;
const Z_OPEN = 9;

/**
 * 栖居成玉 (stone turned jade by dwelling): one creature's day, and what it leaves on the ground.
 *
 * The island is warm white stone; where water and life have touched it for a long time it turns
 * to jade. A creature lives in a dry-land region (zones.ts): it rests at a favourite place in
 * habitat, walks to a reachable shore stand, drinks, and walks back. Every contact is recorded
 * where and when it happens, in a contact map over a square of its home range, one channel each:
 *
 * - walk: each foot, where it comes down, at the moment it does (the feet are the creature's own:
 *   each planted where it landed until it steps again, so a mark is where a foot really stood);
 * - drink: its four planted feet at the water's edge, for as long as it drinks;
 * - rest: the ground under its body lying (the body's own footprint, folded legs within it), for
 *   as long as it rests.
 *
 * Each contact adds a little, less as the ground nears its fill (a value only ever approaches 1):
 * once leaves a trace barely seen, a habit a mark. The ground's shader (cdlod.ts) makes jade of it.
 *
 * The body (BODY, shared with the figure in creature.tsx, so what is drawn is what touches): a
 * torso on four straight legs from hip to foot. Its gait: the diagonal pairs step in turn; a pair
 * lifts when its feet have fallen behind where the hips would put them, swings, and lands ahead.
 * It turns on the spot before it walks off (never sideways or backward), slows as it turns while
 * walking. It drinks from a stand chosen so that its muzzle, the neck bowed, reaches the water's
 * surface. It lies down where it rests.
 *
 * Its ways: across the meadow by the cheapest route (a small A* over 1 m cells: slope dear; water,
 * the terrace, the rim, steep ground and anything standing (obstacles: trees, a platform) closed),
 * each trip a little different (a noise of its own added to the cost), and cheaper where it has
 * walked before: its path wears in.
 *
 * Everything advances by simulated seconds (step(dt), in steps of at most SUBSTEP), so the marks
 * are the same at any frame rate or speed.
 *
 * Plain data, no three.js: it runs the same in the page and in a script (scripts/dwell-check.ts).
 */
export interface DwellWorld {
  grid: HeightGrid;
  water: Water;
  /** The terrace's lowest plate (signed distance, negative inside): the creature keeps off it. */
  terrace: (x: number, z: number) => number;
  seed: number;
  /** Island zones (dry-land regions, habitat, distance to water). Required for whole-island sites. */
  zones?: Zones;
  /** What stands on the ground (trees, a platform): circles it keeps out of (x, z, radius). */
  obstacles?: { x: number; z: number; r: number }[];
}

/** Why a dry-land region was not given a creature (for checks and the panel). */
export interface SiteSkip {
  region: number;
  area: number;
  reason: string;
}

export interface Spot { x: number; z: number; /** Radians: which way it faces there. */ facing: number }
/** An exact lie inside a shelter, and the mouth it walks through. No jitter. */
export interface RestPlace { bed: Spot; mouth: Spot }
/** Where it stands to drink: its neck's angle there (radians from level, down negative) and the point of water its muzzle meets. */
export interface Stand extends Spot { neck: number; water: [number, number, number] }
export interface Sites {
  /** The best stand, and others along the same shore (it drinks at one or another). */
  drink: Stand;
  stands: Stand[];
  homes: Spot[];
  /** The square the contact map covers: corner, size (metres). */
  region: { x0: number; z0: number; size: number };
}

export type Activity = 'rest' | 'walk' | 'drink' | 'eat';
export interface GrazingPatch { x: number; z: number; radius: number; biomass: number; version: number; stand: Spot }
export type Point = [number, number, number];
export interface Pose {
  /** The body's middle on the ground: x, ground height, z. */
  x: number;
  y: number;
  z: number;
  /** Radians, about the vertical (0: +x). */
  heading: number;
  /** Radians: nose up positive. */
  pitch: number;
  /** The torso's middle, metres above the ground. */
  torso: number;
  /** The neck's angle from level (radians; up positive): from its shoulder to its muzzle. */
  neck: number;
  activity: Activity;
  /** 0 standing to 1 lying. */
  lying: number;
  /** 0 head up to 1 head down at the water. */
  drinking: number;
  eating: number;
  /** Its hips and its feet (world), front left, front right, hind left, hind right; and its muzzle. */
  hips: Point[];
  feet: Point[];
  muzzle: Point;
  /** Whether each foot is planted (or in the air). */
  planted: boolean[];
}

/**
 * The body, metres, facing +x (left is +z): the blockout's creature, 1.6 m long and 1.4 m high.
 * The figure (creature.tsx) is drawn from these numbers.
 */
/**
 * The neck and head as sculpted (creatureMorph.ts: the island's creature, seed 11), in the body's
 * metres: the neck's root (along, above the torso's middle), its length and angle standing, the
 * face's length and slope. The sim's numbers come from here, so what it reaches is what is drawn.
 * (They were set apart: the sim's shoulder 0.33 m below the sculpt's and its neck 0.27 m longer, and
 * the drawing stretched the neck to make up the difference.)
 */
/**
 * A creature's head and neck, from its form (creatureMorph.ts axes): where the neck leaves the body,
 * the head's base along it, the face ahead of that and its slope. The torso and hips are the same for
 * every creature (scaled to a 0.92 m stand), so feet, lying and the den fit all; the head and neck
 * follow the form, so the muzzle the sim drinks with is the one drawn.
 */
export interface HeadNeck {
  shoulder: [number, number];
  head: { at: number; front: number; level: number; offset: number };
  neckUp: number;
  neckLying: number;
}
export function headNeckOf(axes: MorphAxes): HeadNeck {
  const r = resolveMorph({ worldSeed: 684, creatureSeed: 11, axes });
  const k = 0.92 / r.morph.torso.stand, root = r.figure.neck[0].at, head = r.figure.head[0].at, mouth = r.figure.head[r.figure.head.length - 1].at;
  const at = Math.hypot(head.x - root.x, head.y - root.y) * k, up = Math.atan2(head.y - root.y, head.x - root.x);
  const front = Math.hypot(mouth.x - head.x, mouth.y - head.y) * k, face = Math.atan2(mouth.y - head.y, mouth.x - head.x);
  // The face's slope as the neck bows: as sculpted standing; steep (−1.25) with the neck bowed to −1
  // to drink, as a grazing animal's (at −1.45 the chin tucked back).
  const slope = (face + 1.25) / (up + 1);
  return {
    shoulder: [root.x * k, (root.y - r.morph.torso.stand) * k],
    head: { at, front, level: 1 - slope, offset: face - slope * up },
    neckUp: up,
    // Lying, a little more upright, the head held up (a resting deer's; lower, it stretched forward like a goose's).
    neckLying: up + 0.2,
  };
}
/** The sculpt every creature had before forms varied (seed 11's birth form): BODY's head and neck. */
const SCULPT_FORM = headNeckOf(birthAxes(11));

export const BODY = {
  torso: { stand: 0.92, lie: 0.36, along: 0.62, up: 0.32, across: 0.27 }, // its middle's height standing, lying; its half-sizes
  hips: [[0.42, 0.17], [0.42, -0.17], [-0.42, 0.17], [-0.42, -0.17]] as [number, number][], // along, across
  hipDrop: 0.08, // hips below the torso's middle
  // The default head and neck (each creature's own: Dwelling.form, from headNeckOf).
  shoulder: SCULPT_FORM.shoulder, // the neck's root: along, above the torso's middle
  // The head's base along the neck; the face ahead of that; the face's angle = neck × (1 − level) + offset.
  head: SCULPT_FORM.head,
  neckUp: SCULPT_FORM.neckUp, // radians, the neck's angle standing
  neckLying: SCULPT_FORM.neckLying,
  // A grazing horse keeps its trunk and forelegs nearly upright; the cervical
  // chain supplies most of the reach. Deep torso lowering made the foreknees
  // buckle into a pair of false shoulder humps.
  drinkLower: 0.2, // metres
  drinkTip: 0.2, // radians
  drinkSplay: [0.3, -0.1] as [number, number], // metres; the shore solver requires this reach
  foldAlong: 1.10, // folded feet stay under their own shoulders and haunches
  foldAcross: 1.55, // open the lying stance enough to read each limb beside the belly
};
export const CREATURE = {
  speed: 1.1, // m/s walking
  turn: 1.0, // rad/s turning on the spot (faster, its feet could not keep up)
};
const GAIT = {
  swing: 0.28, // seconds a pair is in the air
  lift: 0.11, // metres a foot lifts
  trigger: 0.2, // metres behind its place a foot may fall before its pair steps (walking)
  settle: 0.1, // the same, standing (it shuffles into place)
  lead: 0.3, // seconds of its speed a foot lands ahead of its place
};
const SUBSTEP = 0.05; // seconds, the longest step simulated at once
/** Lying mark on the ground: half-axes in metres (along the heading, across it). About 1.4 by 0.76 m. */
export const REST_MARK = { along: 0.7, across: 0.38 };
const WEAR = {
  texel: 0.25, // metres per cell of the contact map
  step: { radius: 0.16, amount: 0.07 }, // one foot landing
  // Per second of drinking: at each planted foot, and (less) over the ground it stands over.
  drink: { radius: 0.3, rate: 0.022, under: [0.6, 0.35, 0.01] as [number, number, number] },
  // Per second of lying, over the body's footprint (the torso's where within 0.1 m of the ground,
  // the folded legs under it).
  rest: { along: REST_MARK.along, across: REST_MARK.across, rate: 0.006 },
};
const TIMES = { rest: [50, 90], drink: [15, 26] }; // seconds, each between the two
/** Simulated need units, 0 depleted to 1 full. Thresholds determine the next destination. */
/** Seconds from a need passing its mark to getting up from rest. */
const WAKE_S = 1.5;
/**
 * Choosing where to go, as The Sims' utility AI: each place advertises the need it meets; a creature
 * scores it by how urgent that need is less its distance (weighed by how much of a homebody it is),
 * and takes the best, or one within `tie` of it at random. `follow`: a creature at rest gets up to go
 * with a companion who sets out for water or grass when its own need is within this of its mark
 * (more for a bold one).
 */
const CHOICE = { distance: 0.004, tie: 0.04, follow: 0.12 };

export const NEEDS = {
  initial: { hunger: 0.69, thirst: 0.62, energy: 0.75 },
  drain: { hunger: 0.0017, thirst: 0.002, energyWalk: 0.0013 },
  recover: { food: 0.028, water: 0.045, rest: 0.008 },
  seek: { hunger: 0.52, thirst: 0.5, energy: 0.35 },
  grazing: { minBiomass: 0.15, consume: 0.05, floor: 0.08, regrowSeconds: 160 },
} as const;
export interface CreatureNeeds { hunger: number; thirst: number; energy: number }
/**
 * Homes: near/far from the drink stand; shore stands where toWater is in [shoreLo, shoreHi].
 * `wade` is not a permission to enter water: all planted feet must stay dry (depth ≤ 0). The old
 * 3 cm allowance put a forefoot in the sheet while drinking and inflated check counts.
 */
const SITE = {
  near: 18, far: 90, homes: 3, apart: 22, keepOff: 6, sip: 0.12, stands: 2.5,
  shoreLo: 0.8, shoreHi: 14, // metres to water for a candidate stand (a little back from the lip)
  minRegion: 2500, // m²: regions smaller than this are skipped (too small for a home range)
};
const WALKABLE = { slope: 0.6, rim: 4, terrace: 2, water: 0 }; // (a dug bank stands at 0.5)
/** Extra metres a search keeps outside an obstacle, so a wandering step does not clip it. */
export const ROUTE_CLEAR = 0.7;
const ROUTE = { cell: 1, slope: 6, jitter: 0.9, familiar: 0.5, margin: 12, clear: ROUTE_CLEAR };
const PAIRS = [[0, 3], [1, 2]]; // the diagonal pairs
/** Last findSites skip list (one call); for check-world and diagnostics. */
let lastSiteSkips: SiteSkip[] = [];
export const siteSkips = (): SiteSkip[] => lastSiteSkips;

/** Water's depth at (x, z), metres (negative: dry, by how far the ground stands above the water). */
export function waterDepth(world: DwellWorld, x: number, z: number): number {
  const level = waterLevel(world, x, z);
  return level === null ? -1 : level - sampleGrid(world.grid, x, z);
}

/** The water's surface height at (x, z), or null where there is none. */
function waterLevel(world: DwellWorld, x: number, z: number): number | null {
  const f = world.water.field;
  if (!f) return null;
  const i = Math.round((x - f.x0) / f.step), j = Math.round((z - f.z0) / f.step);
  if (i < 0 || j < 0 || i >= f.nx || j >= f.nz) return null;
  const level = f.level[j * f.nx + i];
  return Number.isNaN(level) ? null : level;
}

/** Whether a creature may stand at (x, z): dry, not steep, off the terrace, in from the rim, clear of anything standing. */
export function walkable(world: DwellWorld, x: number, z: number): boolean {
  const g = world.grid;
  if (sampleGrid(g, x, z, 3) > -WALKABLE.rim || world.terrace(x, z) < WALKABLE.terrace) return false;
  if (Math.hypot(sampleGrid(g, x, z, 1), sampleGrid(g, x, z, 2)) > WALKABLE.slope) return false;
  if (world.obstacles?.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) return false;
  return waterDepth(world, x, z) < WALKABLE.water;
}

/**
 * The body set on the ground at (x, z) facing `heading`, lying and drinking as given: its tip
 * (from the ground under its front and hind hips; forward to drink), its torso's height, its
 * shoulder (where the neck starts).
 */
function bodyOn(groundAt: (x: number, z: number) => number, x: number, z: number, heading: number, lying: number, drinking: number, shoulderAt: [number, number] = BODY.shoulder) {
  const c = Math.cos(heading), s = Math.sin(heading), along = BODY.hips[0][0];
  const y = groundAt(x, z);
  const ground = Math.atan2(groundAt(x + c * along, z + s * along) - groundAt(x - c * along, z - s * along), 2 * along);
  const pitch = (ground - BODY.drinkTip * drinking) * (1 - lying);
  const torso = BODY.torso.stand - BODY.drinkLower * drinking + (BODY.torso.lie - BODY.torso.stand) * lying;
  // A point of the body (along, up from the torso's middle), the body tipped about its middle.
  const of = (a: number, u: number): Point => {
    const fa = a * Math.cos(pitch) - u * Math.sin(pitch), fu = a * Math.sin(pitch) + u * Math.cos(pitch);
    return [x + c * fa, y + torso + fu, z + s * fa];
  };
  // Its lean across (from the ground under its left and right hips): the hips follow it.
  const across = BODY.hips[0][1];
  const roll = Math.atan2(groundAt(x - s * across, z + c * across) - groundAt(x + s * across, z - c * across), 2 * across) * (1 - lying);
  return { y, pitch, roll, torso, of, shoulder: of(...shoulderAt) };
}

/** The muzzle from the shoulder, the neck at angle `neck` from level: [ahead, up] (the head turned back toward level as drawn). */
export function muzzleFrom(neck: number, form: HeadNeck = BODY): [number, number] {
  const { at, front, level, offset } = form.head, head = neck * (1 - level) + offset;
  return [at * Math.cos(neck) + front * Math.cos(head), at * Math.sin(neck) + front * Math.sin(head)];
}

/**
 * One drinking stand from a shore sample: outward unit (ox, oz) points from water onto dry land.
 * Muzzle meets the water SITE.sip in from the edge; feet dry (fore at most at the water's line).
 */
function tryDrinkStand(
  world: DwellWorld,
  groundAt: (x: number, z: number) => number,
  slope: (x: number, z: number) => number,
  shoreX: number,
  shoreZ: number,
  ox: number,
  oz: number,
): (Stand & { score: number }) | null {
  const L = Math.hypot(ox, oz) || 1;
  ox /= L; oz /= L;
  // Water point its muzzle meets: a little into the water from the dry shore sample.
  const wx = shoreX - ox * SITE.sip, wz = shoreZ - oz * SITE.sip;
  const wy = waterLevel(world, wx, wz);
  if (wy === null || waterDepth(world, wx, wz) <= 0) return null;
  const facing = Math.atan2(-oz, -ox); // faces the water
  let reach = 1.2, neck = 0, ok = true, sx = 0, sz = 0;
  for (let it = 0; it < 4; it++) {
    sx = wx + ox * reach; sz = wz + oz * reach;
    const body = bodyOn(groundAt, sx, sz, facing, 0, 1);
    const drop = wy - body.shoulder[1];
    let lo = -1.5, hi = BODY.neckUp;
    if (muzzleFrom(lo)[1] > drop) { ok = false; break; }
    for (let b = 0; b < 30; b++) { const m = (lo + hi) / 2; if (muzzleFrom(m)[1] > drop) hi = m; else lo = m; }
    neck = (lo + hi) / 2;
    reach = Math.hypot(body.shoulder[0] - sx, body.shoulder[2] - sz) + muzzleFrom(neck)[0];
  }
  if (!ok || !walkable(world, sx, sz)) return null;
  const c = Math.cos(facing), s = Math.sin(facing);
  // Feet as planted while drinking (splay fully on): every foot dry, and on standable ground.
  // Forefeet may sit at the water's line on dry bank (depth ≤ 0); they must not enter the sheet.
  let driest = 0;
  for (let k = 0; k < BODY.hips.length; k++) {
    const [ha, hc] = BODY.hips[k];
    const a = ha + BODY.drinkSplay[k < 2 ? 0 : 1], fx = sx + c * a - s * hc, fz = sz + s * a + c * hc;
    const depth = waterDepth(world, fx, fz);
    if (depth > 0) return null;
    if (!walkable({ ...world, water: { ...world.water, field: null } }, fx, fz)) return null;
    if (k < 2) driest = Math.min(driest, depth); // more negative = further onto dry bank
  }
  // Prefer flat stands, clear of the terrace, and with forefeet well clear of the water (not on the lip).
  const score = -2 * slope(sx, sz) + (world.terrace(sx, sz) > SITE.keepOff ? 0.5 : 0) + Math.min(-driest, 1.5);
  return { x: sx, z: sz, facing, neck, water: [wx, wy, wz], score };
}

/**
 * Pair drink stands and homes inside one dry-land region. Returns null with a reason if the
 * region cannot host a creature (no forced placement).
 */
function sitesInRegion(world: DwellWorld, zones: Zones, regionIndex: number): { sites: Sites; score: number } | { reason: string } {
  const groundAt = (x: number, z: number) => sampleGrid(world.grid, x, z);
  const slope = (x: number, z: number) => Math.hypot(sampleGrid(world.grid, x, z, 1), sampleGrid(world.grid, x, z, 2));
  const { cell, nx, nz, x0, z0, region, zone, toWater } = zones;
  const at = (i: number) => x0 + (i + 0.5) * cell, atZ = (j: number) => z0 + (j + 0.5) * cell;
  // Shore candidates: dry cells of this region near water; outward = away from nearest wet neighbour.
  const stands: (Stand & { score: number })[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i;
    if (region[t] !== regionIndex) continue;
    const tw = toWater[t];
    if (tw < SITE.shoreLo || tw > SITE.shoreHi) continue;
    const x = at(i), z = atZ(j);
    if (!walkable(world, x, z)) continue;
    // Outward: from the nearest wet sample toward this cell (or fall back to -grad of toWater).
    let ox = 0, oz = 0, found = false;
    for (let a = 0; a < 8; a++) {
      const dx = Math.cos((a * Math.PI) / 4), dz = Math.sin((a * Math.PI) / 4);
      if (waterDepth(world, x + dx * cell, z + dz * cell) > 0) {
        ox -= dx; oz -= dz; found = true;
      }
    }
    if (!found) {
      const twX = toWater[j * nx + Math.min(i + 1, nx - 1)] - toWater[j * nx + Math.max(i - 1, 0)];
      const twZ = toWater[Math.min(j + 1, nz - 1) * nx + i] - toWater[Math.max(j - 1, 0) * nx + i];
      ox = twX; oz = twZ;
    }
    if (ox * ox + oz * oz < 1e-8) continue;
    const stand = tryDrinkStand(world, groundAt, slope, x, z, ox, oz);
    if (stand) stands.push(stand);
  }
  if (!stands.length) return { reason: 'no valid drinking stand (muzzle/feet/shore)' };
  stands.sort((a, b) => b.score - a.score);
  // Keep a diverse set of top stands (not only the single best shore spot).
  const picked: (Stand & { score: number })[] = [];
  for (const s of stands) {
    if (picked.every((p) => Math.hypot(p.x - s.x, p.z - s.z) > 4)) picked.push(s);
    if (picked.length >= 12) break;
  }
  let best: { sites: Sites; score: number } | null = null;
  const untouched: ContactMap = { x0: 0, z0: 0, texel: 1, cells: 0, walk: new Float32Array(0), drink: new Float32Array(0), rest: new Float32Array(0), ground: new Uint8Array(0), version: 0 };
  const flat = () => 0;
  for (const drink of picked) {
    const cands: (Spot & { score: number })[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const t = j * nx + i;
      if (region[t] !== regionIndex) continue;
      // Prefer habitat; allow open stone that still meets the old shelter/slope tests.
      if (zone[t] !== Z_HABITAT && zone[t] !== Z_OPEN) continue;
      const x = at(i), z = atZ(j);
      const r = Math.hypot(x - drink.x, z - drink.z);
      if (r < SITE.near || r > SITE.far) continue;
      if (!walkable(world, x, z) || slope(x, z) > 0.1 || world.terrace(x, z) < SITE.keepOff * 2) continue;
      let wet = false;
      for (let a = 0; a < 8 && !wet; a++) wet = waterDepth(world, x + Math.cos(a) * 5, z + Math.sin(a) * 5) > -0.1;
      if (wet) continue;
      const h = groundAt(x, z);
      let around = 0;
      for (let a = 0; a < 8; a++) around += groundAt(x + Math.cos((a * Math.PI) / 4) * 7, z + Math.sin((a * Math.PI) / 4) * 7);
      const shelter = around / 8 - h;
      const habitatBonus = zone[t] === Z_HABITAT ? 2 : 0;
      cands.push({ x, z, facing: Math.atan2(drink.z - z, drink.x - x), score: habitatBonus + shelter * 3 - slope(x, z) * 10 - r / 200 });
    }
    cands.sort((a, b) => b.score - a.score);
    const reach = SITE.far + ROUTE.margin;
    const around = { x0: drink.x - reach, z0: drink.z - reach, size: 2 * reach };
    const homes: Spot[] = [];
    for (const c of cands) {
      if (!homes.every((h) => Math.hypot(h.x - c.x, h.z - c.z) > SITE.apart)) continue;
      if (!route(world, untouched, around, [drink.x, drink.z], [c.x, c.z], flat)) continue;
      homes.push({ x: c.x, z: c.z, facing: c.facing });
      if (homes.length === SITE.homes) break;
    }
    if (!homes.length) continue;
    const near = stands
      .filter((s) => Math.hypot(s.x - drink.x, s.z - drink.z) <= SITE.stands)
      .map(({ score: _s, ...stand }) => stand);
    let minX = drink.x, maxX = drink.x, minZ = drink.z, maxZ = drink.z;
    for (const h of homes) { minX = Math.min(minX, h.x); maxX = Math.max(maxX, h.x); minZ = Math.min(minZ, h.z); maxZ = Math.max(maxZ, h.z); }
    const size = Math.ceil((Math.max(maxX - minX, maxZ - minZ) + 2 * ROUTE.margin) / 8) * 8;
    const { score: drinkScore, ...bestDrink } = drink;
    const sites: Sites = {
      drink: bestDrink,
      stands: near.length ? near : [bestDrink],
      homes,
      region: { x0: (minX + maxX) / 2 - size / 2, z0: (minZ + maxZ) / 2 - size / 2, size },
    };
    const score = drinkScore + homes.length + homes.reduce((s, h) => s + (cands.find((c) => c.x === h.x && c.z === h.z)?.score ?? 0), 0);
    if (!best || score > best.score) best = { sites, score };
  }
  if (!best) return { reason: 'no home reachable on foot from a valid stand' };
  return best;
}

/**
 * Where it drinks and where it may rest, by rule over the island's dry-land regions: each region
 * is tried for a shore stand (real muzzle/feet tests) and habitat homes with a dry walking route.
 * Invalid regions are skipped and recorded in `siteSkips()`. The best valid region is returned;
 * null only if none work. Does not require the plunge pool, and does not force every region.
 */
export function findSites(world: DwellWorld): Sites | null {
  lastSiteSkips = [];
  const zones = world.zones;
  if (!zones || !zones.regions.length) {
    lastSiteSkips.push({ region: -1, area: 0, reason: 'no zone field / dry-land regions' });
    return null;
  }
  const order = zones.regions.map((r, i) => ({ i, area: r.area })).sort((a, b) => b.area - a.area);
  let best: { sites: Sites; score: number; region: number } | null = null;
  for (const { i, area } of order) {
    if (area < SITE.minRegion) {
      lastSiteSkips.push({ region: i, area, reason: `area ${area.toFixed(0)} m² under ${SITE.minRegion}` });
      continue;
    }
    const result = sitesInRegion(world, zones, i);
    if ('reason' in result) {
      lastSiteSkips.push({ region: i, area, reason: result.reason });
      continue;
    }
    if (!best || result.score > best.score) best = { ...result, region: i };
  }
  return best?.sites ?? null;
}

/** The contact map: per cell of the square, how worn by walking, drinking, resting (0 to 1 each). */
export interface ContactMap {
  x0: number;
  z0: number;
  texel: number;
  cells: number;
  walk: Float32Array;
  drink: Float32Array;
  rest: Float32Array;
  /** 1 where a mark may fall: the walkable ground (not water, the terrace, the rim, a cliff). */
  ground: Uint8Array;
  /** Bumped at every change (for the texture to follow). */
  version: number;
}

function createContactMap(world: DwellWorld, region: Sites['region']): ContactMap {
  const cells = Math.round(region.size / WEAR.texel), n = cells * cells;
  const ground = new Uint8Array(n);
  // (Marks fall on dry ground, wherever it is: under a tree's canopy too; only not in water or off the meadow.)
  const bare: DwellWorld = { ...world, obstacles: [] };
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const x = region.x0 + (i + 0.5) * WEAR.texel, z = region.z0 + (j + 0.5) * WEAR.texel;
    ground[j * cells + i] = walkable(bare, x, z) ? 1 : 0;
  }
  return { x0: region.x0, z0: region.z0, texel: WEAR.texel, cells, walk: new Float32Array(n), drink: new Float32Array(n), rest: new Float32Array(n), ground, version: 0 };
}

/**
 * Add to a channel over an ellipse at (x, z) (half-axes `along` the heading, `across` it), each
 * cell by `amount` times a soft falloff, scaled by what is left to fill.
 */
function deposit(map: ContactMap, channel: Float32Array, x: number, z: number, along: number, across: number, heading: number, amount: number) {
  const c = Math.cos(heading), s = Math.sin(heading), reach = Math.max(along, across);
  const i0 = Math.max(Math.floor((x - reach - map.x0) / map.texel), 0), i1 = Math.min(Math.ceil((x + reach - map.x0) / map.texel), map.cells - 1);
  const j0 = Math.max(Math.floor((z - reach - map.z0) / map.texel), 0), j1 = Math.min(Math.ceil((z + reach - map.z0) / map.texel), map.cells - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * map.cells + i;
    if (!map.ground[t]) continue;
    const dx = map.x0 + (i + 0.5) * map.texel - x, dz = map.z0 + (j + 0.5) * map.texel - z;
    const u = (dx * c + dz * s) / along, v = (-dx * s + dz * c) / across, d2 = u * u + v * v;
    if (d2 >= 1) continue;
    const w = (1 - d2) * (1 - d2);
    channel[t] += amount * w * (1 - channel[t]);
  }
  map.version++;
}

/** The cheapest way from a to b over the square (A*, 1 m cells, eight ways); null if there is none. */
function route(world: DwellWorld, map: ContactMap, region: Sites['region'], from: [number, number], to: [number, number], jitter: Noise2D): [number, number][] | null {
  const cell = ROUTE.cell, n = Math.round(region.size / cell);
  const at = (i: number) => region.x0 + (i + 0.5) * cell, atZ = (j: number) => region.z0 + (j + 0.5) * cell;
  const idx = (x: number, z: number) => [Math.min(Math.max(Math.floor((x - region.x0) / cell), 0), n - 1), Math.min(Math.max(Math.floor((z - region.z0) / cell), 0), n - 1)];
  // Inflate obstacles while searching so a jittered walk does not clip trunks or the watching stone.
  const saved = world.obstacles;
  if (saved?.length) world.obstacles = saved.map((o) => ({ ...o, r: o.r + ROUTE.clear }));
  const cost = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = at(i), z = atZ(j);
    if (!walkable(world, x, z)) { cost[j * n + i] = Infinity; continue; }
    const slope = Math.hypot(sampleGrid(world.grid, x, z, 1), sampleGrid(world.grid, x, z, 2));
    // How worn the ground is here (the walk channel, its densest cell around).
    const mi = Math.floor((x - map.x0) / map.texel), mj = Math.floor((z - map.z0) / map.texel);
    let worn = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const ii = mi + di, jj = mj + dj;
      if (ii >= 0 && jj >= 0 && ii < map.cells && jj < map.cells) worn = Math.max(worn, map.walk[jj * map.cells + ii]);
    }
    cost[j * n + i] = (1 + ROUTE.slope * slope + ROUTE.jitter * (0.5 + 0.5 * jitter(x / 14, z / 14))) * (1 - ROUTE.familiar * worn);
  }
  const [si, sj] = idx(...from), [ti, tj] = idx(...to);
  const start = sj * n + si, goal = tj * n + ti;
  cost[start] = Math.min(cost[start], 1);
  cost[goal] = Math.min(cost[goal], 1);
  const g = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
  // A binary heap of [f, cell].
  const heap: [number, number][] = [];
  const push = (f: number, t: number) => { heap.push([f, t]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (t: number) => Math.hypot((t % n) - ti, Math.floor(t / n) - tj) * 0.5; // (worn ground costs half)
  g[start] = 0;
  push(h(start), start);
  while (heap.length) {
    const [, t] = pop();
    if (closed[t]) continue;
    closed[t] = 1;
    if (t === goal) break;
    const i = t % n, j = Math.floor(t / n);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const u = jj * n + ii;
      if (closed[u] || cost[u] === Infinity) continue;
      // No cutting a corner past a closed cell.
      if (di && dj && (cost[j * n + ii] === Infinity || cost[jj * n + i] === Infinity)) continue;
      const step = Math.hypot(di, dj) * 0.5 * (cost[t] + cost[u]);
      if (g[t] + step < g[u]) { g[u] = g[t] + step; came[u] = t; push(g[u] + h(u), u); }
    }
  }
  if (!closed[goal]) { world.obstacles = saved; return null; }
  const cellsOnWay: number[] = [];
  for (let t = goal; t !== -1; t = came[t]) cellsOnWay.push(t);
  cellsOnWay.reverse();
  const cellsPath: [number, number][] = [from, ...cellsOnWay.slice(1, -1).map((t) => [at(t % n), atZ(Math.floor(t / n))] as [number, number]), to];
  // Eight ways over a lattice walk in straight runs and 45° turns. Relaxed: every point drawn toward
  // its neighbours' middle, again and again (never onto closed ground), the ends kept; then a
  // gentle wander of its own across the way (each trip its own).
  const pts = resampled(cellsPath, 1);
  for (let pass = 0; pass < RELAX; pass++) {
    for (let k = 1; k + 1 < pts.length; k++) {
      const x = (pts[k - 1][0] + pts[k + 1][0]) / 2, z = (pts[k - 1][1] + pts[k + 1][1]) / 2;
      const nx = pts[k][0] * 0.5 + x * 0.5, nz = pts[k][1] * 0.5 + z * 0.5;
      if (walkable(world, nx, nz)) pts[k] = [nx, nz];
    }
  }
  let s = 0;
  const path = pts.map(([x, z], k) => {
    if (k) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    const [ax, az] = pts[Math.max(k - 1, 0)], [bx, bz] = pts[Math.min(k + 1, pts.length - 1)];
    const ux = bx - ax, uz = bz - az, ul = Math.hypot(ux, uz) || 1;
    const ends = Math.min(1, s / 4) * Math.min(1, (pts.length - 1 - k) / 4);
    const off = WANDER * jitter(s / 9, 17.3) * ends;
    const wx = x - (uz / ul) * off, wz = z + (ux / ul) * off;
    return (walkable(world, wx, wz) ? [wx, wz] : [x, z]) as [number, number];
  });
  world.obstacles = saved;
  return path;
}

const RELAX = 40; // passes of the relaxing
const WANDER = 0.45; // metres a way wanders across itself

/** A polyline resampled every `step` metres, its ends kept. */
function resampled(points: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [points[0]];
  let carry = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    let s = step - carry;
    while (s <= len) { out.push([ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len]); s += step; }
    carry = len - (s - step);
  }
  const last = points[points.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.3) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

/** Seeded per creature (docs/plan-2026-11-18-school-herd.md): the same rules, a different day. */
export interface Traits {
  /** 0 a homebody (distance weighs heavily) to 1 a wanderer. */
  roam: number;
  /** 0 shy (follows only when the need is close to its mark) to 1 bold (follows readily). */
  bold: number;
}

/** A second or third creature on the same island: its own id, home and rhythm, the shared ground. */
export interface DwellingOptions {
  /** 0 for the first (the default: everything as it was), 1, 2 … for the others. */
  id?: number;
  /** The sites already found for the first (the same island: no need to search again). */
  sites?: Sites;
  /** The first's contact map: every creature's steps turn the same stone to jade. */
  map?: ContactMap;
  /** Which of the sites' homes is its own. */
  home?: number;
  /** Whether this one regrows the grazing it shares (only one should). Default true. */
  regrow?: boolean;
  /** Its form (head and neck from it); default the one sculpt. */
  axes?: MorphAxes;
}

export interface Dwelling {
  /** 0 the first creature, 1 the second … */
  id: number;
  traits: Traits;
  /** The others on the island (for following and for sharing the drinking stands). */
  companions: Dwelling[];
  /** Its head and neck (from its form). */
  form: HeadNeck;
  /** Standing aside on its way for a companion to pass (the other then walks round it). */
  yielding: boolean;
  /** A new form (the atlas's "save to this creature"): its head and neck from now on, no restart. */
  setForm: (axes: MorphAxes) => void;
  sites: Sites;
  map: ContactMap;
  pose: Pose;
  /** Which home it prefers (an index into sites.homes); set to move house. */
  home: number;
  /** Seconds simulated, and rest–drink–return cycles completed. */
  time: number;
  cycles: number;
  needs: CreatureNeeds;
  /** The way it is walking now (for the debug view). */
  way: [number, number][] | null;
  /** Where it drinks this time (for the checks: its muzzle meets this stand's water). */
  stand: Stand | null;
  /** The ground's height at (x, z). */
  groundAt: (x: number, z: number) => number;
  /** Whether (x, z) is over the open island (not the terrace, not past the rim). */
  open: (x: number, z: number) => boolean;
  /** Whether a creature may stand at (x, z) (walkable). */
  dry: (x: number, z: number) => boolean;
  /** What now stands in its way (trees, a platform): it keeps out of them from now on. */
  setObstacles: (o: { x: number; z: number; r: number }[]) => void;
  /**
   * One smoothed way between two points, using the obstacles set now.
   * Same relax and wander as a trip; the noise is fixed for this seed, so it is one real
   * curve, not every curve the creature might walk.
   */
  wayBetween: (from: [number, number], to: [number, number]) => [number, number][] | null;
  /**
   * Where it lies when a shelter is placed. Null: the old scatter around the home anchor.
   * The anchor itself (sites.homes) does not move.
   */
  restPlace: RestPlace | null;
  setRestPlace: (p: RestPlace | null) => void;
  grazing: GrazingPatch | null;
  setGrazing: (p: GrazingPatch | null) => void;
  /** Walk to the lie or to the drink. The same leave a day uses; it does not wait out the stay. */
  headFor: (where: 'rest' | 'drink') => void;
  step: (dt: number) => void;
  reset: () => void;
  /**
   * What the step is already doing, copied out for the debug layer. Not an input:
   * changing it does not move the creature.
   */
  intent: Intent;
}

/** The current trip, in the same numbers `step` uses. Metres and metres per simulated second. */
export interface Intent {
  /** While walking, where the route is going. While staying, drink or rest. */
  kind: 'drink' | 'rest' | 'eat';
  x: number;
  z: number;
  /** Body movement over the last substep. Zero when it is standing still. */
  vx: number;
  vz: number;
}

/** A creature at home, the ground untouched; null if no shore or home could be found. */
export function createDwelling(world: DwellWorld, opts: DwellingOptions = {}): Dwelling | null {
  const sites = opts.sites ?? findSites(world);
  if (!sites) return null;
  const id = opts.id ?? 0;
  const ownsMap = !opts.map;
  const map = opts.map ?? createContactMap(world, sites.region);
  const rngSeed = world.seed + 911 + id * 7919;
  const traitRng = createRng(world.seed * 13 + id * 101 + 5);
  const traits: Traits = { roam: traitRng(), bold: traitRng() };
  const groundAt = (x: number, z: number) => sampleGrid(world.grid, x, z);
  let rng: Rng = createRng(rngSeed);
  // Set while resting when a companion sets out and it means to go too.
  let follow: 'drink' | 'eat' | null = null;
  // Giving way on a walk: re-planned round a companion standing in it (once a trip); seconds waited for one walking.
  let detoured = false, waited = 0;
  // The patch it is eating from this time: its own, or a companion's it went with.
  let meal: GrazingPatch | null = null;
  // The current leg: where it goes, its way and arc lengths, how far along; how long it stays.
  let way: [number, number][] = [], lengths: number[] = [], along = 0, stay = 0, trip = 0, next: 'drink' | 'rest' | 'eat' = 'drink';
  let goal: Spot = sites.homes[0], spot: Spot = sites.homes[0], set = false;
  let restPlace: RestPlace | null = null;
  // The feet: where each stands (or is in the air: from, to, how far through its swing).
  const feet = BODY.hips.map(() => ({ at: [0, 0, 0] as Point, from: [0, 0, 0] as Point, to: [0, 0, 0] as Point, t: 1 }));
  let lastPair = 1, vx = 0, vz = 0;
  const intent: Intent = { kind: 'rest', x: 0, z: 0, vx: 0, vz: 0 };
  const publishIntent = (movingTo: 'drink' | 'rest' | 'eat' | null, at: Spot) => {
    intent.kind = movingTo ?? (d.pose.activity === 'drink' ? 'drink' : d.pose.activity === 'eat' ? 'eat' : 'rest');
    intent.x = at.x;
    intent.z = at.z;
    intent.vx = vx;
    intent.vz = vz;
  };
  const d: Dwelling = {
    id, traits, companions: [], form: opts.axes ? headNeckOf(opts.axes) : BODY, yielding: false, setForm: () => {}, sites, map, home: Math.min(opts.home ?? 0, sites.homes.length - 1), time: 0, cycles: 0, needs: { ...NEEDS.initial }, way: null, stand: null, groundAt,
    open: (x, z) => world.terrace(x, z) > 8 && sampleGrid(world.grid, x, z, 3) < -5,
    dry: (x, z) => walkable(world, x, z),
    setObstacles: (o) => { world.obstacles = o; },
    wayBetween: (from, to) => route(world, map, sites.region, from, to, createNoise2D(world.seed * 31 + 1)),
    restPlace: null,
    setRestPlace: (p) => { restPlace = p; d.restPlace = p; },
    grazing: null,
    setGrazing: (p) => { d.grazing = p; },
    headFor: () => {},
    pose: {
      x: 0, y: 0, z: 0, heading: 0, pitch: 0, torso: BODY.torso.lie, neck: BODY.neckLying, activity: 'rest', lying: 1, drinking: 0, eating: 0,
      hips: BODY.hips.map(() => [0, 0, 0] as Point), feet: BODY.hips.map(() => [0, 0, 0] as Point), muzzle: [0, 0, 0], planted: [true, true, true, true],
    },
    intent,
    step: () => {},
    reset: () => {},
  };
  // Where each foot belongs: under its hip (folded in under the body lying), on the ground.
  const placeFor = (k: number, lead: number): Point => {
    const p = d.pose, c = Math.cos(p.heading), s = Math.sin(p.heading);
    const [ha, hc] = BODY.hips[k];
    const fa = ha * (1 + (BODY.foldAlong - 1) * p.lying) + BODY.drinkSplay[k < 2 ? 0 : 1] * p.drinking, fc = hc * (1 + (BODY.foldAcross - 1) * p.lying);
    const x = p.x + c * fa - s * fc + vx * lead, z = p.z + s * fa + c * fc + vz * lead;
    return [x, groundAt(x, z), z];
  };
  // Where it stands at a stand, and how far it bows, so its own muzzle meets the stand's water point:
  // the stand as found (for the sculpt's head) if it has that head; else, the same solve the stand
  // was found by, with its own head: a little nearer or further back along the same line. Kept only
  // if its feet stay dry there; otherwise the stand as found.
  const bows = new Map<Stand, { at: Spot; neck: number }>();
  const standFor = (st: Stand) => {
    if (d.form === BODY) return { at: st as Spot, neck: st.neck };
    let got = bows.get(st);
    if (!got) {
      const [wx, wy, wz] = st.water, c = Math.cos(st.facing), s = Math.sin(st.facing);
      let reach = Math.hypot(wx - st.x, wz - st.z), neck = st.neck, sx = st.x, sz = st.z;
      for (let it = 0; it < 4; it++) {
        sx = wx - c * reach; sz = wz - s * reach;
        const body = bodyOn(groundAt, sx, sz, st.facing, 0, 1, d.form.shoulder);
        const drop = wy - body.shoulder[1];
        let lo = -1.5, hi = d.form.neckUp;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (muzzleFrom(m, d.form)[1] > drop) hi = m; else lo = m; }
        neck = (lo + hi) / 2;
        reach = Math.hypot(body.shoulder[0] - sx, body.shoulder[2] - sz) + muzzleFrom(neck, d.form)[0];
      }
      const dryFeet = BODY.hips.every(([ha, hc], k) => {
        const a = ha + BODY.drinkSplay[k < 2 ? 0 : 1], fx = sx + c * a - s * hc, fz = sz + s * a + c * hc;
        return waterDepth(world, fx, fz) <= 0 && walkable({ ...world, water: { ...world.water, field: null } }, fx, fz);
      });
      got = dryFeet && walkable(world, sx, sz) ? { at: { x: sx, z: sz, facing: st.facing }, neck } : { at: st as Spot, neck: st.neck };
      bows.set(st, got);
    }
    return got;
  };
  const neckAt = (st: Stand) => standFor(st).neck;
  d.setForm = (axes) => { d.form = headNeckOf(axes); bows.clear(); };
  // The body from its place, heading, lying, drinking: torso, tip, hips, neck, muzzle.
  const shape = () => {
    const p = d.pose, c = Math.cos(p.heading), s = Math.sin(p.heading);
    const f = d.form;
    const b = bodyOn(groundAt, p.x, p.z, p.heading, p.lying, p.drinking, f.shoulder);
    p.y = b.y; p.pitch = b.pitch; p.torso = b.torso;
    BODY.hips.forEach(([ha, hc], k) => {
      const [x, y, z] = b.of(ha, -BODY.hipDrop);
      p.hips[k] = [x - s * hc, y + hc * Math.sin(b.roll), z + c * hc];
    });
    // The neck: up standing, low lying; bowed to the water's angle drinking.
    const drinkNeck = d.stand ? neckAt(d.stand) : -0.6;
    p.neck = (f.neckUp + (drinkNeck - f.neckUp) * p.drinking + (-0.92 - f.neckUp) * p.eating) * (1 - p.lying) + f.neckLying * p.lying;
    const [ahead, up] = muzzleFrom(p.neck, f);
    p.muzzle = [b.shoulder[0] + c * ahead, b.shoulder[1] + up, b.shoulder[2] + s * ahead];
  };
  // The gait: feet in the air move on (landing: a mark where they land, walking); a pair whose
  // feet have fallen far enough behind their places lifts, if the other pair is down.
  const stepFeet = (dt: number, moving: boolean) => {
    const p = d.pose;
    for (let k = 0; k < 4; k++) {
      const f = feet[k];
      if (f.t >= 1) continue;
      f.t = Math.min(f.t + dt / GAIT.swing, 1);
      const u = f.t * f.t * (3 - 2 * f.t);
      const x = f.from[0] + (f.to[0] - f.from[0]) * u, z = f.from[2] + (f.to[2] - f.from[2]) * u;
      f.at = [x, groundAt(x, z) + GAIT.lift * Math.sin(Math.PI * f.t), z];
      if (f.t >= 1) {
        f.at = [f.to[0], groundAt(f.to[0], f.to[2]), f.to[2]];
        if (p.activity === 'walk' && p.lying === 0) deposit(map, map.walk, f.at[0], f.at[2], WEAR.step.radius, WEAR.step.radius, p.heading, WEAR.step.amount);
      }
    }
    if (feet.some((f) => f.t < 1)) return;
    const trigger = moving ? GAIT.trigger : GAIT.settle;
    const behind = PAIRS.map((pair) => Math.max(...pair.map((k) => { const h = placeFor(k, 0); return Math.hypot(feet[k].at[0] - h[0], feet[k].at[2] - h[2]); })));
    // The pair furthest behind (on a tie, the one that did not step last).
    const pick = behind[0] === behind[1] ? 1 - lastPair : behind[0] > behind[1] ? 0 : 1;
    if (behind[pick] <= trigger) return;
    lastPair = pick;
    for (const k of PAIRS[pick]) {
      const f = feet[k];
      f.from = [...f.at];
      f.to = placeFor(k, moving ? GAIT.lead : 0);
      f.t = 0;
    }
  };
  const pose = () => {
    shape();
    feet.forEach((f, k) => { d.pose.feet[k] = f.at; d.pose.planted[k] = f.t >= 1; });
  };
  // A place to stand at home: a little off it (never the same twice), on walkable ground.
  const nearHome = (s: Spot, reach: number): Spot => {
    for (let k = 0; k < 12; k++) {
      const a = rng() * 2 * Math.PI, r = reach * Math.sqrt(rng());
      const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      if (walkable(world, x, z)) return { x, z, facing: s.facing + (rng() - 0.5) * 0.5 };
    }
    return s;
  };
  const begin = (activity: Activity, at: Spot) => {
    d.pose.activity = activity;
    spot = at;
    stay = activity === 'rest' ? TIMES.rest[0] + rng() * (TIMES.rest[1] - TIMES.rest[0]) : activity === 'eat' ? 18 : TIMES.drink[0] + rng() * (TIMES.drink[1] - TIMES.drink[0]);
    set = false;
  };
  const joinWays = (a: [number, number][] | null, b: [number, number][] | null) => (
    a && b ? [...a.slice(0, -1), ...b] : null
  );
  // The stands a companion holds (drinking there or walking to it): one creature to a stand.
  const freeStands = () => {
    const taken = d.companions.filter((o) => o.stand && (o.pose.activity === 'drink' || (o.pose.activity === 'walk' && o.intent.kind === 'drink'))).map((o) => o.stand!);
    return sites.stands.filter((st) => taken.every((t) => Math.hypot(t.x - st.x, t.z - st.z) > 1.6));
  };
  // A place at a companion's patch: across it from the companion's stand (or a little round), facing in.
  const beside = (patch: GrazingPatch): Spot | null => {
    const r = Math.hypot(patch.stand.x - patch.x, patch.stand.z - patch.z), a0 = Math.atan2(patch.stand.z - patch.z, patch.stand.x - patch.x);
    for (const off of [Math.PI, 2.2, -2.2]) {
      const a = a0 + off, x = patch.x + Math.cos(a) * r, z = patch.z + Math.sin(a) * r;
      if (walkable(world, x, z)) return { x, z, facing: a + Math.PI };
    }
    return null;
  };
  const leave = (to: 'drink' | 'rest' | 'eat') => {
    const joining = follow;
    follow = null;
    detoured = false; waited = 0;
    if (to === 'eat' && (!d.grazing || d.grazing.biomass < NEEDS.grazing.minBiomass)) to = 'rest';
    next = to;
    if (to === 'drink') {
      const free = freeStands();
      const choice = free.length ? free : sites.stands;
      d.stand = choice[Math.floor(rng() * choice.length)] ?? sites.drink;
      goal = standFor(d.stand).at;
    } else if (to === 'eat') {
      // Going with a companion: to its patch, across from it; else to its own.
      const host = joining === 'eat' ? d.companions.find((o) => o.pose.activity === 'walk' && o.intent.kind === 'eat' && o.grazing) : undefined;
      const place = host?.grazing ? beside(host.grazing) : null;
      meal = place ? host!.grazing : d.grazing;
      goal = place ?? d.grazing!.stand;
    }
    else goal = restPlace ? restPlace.bed : nearHome(sites.homes[d.home], 0.7);
    const p = d.pose;
    const jitter = createNoise2D(world.seed * 31 + ++trip);
    const here: [number, number] = [p.x, p.z], there: [number, number] = [goal.x, goal.z];
    // Through the mouth, so the relaxed walk does not cut the corner of a wall.
    // Already on the mouth: one leg is enough.
    let found: [number, number][] | null;
    if (restPlace && Math.hypot(here[0] - restPlace.mouth.x, here[1] - restPlace.mouth.z) > 1.2) {
      const mouth: [number, number] = [restPlace.mouth.x, restPlace.mouth.z];
      found = joinWays(
        route(world, map, sites.region, here, mouth, jitter),
        route(world, map, sites.region, mouth, there, jitter),
      );
    } else found = route(world, map, sites.region, here, there, jitter);
    if (!found) {
      // No way there (never a straight line through water): it stays where it is a while longer.
      begin(p.activity === 'walk' ? 'rest' : p.activity, spot);
      publishIntent(null, spot);
      return;
    }
    way = found;
    lengths = [0];
    for (let k = 1; k < way.length; k++) lengths.push(lengths[k - 1] + Math.hypot(way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1]));
    along = 0;
    p.activity = 'walk';
    d.way = way;
    publishIntent(to, goal);
  };
  const pointAt = (s: number): [number, number] => {
    let k = 1;
    while (k < lengths.length - 1 && lengths[k] < s) k++;
    const t = Math.min(Math.max((s - lengths[k - 1]) / Math.max(lengths[k] - lengths[k - 1], 1e-6), 0), 1);
    const [ax, az] = way[k - 1], [bx, bz] = way[k];
    return [ax + (bx - ax) * t, az + (bz - az) * t];
  };
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const turnToward = (from: number, to: number, most: number) => from + Math.max(-most, Math.min(most, wrap(to - from)));
  d.reset = () => {
    rng = createRng(rngSeed);
    follow = null;
    // The shared map is cleared by its owner (the first creature) only.
    if (ownsMap) { map.walk.fill(0); map.drink.fill(0); map.rest.fill(0); map.version++; }
    d.time = 0; d.cycles = 0; d.needs = { ...NEEDS.initial }; trip = 0; d.way = null; d.stand = null;
    const lie = restPlace?.bed ?? sites.homes[d.home];
    const p = d.pose;
    p.x = lie.x; p.z = lie.z; p.heading = lie.facing; p.lying = 1; p.drinking = 0; p.eating = 0;
    if (d.grazing) { d.grazing.biomass = 1; d.grazing.version++; }
    vx = vz = 0;
    feet.forEach((f, k) => { f.at = placeFor(k, 0); f.t = 1; });
    begin('rest', lie);
    set = true;
    publishIntent(null, lie);
    pose();
  };
  const tick = (dt: number) => {
    const p = d.pose;
    d.time += dt;
    if (opts.regrow !== false && d.grazing && d.grazing.biomass < 1) {
      const before = d.grazing.biomass;
      d.grazing.biomass = 1 - (1 - before) * Math.exp(-dt / NEEDS.grazing.regrowSeconds);
      if (Math.abs(d.grazing.biomass - before) > 1e-6) d.grazing.version++;
    }
    const px = p.x, pz = p.z;
    const n = d.needs;
    n.hunger = Math.max(0, n.hunger - dt * NEEDS.drain.hunger);
    n.thirst = Math.max(0, n.thirst - dt * NEEDS.drain.thirst);
    if (p.activity === 'walk') n.energy = Math.max(0, n.energy - dt * NEEDS.drain.energyWalk);
    let moving = false;
    if (p.activity === 'walk') {
      if (p.lying > 0 || p.drinking > 0 || p.eating > 0) {
        // Rise (or lift the head) first.
        p.lying = Math.max(p.lying - dt / 1.5, 0);
        p.drinking = Math.max(p.drinking - dt / 1.0, 0);
        p.eating = Math.max(p.eating - dt / 1.0, 0);
      } else {
        // Giving way: a companion within 1.3 m of the next 2.5 m of its way. Standing (grazing,
        // drinking, lying): plan once round it. Walking too: the later one (higher id) waits, up to 3 s.
        let blocked = false;
        for (const o of d.companions) {
          const inWay = [0.6, 1.3, 2.0, 2.5].some((k) => { const q = pointAt(Math.min(along + k, lengths[lengths.length - 1])); return Math.hypot(q[0] - o.pose.x, q[1] - o.pose.z) < 1.3; });
          if (!inWay || Math.hypot(goal.x - o.pose.x, goal.z - o.pose.z) < 1.0) continue;
          const still = o.pose.activity !== 'walk' || o.yielding;
          if (still && !detoured) {
            detoured = true;
            const saved = world.obstacles;
            world.obstacles = [...(saved ?? []), { x: o.pose.x, z: o.pose.z, r: 0.9 }];
            const around = route(world, map, sites.region, [p.x, p.z], [goal.x, goal.z], createNoise2D(world.seed * 31 + trip));
            world.obstacles = saved;
            if (around) {
              way = around; d.way = way; lengths = [0]; along = 0;
              for (let k = 1; k < way.length; k++) lengths.push(lengths[k - 1] + Math.hypot(way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1]));
            }
          } else if (!still && d.id > o.id && waited < 3) blocked = true;
        }
        if (blocked) waited += dt; else waited = 0;
        d.yielding = blocked;
        const total = lengths[lengths.length - 1];
        const ahead = pointAt(Math.min(along + 1.2, total));
        const want = Math.atan2(ahead[1] - p.z, ahead[0] - p.x), off = wrap(want - p.heading);
        if (blocked) {
          // Waiting for the other to pass: it stands where it is.
        } else if (Math.abs(off) > 0.5 && total - along > 0.6) {
          // Too far off its way: it turns on the spot.
          p.heading += Math.sign(off) * Math.min(Math.abs(off), CREATURE.turn * dt);
        } else {
          p.heading = turnToward(p.heading, want, dt * 2.5);
          // Slower as it turns (never sideways); easing in and out.
          const speed = CREATURE.speed * Math.max(Math.cos(off), 0) ** 2 * Math.min(1, 0.35 + along / 2, 0.3 + (total - along) / 2);
          along = Math.min(along + speed * dt, total);
          [p.x, p.z] = pointAt(along);
          moving = true;
        }
        if (along >= total) {
          if (next === 'drink') begin('drink', goal);
          else if (next === 'eat') begin('eat', goal);
          else { begin('rest', goal); d.cycles++; }
          d.way = null;
        }
      }
    } else {
      // Staying: turn on the spot to face the way it means to (the water; its usual way at home),
      // then drink, or lie down.
      const off = wrap(spot.facing - p.heading);
      if (!set) {
        p.heading += Math.sign(off) * Math.min(Math.abs(off), CREATURE.turn * dt);
        if (Math.abs(off) < 0.02 && feet.every((f) => f.t >= 1)) set = true;
      } else if (p.activity === 'drink') {
        p.drinking = Math.min(p.drinking + dt / 1.2, 1);
        if (p.drinking >= 1) {
          n.thirst = Math.min(1, n.thirst + dt * NEEDS.recover.water);
          for (const f of feet) if (f.t >= 1) deposit(map, map.drink, f.at[0], f.at[2], WEAR.drink.radius, WEAR.drink.radius, p.heading, WEAR.drink.rate * dt);
          const [a, c, r] = WEAR.drink.under;
          deposit(map, map.drink, p.x, p.z, a, c, p.heading, r * dt);
        }
      } else if (p.activity === 'eat') {
        p.eating = Math.min(p.eating + dt / 1.5, 1);
        const patch = meal ?? d.grazing;
        if (p.eating > 0.9 && patch && Math.hypot(p.muzzle[0] - patch.x, p.muzzle[2] - patch.z) < patch.radius && p.muzzle[1] - groundAt(p.muzzle[0], p.muzzle[2]) < 0.5) {
          patch.biomass = Math.max(NEEDS.grazing.floor, patch.biomass - dt * NEEDS.grazing.consume);
          patch.version++;
          n.hunger = Math.min(1, n.hunger + dt * NEEDS.recover.food);
        }
      } else {
        p.lying = Math.min(p.lying + dt / 2, 1);
        if (p.lying >= 1) n.energy = Math.min(1, n.energy + dt * NEEDS.recover.rest);
        if (p.lying >= 1) deposit(map, map.rest, p.x, p.z, WEAR.rest.along, WEAR.rest.across, p.heading, WEAR.rest.rate * dt);
        // As a Sim does: when food or water falls past the mark it acts on, it gets up now rather
        // than finishing its rest, so the card's mark is where it moves (not some time after).
        const canEat = !!d.grazing && d.grazing.biomass >= NEEDS.grazing.minBiomass;
        if (set && ((n.thirst < NEEDS.seek.thirst && freeStands().length > 0) || (canEat && n.hunger < NEEDS.seek.hunger))) stay = Math.min(stay, WAKE_S);
        // A companion sets out for water or grass: if its own need is near enough its mark, it goes too.
        if (set && !follow && n.energy >= NEEDS.seek.energy) for (const o of d.companions) {
          if (o.pose.activity !== 'walk' || o.intent.kind === 'rest') continue;
          const kind = o.intent.kind;
          if (kind === 'eat' && !canEat) continue;
          if (kind === 'drink' && freeStands().length === 0) continue;
          const need = kind === 'drink' ? n.thirst : n.hunger, mark = kind === 'drink' ? NEEDS.seek.thirst : NEEDS.seek.hunger;
          if (need < mark + CHOICE.follow * (0.5 + d.traits.bold)) { follow = kind; stay = Math.min(stay, WAKE_S); break; }
        }
      }
      if (set) {
        stay -= dt;
        if (stay <= 0) {
          const canEat = !!d.grazing && d.grazing.biomass >= NEEDS.grazing.minBiomass;
          // Water is an option only while a stand is free: otherwise it waits its turn.
          const drinkUrgency = freeStands().length ? Math.max(0, NEEDS.seek.thirst - n.thirst) / NEEDS.seek.thirst : 0;
          const eatUrgency = canEat ? Math.max(0, NEEDS.seek.hunger - n.hunger) / NEEDS.seek.hunger : 0;
          // Each place's score: the need's urgency less its distance, weighed by how much of a
          // homebody it is; the best, or one within `tie` of it at random.
          const far = (x: number, z: number) => Math.hypot(x - p.x, z - p.z) * CHOICE.distance * (1.4 - d.traits.roam);
          const options: ['drink' | 'eat', number][] = [];
          if (drinkUrgency > 0) options.push(['drink', drinkUrgency - far(sites.drink.x, sites.drink.z)]);
          if (eatUrgency > 0 && d.grazing) options.push(['eat', eatUrgency - far(d.grazing.x, d.grazing.z)]);
          let wish: 'drink' | 'eat' | null = null;
          if (options.length) {
            const best = Math.max(...options.map((o) => o[1]));
            const near = options.filter((o) => o[1] >= best - CHOICE.tie);
            wish = near[Math.floor(rng() * near.length)][0];
          }
          const chosen = n.energy < NEEDS.seek.energy && p.activity !== 'rest' ? 'rest'
            : wish ?? (follow && p.activity === 'rest' ? follow : 'rest');
          if (chosen === 'rest' && p.activity === 'rest') begin('rest', spot);
          else leave(chosen);
        }
      }
    }
    vx = (p.x - px) / dt; vz = (p.z - pz) / dt;
    publishIntent(p.activity === 'walk' ? next : null, p.activity === 'walk' ? goal : spot);
    shape();
    stepFeet(dt, moving);
    pose();
  };
  d.headFor = leave;
  d.step = (dt: number) => {
    let left = dt;
    while (left > 1e-9) { const h = Math.min(left, SUBSTEP); tick(h); left -= h; }
  };
  d.reset();
  return d;
}
