import { basinMesh, outlineRadius, type BasinMesh } from '../../core/terrain/basinMesh';
import { fallMesh, type FallMesh, type LipPoint } from '../../core/terrain/fallMesh';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { potentialFlow, sampleField, type FlowField, type Source } from '../../core/terrain/potentialFlow';
import type { groundRules } from './ground';

/**
 * The raised terrace as a stair of three pools (the owner's option A): each plate a block holding a
 * pool, the top one fed by the spring. The water's way through it is a graph: pools, and outlets
 * that each lead to a pool below (or, from the lowest, to the meadow), solved from the top down:
 *
 * - A pool's inflow is the spring's (the top pool) or what the outlets of the pool above pour in.
 * - Its rim's crest is level but for its outlets (ground.ts: where and how deep, by rule): at each
 *   the crest dips in a smooth hollow, the main outlet deepest, so the water leaves by the lowest
 *   way first; the rim thickens there (a dam grows where it spills) and swells downstream.
 * - Its level is where what spills over the crest equals the inflow. The crest is natural, not
 *   engineered: what spills per metre is taken as 1.4 h^1.5 m虏/s under h metres of water (a
 *   broad-crested weir's form, its coefficient lowered for a rough, rounded natural lip: an
 *   approximation), summed along the rim. More water: a higher level, the main outlet widens, the
 *   secondary ones begin to spill.
 * - Each continuous spilling stretch is an outlet: its crest, width, flow, the pool it falls into.
 *   Its fall (fallMesh.ts) starts on the rim's outer edge where the pool's sheet ends, and where it
 *   lands, with its flow and its drop, is an inflow of the pool below (its water stirs there).
 * - The water in a pool runs from where it comes in to where it goes out: potential flow over its
 *   open water (potentialFlow.ts: sources where falls land, sinks along each outlet's lip, no flow
 *   through a shore, round the plate standing in it), the speed the discharge over the depth (slow
 *   over the deep middle, fast over the shallow lip). A visual approximation of the flow, not a
 *   solution of the shallow-water equations; the levels are the steady state for the flow. (The
 *   first version summed radial sources and sinks, the walls unseen: in a lower pool, wrapped round
 *   the plate above, its lines ran straight through that plate.)
 *
 * Under each spilling stretch the outer wall is fluted (travertine grows where water runs down).
 */
export interface TerraceParams {
  /** Metres: the rim around each pool (wider at the outlets). */
  rim: number;
  /** Metres: the water's depth at the middle of each pool. */
  depth: number;
  /** Metres: how deep the main outlets dip below the rim (secondary ones about half). */
  dip: number;
}
export const TERRACE_DEFAULTS: TerraceParams = { rim: 3, depth: 1.6, dip: 0.45 };

const SEGMENTS = 1200; // steps round each outline (half a metre or so: enough for the flutes)
const WEIR = 1.4; // m虏/s per metre of a natural crest under a metre of water (q = WEIR h^1.5)
const FLUTE_REACH = 3; // metres either side of a spill the wall is fluted
const THICKEN = 0.8; // the rim is this much wider at an outlet
const SHALLOW = 0.5; // metres of water at the foot of the inner wall (the floor is a dish)
const FLOW_CELL = 2; // metres between the flow's cells
const FASTEST = 2.5; // m/s
const ARROW = 10; // metres between the debug view's flow arrows
const DAM = 1.3; // a main outlet's hollow is at least this many times the depth its whole flow needs

export interface Inflow {
  x: number;
  z: number;
  flow: number;
  drop: number;
  spread: number;
  /** The line it lands along (x0, z0, x1, z1). */
  ends: [number, number, number, number];
}
export interface PoolNode {
  id: number;
  top: number;
  level: number;
  centre: [number, number];
  inflow: number;
  outflow: number;
  /** Where water comes in: the spring (top pool) or the falls from above. */
  inflows: Inflow[];
  /** The water's velocity sampled over the pool, for the debug view: x, z, vx, vz each. */
  arrows: [number, number, number, number][];
  /** The water's velocity over the pool (for the debug view's particles). */
  field: FlowField;
}
export interface OutletNode {
  pool: number;
  main: boolean;
  /** The lowest crest along the stretch. */
  crest: number;
  width: number;
  flow: number;
  /** The pool it falls into (−1: off the terrace, onto the meadow). */
  to: number;
  lip: LipPoint[];
  /** The middle of the lip. */
  at: [number, number, number];
  /** Where its fall lands (set once it is made). */
  landing?: [number, number, number];
}
export interface Terrace {
  meshes: BasinMesh[];
  /** Each plate's top (its rim), lowest first. */
  tops: number[];
  /** Each plate's water level, lowest first. */
  levels: number[];
  pools: PoolNode[];
  outlets: OutletNode[];
  /** The falls between the plates (the lowest plate's are the water system's: water.ts). */
  falls: FallMesh[];
}

