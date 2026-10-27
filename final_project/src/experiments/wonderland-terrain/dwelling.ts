import { createNoise2D, type Noise2D } from '../../core/noise';
import { createRng, type Rng } from '../../core/rng';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
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

export type Activity = 'rest' | 'walk' | 'drink';
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
export const BODY = {
  torso: { stand: 0.92, lie: 0.36, along: 0.62, up: 0.32, across: 0.27 }, // its middle's height standing, lying; its half-sizes
  hips: [[0.42, 0.17], [0.42, -0.17], [-0.42, 0.17], [-0.42, -0.17]] as [number, number][], // along, across
  hipDrop: 0.08, // hips below the torso's middle
  shoulder: [0.5, 0.13] as [number, number], // the neck's root: along, above the torso's middle
  head: { at: 0.85, front: 0.2, level: 0.55 }, // the head's middle along the neck; its front ahead of that; how much it is turned back toward level
  neckUp: 0.75, // radians, the neck's angle standing
  neckLying: 0.25,
  // Drinking (as a deer does): the torso lowered and tipped forward, the forefeet set out ahead
  // (the legs keep their length, the stance widens), the hind feet a little back.
  drinkLower: 0.2, // metres
  drinkTip: 0.2, // radians
  drinkSplay: [0.3, -0.1] as [number, number], // metres the fore, hind feet move along, at full drink
  foldAlong: 0.55, // lying, the feet folded in under the body (fractions of the hips' offsets)
  foldAcross: 0.7,
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
const WEAR = {
  texel: 0.25, // metres per cell of the contact map
  step: { radius: 0.16, amount: 0.07 }, // one foot landing
  // Per second of drinking: at each planted foot, and (less) over the ground it stands over.
  drink: { radius: 0.3, rate: 0.022, under: [0.6, 0.35, 0.01] as [number, number, number] },
  // Per second of lying, over the body's footprint (the torso's where within 0.1 m of the ground,
  // the folded legs under it: about 1.4 by 0.75 m).
  rest: { along: 0.7, across: 0.38, rate: 0.006 },
};
const TIMES = { rest: [50, 90], drink: [15, 26] }; // seconds, each between the two
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
const ROUTE = { cell: 1, slope: 6, jitter: 0.9, familiar: 0.5, margin: 12, clear: 0.7 }; // clear: extra metres routes keep from obstacles (gait jitter)
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
function bodyOn(groundAt: (x: number, z: number) => number, x: number, z: number, heading: number, lying: number, drinking: number) {
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
  return { y, pitch, roll, torso, of, shoulder: of(...BODY.shoulder) };
}

/** The muzzle from the shoulder, the neck at angle `neck` from level: [ahead, up] (the head turned back toward level as drawn). */
export function muzzleFrom(neck: number): [number, number] {
  const { at, front, level } = BODY.head, head = neck * (1 - level);
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

export interface Dwelling {
  sites: Sites;
  map: ContactMap;
  pose: Pose;
  /** Which home it prefers (an index into sites.homes); set to move house. */
  home: number;
  /** Seconds simulated, and rest–drink–return cycles completed. */
  time: number;
  cycles: number;
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
  step: (dt: number) => void;
  reset: () => void;
}

/** A creature at home, the ground untouched; null if no shore or home could be found. */
export function createDwelling(world: DwellWorld): Dwelling | null {
  const sites = findSites(world);
  if (!sites) return null;
  const map = createContactMap(world, sites.region);
  const groundAt = (x: number, z: number) => sampleGrid(world.grid, x, z);
  let rng: Rng = createRng(world.seed + 911);
  // The current leg: where it goes, its way and arc lengths, how far along; how long it stays.
  let way: [number, number][] = [], lengths: number[] = [], along = 0, stay = 0, trip = 0, next: 'drink' | 'rest' = 'drink';
  let goal: Spot = sites.homes[0], spot: Spot = sites.homes[0], set = false;
  // The feet: where each stands (or is in the air: from, to, how far through its swing).
  const feet = BODY.hips.map(() => ({ at: [0, 0, 0] as Point, from: [0, 0, 0] as Point, to: [0, 0, 0] as Point, t: 1 }));
  let lastPair = 1, vx = 0, vz = 0;
  const d: Dwelling = {
    sites, map, home: 0, time: 0, cycles: 0, way: null, stand: null, groundAt,
    open: (x, z) => world.terrace(x, z) > 8 && sampleGrid(world.grid, x, z, 3) < -5,
    dry: (x, z) => walkable(world, x, z),
    setObstacles: (o) => { world.obstacles = o; },
    pose: {
      x: 0, y: 0, z: 0, heading: 0, pitch: 0, torso: BODY.torso.lie, neck: BODY.neckLying, activity: 'rest', lying: 1, drinking: 0,
      hips: BODY.hips.map(() => [0, 0, 0] as Point), feet: BODY.hips.map(() => [0, 0, 0] as Point), muzzle: [0, 0, 0], planted: [true, true, true, true],
    },
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
  // The body from its place, heading, lying, drinking: torso, tip, hips, neck, muzzle.
  const shape = () => {
    const p = d.pose, c = Math.cos(p.heading), s = Math.sin(p.heading);
    const b = bodyOn(groundAt, p.x, p.z, p.heading, p.lying, p.drinking);
    p.y = b.y; p.pitch = b.pitch; p.torso = b.torso;
    BODY.hips.forEach(([ha, hc], k) => {
      const [x, y, z] = b.of(ha, -BODY.hipDrop);
      p.hips[k] = [x - s * hc, y + hc * Math.sin(b.roll), z + c * hc];
    });
    // The neck: up standing, low lying; bowed to the water's angle drinking.
    const drinkNeck = d.stand?.neck ?? -0.6;
    p.neck = (BODY.neckUp + (drinkNeck - BODY.neckUp) * p.drinking) * (1 - p.lying) + BODY.neckLying * p.lying;
    const [ahead, up] = muzzleFrom(p.neck);
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
    stay = activity === 'rest' ? TIMES.rest[0] + rng() * (TIMES.rest[1] - TIMES.rest[0]) : TIMES.drink[0] + rng() * (TIMES.drink[1] - TIMES.drink[0]);
    set = false;
  };
  const leave = (to: 'drink' | 'rest') => {
    next = to;
    if (to === 'drink') {
      d.stand = sites.stands[Math.floor(rng() * sites.stands.length)] ?? sites.drink;
      goal = d.stand;
    } else goal = nearHome(sites.homes[d.home], 0.7);
    const p = d.pose;
    const jitter = createNoise2D(world.seed * 31 + ++trip);
    const found = route(world, map, sites.region, [p.x, p.z], [goal.x, goal.z], jitter);
    if (!found) {
      // No way there (never a straight line through water): it stays where it is a while longer.
      begin(p.activity === 'walk' ? 'rest' : p.activity, spot);
      return;
    }
    way = found;
    lengths = [0];
    for (let k = 1; k < way.length; k++) lengths.push(lengths[k - 1] + Math.hypot(way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1]));
    along = 0;
    p.activity = 'walk';
    d.way = way;
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
    rng = createRng(world.seed + 911);
    map.walk.fill(0); map.drink.fill(0); map.rest.fill(0); map.version++;
    d.time = 0; d.cycles = 0; trip = 0; d.way = null; d.stand = null;
    const home = sites.homes[d.home];
    const p = d.pose;
    p.x = home.x; p.z = home.z; p.heading = home.facing; p.lying = 1; p.drinking = 0;
    vx = vz = 0;
    feet.forEach((f, k) => { f.at = placeFor(k, 0); f.t = 1; });
    begin('rest', home);
    set = true;
    pose();
  };
  const tick = (dt: number) => {
    const p = d.pose;
    d.time += dt;
    const px = p.x, pz = p.z;
    let moving = false;
    if (p.activity === 'walk') {
      if (p.lying > 0 || p.drinking > 0) {
        // Rise (or lift the head) first.
        p.lying = Math.max(p.lying - dt / 1.5, 0);
        p.drinking = Math.max(p.drinking - dt / 1.0, 0);
      } else {
        const total = lengths[lengths.length - 1];
        const ahead = pointAt(Math.min(along + 1.2, total));
        const want = Math.atan2(ahead[1] - p.z, ahead[0] - p.x), off = wrap(want - p.heading);
        if (Math.abs(off) > 0.5 && total - along > 0.6) {
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
          for (const f of feet) if (f.t >= 1) deposit(map, map.drink, f.at[0], f.at[2], WEAR.drink.radius, WEAR.drink.radius, p.heading, WEAR.drink.rate * dt);
          const [a, c, r] = WEAR.drink.under;
          deposit(map, map.drink, p.x, p.z, a, c, p.heading, r * dt);
        }
      } else {
        p.lying = Math.min(p.lying + dt / 2, 1);
        if (p.lying >= 1) deposit(map, map.rest, p.x, p.z, WEAR.rest.along, WEAR.rest.across, p.heading, WEAR.rest.rate * dt);
      }
      if (set) {
        stay -= dt;
        if (stay <= 0) leave(p.activity === 'drink' ? 'rest' : 'drink');
      }
    }
    vx = (p.x - px) / dt; vz = (p.z - pz) / dt;
    shape();
    stepFeet(dt, moving);
    pose();
  };
  d.step = (dt: number) => {
    let left = dt;
    while (left > 1e-9) { const h = Math.min(left, SUBSTEP); tick(h); left -= h; }
  };
  d.reset();
  return d;
}
