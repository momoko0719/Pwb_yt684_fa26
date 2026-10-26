/**
 * A level block holding a pool, generated as a mesh from its outline: the shape is swept around
 * the outline as a profile (a cross-section): the outer wall rising from below the ground, a
 * rounded edge, the rim, a rounded inner edge, the inner wall down to the floor with a fillet, the
 * floor. Each ring of the profile follows the outline set in by the profile's distance, so the
 * walls are exactly vertical and the edges exactly round at any distance; one mesh, no level of
 * detail.
 *
 * The rim's crest is not level: its height is given for each step round the outline (`crest`), and
 * where it stands below the water (`level`) the water spills over it, the sheet running out over
 * the rim. Under those stretches the outer wall is fluted (`flutes`): rounded ribs, as travertine
 * grows where water runs down a face, the rest of the wall left smooth.
 *
 * Plain arrays, so it can be built in a worker and sent back.
 */
export interface BasinShape {
  /** The outline's centre: it must see the whole outline (rays from it cross the outline once). */
  centre: [number, number];
  /** The outline's signed distance (negative inside), metres. */
  outline: (x: number, z: number) => number;
  /** The ground beneath, for where the outer wall starts (FOOT below it). */
  ground: (x: number, z: number) => number;
  /** The rim's crest, per step round the outline (step i at angle 2π i / n from the centre, from +x toward +z). */
  crest: Float64Array;
  /** The water's level. */
  level: number;
  /** The floor: a dish, deepest at the centre, shallowest along the inner wall's foot. */
  floor: { centre: number; edge: number };
  /** Width of the rim at each step, metres (wider where water spills: a dam thickens at its lip). */
  rim: Float64Array;
  /** How fluted the outer wall is at each step (0 smooth, 1 fully). */
  flutes: Float64Array;
  /** The water's velocity at a point of the pool (x, z), given its depth there: m/s, x and z. */
  flow: (x: number, z: number, depth: number) => [number, number];
}

export interface BasinMesh {
  positions: Float32Array;
  normals: Float32Array;
  occlusion: Float32Array;
  indices: Uint32Array;
  /** The pool's water; per vertex its depth and its flow (x, z, metres a second: toward the spills). */
  water: { positions: Float32Array; depths: Float32Array; flow: Float32Array; indices: Uint32Array };
}

const OUTER_BEVEL = 0.6; // metres: the rounding of the outer edge
const INNER_BEVEL = 0.3; // and of the inner edge
const FILLET = 0.4; // where the inner wall meets the floor
const ARC = 4; // segments in each rounding
const FOOT = 3; // metres the outer wall starts below the ground (deeper than a pool dug at its foot)
const FLUTE_DEPTH = 0.3; // metres a flute's rib stands out from the wall
const FLUTE_PERIOD = 3; // metres between ribs, on average

/** A point of the profile: inward offset from the outline (given the rim here), height (given the crest here), normal (outward, up), occlusion, how much of the wall's fluting it takes. */
interface ProfilePoint { d: (rim: number) => number; y: (crest: number) => number; nOut: number; nUp: number; occ: number; flute: number }
// Rings of the water's sheet, from the centre out, closer toward the edge (where the water quickens
// toward an outlet; evenly spaced they were 7 m apart on a 100 m pool, coarser than the quickening).
const WATER_RINGS = 22;
const RING_PACK = 1.7;

