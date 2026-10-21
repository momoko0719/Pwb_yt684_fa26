import type { IslandParams } from '../params/island';
import { SIZES } from '../scale';
import type { IslandField } from './island';

/**
 * Where the rain goes (Class 03/04 map simulation: flow accumulation). Rain falls evenly on the
 * island; every patch of ground sends its water to its lowest neighbour, and the water a patch
 * carries is all the area upstream of it. Where that area passes a threshold a stream begins; the
 * stream widens as more ground drains into it, runs through the lake and the pools (they fill and
 * spill), and leaves the island over the rim, where it becomes one of the falls. So water has a
 * source and a destination, and everything flows toward Guixu.
 *
 * Pure: same field, same water.
 *
 * 1. Heights on a grid; hollows are filled (priority flood) so every cell drains to the rim,
 *    with a tiny slope across the filled flats so water still knows which way to go.
 * 2. Each cell drains to its lowest neighbour (D8); cells are visited from high to low, adding
 *    their area to the cell below.
 * 3. Streams are traced from each source down to where they join a larger one or leave the rim.
 */
const GRID = 256;
const EPS = 1e-3; // metres: the slope laid across filled flats
const SOURCE_AREA = SIZES.stream.sourceArea; // m² upstream where a stream begins
const SMOOTH = 2; // rounds of corner cutting on each stream line

export interface StreamPoint {
  x: number;
  y: number;
  z: number;
  /** Channel width in metres. */
  width: number;
  /** Upstream area in m². */
  area: number;
}

export interface WaterExit {
  /** Angle around the island where the stream leaves the rim. */
  angle: number;
  width: number;
  area: number;
}

export interface WaterSystem {
  streams: StreamPoint[][];
  /** Where streams leave the island, largest first. */
  exits: WaterExit[];
  /** Upstream area (m²) at a point, bilinear on the grid; 0 off the island. */
  areaAt(x: number, z: number): number;
}

/** Channel width for an upstream area: grows with its square root (design judgement, see docs/scale.md). */
export const streamWidth = (area: number) =>
  Math.min(SIZES.stream.width[1], SIZES.stream.width[0] * Math.sqrt(Math.max(area, SOURCE_AREA) / SOURCE_AREA));

