/**
 * A waterfall as a sheet following the water's own path, from a lip that is a run of points along a
 * rim's outer edge (so it follows the rim's curve, and starts exactly where the pool's water runs out
 * over the rim). Each point carries its own flow per metre q: over a lip the water runs at the
 * critical depth h = (q² / g)^(1/3), at speed √(g h). Where that is slow (a thin film: the ends of a
 * spilling stretch, a small outlet) the water clings to the face, a hand's breadth off it; where it
 * is fast it leaves the face and falls free on its parabola (x = v t, y = −g t² / 2). Each column
 * runs down to whatever is below and records where it lands; the shader (fallMaterial.ts) thins
 * the sheet into strands and whitens it as it speeds up, more where the flow is greater.
 *
 * Plain arrays, so it can be built in a worker and sent back.
 */
export interface LipPoint {
  x: number;
  y: number;
  z: number;
  /** Outward from the face (x, z; unit). */
  dx: number;
  dz: number;
  /** Flow per metre of lip, m²/s. */
  q: number;
}

export interface FallShape {
  lip: LipPoint[];
  /** The height of whatever the water falls onto, at (x, z). */
  below: (x: number, z: number) => number;
  /** Metres it falls at most (over the rim, into the cloud below, it is lost to sight). */
  maxDrop?: number;
  /** Metres a clinging film keeps off the face (more where the face is fluted). */
  offset?: number;
}

export interface FallMesh {
  positions: Float32Array;
  /**
   * Per vertex: metres along the lip, seconds since the water left the lip (τ: the shader carries
   * its detail by τ − time, so it can only move down, at the water's own speed), metres fallen,
   * speed.
   */
  flow: Float32Array;
  /**
   * Per vertex: share of its column's way down (0 at the lip, 1 where it lands); the flow per metre
   * of lip above it (m²/s); metres above where its column lands (LOST where it is followed down
   * no further, into the cloud, and lands nowhere in sight).
   */
  extra: Float32Array;
  indices: Uint32Array;
  /** Where it lands: the flow-weighted middle (x, y, z), its spread (metres), total flow (m³/s), mean drop (m). */
  landing: [number, number, number];
  /** The line it lands along: the first and last flowing columns' landings (x0, z0, x1, z1). */
  ends: [number, number, number, number];
  spread: number;
  total: number;
  drop: number;
}

const G = 9.81;
const STEP = 0.04; // seconds between rows down the sheet
const CLING: [number, number] = [0.45, 0.9]; // m/s over a lip: below the first the film clings, above the second it falls free
const CLEAR_DROP = 0.8; // metres below the lip by which the sheet is clear of the face
/** Metres above its landing, for a column followed down no further (it lands out of sight). */
export const LOST = 1000;

/** The speed over a lip for a flow per metre q (critical flow over a crest). */
export function lipSpeed(q: number) {
  return Math.sqrt(G * Math.cbrt((q * q) / G));
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function fallMesh(s: FallShape): FallMesh {
  const cols = s.lip.length, off = s.offset ?? 0.12;
  // Each column's path, down to where it lands. Once it has dropped below the rim's rounded edge it
  // keeps at least `off` from the face (a free fall barely past the lip ran into the flutes).
  const paths = s.lip.map((p) => {
    const v0 = lipSpeed(Math.max(p.q, 1e-5)), free = smooth(CLING[0], CLING[1], v0);
    const pts: [number, number, number, number][] = []; // x, y, z, t
    let lands = false;
    for (let t = 0; t < 12; t += STEP) {
      const clear = off * smooth(0, CLEAR_DROP, 0.5 * G * t * t);
      const out = Math.max(free * v0 * t + (1 - free) * Math.min(v0 * t, off), clear);
      const x = p.x + p.dx * out, z = p.z + p.dz * out, y = p.y - 0.5 * G * t * t;
      pts.push([x, y, z, t]);
      if (y < s.below(x, z)) { lands = true; break; }
      if (p.y - y > (s.maxDrop ?? Infinity)) break;
    }
    return { pts, v0, lands };
  });
  const rows = Math.max(...paths.map((c) => c.pts.length));
  // Metres along the lip, at each column.
  const along = [0];
  for (let c = 1; c < cols; c++) along.push(along[c - 1] + Math.hypot(s.lip[c].x - s.lip[c - 1].x, s.lip[c].z - s.lip[c - 1].z));
  const positions: number[] = [], flow: number[] = [], extra: number[] = [], indices: number[] = [];
  for (let r = 0; r < rows; r++) {
    paths.forEach(({ pts, v0, lands }, c) => {
      const k = Math.min(r, pts.length - 1), [x, y, z, t] = pts[k];
      positions.push(x, y, z);
      flow.push(along[c], t, s.lip[c].y - y, Math.hypot(v0, G * t));
      extra.push(pts.length > 1 ? k / (pts.length - 1) : 1, s.lip[c].q, lands ? y - pts[pts.length - 1][1] : LOST);
    });
  }
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c, b = a + cols;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // Where it lands, weighted by flow.
  let wx = 0, wy = 0, wz = 0, weight = 0, drop = 0;
  const lands = paths.map(({ pts }, c) => {
    const [x, y, z] = pts[pts.length - 1], w = s.lip[c].q;
    wx += x * w; wy += y * w; wz += z * w; weight += w; drop += (s.lip[c].y - y) * w;
    return [x, z];
  });
  const sum = weight || 1;
  const mid: [number, number, number] = [wx / sum, wy / sum, wz / sum];
  const spread = Math.max(...lands.map(([x, z]) => Math.hypot(x - mid[0], z - mid[2])), 0.5);
  // The line it lands along: from the first to the last column carrying a tenth of the most.
  const most = Math.max(...s.lip.map((p) => p.q));
  const flowing = lands.filter((_, c) => s.lip[c].q > 0.1 * most);
  const [a, b] = [flowing[0] ?? [mid[0], mid[2]], flowing[flowing.length - 1] ?? [mid[0], mid[2]]];
  // The total flow: the mean flow per metre times the lip's length.
  let length = 0;
  for (let c = 0; c + 1 < cols; c++) length += Math.hypot(s.lip[c + 1].x - s.lip[c].x, s.lip[c + 1].z - s.lip[c].z);
  return {
    positions: new Float32Array(positions), flow: new Float32Array(flow), extra: new Float32Array(extra), indices: new Uint32Array(indices),
    landing: mid, ends: [a[0], a[1], b[0], b[1]], spread, total: (weight / Math.max(cols, 1)) * Math.max(length, 0.1), drop: drop / sum,
  };
}