export function basinMesh(s: BasinShape): BasinMesh {
  const [cx, cz] = s.centre;
  const n = s.crest.length;
  const profile: ProfilePoint[] = [];
  const push = (d: (rim: number) => number, y: (c: number) => number, nOut: number, nUp: number, occ: number, flute = 0) => profile.push({ d, y, nOut, nUp, occ, flute });
  const edgeFloor = s.floor.edge;
  // The outer wall's foot is set per vertex (below the ground there): marked by y = NaN here.
  push(() => 0, () => NaN, 1, 0, 0.75, 1);
  push(() => 0, (c) => c - OUTER_BEVEL, 1, 0, 1, 1);
  for (let k = 1; k <= ARC; k++) {
    const a = (k / ARC) * (Math.PI / 2);
    push(() => -OUTER_BEVEL + OUTER_BEVEL * Math.cos(a), (c) => c - OUTER_BEVEL + OUTER_BEVEL * Math.sin(a), Math.cos(a), Math.sin(a), 1, Math.cos(a));
  }
  for (let k = 0; k <= ARC; k++) {
    const a = Math.PI / 2 + (k / ARC) * (Math.PI / 2);
    push((rim) => -(rim - INNER_BEVEL) + INNER_BEVEL * Math.cos(a), (c) => c - INNER_BEVEL + INNER_BEVEL * Math.sin(a), Math.cos(a), Math.sin(a), 1);
  }
  push((rim) => -rim, () => edgeFloor + FILLET, -1, 0, 0.8);
  for (let k = 1; k <= ARC; k++) {
    const a = -(k / ARC) * (Math.PI / 2);
    push((rim) => -rim - FILLET + FILLET * Math.cos(a), () => edgeFloor + FILLET + FILLET * Math.sin(a), -Math.cos(a), -Math.sin(a), 0.7);
  }

  const along = (angle: number, d: number) => outlineRadius(s.centre, s.outline, angle, d);
  // The outline's own points and arc length, for the flutes' spacing.
  const edge = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI, m = along(a, 0);
    return [cx + Math.cos(a) * m, cz + Math.sin(a) * m];
  });
  const arc = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) arc[i] = arc[i - 1] + Math.hypot(edge[i % n][0] - edge[i - 1][0], edge[i % n][1] - edge[i - 1][1]);
  // The ribs: a smooth wave along the arc (round ribs and round hollows: |sin| left a sharp crease
  // in every hollow, read through the water as a ridge), their spacing wandering a little.
  const rib = (t: number) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / FLUTE_PERIOD + 0.8 * Math.sin(t / 7.3));
  const ribSlope = (t: number) => (rib(t + 0.05) - rib(t - 0.05)) / 0.1;

  const rings = profile.length;
  const positions: number[] = [], normals: number[] = [], occlusion: number[] = [], indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI;
    const flute = s.flutes[i] * FLUTE_DEPTH;
    for (let r = 0; r < rings; r++) {
      const p = profile[r];
      const m = along(angle, p.d(s.rim[i]));
      let x = cx + Math.cos(angle) * m, z = cz + Math.sin(angle) * m;
      // Outward across the outline here (its gradient), horizontal; along it.
      const e = 0.1;
      let gx = s.outline(x + e, z) - s.outline(x - e, z), gz = s.outline(x, z + e) - s.outline(x, z - e);
      const gl = Math.hypot(gx, gz) || 1;
      gx /= gl; gz /= gl;
      let nOut = p.nOut, nAlong = 0;
      if (p.flute > 0 && flute > 0) {
        const out = flute * p.flute * rib(arc[i]);
        x += gx * out; z += gz * out;
        nAlong = -flute * p.flute * ribSlope(arc[i]) * nOut;
      }
      const y = Number.isNaN(p.y(s.crest[i])) ? s.ground(x, z) - FOOT : p.y(s.crest[i]);
      positions.push(x, y, z);
      // The along direction is (−gz, gx) (toward the next step).
      const nx = gx * nOut - gz * nAlong, nz = gz * nOut + gx * nAlong;
      const nl = Math.hypot(nx, p.nUp, nz) || 1;
      normals.push(nx / nl, p.nUp / nl, nz / nl);
      occlusion.push(p.occ * (p.flute > 0 ? 1 - 0.25 * s.flutes[i] * (1 - rib(arc[i])) : 1));
    }
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (let r = 0; r + 1 < rings; r++) {
      const a = i * rings + r, b = j * rings + r;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // The floor: a fan from the centre (its deepest) to the last ring: a dish.
  const centre = positions.length / 3;
  positions.push(cx, s.floor.centre, cz);
  normals.push(0, 1, 0);
  occlusion.push(0.75);
  for (let i = 0; i < n; i++) indices.push(centre, ((i + 1) % n) * rings + rings - 1, i * rings + rings - 1);
  fixWinding(positions, normals, indices);

  // The water: rings from the centre out to just under the inner edge (hidden under it); where the
  // crest is below the water, smoothly on out over the rim to its outer edge (the water spilling).
  // Its depth over the dish of the floor, or over the crest; its flow from the rule (s.flow).
  const wp: number[] = [], wd: number[] = [], wf: number[] = [], wi: number[] = [];
  const floorAt = (f: number) => s.floor.centre + (edgeFloor - s.floor.centre) * f; // as the floor's fan: linear out from the centre
  const vertex = (x: number, z: number, depth: number) => {
    wp.push(x, s.level, z);
    wd.push(depth);
    const [vx, vz] = s.flow(x, z, depth);
    wf.push(vx, vz);
  };
  vertex(cx, cz, s.level - s.floor.centre);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI;
    const over = smooth(0, 0.03, s.level - s.crest[i]);
    const inner = along(angle, -s.rim[i] - FILLET), outer = along(angle, -s.rim[i] + 0.25 + over * (s.rim[i] - 0.2));
    for (let j = 1; j <= WATER_RINGS; j++) {
      const m = outer * (1 - (1 - j / WATER_RINGS) ** RING_PACK);
      const depth = m <= inner ? s.level - floorAt(m / inner) : Math.max(s.level - s.crest[i], over > 0.5 ? 0.02 : s.level - edgeFloor);
      vertex(cx + Math.cos(angle) * m, cz + Math.sin(angle) * m, depth);
    }
  }
  const ring = (i: number, j: number) => (j === 0 ? 0 : 1 + (i % n) * WATER_RINGS + (j - 1));
  for (let i = 0; i < n; i++) {
    wi.push(0, ring(i + 1, 1), ring(i, 1));
    for (let j = 1; j < WATER_RINGS; j++) wi.push(ring(i, j), ring(i + 1, j), ring(i, j + 1), ring(i + 1, j), ring(i + 1, j + 1), ring(i, j + 1));
  }
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals), occlusion: new Float32Array(occlusion), indices: new Uint32Array(indices),
    water: { positions: new Float32Array(wp), depths: new Float32Array(wd), flow: new Float32Array(wf), indices: new Uint32Array(wi) },
  };
}

/**
 * How far from the centre, along the ray at `angle`, the outline set in by d lies (bisected; d
 * negative is inside).
 */
export function outlineRadius(centre: [number, number], outline: (x: number, z: number) => number, angle: number, d = 0) {
  const [cx, cz] = centre, dx = Math.cos(angle), dz = Math.sin(angle);
  let lo = 0, hi = 1;
  while (outline(cx + dx * hi, cz + dz * hi) < d && hi < 1e4) hi *= 2;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (outline(cx + dx * m, cz + dz * m) < d) lo = m; else hi = m;
  }
  return lo;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Turn every triangle to face its vertices' normals (so the profile's order cannot flip a face). */
export function fixWinding(p: number[], n: number[], idx: number[]) {
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = n[a] + n[b] + n[c], ny = n[a + 1] + n[b + 1] + n[c + 1], nz = n[a + 2] + n[b + 2] + n[c + 2];
    if (fx * nx + fy * ny + fz * nz < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  }
}