export function createWaterSystem(field: IslandField, p: IslandParams): WaterSystem {
  const extent = p.radius * 1.4;
  const cell = (2 * extent) / GRID;
  const N = GRID;
  const at = (i: number) => -extent + (i + 0.5) * cell;
  const height = new Float64Array(N * N).fill(NaN);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) height[j * N + i] = field.top(at(i), at(j)) ?? NaN;
  const valid = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && !Number.isNaN(height[j * N + i]);
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // 1. Priority flood from the island's edge inward (a binary heap on filled height).
  const filled = new Float64Array(N * N).fill(NaN);
  const closed = new Uint8Array(N * N);
  const heap: number[] = [];
  const less = (a: number, b: number) => filled[a] < filled[b];
  const push = (k: number) => {
    heap.push(k);
    for (let c = heap.length - 1; c > 0;) {
      const parent = (c - 1) >> 1;
      if (!less(heap[c], heap[parent])) break;
      [heap[c], heap[parent]] = [heap[parent], heap[c]];
      c = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let c = 0; ;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === c) break;
        [heap[c], heap[m]] = [heap[m], heap[c]];
        c = m;
      }
    }
    return top;
  };
  const edge = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (!valid(i, j)) continue;
      if (NB.some(([di, dj]) => !valid(i + di, j + dj))) {
        const k = j * N + i;
        edge[k] = 1;
        filled[k] = height[k];
        closed[k] = 1;
        push(k);
      }
    }
  }
  while (heap.length) {
    const k = pop();
    const i = k % N, j = (k - i) / N;
    for (const [di, dj] of NB) {
      const ni = i + di, nj = j + dj;
      if (!valid(ni, nj)) continue;
      const m = nj * N + ni;
      if (closed[m]) continue;
      closed[m] = 1;
      filled[m] = Math.max(height[m], filled[k] + EPS);
      push(m);
    }
  }

  // 2. Each cell drains to its lowest neighbour; the edge drains off the island (-1).
  const down = new Int32Array(N * N).fill(-1);
  const order: number[] = [];
  for (let k = 0; k < N * N; k++) {
    if (Number.isNaN(filled[k])) continue;
    order.push(k);
    if (edge[k]) continue;
    const i = k % N, j = (k - i) / N;
    // Steepest descent: the neighbour with the greatest drop per metre.
    let best = -1, steepest = 0;
    for (const [di, dj] of NB) {
      const ni = i + di, nj = j + dj;
      if (!valid(ni, nj)) continue;
      const m = nj * N + ni;
      const drop = (filled[k] - filled[m]) / Math.hypot(di, dj);
      if (drop > steepest) [best, steepest] = [m, drop];
    }
    down[k] = best;
  }
  order.sort((a, b) => filled[b] - filled[a]);
  const area = new Float64Array(N * N);
  for (const k of order) {
    area[k] += cell * cell;
    if (down[k] >= 0) area[down[k]] += area[k];
  }

  // 3. Streams: from each source (a stream cell with no stream flowing in) down to a junction or
  // the rim. Inside the lake and the pools the water is standing, so the line breaks there.
  const isStream = (k: number) => area[k] >= SOURCE_AREA;
  const inflow = new Uint8Array(N * N);
  for (const k of order) if (isStream(k) && down[k] >= 0) inflow[down[k]] = 1;
  const visited = new Uint8Array(N * N);
  const standing = (x: number, z: number) => field.pools.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius * 0.9);
  const streams: StreamPoint[][] = [];
  const exits: WaterExit[] = [];
  const point = (k: number): StreamPoint => {
    const x = at(k % N), z = at(Math.floor(k / N));
    return { x, z, y: field.top(x, z) ?? height[k], width: streamWidth(area[k]), area: area[k] };
  };
  for (const k0 of order) {
    if (!isStream(k0) || inflow[k0]) continue;
    let line: StreamPoint[] = [];
    const flush = () => {
      if (line.length >= 2) streams.push(smooth(line, field));
      line = [];
    };
    for (let k = k0; ;) {
      const pt = point(k);
      if (standing(pt.x, pt.z)) flush();
      else line.push(pt);
      if (visited[k]) break; // joined a stream already traced
      visited[k] = 1;
      if (down[k] < 0) {
        exits.push({ angle: Math.atan2(pt.z, pt.x), width: pt.width, area: area[k] });
        break;
      }
      k = down[k];
    }
    flush();
  }
  exits.sort((a, b) => b.area - a.area);

  const areaAt = (x: number, z: number) => {
    const fx = (x + extent) / cell - 0.5, fz = (z + extent) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return 0;
    const u = fx - i, v = fz - j;
    const a = (ii: number, jj: number) => area[jj * N + ii];
    return (a(i, j) * (1 - u) + a(i + 1, j) * u) * (1 - v) + (a(i, j + 1) * (1 - u) + a(i + 1, j + 1) * u) * v;
  };
  return { streams, exits, areaAt };
}

/** Corner cutting (Chaikin): a grid staircase becomes a winding line; heights are re-read from the ground. */
function smooth(line: StreamPoint[], field: IslandField): StreamPoint[] {
  let pts = line;
  for (let r = 0; r < SMOOTH; r++) {
    const next: StreamPoint[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const mix = (t: number): StreamPoint => ({
        x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: 0,
        width: a.width + (b.width - a.width) * t, area: a.area + (b.area - a.area) * t,
      });
      next.push(mix(0.25), mix(0.75));
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts.map((q) => ({ ...q, y: field.top(q.x, q.z) ?? q.y }));
}
