import { DataUtils } from 'three';
import { roundCone, smin, smoothstep, type Sdf } from './sdf';
import type { Bounds } from './surfaceNets';

/**
 * A terraced island as one baked field: whatever made it (rules, noise, a growth simulation)
 * bakes it into two grids, and both the CPU (meshing, water, placing things) and the GPU (shading
 * each pixel, core/shaders/terraceSdf.ts) carve the same shape from them. Only smooth quantities
 * are baked; the sharp part, cutting the surface into steps, is done where it is read, which is
 * what keeps the steps crisp at any distance. Values are rounded to half floats when baked, as the
 * GPU stores them, so the two read exactly the same numbers.
 *
 * The shape: a top surface cut into shelves `step` metres high, each riser rounded over a fixed run
 * on the ground; pools dished into the shelves where the water runs, a rim kept at each shelf's
 * edge; the outline's edge rounded; beneath, the same steps upside down on a hanging cone; a few
 * tails hanging from it.
 */
export interface TerraceField {
  /** Texels per side; the grid is centred on the origin. */
  size: number;
  /** Metres between texels. */
  texel: number;
  /** Per texel: the surface's height (before cutting into steps), its gradient (x, z), the outline's signed distance (negative inside). */
  a: Float32Array;
  /** Per texel: how far inside the water (metres, negative outside), an offset subtracted as |b|, the underside's depth below the base, its slope. */
  b: Float32Array;
  /**
   * Per texel, optional: how far the surface is cut into steps (0: left smooth, as meadow; 1: cut
   * into shelves and pools); the level of standing water (a lake, a channel; NO_WATER where none);
   * the natural ground before anything was built on it (for setting things on it); the steepest
   * slope of the surface within NEAR_SLOPE metres (see nearSlope). Absent means cut everywhere, no
   * standing water, no steeper slope nearby than here.
   */
  c?: Float32Array;
  /**
   * Optional level plates (a raised terrace): per texel the signed distance to each of up to three
   * plates' outlines, then a depth carved after them (a lake, a channel). Only these smooth
   * distances are baked; each plate's sharp edge is cut where it is read (plateTops, plateRiser),
   * as the steps are: baked into the height at the texel's spacing, a steep edge came out pleated
   * by the interpolation between texels.
   */
  d?: Float32Array;
  /** Each plate's top height, metres (with `d`). */
  plateTops?: number[];
  /** The run of a plate's edge on the ground, metres (with `d`). */
  plateRiser?: number;
  /**
   * Optional basins (a stair of pools), lowest first: each a level-topped block with a vertical
   * wall, dished into a pool. Shapes, not grids: both CPU and GPU compute each one's outline
   * (basinDistance) and cut its wall where they read it, as the plates' edges are.
   */
  basins?: Basin[];
  /** Per shelf, -0.5 to 0.5: each pool spreads JITTER x this further or less far than the water. */
  jitter: number[];
  /** Depths where the underside's strata meet, from 0 down. */
  under: number[];
  /** Hanging tails: [ax, ay, az, bx, by, bz, r1, r2] each, at most MAX_TAILS. */
  tails: number[][];
  /** Tails are only looked up below this height. */
  tailTop: number;
  /** Highest and lowest the shape reaches, metres. */
  top: number;
  bottom: number;
}

/** How the surface is cut and dished. */
export interface TerraceStyle {
  /** Height of each shelf, metres. */
  step: number;
  /** Width of each pool's rim, metres. */
  rim: number;
  /** Depth of water in a pool, metres. */
  poolDepth: number;
}

export const BASE_DEPTH = 10; // metres from the top's zero to the underside's start
export const EDGE_ROUND = 3; // the outline's upper edge is rounded this much
export const UNDER_ROUND = 4; // and its lower edge this much (less than the wall, or the roundings crease)
export const UNDER_RUN = 6; // horizontal run of each riser beneath, metres: a soft bevel on every stratum
export const RISER_RUN = 2.4; // horizontal run of each riser on top, metres (more than two mesh cells)
/**
 * A mesh can only hold what is broader than a few of its cells: anything finer aliases into jags.
 * So a mesh of a given cell is carved from the shape simplified to it: every run and rounding at
 * least LOD_SPAN cells wide (thin strata then melt into slopes). Far off, where cells are coarse,
 * the island reads as a few broad masses; near, at fine cells, in full detail. The per-pixel
 * carving (terraceSdf.ts) restores the top's detail wherever it is on.
 */
