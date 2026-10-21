import type { IslandParams } from '../params/island';
import type { IslandField } from './island';
import { SIZES } from '../scale';

/**
 * Footpaths between two points the visitor picks (Class 06, paths). Pure: same ends, same path.
 *
 * 1. Ends: the visitor's two clicks, snapped to the nearest walkable ground.
 * 2. Route: A* on a grid over the island. A step costs its length times (1 + steepness²), so the
 *    path winds along the slopes the way a mountain path does; pools and sheer rock are walls.
 *    This is the terrain shaping the line.
 *    Where a pool or a deep gully blocks the way, a step may leap straight across it: a bridge.
 * 3. Line: the grid route is smoothed with a Catmull-Rom spline and resampled every STEP metres,
 *    then draped on the ground. Where the grade is steep the path becomes stone steps.
 *    The line then shapes the world in turn: grass and flowers keep off it.
 */
const GRID = 96;
const STEP = SIZES.path.sample; // metres between path samples
const STEEP = 0.22; // grade (rise over run) above which the path turns into steps
const WALL_SLOPE = 0.9; // steeper than this cannot be walked
export const PATH_WIDTH = SIZES.path.width; // metres (GB 51192: stair paths at least 1.5 m)
const REUSE = 0.35; // walking on an existing path costs this share of fresh ground
const LEAP_MAX = 12; // longest leap, in grid cells (also limited by SPAN_MAX)
const SPAN_MAX = SIZES.path.spanMax; // longest stone arch, metres
const GAP_DEPTH = SIZES.path.gullyDepth; // metres below the deck that count as a deep gully
const BRIDGE_GRADE = 0.3; // a bridge's deck may not climb steeper than this
const BRIDGE_COST = 1.4; // a metre of bridge costs this much more than a metre of flat ground
const BRIDGE_FIXED = 3; // plus this many metres' worth, once per bridge


export interface PathPoint {
  x: number;
  y: number;
  z: number;
  /** Unit direction of travel on the ground plane. */
  tx: number;
  tz: number;
  /** True where the grade is steep enough for steps. */
  step: boolean;
  /** Index of the bridge this point is on, or -1 on the ground. */
  bridge: number;
}

/** A span where the path leaves the ground: a stone arch over a pool or a deep gully. */
export interface Bridge {
  a: [number, number, number];
  b: [number, number, number];
  length: number;
  /** First and last path points on the deck. */
  first: number;
  last: number;
}

export interface IslandPath {
  points: PathPoint[];
  /** Where the path starts and ends (x, z). */
  landing: [number, number];
  /** The end of the path on the ground (x, y, z). */
  lookout: [number, number, number];
  /** Whether a ground point lies on the path (within its width plus a margin). */
  near(x: number, z: number, margin?: number): boolean;
  bridges: Bridge[];
  /** Ground height under any point (0 past the rim), for drawing on the island. */
  heightAt(x: number, z: number): number;
}

/** A coarse grid marking where paths run, for fast "is this on a path" lookups (grass, A* reuse). */
export interface PathMask {
  has(x: number, z: number): boolean;
}

const MASK_CELL = 1; // metres per cell of the path mask

export function pathMask(paths: IslandPath[], p: IslandParams, margin: number, clearings: [number, number, number][] = []): PathMask {
  const extent = p.radius * 1.4;
  const N = Math.min(Math.ceil((2 * extent) / MASK_CELL), 2048);
  const cell = (2 * extent) / N;
  const grid = new Uint8Array(N * N);
  const mark = (x: number, z: number, r: number) => {
    const i0 = Math.floor((x - r + extent) / cell), i1 = Math.floor((x + r + extent) / cell);
    const j0 = Math.floor((z - r + extent) / cell), j1 = Math.floor((z + r + extent) / cell);
    for (let j = Math.max(j0, 0); j <= Math.min(j1, N - 1); j++) {
      for (let i = Math.max(i0, 0); i <= Math.min(i1, N - 1); i++) {
        const cx = -extent + (i + 0.5) * cell, cz = -extent + (j + 0.5) * cell;
        if (Math.hypot(cx - x, cz - z) <= r) grid[j * N + i] = 1;
      }
    }
  };
  const half = PATH_WIDTH / 2 + margin;
  for (const path of paths) for (const q of path.points) mark(q.x, q.z, half);
  for (const [x, z, r] of clearings) mark(x, z, r);
  return {
    has(x, z) {
      const i = Math.floor((x + extent) / cell), j = Math.floor((z + extent) / cell);
      return i >= 0 && j >= 0 && i < N && j < N && grid[j * N + i] === 1;
    },
  };
}