export function buildTerrace(rules: ReturnType<typeof groundRules>, grid: HeightGrid, p: TerraceParams, flow: number): Terrace {
  const anchor = rules.meadow(rules.frame.basin[0], rules.frame.basin[1], -100);
  const tops = rules.plates.map((pl) => anchor + pl.top);
  const n = rules.plates.length;
  const levels: number[] = new Array(n), meshes: BasinMesh[] = new Array(n), pools: PoolNode[] = new Array(n);
  const outlets: OutletNode[] = [], falls: FallMesh[] = [];
  // The outlets pouring into each pool, from the pool above (their falls are made once the pool's
  // level is known: they fall to it).
  const pouring: OutletNode[][] = Array.from({ length: n }, () => []);

  for (let k = n - 1; k >= 0; k--) {
    const pl = rules.plates[k], outline = rules.plate(k), [cx, cz] = pl.centre;
    const plan = rules.outlets[k];
    // The outline's points, outward normals and arc length.
    const pts = Array.from({ length: SEGMENTS }, (_, i) => {
      const a = (i / SEGMENTS) * 2 * Math.PI, m = outlineRadius(pl.centre, outline, a, 0);
      const x = cx + Math.cos(a) * m, z = cz + Math.sin(a) * m, e = 0.2;
      const gx = outline(x + e, z) - outline(x - e, z), gz = outline(x, z + e) - outline(x, z - e), gl = Math.hypot(gx, gz) || 1;
      return { x, z, nx: gx / gl, nz: gz / gl };
    });
    const ds = new Float64Array(SEGMENTS), arc = new Float64Array(SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      const j = (i + 1) % SEGMENTS;
      ds[i] = Math.hypot(pts[j].x - pts[i].x, pts[j].z - pts[i].z);
      if (i) arc[i] = arc[i - 1] + ds[i - 1];
    }
    const perimeter = arc[SEGMENTS - 1] + ds[SEGMENTS - 1];
    const alongTo = (i: number, s: number) => { const d = Math.abs(arc[i] - s) % perimeter; return Math.min(d, perimeter - d); };
    // The inflow: the spring's, or what the outlets above pour in.
    const inflow = k === n - 1 ? flow : pouring[k].reduce((t, o) => t + o.flow, 0);
    // The crest: level but for each outlet's hollow; the rim thicker there. A dam grows to the
    // water it carries: the main hollow is at least DAM times as deep as the whole inflow needs
    // over the hollow's breadth (so more water deepens the spillway, not floods the whole rim).
    const crest = new Float64Array(SEGMENTS), rim = new Float64Array(SEGMENTS);
    const breadth = 2.5 * plan[0].reach;
    const scale = Math.max(p.dip, DAM * (inflow / (WEIR * breadth)) ** (2 / 3)) / plan[0].dip;
    const marks = plan.map((o) => arc[Math.round(((((o.angle / (2 * Math.PI)) % 1) + 1) % 1) * SEGMENTS) % SEGMENTS]);
    for (let i = 0; i < SEGMENTS; i++) {
      let dip = 0, near = 0;
      plan.forEach((o, m) => {
        const d = alongTo(i, marks[m]);
        // Only the main outlet deepens to carry the flow; the others keep their own hollows.
        dip += o.dip * (o.main ? scale : p.dip / plan[0].dip) * Math.exp(-(d * d) / (2 * o.reach * o.reach));
        near = Math.max(near, Math.exp(-(d * d) / (2 * (o.reach * 1.6) ** 2)));
      });
      crest[i] = tops[k] - dip + 0.03 * rules.noise(arc[i] / 20 + 11 * k, 3.7 * k);
      rim[i] = p.rim * (1 + THICKEN * near);
    }
    // The level that passes the inflow.
    const spilt = (level: number) => {
      let q = 0;
      for (let i = 0; i < SEGMENTS; i++) if (level > crest[i]) q += WEIR * (level - crest[i]) ** 1.5 * ds[i];
      return q;
    };
    let lo = Math.min(...crest), hi = lo + 3;
    for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (spilt(m) < inflow) lo = m; else hi = m; }
    const level = (lo + hi) / 2;
    levels[k] = level;
    // Where the water comes in: the spring (across the pool from its main outlet), or the falls from
    // above, landing on this level.
    const inflows: Inflow[] = k === n - 1
      ? [(() => {
        const a = plan[0].angle + Math.PI, m = 0.6 * outlineRadius(pl.centre, outline, a, 0);
        const x = cx + Math.cos(a) * m, z = cz + Math.sin(a) * m;
        return { x, z, flow, drop: 0, spread: 2, ends: [x, z, x, z] as [number, number, number, number] };
      })()]
      : pouring[k].map((o) => {
        const fall = fallMesh({ lip: o.lip, below: () => level, offset: 0.6 });
        falls.push(fall);
        o.landing = fall.landing;
        return { x: fall.landing[0], z: fall.landing[2], flow: o.flow, drop: fall.drop, spread: fall.spread, ends: fall.ends };
      });
    // The outlets: each continuous spilling stretch.
    const over = (i: number) => level > crest[((i % SEGMENTS) + SEGMENTS) % SEGMENTS];
    let start = 0;
    while (start < SEGMENTS && over(start)) start++;
    const mine: OutletNode[] = [];
    for (let s = 0; s < SEGMENTS && start < SEGMENTS; s++) {
      const i0 = start + s;
      if (!over(i0) || over(i0 - 1)) continue;
      const lip: LipPoint[] = [];
      let width = 0, q = 0, lowest = Infinity, main = false;
      for (let i = i0; over(i) && i - i0 < SEGMENTS; i++) {
        const j = i % SEGMENTS, h = level - crest[j], qi = WEIR * h ** 1.5;
        lip.push({ x: pts[j].x, y: level, z: pts[j].z, dx: pts[j].nx, dz: pts[j].nz, q: qi });
        width += ds[j]; q += qi * ds[j]; lowest = Math.min(lowest, crest[j]);
        if (alongTo(j, marks[0]) < plan[0].reach * 2) main = true;
      }
      if (lip.length < 2) continue;
      const mid = lip[Math.floor(lip.length / 2)];
      mine.push({ pool: k, main, crest: lowest, width, flow: q, to: k - 1, lip, at: [mid.x, mid.y, mid.z] });
    }
    // Its outflow is its inflow (the level was solved for it); share it out exactly among the
    // outlets (the sum over the discrete rim differs from the bisected target by a hair).
    const total = mine.reduce((t, o) => t + o.flow, 0) || 1;
    for (const o of mine) { const f = (o.flow / total) * inflow; for (const lp of o.lip) lp.q *= f / o.flow; o.flow = f; }
    outlets.push(...mine);
    if (k > 0) pouring[k - 1].push(...mine);
    // The flow in the pool: potential flow over its water, from its inflows to its outlets' lips.
    // The water: inside the rim, outside the plate standing in it; and on over the rim where it
    // spills. The step round the outline at (x, z): by its angle from the centre (as pts are).
    const upper = k < n - 1 ? rules.plate(k + 1) : null;
    const stepAt = (x: number, z: number) => ((Math.round((Math.atan2(z - cz, x - cx) / (2 * Math.PI)) * SEGMENTS) % SEGMENTS) + SEGMENTS) % SEGMENTS;
    const floor = { centre: level - p.depth, edge: level - Math.min(SHALLOW, p.depth) };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of pts) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z); }
    const x0 = minX - 2, z0 = minZ - 2, nx = Math.ceil((maxX - minX + 4) / FLOW_CELL) + 1, nz = Math.ceil((maxZ - minZ + 4) / FLOW_CELL) + 1;
    const mask = new Uint8Array(nx * nz), depthOf = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * FLOW_CELL, z = z0 + j * FLOW_CELL, o = outline(x, z), s = stepAt(x, z);
      const open = o < -rim[s] - 0.3 && (!upper || upper(x, z) > 0.3);
      const spilling = o < 0.2 && over(s);
      if (!open && !spilling) continue;
      const t = j * nx + i;
      mask[t] = 1;
      // Its depth: over the dish (deepest at the centre, as the floor's fan) or over the crest.
      const reach = Math.hypot(pts[s].x - cx, pts[s].z - cz) - rim[s];
      depthOf[t] = open ? level - (floor.centre + (floor.edge - floor.centre) * Math.min(Math.hypot(x - cx, z - cz) / Math.max(reach, 1), 1)) : Math.max(level - crest[s], 0.05);
    }
    const sources: Source[] = [
      ...inflows.map((q) => ({ x: q.x, z: q.z, flow: q.flow, radius: Math.max(q.spread * 0.8, 3) })),
      ...mine.flatMap((o) => o.lip.map((lp) => ({ x: lp.x, z: lp.z, flow: -lp.q * (o.width / o.lip.length), radius: 2.5 }))),
    ];
    const { qx, qz } = potentialFlow({ x0, z0, step: FLOW_CELL, nx, nz, mask }, sources);
    const clampSpeed = (vx: number, vz: number): [number, number] => {
      const speed = Math.hypot(vx, vz);
      return speed > FASTEST ? [(vx / speed) * FASTEST, (vz / speed) * FASTEST] : [vx, vz];
    };
    const field: FlowField = { x0, z0, step: FLOW_CELL, nx, nz, mask, vx: new Float32Array(nx * nz), vz: new Float32Array(nx * nz) };
    for (let t = 0; t < nx * nz; t++) {
      if (!mask[t]) continue;
      [field.vx[t], field.vz[t]] = clampSpeed(qx[t] / Math.max(depthOf[t], 0.12), qz[t] / Math.max(depthOf[t], 0.12));
    }
    const flowAt = (x: number, z: number, depth: number): [number, number] => {
      const q = sampleField(field, qx, qz, x, z);
      return q ? clampSpeed(q[0] / Math.max(depth, 0.12), q[1] / Math.max(depth, 0.12)) : [0, 0];
    };
    // Fluted where water runs down the wall.
    const flutes = new Float64Array(SEGMENTS);
    const reach = Math.ceil(FLUTE_REACH / (perimeter / SEGMENTS));
    for (let i = 0; i < SEGMENTS; i++) {
      if (!over(i)) continue;
      for (let d = -reach; d <= reach; d++) {
        const j = (i + d + SEGMENTS) % SEGMENTS;
        flutes[j] = Math.max(flutes[j], 1 - Math.abs(d) / (reach + 1));
      }
    }
    meshes[k] = basinMesh({
      centre: pl.centre, outline, ground: (x, z) => sampleGrid(grid, x, z), crest, level,
      floor, rim, flutes, flow: flowAt,
    });
    // The flow, sampled every ARROW metres over the pool's water (for the debug view).
    const arrows: [number, number, number, number][] = [];
    const every = Math.round(ARROW / FLOW_CELL);
    for (let j = 0; j < nz; j += every) for (let i = 0; i < nx; i += every) {
      const t = j * nx + i;
      if (mask[t]) arrows.push([x0 + i * FLOW_CELL, z0 + j * FLOW_CELL, field.vx[t], field.vz[t]]);
    }
    pools[k] = { id: k, top: tops[k], level, centre: pl.centre, inflow, outflow: mine.reduce((t, o) => t + o.flow, 0), inflows, arrows, field };
  }
  return { meshes, tops, levels, pools, outlets, falls };
}

/**
 * The heights that cast shadows: the ground, and over each plate its top (lowest first, so an
 * upper plate stands on a lower). For baking the light (heightGrid.ts bakeLight).
 */
export function castHeights(rules: ReturnType<typeof groundRules>, grid: HeightGrid, tops: number[]): HeightGrid {
  const data = grid.data.slice();
  const { size, texel } = grid;
  const plates = rules.plates.map((_, k) => rules.plate(k));
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i - (size - 1) / 2) * texel, z = (j - (size - 1) / 2) * texel;
      const t = (j * size + i) * 4;
      plates.forEach((plate, k) => { if (plate(x, z) < 0) data[t] = Math.max(data[t], tops[k]); });
    }
  }
  return { ...grid, data };
}