export const LOD_SPAN = 3;
export const BASIN_WALL = 0.3; // a pool's floor drops this many metres per metre in from its edge
export const JITTER = 7; // metres
export const MAX_SHELVES = 32;
export const MAX_UNDER = 32;
export const MAX_TAILS = 2;
export const TAIL_BLEND = 6;
export const NO_WATER = -1e4;
export const NO_PLATE = 1e4; // a plate's distance where there is none
export const SAMPLE = 16; // values sampleField reads
export const PLATE_RISER = 3; // metres: a plate's edge, from its rim to the ground below, by default

/**
 * A basin of a stair of pools: a block of travertine, level on top at `top`, its wall nearly
 * vertical (BASIN_RISER), a rim BASIN_RIM wide, inside it a pool `depth` deep (full depth
 * BASIN_FLOOR in from the rim). Its outline: an ellipse, lobed a little (BASIN_LOBES) so no two are
 * alike; `phase` turns the lobes.
 */
export interface Basin {
  centre: [number, number];
  radii: [number, number];
  top: number;
  depth: number;
  phase: number;
}
export const BASIN_RISER = 1; // metres: the run of a basin's wall (nearly vertical: rimstone dams)
export const BASIN_RIM = 1.2; // metres: the dam's crest around a pool, in from the top of its wall
export const BASIN_FLOOR = 3; // metres in from the rim to a pool's full depth
export const BASIN_LOBES = [0.09, 0.05]; // the outline's lobes: three and five around, as shares of its radius
export const MAX_BASINS = 6;
export const BASIN_KEEP = 0.5; // metres above a basin's top over which higher ground is left as it is

/**
 * A basin's outline as a distance (negative inside): the ellipse's, as a share of its radius,
 * times its shorter radius (so never more than the truth along the longer one); no noise, so the
 * shader computes the same. The lobes, sin(3θ + φ) and sin(5θ + 2φ), are written as polynomials
 * in cos θ and sin θ (the multiple-angle formulas): no trigonometry, which the shader would pay for
 * dozens of times a pixel.
 */
export function basinDistance(b: Basin, x: number, z: number) {
  const qx = (x - b.centre[0]) / b.radii[0], qz = (z - b.centre[1]) / b.radii[1];
  const r = Math.max(Math.hypot(qx, qz), 1e-4);
  const c = qx / r, s = qz / r;
  const c2 = c * c, s2 = s * s;
  const sin3 = s * (3 - 4 * s2), cos3 = c * (4 * c2 - 3);
  const sin5 = s * (16 * s2 * s2 - 20 * s2 + 5), cos5 = c * (16 * c2 * c2 - 20 * c2 + 5);
  const lobes = BASIN_LOBES[0] * (sin3 * Math.cos(b.phase) + cos3 * Math.sin(b.phase))
    + BASIN_LOBES[1] * (sin5 * Math.cos(2 * b.phase) + cos5 * Math.sin(2 * b.phase));
  return (r - 1 - lobes) * Math.min(b.radii[0], b.radii[1]);
}

/** The height with the field's plates and basins on it (see TerraceField.d, .basins), from a sample. */
export function platedHeight(field: TerraceField, s: ArrayLike<number>, riser = field.plateRiser ?? PLATE_RISER, x?: number, z?: number, basinRiser = BASIN_RISER) {
  let h = s[0];
  if (field.d && field.plateTops) field.plateTops.forEach((top, k) => { h += (top - h) * (1 - smoothstep(-riser, 0, s[12 + k])); });
  if (field.basins && x !== undefined && z !== undefined) h = basinHeight(field.basins, h, x, z, basinRiser);
  return h - (field.d ? s[15] : 0);
}

/**
 * The basins (lowest first) set on a height h at (x, z): each wall rising to its top, its pool
 * dished; ground already higher than a basin's top (the terrace it stands against) is left.
 */
export function basinHeight(basins: Basin[], h: number, x: number, z: number, riser = BASIN_RISER) {
  for (const b of basins) {
    // Far from it (beyond its lobes): nothing to cut, and no trig.
    if (Math.hypot((x - b.centre[0]) / b.radii[0], (z - b.centre[1]) / b.radii[1]) > 1 + BASIN_LOBES[0] + BASIN_LOBES[1]) continue;
    const d = basinDistance(b, x, z);
    if (d > 0) continue;
    const floor = b.top - b.depth * smoothstep(-BASIN_RISER - BASIN_RIM, -BASIN_RISER - BASIN_RIM - BASIN_FLOOR, d);
    const target = floor + (h - floor) * smoothstep(b.top, b.top + BASIN_KEEP, h);
    h += (target - h) * (1 - smoothstep(-riser, 0, d));
  }
  return h;
}
export const NEAR_SLOPE = 12; // metres around a point within which its steepest slope is taken

