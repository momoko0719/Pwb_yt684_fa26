import type { HeightGrid } from './heightGrid';

/**
 * Routes over a height grid for water that must reach a goal (a stream to its outlet on the rim):
 * the cheapest way by Dijkstra's search over the texels (eight neighbours), each step costing its
 * length, much more for every metre it climbs (water runs downhill wherever it can, and over a low
 * rise only where it must), and more near routes already taken (streams keep apart). Cells marked
 * blocked (the terrace) are never entered. Returns the route as world points, smoothed.
 */
export interface RouteCosts {
  /** Cost per metre climbed (on top of the step's length). */
  climb: number;
  /** Extra cost per step within `apart` metres of an earlier route, at most. */
  crowd: number;
  apart: number;
}
export const ROUTE_COSTS: RouteCosts = { climb: 60, crowd: 6, apart: 18 };

/** A binary min-heap of texel indices keyed by cost. */
class Heap {
  private keys: Float64Array;
  private items: Int32Array;
  size = 0;
  constructor(capacity: number) {
    this.keys = new Float64Array(capacity);
    this.items = new Int32Array(capacity);
  }
  push(item: number, key: number) {
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p]; this.items[i] = this.items[p]; i = p;
    }
    this.keys[i] = key; this.items[i] = item;
  }
  pop(): number {
    const top = this.items[0];
    const key = this.keys[--this.size], item = this.items[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.keys[c + 1] < this.keys[c]) c++;
      if (this.keys[c] >= key) break;
      this.keys[i] = this.keys[c]; this.items[i] = this.items[c]; i = c;
    }
    this.keys[i] = key; this.items[i] = item;
    return top;
  }
}

/** Texels within `apart` metres of the given routes: how near (1 at a route, 0 at `apart`). */
export function crowding(g: HeightGrid, routes: [number, number][][], apart: number): Float32Array {
  const { size, texel } = g;
  const near = new Float32Array(size * size);
  const r = Math.ceil(apart / texel);
  for (const route of routes) {
    for (const [x, z] of route) {
      const ci = Math.round(x / texel + (size - 1) / 2), cj = Math.round(z / texel + (size - 1) / 2);
      for (let j = Math.max(cj - r, 0); j <= Math.min(cj + r, size - 1); j++) {
        for (let i = Math.max(ci - r, 0); i <= Math.min(ci + r, size - 1); i++) {
          const d = Math.hypot(i - ci, j - cj) * texel;
          if (d < apart) near[j * size + i] = Math.max(near[j * size + i], 1 - d / apart);
        }
      }
    }
  }
  return near;
}

/**
 * The cheapest route from (x0, z0) to any texel where `goal` holds; null if none is reached.
 * `blocked` texels are never entered; `near` (from crowding) adds the crowding cost.
 */
export function route(g: HeightGrid, x0: number, z0: number, goal: (t: number) => boolean, blocked: Uint8Array, near: Float32Array, c: RouteCosts = ROUTE_COSTS): [number, number][] | null {
  const { size, texel, data } = g;
  const n = size * size;
  const cost = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const heap = new Heap(n * 8); // a texel may be pushed once per neighbour
  const start = Math.round(z0 / texel + (size - 1) / 2) * size + Math.round(x0 / texel + (size - 1) / 2);
  cost[start] = 0;
  heap.push(start, 0);
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let end = -1;
  while (heap.size) {
    const t = heap.pop();
    if (goal(t)) { end = t; break; }
    const i = t % size, j = (t / size) | 0, h = data[t * 4];
    for (const [di, dj] of steps) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= size || nj >= size) continue;
      const m = nj * size + ni;
      if (blocked[m]) continue;
      const run = Math.hypot(di, dj) * texel;
      const rise = Math.max(data[m * 4] - h, 0);
      const k = cost[t] + run * (1 + c.crowd * near[m]) + c.climb * rise;
      if (k < cost[m]) { cost[m] = k; from[m] = t; heap.push(m, k); }
    }
  }
  if (end < 0) return null;
  const cells: [number, number][] = [];
  for (let t = end; t >= 0; t = from[t]) cells.push([((t % size) - (size - 1) / 2) * texel, (((t / size) | 0) - (size - 1) / 2) * texel]);
  cells.reverse();
  return smooth(cells);
}

/** Chaikin's corner cutting, three times (the texel steps' corners become curves), ends kept. */
function smooth(points: [number, number][]): [number, number][] {
  let p = points;
  for (let pass = 0; pass < 3 && p.length > 2; pass++) {
    const q: [number, number][] = [p[0]];
    for (let k = 0; k + 1 < p.length; k++) {
      const [ax, az] = p[k], [bx, bz] = p[k + 1];
      q.push([0.75 * ax + 0.25 * bx, 0.75 * az + 0.25 * bz], [0.25 * ax + 0.75 * bx, 0.25 * az + 0.75 * bz]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

/** A route resampled every `step` metres. */
export function resample(points: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [points[0]];
  let carry = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    let s = step - carry;
    while (s <= len) {
      out.push([ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len]);
      s += step;
    }
    carry = len - (s - step);
  }
  const [lx, lz] = points[points.length - 1];
  const [ox, oz] = out[out.length - 1];
  if (Math.hypot(lx - ox, lz - oz) > step * 0.3) out.push([lx, lz]);
  return out;
}