const inPoolOf = (field: IslandField) => (x: number, z: number) => field.pools.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius * 1.2);

/**
 * A path between two points the visitor chose. The ends are the intent;
 * the terrain decides the route. Cells on `reuse` (paths already walked) cost less, so new paths
 * join old ones and a network grows, like paths trodden into a hillside.
 */
export function routePath(field: IslandField, p: IslandParams, from2: [number, number], to2: [number, number], reuse?: PathMask): IslandPath | null {
  const extent = p.radius * 1.05;
  const cell = (2 * extent) / GRID;
  const inPool = inPoolOf(field);
  const landing = from2;
  const endY = field.top(to2[0], to2[1]);
  if (endY === null) return null;
  const lookout: [number, number, number] = [to2[0], endY, to2[1]];

  // A* over grid cells. Every cell inside the rim has a ground height; walkable cells are dry and
  // inside 0.95 of the rim. Besides the 8 neighbours, a step may leap 2..LEAP_MAX cells straight
  // across a gap (a pool, or ground well below the line between the two ends): that leap is a
  // bridge. It costs more than walking, so a bridge appears only where going round costs more.
  const index = (x: number, z: number) => [Math.floor((x + extent) / cell), Math.floor((z + extent) / cell)];
  const centre = (i: number, j: number) => [-extent + (i + 0.5) * cell, -extent + (j + 0.5) * cell];
  const ground = new Float32Array(GRID * GRID).fill(NaN);
  const pool = new Uint8Array(GRID * GRID);
  const height = new Float32Array(GRID * GRID).fill(NaN);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const [x, z] = centre(i, j);
      const y = field.top(x, z);
      if (y === null || Math.hypot(x, z) >= field.rim(Math.atan2(z, x)) * 0.95) continue;
      const k = j * GRID + i;
      ground[k] = y;
      pool[k] = inPool(x, z) ? 1 : 0;
      if (!pool[k]) height[k] = y;
    }
  }
  const [si, sj] = index(landing[0], landing[1]);
  const [ei, ej] = index(lookout[0], lookout[2]);
  // A click on a pool or the very edge snaps to the nearest walkable cell.
  const snap = (i: number, j: number) => {
    for (let r = 0; r <= 4; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && nj >= 0 && ni < GRID && nj < GRID && !Number.isNaN(height[nj * GRID + ni])) return nj * GRID + ni;
        }
      }
    }
    return -1;
  };
  const start = snap(si, sj), goal = snap(ei, ej);
  if (start < 0 || goal < 0 || start === goal) return null;
  const cost = new Float64Array(GRID * GRID).fill(Infinity);
  const from = new Int32Array(GRID * GRID).fill(-1);
  const leapTo = new Uint8Array(GRID * GRID); // 1 where the best way in is a bridge
  const done = new Uint8Array(GRID * GRID);
  const h = (n: number) => Math.hypot((n % GRID) - ei, Math.floor(n / GRID) - ej) * cell;
  const open: { n: number; f: number }[] = [{ n: start, f: h(start) }];
  cost[start] = 0;
  const gapDepth = GAP_DEPTH;
  const relax = (n: number, m: number, c: number, leap: 0 | 1) => {
    if (c < cost[m]) {
      cost[m] = c;
      from[m] = n;
      leapTo[m] = leap;
      open.push({ n: m, f: c + h(m) });
    }
  };
  while (open.length) {
    let k = 0;
    for (let m = 1; m < open.length; m++) if (open[m].f < open[k].f) k = m;
    const { n } = open.splice(k, 1)[0];
    if (done[n]) continue;
    done[n] = 1;
    if (n === goal) break;
    const i = n % GRID, j = Math.floor(n / GRID);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        // Walking to a neighbour.
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID) continue;
        const m = nj * GRID + ni;
        const run = Math.hypot(di, dj) * cell;
        if (!Number.isNaN(height[m])) {
          const grade = Math.abs(height[m] - height[n]) / run;
          if (grade <= WALL_SLOPE) {
            const [cx, cz] = centre(ni, nj);
            relax(n, m, cost[n] + run * (1 + 25 * grade * grade) * (reuse?.has(cx, cz) ? REUSE : 1), 0);
          }
        }
        // Leaping a gap: every cell in between is a pool or lies well below the deck.
        for (let L = 2; L <= LEAP_MAX; L++) {
          const li = i + di * L, lj = j + dj * L;
          if (li < 0 || lj < 0 || li >= GRID || lj >= GRID) break;
          const t = lj * GRID + li;
          if (Number.isNaN(height[t])) continue;
          const span = Math.hypot(di, dj) * L * cell;
          if (span > SPAN_MAX) break;
          if (Math.abs(height[t] - height[n]) / span > BRIDGE_GRADE) break;
          let gap = true;
          for (let q = 1; q < L && gap; q++) {
            const c = (j + dj * q) * GRID + (i + di * q);
            const deck = height[n] + ((height[t] - height[n]) * q) / L;
            gap = !Number.isNaN(ground[c]) && (pool[c] === 1 || ground[c] < deck - gapDepth);
          }
          if (gap) relax(n, t, cost[n] + span * BRIDGE_COST + BRIDGE_FIXED, 1);
          break; // the first walkable cell along the line ends the leap either way
        }
      }
    }
  }
  if (from[goal] === -1) return null;
  const nodes: { at: [number, number]; leap: boolean }[] = [];
  for (let n = goal; n !== -1; n = from[n]) nodes.unshift({ at: centre(n % GRID, Math.floor(n / GRID)) as [number, number], leap: leapTo[n] > 0 });
  nodes[0].at = landing;
  nodes[nodes.length - 1].at = [lookout[0], lookout[2]];

  // Pieces: runs of walked cells (smoothed) and bridges (straight, end to end).
  const pieces: { pts: [number, number][]; bridge: boolean }[] = [];
  let walked: [number, number][] = [nodes[0].at];
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].leap) {
      pieces.push({ pts: walked, bridge: false });
      pieces.push({ pts: [nodes[i - 1].at, nodes[i].at], bridge: true });
      walked = [nodes[i].at];
    } else walked.push(nodes[i].at);
  }
  pieces.push({ pts: walked, bridge: false });

  const smooth = (route: [number, number][]) => {
    if (route.length < 3) return route;
    // Catmull-Rom through every second cell.
    const ctrl = route.filter((_, i) => i % 2 === 0 || i === route.length - 1);
    const dense: [number, number][] = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
      for (let k = 0; k < 8; k++) {
        const t = k / 8, t2 = t * t, t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    dense.push(ctrl[ctrl.length - 1]);
    return dense;
  };

  const step = STEP;
  const points: PathPoint[] = [];
  const bridges: Bridge[] = [];
  for (const piece of pieces) {
    if (piece.pts.length < 2) continue;
    const dense = piece.bridge ? piece.pts : smooth(piece.pts);
    let deck: [number, number] | null = null;
    if (piece.bridge) {
      const [a, b] = piece.pts;
      const ya = field.top(a[0], a[1]) ?? 0, yb = field.top(b[0], b[1]) ?? 0;
      deck = [ya, yb];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      bridges.push({ a: [a[0], ya, a[1]], b: [b[0], yb, b[1]], length, first: points.length, last: points.length });
    }
    // Even resampling along this piece; on a bridge the height follows the deck, not the ground.
    const lens = dense.slice(1).map((q, i) => Math.hypot(q[0] - dense[i][0], q[1] - dense[i][1]));
    const pieceLen = lens.reduce((x, y) => x + y, 0);
    let total = 0;
    let carry = 0;
    for (let i = 0; i < dense.length - 1; i++) {
      const [ax, az] = dense[i], [bx, bz] = dense[i + 1];
      const len = lens[i];
      if (len < 1e-6) continue;
      for (let d = carry; d < len; d += step) {
        const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
        const along = (total + d) / Math.max(pieceLen, 1e-6);
        const y = deck ? deck[0] + (deck[1] - deck[0]) * along : field.top(x, z);
        if (y !== null) points.push({ x, y, z, tx: (bx - ax) / len, tz: (bz - az) / len, step: false, bridge: deck ? bridges.length - 1 : -1 });
      }
      carry = (carry - len) % step;
      if (carry < 0) carry += step;
      total += len;
    }
    if (deck) bridges[bridges.length - 1].last = points.length - 1;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    b.step = b.bridge < 0 && a.bridge < 0 && Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z) > STEEP;
  }

  // Nearness on a coarse grid of the path's samples.
  const width = PATH_WIDTH;
  const near = (x: number, z: number, margin = 0) => points.some((q) => Math.hypot(x - q.x, z - q.z) < width / 2 + margin);
  return { points, landing, lookout, near, bridges, heightAt: (x, z) => field.top(x, z) ?? 0 };
}