/**
 * The steepest slope within NEAR_SLOPE metres of every texel (a max filter over the slope's grid).
 * A height's distance is its height difference over the slope, and only the steepest slope nearby
 * keeps that from overstating: beside a cliff the ground is flat, but the cliff a few metres off is
 * nearer than the height above that ground says. Overstated, the meshing skipped blocks that held
 * surface (holes at the terrace's edges).
 */
export function nearSlope(gradX: (t: number) => number, gradZ: (t: number) => number, size: number, texel: number): Float32Array {
  const slope = new Float32Array(size * size);
  for (let t = 0; t < slope.length; t++) slope[t] = Math.hypot(gradX(t), gradZ(t));
  const r = Math.ceil(NEAR_SLOPE / texel);
  const row = new Float32Array(slope.length), out = new Float32Array(slope.length);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let m = 0;
    for (let k = Math.max(i - r, 0); k <= Math.min(i + r, size - 1); k++) m = Math.max(m, slope[j * size + k]);
    row[j * size + i] = m;
  }
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let m = 0;
    for (let k = Math.max(j - r, 0); k <= Math.min(j + r, size - 1); k++) m = Math.max(m, row[k * size + i]);
    out[j * size + i] = m;
  }
  return out;
}

/** Round every value to a half float, as the GPU will store it. */
export function roundToHalf(values: Float32Array) {
  for (let i = 0; i < values.length; i++) values[i] = DataUtils.fromHalfFloat(DataUtils.toHalfFloat(values[i]));
}

/**
 * Steps: flat for most of each one, then a rounded riser whose run on the ground is `run` metres.
 * A step too fine for that run (thin, on a steep slope: its riser would need more than 0.7 of it)
 * cannot be drawn at this run without jags, so it melts into the slope instead (fully by 1.2):
 * coarse meshes, with long runs, show the broad masses only (LOD_SPAN).
 */
export function steps(h: number, bottom: number, thick: number, slope: number, run: number) {
  const f = (h - bottom) / thick;
  const need = (run * slope) / thick;
  const riser = Math.min(Math.max(need, 0.12), 0.7);
  const melt = smoothstep(0.7, 1.2, need);
  const stepped = bottom + thick * smoothstep(1 - riser, 1, f);
  return { f, riser, q: stepped + (h - stepped) * melt, steep: ((1.5 * slope) / riser) * (1 - melt) + 1.5 * slope * melt };
}

export interface Terrace {
  /** Shelf height (cut into steps) at a point. */
  height: number;
  /** Index of the shelf a point is on. */
  shelf: number;
  /** Whether the point is in a pool, and how far inside its edge (metres, positive inside). */
  pool: boolean;
  inside: number;
  /** How far inside the water (metres, positive inside; very negative where pools cannot be). */
  band: number;
  /** The outline's signed distance (negative inside). */
  outline: number;
  /** The surface's own downhill direction (unit, ground plane) and how steep it is. */
  downX: number;
  downZ: number;
  slope: number;
  /** Steepest slope of the cut surface here (on its riser), for a safe distance. */
  steep: number;
}

/** Bilinear read of the grids at (x, z), as the GPU's linear filtering reads them: a in 0–3, b in 4–7, c in 8–11, d in 12–15. */
export function sampleField(field: TerraceField, x: number, z: number, out = new Float64Array(SAMPLE)) {
  const { size, texel, a, b, c: cut, d: plates } = field;
  const max = size - 1;
  const fx = Math.min(Math.max(x / texel + max / 2, 0), max), fz = Math.min(Math.max(z / texel + max / 2, 0), max);
  const i = Math.min(Math.floor(fx), max - 1), j = Math.min(Math.floor(fz), max - 1);
  const u = fx - i, v = fz - j;
  const n00 = (j * size + i) * 4, n10 = n00 + 4, n01 = n00 + size * 4, n11 = n01 + 4;
  const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
  for (let c = 0; c < 4; c++) {
    out[c] = a[n00 + c] * w00 + a[n10 + c] * w10 + a[n01 + c] * w01 + a[n11 + c] * w11;
    out[c + 4] = b[n00 + c] * w00 + b[n10 + c] * w10 + b[n01 + c] * w01 + b[n11 + c] * w11;
    out[c + 8] = cut ? cut[n00 + c] * w00 + cut[n10 + c] * w10 + cut[n01 + c] * w01 + cut[n11 + c] * w11 : c === 0 ? 1 : c === 1 ? NO_WATER : 0;
    out[c + 12] = plates ? plates[n00 + c] * w00 + plates[n10 + c] * w10 + plates[n01 + c] * w01 + plates[n11 + c] * w11 : c < 3 ? NO_PLATE : 0;
  }
  // Beyond the grid, the outline's distance keeps growing.
  const half = (max / 2) * texel;
  out[3] += Math.hypot(Math.max(Math.abs(x) - half, 0), Math.max(Math.abs(z) - half, 0));
  return out;
}

