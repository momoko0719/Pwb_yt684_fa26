import { createNoise2D, type Noise2D } from '../../core/noise';
import { createRng } from '../../core/rng';
import { outlineRadius } from '../../core/terrain/basinMesh';
import { smoothstep } from '../../core/sdf/sdf';
import { redistance } from '../../core/sdf/terraceField';
import { fillGradients, sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { FRAME_DEFAULTS, islandFrame, ovalRadius, type FrameParams } from './frame';
import { ISLAND, SEED, TERRACE_LEVELS } from './layout';
import { RANGE, rangeHeight, rangePeaks, type RangeParams } from './range';

/**
 * Wonderland's natural ground, as rules: the island's outline, the meadow on it, the range of
 * peaks around the terrace. Shared by every page that builds the island, however it draws it.
 */
export interface GroundParams {
  seed: number;
  range: RangeParams;
  /** How the parts lie (frame.ts): the back's direction, how much the seed varies them. */
  frame: FrameParams;
}
export const GROUND_DEFAULTS: GroundParams = { seed: SEED, range: RANGE, frame: FRAME_DEFAULTS };

export const PLATE_CORNER = 28; // metres: how round a terrace plate's corners are
// Metres a higher plate keeps inside the one below, at the least: the lower one's rim (up to 8 m on
// its slider) and a strait of open water.
const PLATE_GAP = 14;
const OUTLET = {
  dip: [0.45, 0.22], // metres a main, a secondary outlet's crest stands below the rim
  reach: [5, 3.5], // metres along the rim over which each dips (a gaussian's sigma)
  bulge: [6, 3], // metres the outline swells downstream there (a dam is convex downstream where it spills)
  spread: [10, 7], // metres along the rim the swelling reaches (sigma)
  inside: 10, // metres inside the plate below a fall must land (past its rim)
  apart: 25, // metres along the rim a secondary outlet keeps from the main
  secondary: 0.7, // the chance an upper plate has a secondary outlet
};

/** An outlet of a terrace plate: where on its outline (angle from its centre), and how it dips and swells. */
export interface Outlet {
  angle: number;
  x: number;
  z: number;
  main: boolean;
  dip: number;
  reach: number;
  bulge: number;
  spread: number;
}
/**
 * The meadow's low swells: how many, how wide and high (metres), how far out from the island's
 * centre (a share of its radius), how far apart (a share of their two widths), how far from the
 * terrace and the range they keep (a share of their width).
 */
const SWELLS = { count: 4, width: [90, 140], height: [6, 8], out: [0.45, 0.8], apart: 0.8, clear: 0.5 };
const RANGE_RIM = 25; // metres in from the rim over which the range comes down to the meadow
const RANGE_CLEAR = 6; // metres of meadow left between the terrace and the range's foot
const RANGE_APRON = 2.2; // the steepest the range may rise from there (rise over run)

/** A minimum with its corner rounded over k (polynomial, after Inigo Quilez). */
export function smoothMin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** The ground's rules for a seed and range. */
export function groundRules(p: GroundParams) {
  const noise: Noise2D = createNoise2D(p.seed + 5);
  const rx = ISLAND.across / 2, rz = ISLAND.deep / 2;
  // The frame: the basin, the plates, the range's centre, the back's direction (frame.ts).
  const frame = islandFrame(p.seed, rx, rz, ISLAND.across / 2, ISLAND.deep / 2, p.frame);
  const [ux, uz] = frame.u, [vx, vz] = frame.v;
  const plates = frame.plates.map((pl, k) => ({ ...pl, top: TERRACE_LEVELS[k] }));
  // The outline: an oval's signed distance (Inigo Quilez's approximation), its edge wandering in
  // long bays (90 m) and smaller points (35 m).
  const outline = (x: number, z: number) => {
    const k = Math.hypot(x / rx, z / rz);
    const g = Math.hypot(x / (rx * rx), z / (rz * rz));
    const oval = g > 1e-9 ? ((k - 1) * k) / g : -Math.min(rx, rz);
    return oval + 12 * noise(x / 90, z / 90) + 4 * noise(x / 35 + 40, z / 35 - 40);
  };
  // The meadow: a gentle rise toward the back, the swells, a broad roll, easing down to the rim.
  const meadow = (x: number, z: number, edge: number) => {
    let h = 1 + 5 * smoothstep(-260, 160, x * ux + z * uz);
    for (const [sx, sz, w, sh] of swells) {
      // Long along the frame's axis, as the range and terrace lie.
      const ox = x - sx, oz = z - sz;
      const dx = (ox * ux + oz * uz) / (w / 2), dz = (ox * vx + oz * vz) / (w * 0.35);
      h += sh * 0.6 * Math.exp(-2 * (dx * dx + dz * dz));
    }
    h += 1.2 * noise(x / 70 + 9, z / 70) + 0.4 * noise(x / 25, z / 25 + 9);
    return h - 2 * (1 - smoothstep(-30, 0, edge));
  };
  // A terrace plate's base outline: a rounded rectangle wandering in broad swells of its own; a
  // higher plate kept PLATE_GAP inside the one below all round (its swells and the lower one's
  // could meet: the lower pool, a ring round it, was cut in two, its inflow on one side of the cut
  // and its outlet on the other).
  const base = (k: number): ((x: number, z: number) => number) => {
    const { centre, size } = plates[k], salt = 13 * k + 7;
    const lower = k ? base(k - 1) : null;
    return (x: number, z: number) => {
      // In the frame's axes: along u, across v.
      const dx = x - centre[0], dz = z - centre[1];
      const qx = Math.abs(dx * ux + dz * uz) - (size[0] / 2 - PLATE_CORNER), qz = Math.abs(dx * vx + dz * vz) - (size[1] / 2 - PLATE_CORNER);
      const box = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - PLATE_CORNER;
      const own = box + 7 * noise(x / 80 + salt, z / 80 - salt) + 2 * noise(x / 30 - salt, z / 30 + salt);
      return lower ? -smoothMin(-own, -(lower(x, z) + PLATE_GAP), 8) : own;
    };
  };
  // Its outlets, by rule, from the lowest plate up. The lowest's main outlet faces the pass. Each
  // higher plate's main outlet is where its fall lands well inside the plate below and as far as
  // can be from that plate's own main outlet (so the water crosses each pool, inflow to outflow),
  // a little in favour of facing downstream; perhaps a shallower secondary outlet, well along the
  // rim from the main, landing inside the plate below too. The seed nudges the choices.
  const rng = createRng(p.seed + 401);
  const outlets: Outlet[][] = [];
  // A plate's outline with its outlets swelling downstream.
  const swollen = (k: number) => {
    const shape = base(k), { centre } = plates[k];
    return (x: number, z: number) => {
      let d = shape(x, z);
      const a = Math.atan2(z - centre[1], x - centre[0]), r = Math.hypot(x - centre[0], z - centre[1]);
      for (const o of outlets[k]) {
        const along = Math.atan2(Math.sin(a - o.angle), Math.cos(a - o.angle)) * r;
        d -= o.bulge * Math.exp(-(along * along) / (2 * o.spread * o.spread));
      }
      return d;
    };
  };
  const CANDIDATES = 180;
  plates.forEach((pl, k) => {
    const shape = base(k);
    const at = (angle: number) => {
      const r = outlineRadius(pl.centre, shape, angle, 0);
      return { r, x: pl.centre[0] + Math.cos(angle) * r, z: pl.centre[1] + Math.sin(angle) * r };
    };
    // Where a fall from the outline at this angle would land: thrown out along the outline's own
    // normal, past the outlet's swelling and the water's throw.
    const throwFrom = (angle: number): [number, number] => {
      const q = at(angle), e = 0.2;
      const gx = shape(q.x + e, q.z) - shape(q.x - e, q.z), gz = shape(q.x, q.z + e) - shape(q.x, q.z - e), gl = Math.hypot(gx, gz) || 1;
      const out = OUTLET.bulge[0] + 4;
      return [q.x + (gx / gl) * out, q.z + (gz / gl) * out];
    };
    const cands = Array.from({ length: CANDIDATES }, (_, i) => {
      const angle = (i / CANDIDATES) * 2 * Math.PI, q = at(angle);
      return { angle, ...q, landing: throwFrom(angle), jitter: rng() };
    });
    const below = k ? swollen(k - 1) : null;
    // Every part of the stretch the outlet may spill over (its hollow, 2.5 of its reaches either
    // way) must land well inside the plate below.
    const lands = (c: (typeof cands)[number], m = 0) => {
      if (!below) return true;
      const span = (2.5 * OUTLET.reach[m]) / Math.max(c.r, 1);
      for (let t = -1; t <= 1; t += 0.25) {
        const [lx, lz] = throwFrom(c.angle + t * span);
        if (below(lx, lz) > -OUTLET.inside) return false;
      }
      return true;
    };
    const make = (c: (typeof cands)[number], main: boolean): Outlet => {
      const m = main ? 0 : 1;
      return { angle: c.angle, x: c.x, z: c.z, main, dip: OUTLET.dip[m], reach: OUTLET.reach[m], bulge: OUTLET.bulge[m], spread: OUTLET.spread[m] };
    };
    // The front: the way the range opens. The lowest plate's main outlet is where the range's open
    // axis, out from the basin toward the front, crosses its outline (the pass); each higher one
    // leans that way too.
    const front = frame.back + Math.PI;
    const off = (c: (typeof cands)[number]) => Math.abs(Math.atan2(Math.sin(c.angle - front), Math.cos(c.angle - front)));
    let main: (typeof cands)[number];
    if (!k) main = cands.reduce((a, c) => (off(c) < off(a) ? c : a));
    else {
      const prev = outlets[k - 1][0];
      const score = (c: (typeof cands)[number]) => Math.hypot(c.landing[0] - prev.x, c.landing[1] - prev.z) + 15 * Math.cos(c.angle - front) + 10 * c.jitter;
      main = cands.filter((c) => lands(c, 0)).reduce((a, c) => (score(c) > score(a) ? c : a));
    }
    const list = [make(main, true)];
    if (k && rng() < OUTLET.secondary) {
      const away = cands.filter((c) => lands(c, 1) && Math.abs(Math.atan2(Math.sin(c.angle - main.angle), Math.cos(c.angle - main.angle))) * main.r > OUTLET.apart);
      if (away.length) list.push(make(away[Math.floor(rng() * away.length)], false));
    }
    outlets.push(list);
  });
  const plate = swollen;
  const peaks = rangePeaks(p.seed, rx, rz, p.range, frame.rangeCentre, frame.back);
  // The swells: on open meadow, away from the terrace and the range, apart from each other.
  const swells: [number, number, number, number][] = [];
  {
    const pick = createRng(p.seed + 523), lowest = base(0);
    for (let tries = 0; tries < 400 && swells.length < SWELLS.count; tries++) {
      const a = 2 * Math.PI * pick(), out = SWELLS.out[0] + (SWELLS.out[1] - SWELLS.out[0]) * pick();
      const w = SWELLS.width[0] + (SWELLS.width[1] - SWELLS.width[0]) * pick(), sh = SWELLS.height[0] + (SWELLS.height[1] - SWELLS.height[0]) * pick();
      const r = out * ovalRadius(rx, rz, a), sx = Math.cos(a) * r, sz = Math.sin(a) * r, keep = SWELLS.clear * w;
      if (lowest(sx, sz) < keep) continue;
      let onRange = false;
      for (let k = 0; k < 8 && !onRange; k++) onRange = rangeHeight(peaks, sx + Math.cos(k) * keep, sz + Math.sin(k) * keep, noise, p.range, frame.rangeCentre) > 0;
      if (onRange || swells.some(([qx, qz, qw]) => Math.hypot(qx - sx, qz - sz) < (SWELLS.apart * (qw + w)) / 2)) continue;
      swells.push([sx, sz, w, sh]);
    }
  }
  // The natural ground: the meadow with the range on it. The range comes down to the meadow near
  // the rim, and short of the terrace (`clear`, distance out from its lowest plate) it may rise no
  // faster than RANGE_APRON from a strip of meadow: its foot runs out in an apron, its peaks keep
  // their shape. (A spur reaching over a plate was cut off by its riser into a crumpled cliff;
  // faded out over a fixed distance, a tall peak near the terrace became a sheer wall.)
  const natural = (x: number, z: number, edge: number, clear: number) => {
    const range = rangeHeight(peaks, x, z, noise, p.range, frame.rangeCentre) * smoothstep(0, RANGE_RIM, -edge);
    const apron = RANGE_APRON * Math.max(clear - RANGE_CLEAR, 0);
    return meadow(x, z, edge) + Math.max(smoothMin(range, apron, 8), 0);
  };
  return { noise, rx, rz, frame, plates, swells, outline, meadow, plate, outlets, peaks, natural };
}

const RIM_POINTS = 720;
const EDGE_ROUND = 2.5; // metres: the ground's edge rounded down into the island's side

/**
 * The natural ground baked to a height grid (1 m texels over the island and a margin), and the
 * rim: the outline as a ring of points (x, z, ground height there), for the island's side.
 */
export function bakeGround(p: GroundParams, texel = 1): { grid: HeightGrid; rim: Float32Array } {
  const rules = groundRules(p);
  const half = Math.max(rules.rx, rules.rz) + 20;
  const size = Math.ceil((2 * half) / texel) + 1;
  const n = size * size;
  const at = (i: number) => (i - (size - 1) / 2) * texel;
  // Outlines made true distances again (see redistance): the island's, and the lowest plate's.
  const distances = (shape: (x: number, z: number) => number) => {
    const shaped = new Float32Array(n);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) shaped[j * size + i] = shape(at(i), at(j));
    return redistance(shaped, size, texel);
  };
  const edges = distances(rules.outline);
  const clear = distances(rules.plate(0));
  const data = new Float32Array(n * 4);
  let top = -Infinity, bottom = Infinity;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const t = j * size + i;
      // Rounded down over the last EDGE_ROUND metres to the rim (a quarter circle).
      const e = Math.min(Math.max(-edges[t], 0), EDGE_ROUND);
      const h = rules.natural(at(i), at(j), edges[t], clear[t]) - (EDGE_ROUND - Math.sqrt(EDGE_ROUND ** 2 - (EDGE_ROUND - e) ** 2));
      data[t * 4] = h;
      data[t * 4 + 3] = edges[t];
      if (edges[t] < 0) { top = Math.max(top, h); bottom = Math.min(bottom, h); }
    }
  }
  const grid: HeightGrid = { size, texel, data, top, bottom };
  fillGradients(grid);
  // The rim: along each ray from the centre, where the outline crosses zero (bisected).
  const rim = new Float32Array(RIM_POINTS * 3);
  for (let k = 0; k < RIM_POINTS; k++) {
    const a = (k / RIM_POINTS) * 2 * Math.PI, dx = Math.cos(a), dz = Math.sin(a);
    let lo = 0, hi = half * 1.5;
    for (let s = 0; s < 40; s++) {
      const m = (lo + hi) / 2;
      if (sampleGrid(grid, dx * m, dz * m, 3) < 0) lo = m; else hi = m;
    }
    rim[k * 3] = dx * lo;
    rim[k * 3 + 1] = dz * lo;
    rim[k * 3 + 2] = sampleGrid(grid, dx * lo, dz * lo);
  }
  return { grid, rim };
}