const roundMax = (a: number, b: number, r: number) =>
  Math.hypot(Math.max(a + r, 0), Math.max(b + r, 0)) + Math.min(Math.max(a + r, b + r), 0) - r;

/** The terraced surface at (x, z); `run` is the risers' run (wider for a coarse mesh, see LOD_SPAN). */
export function terraceAt(
  field: TerraceField, style: TerraceStyle, x: number, z: number, s = sampleField(field, x, z), run = RISER_RUN, plateRiser?: number,
  basinRiser = BASIN_RISER,
): Terrace {
  const [, gx, gz, outline, wet, offset, , , cut] = s;
  const h = platedHeight(field, s, plateRiser, x, z, basinRiser);
  const slope = Math.max(Math.hypot(gx, gz), 1e-3);
  const k = Math.floor(h / style.step);
  const st = steps(h, k * style.step, style.step, slope, run);
  // Left smooth where not cut (meadow), shelves where cut; the steepness never less than the
  // steepest slope nearby (nearSlope).
  const height = h + (st.q - h) * cut, steep = Math.max(1.5 * slope * (1 - cut) + st.steep * cut, 1.5 * s[11]);
  const fromBand = wet + JITTER * field.jitter[Math.min(Math.max(k, 0), MAX_SHELVES - 1)] - Math.abs(offset);
  const fromEdge = (st.f * style.step) / slope - style.rim;
  const fromRiser = ((1 - st.riser - st.f) * style.step) / slope - 0.3;
  const inside = Math.min(fromBand, fromEdge, fromRiser);
  const can = outline < -EDGE_ROUND * 2 && cut > 0.5;
  return {
    height, shelf: k, pool: inside > 0 && can, inside, band: can ? fromBand : -99, outline,
    downX: -gx / slope, downZ: -gz / slope, slope, steep,
  };
}

/**
 * How far above the underside's start (−BASE_DEPTH) the underside can still change the distance,
 * and the most its distance is ever divided by, for steps of the given run and rounding. Above that
 * height its effect is bounded, so it need not be looked up: the bound is used instead, never a
 * guess (a guessed cutoff once made the distance jump there, the meshing skipped blocks that held
 * surface, and holes opened along the side). The steepest riser is 1.5 x the thickest stratum over
 * the run; the scale carries 25% slack for bilinear reads between texels.
 */
export function underReach(field: TerraceField, run: number, round: number) {
  let thickest = 0;
  for (let k = 1; k < field.under.length; k++) thickest = Math.max(thickest, field.under[k] - field.under[k - 1]);
  const scale = 1.25 * Math.hypot(1, (1.5 * thickest) / run);
  return { height: round * scale + 1, scale };
}

/**
 * The field's shape as a signed distance (mirrors map() in terraceSdf.ts), simplified for a mesh of
 * `cell` metres (LOD_SPAN; 0 for full detail).
 */
export function terraceSdf(field: TerraceField, style: TerraceStyle, cell = 0): Sdf {
  const tails = field.tails.map((t) => roundCone(t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7]));
  const s = new Float64Array(SAMPLE);
  const span = LOD_SPAN * cell;
  const riserRun = Math.max(RISER_RUN, span), underRun = Math.max(UNDER_RUN, span);
  const plateRiser = Math.max(field.plateRiser ?? PLATE_RISER, span), basinRiser = Math.max(BASIN_RISER, span);
  const edgeRound = Math.max(EDGE_ROUND, span / 2), underRound = Math.max(UNDER_ROUND, span / 2);
  const reach = underReach(field, underRun, underRound);
  // A coarse mesh reads the field averaged over a cross of five reads (LOD_SPAN), so steep sides
  // baked into the field itself (a terrace's edge) are as broad as it can hold.
  const blur = span / 2;
  const t = new Float64Array(SAMPLE);
  return (x, y, z) => {
    sampleField(field, x, z, s);
    if (blur > 0) {
      for (const [dx, dz] of [[blur, 0], [-blur, 0], [0, blur], [0, -blur]]) {
        sampleField(field, x + dx, z + dz, t);
        for (let i = 0; i < SAMPLE; i++) s[i] += t[i];
      }
      for (let i = 0; i < SAMPLE; i++) s[i] /= 5;
    }
    const tr = terraceAt(field, style, x, z, s, riserRun, plateRiser, basinRiser);
    let top = (y - tr.height) / Math.sqrt(1 + tr.steep * tr.steep);
    if (tr.band > -99 && tr.inside > -1) {
      const floor = tr.height - Math.min(tr.inside * BASIN_WALL, style.poolDepth);
      top = -smin(-top, (floor - y) / Math.hypot(1, BASIN_WALL), 0.4);
    }
    const side = roundMax(top, tr.outline, edgeRound);
    let d = side;
    if (y > -BASE_DEPTH + reach.height) {
      // Out of the underside's reach: its bound, which is exact on the surface and never further
      // than the truth inside (safe for skipping empty blocks).
      d = roundMax(side, (-BASE_DEPTH - y) / reach.scale, underRound);
    } else {
      const cone = s[6], coneSlope = Math.max(s[7], 1e-3);
      const under = field.under;
      let k = 0;
      while (k < under.length - 2 && under[k + 1] <= cone) k++;
      const u = steps(cone, under[k], under[k + 1] - under[k], coneSlope, underRun);
      d = roundMax(side, (-BASE_DEPTH - u.q - y) / (1.25 * Math.sqrt(1 + u.steep * u.steep)), underRound);
    }
    if (y < field.tailTop) for (const tail of tails) d = smin(d, tail(x, y, z), TAIL_BLEND);
    return d;
  };
}

/** The box the shape fits in. */
export function fieldBounds(field: TerraceField): Bounds {
  const half = ((field.size - 1) / 2) * field.texel;
  return { min: [-half, field.bottom, -half], max: [half, field.top, half] };
}

/** Box-blur a square grid in place, `passes` times (keeps a distance's slope within its bound). */
export function blurGrid(v: Float32Array, size: number, passes: number) {
  const tmp = new Float32Array(v.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const a = v[j * size + Math.max(i - 1, 0)], b = v[j * size + i], c = v[j * size + Math.min(i + 1, size - 1)];
      tmp[j * size + i] = (a + b + c) / 3;
    }
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const a = tmp[Math.max(j - 1, 0) * size + i], b = tmp[j * size + i], c = tmp[Math.min(j + 1, size - 1) * size + i];
      v[j * size + i] = (a + b + c) / 3;
    }
  }
}

/**
 * Make a shaped outline a true distance again. Anything baked as a distance must stay one (change
 * by at most a metre a metre): the meshing skips blocks by it, and an outline bent by noise
 * overstated it near the rim by nearly half again, so blocks holding surface were skipped (holes
 * seen from afar). Its inside is kept, the distance measured exactly from it (Euclidean distance
 * transform), then smoothed a little so the rim is not stepped by the grid. In metres.
 */
export function redistance(shaped: Float32Array, size: number, texel: number): Float32Array {
  const mask = new Uint8Array(shaped.length);
  for (let i = 0; i < shaped.length; i++) mask[i] = shaped[i] < 0 ? 1 : 0;
  const d = signedDistance(mask, size);
  for (let i = 0; i < d.length; i++) d[i] *= texel;
  blurGrid(d, size, 2);
  return d;
}

/** Signed distance to a mask on a grid (negative inside), in grid cells: exact Euclidean (Felzenszwalb and Huttenlocher). */
export function signedDistance(mask: Uint8Array, n: number): Float32Array {
  const toInside = edt(mask, n, 1), toOutside = edt(mask, n, 0);
  const out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = mask[i] ? 0.5 - Math.sqrt(toOutside[i]) : Math.sqrt(toInside[i]) - 0.5;
  return out;
}

/** Squared distance from every cell to the nearest cell whose mask equals `target`. */
function edt(mask: Uint8Array, n: number, target: number): Float64Array {
  const INF = 1e20;
  const d = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) d[i] = mask[i] === target ? 0 : INF;
  const f = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), zz = new Float64Array(n + 1);
  const pass = (get: (k: number) => number, set: (k: number, x: number) => void) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0;
    v[0] = 0; zz[0] = -INF; zz[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= zz[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; zz[k] = s; zz[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (zz[k + 1] < q) k++;
      out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
    for (let q = 0; q < n; q++) set(q, out[q]);
  };
  for (let r = 0; r < n; r++) pass((q) => d[r * n + q], (q, x) => { d[r * n + q] = x; });
  for (let c = 0; c < n; c++) pass((q) => d[q * n + c], (q, x) => { d[q * n + c] = x; });
  return d;
}
