import { createNoise2D } from '../../core/noise';
import { createRng } from '../../core/rng';
import { fallMesh, type FallMesh, type LipPoint } from '../../core/terrain/fallMesh';
import { fillGradients, sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { potentialFlow, sampleField, type FlowField, type Source } from '../../core/terrain/potentialFlow';
import { crowding, resample, route } from '../../core/terrain/routes';
import type { groundRules } from './ground';
import type { Terrace } from './terrace';

/**
 * Where the terrace's water goes after the terrace (terrace.ts holds the pools and their outlets):
 * the lowest pool's main outlet falls onto the meadow, where it has dug a plunge pool, a teardrop
 * pointing the way the water was thrown; any other outlet of that pool falls into a small basin of
 * its own, and a runnel takes its water on into the plunge pool. From the plunge pool's tip one
 * channel leads on, narrowing as it goes, and divides into streams that run each its own way to the
 * island's rim and pour over it into the cloud below (all water flows to Guixu).
 *
 * The water below the terrace is one body, not pieces laid side by side: every part (the plunge
 * pool, the channel, the fork, each stream) sets the water's level and its velocity over the
 * ground it covers, on the ground's own grid (1 m), where parts meet the levels and velocities are
 * blended, and the whole is one mesh at that level. Its shore is where the level meets the ground,
 * found per pixel by the water's shader (the first version laid a ribbon per stream and a fan for
 * the pool, their edges overlapping at the fork and their shores zigzagging with the triangles).
 *
 * Shares: the streams divide the flow by how steeply each one's bed falls over its first 80 m
 * (a channel carries in proportion to the root of its slope, as Manning's rule goes, for the same
 * section): the steepest is the main stream. Each one's width (√ its flow, as rivers' go) follows
 * from its share, and what the streams carry sums to what comes down the channel.
 *
 * Each stream's way: its own outlet, a sector of the rim within the fan ahead, the cheapest way
 * there (routes.ts: downhill cheap, climbing dear, near another stream dear), then meanders laid
 * along it, on to the rim's very edge. Its level only falls along it, and never stands above the
 * ground on either bank (so the bed holds the water on a slope across it).
 *
 * Every point where water lands (each fall into a pool, the plunge pool's) is an impact: the line
 * it lands along, its flow and drop, shared by the water's shader (it stirs there, settling with
 * distance) and the debug view.
 */
export interface WaterParams {
  /** Cubic metres a second through the system (the spring's). */
  flow: number;
  /** Streams the channel divides into. */
  streams: number;
  /** Radians the fan of streams spans either side of the way the water was thrown. */
  fan: number;
  /** How far a stream's meanders swing either side of its way, metres. */
  meander: number;
}
// The owner's settings (2026-10-25): a full flow, four streams spread wide, gentle meanders.
export const WATER_DEFAULTS: WaterParams = { flow: 15.1, streams: 4, fan: 1.4, meander: 3.5 };

const PLUNGE = { depth: 1.6, water: 0.3 }; // metres: the plunge pool's depth, its water below the meadow
const BASIN = { radius: 3, water: 0.25, depth: 0.8 }; // a secondary outlet's own small basin
const CHANNEL = 26; // metres the single channel runs from the plunge pool before it divides
const STREAM = {
  width: 2.4, // metres of width per √(m³/s)
  water: 0.2, // metres the water stands below the lower bank
  bed: 0.6, // metres the bed lies below the water
  bank: 0.5, // the banks' slope outside the channel
  step: 2, // metres between a stream's points
  bend: 55, // metres between a meander's bends, on average (each between 0.6 and 1.4 times)
  depth: 0.45, // metres: the mean depth over a cross-section (for its speed)
};
const SHARE_REACH = 80; // metres of a stream's way over which its slope sets its share
const RIM_BAND = 3; // metres in from the rim where a stream's way ends (then runs on to the edge)
const RIM_LIP = 0.4; // metres in from the rim a stream pours over it
const BLOCK = 3; // metres around the terrace streams keep off
const OVER_RIM = 70; // metres a fall over the rim is followed down (then lost in the cloud)
const UNDER_BANK = 3; // texels the water's mesh runs on under the banks (hidden by them)
// Metres out from a bed's edge over which the ground must stand above the water: past the mesh's
// own edge (a bed's edge, 1.5 m of bank, UNDER_BANK). Only the bank half a metre out was asked at
// first: on a slope across a stream the ground further down fell below the water, and its sheet
// stood over the meadow to its mesh's hard edge.
const CONTAIN = 5;
const SMOOTHING = 3; // passes evening the level where parts meet

export interface WaterSheet { positions: Float32Array; depths: Float32Array; flow: Float32Array; indices: Uint32Array }
/** Where water lands: place (x, y, z), flow (m³/s), drop (m), spread (m), the line it lands along. */
export interface Impact { x: number; y: number; z: number; flow: number; drop: number; spread: number; ends: [number, number, number, number] }
export interface Water {
  falls: FallMesh[];
  impacts: Impact[];
  /** The water below the terrace: one sheet. */
  sheets: WaterSheet[];
  /** The ways (for the debug view): points (x, y, z), the flow each carries, whether it is the main stream. */
  ways: { points: [number, number, number][]; flow: number; main: boolean }[];
  /** The plunge pool: where, its radius, its level. */
  plunge: { x: number; z: number; radius: number; level: number };
  /**
   * Per texel of the grid, how much water stands there (0 to 1, by its depth): far off the ground
   * paints the water itself from this, where its coarse mesh spans a narrow channel and would hide
   * the water sheet below it (streams seen from afar broke into dashes).
   */
  mask: Uint8Array;
  /** The water's velocity and level over its cells (for the debug view's particles; level NaN off the mesh). */
  field: (FlowField & { level: Float32Array }) | null;
}

const smooth = (a: number, b: number, v: number) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
type Way = { points: [number, number][]; levels: number[] };

/**
 * Build the water below the terrace and cut its pools and channels into the ground (the grid is
 * changed in place, its gradients refilled).
 */
export function buildWater(rules: ReturnType<typeof groundRules>, grid: HeightGrid, terrace: Terrace, p: WaterParams, seed: number): Water {
  const rng = createRng(seed + 77);
  const { size, texel, data } = grid;
  const n = size * size;
  const at = (i: number) => (i - (size - 1) / 2) * texel;
  const index = (x: number) => Math.round(x / texel + (size - 1) / 2);
  const ground = (x: number, z: number) => sampleGrid(grid, x, z);
  const outline = (x: number, z: number) => sampleGrid(grid, x, z, 3);
  const outward = (x: number, z: number): [number, number] => {
    const e = 0.5, gx = outline(x + e, z) - outline(x - e, z), gz = outline(x, z + e) - outline(x, z - e), l = Math.hypot(gx, gz) || 1;
    return [gx / l, gz / l];
  };

  // The lowest pool's outlets fall onto the meadow; the main one's has dug the plunge pool.
  const bottom = terrace.outlets.filter((o) => o.pool === 0);
  if (!bottom.length) {
    // Nothing leaves the terrace (no flow): no plunge pool, no streams.
    return { falls: [...terrace.falls], impacts: [], sheets: [], ways: [], plunge: { x: 0, z: 0, radius: 0, level: 0 }, mask: new Uint8Array(n), field: null };
  }
  const main = bottom.reduce((a, b) => (b.flow > a.flow ? b : a));
  const probe = fallMesh({ lip: main.lip, below: ground, offset: 0.6 });
  const mid = main.lip[Math.floor(main.lip.length / 2)];
  const thrown = Math.atan2(mid.dz, mid.dx);
  const tx = Math.cos(thrown), tz = Math.sin(thrown);
  // Its size from what falls into it (wider for more water from higher), a teardrop pointing on.
  const radius = 3 + 0.6 * Math.sqrt(main.flow * probe.drop) + 0.5 * probe.spread;
  const pool: [number, number] = [probe.landing[0] + tx * radius * 0.25, probe.landing[2] + tz * radius * 0.25];
  // Distance out of the teardrop (negative inside; understated ahead): a circle behind, narrowing
  // ahead to its tip TEAR radii on.
  const TEAR = 1.6;
  const tear = (x: number, z: number) => {
    const dx = x - pool[0], dz = z - pool[1], ahead = dx * tx + dz * tz, side = Math.abs(-dx * tz + dz * tx);
    if (ahead <= 0) return Math.hypot(ahead, side) - radius;
    const length = radius * TEAR;
    if (ahead >= length) return Math.hypot(ahead - length, side);
    return (side - radius * (1 - ahead / length) ** 0.8) * 0.8;
  };
  // Its level: below the ground all round it, out past where its water's mesh ends (but not on
  // the terrace, which it stands against).
  let ring = ground(pool[0], pool[1]);
  for (let a = 0; a < 96; a++) {
    const ang = (a / 96) * 2 * Math.PI, cos = Math.cos(ang), sin = Math.sin(ang);
    for (let m = radius * 0.5; m < radius * (TEAR + 2); m += 0.5) {
      const x = pool[0] + cos * m, z = pool[1] + sin * m, d = tear(x, z);
      if (d < 1.5 || d > CONTAIN || rules.plate(0)(x, z) < 0.5) continue;
      ring = Math.min(ring, ground(x, z));
    }
  }
  const poolLevel = ring - PLUNGE.water;
  const tip: [number, number] = [pool[0] + tx * radius * TEAR, pool[1] + tz * radius * TEAR];

  // The other outlets of the lowest pool: each a small basin where it lands.
  const others = bottom.filter((o) => o !== main).map((o) => {
    const f = fallMesh({ lip: o.lip, below: ground, offset: 0.6 });
    const [x, , z] = f.landing;
    return { outlet: o, x, z, level: ground(x, z) - BASIN.water };
  });

  // The ways: one channel from the tip, then each stream to its own sector of the rim; a runnel
  // from each small basin to the plunge pool.
  // (A runnel starts at the terrace's foot: it keeps off the terrace itself only.)
  const blocked = new Uint8Array(n), foot = new Uint8Array(n);
  const terraceOutline = rules.plate(0);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const t = j * size + i, o = terraceOutline(at(i), at(j));
    if (data[t * 4 + 3] > -0.5 || o < BLOCK) blocked[t] = 1;
    if (data[t * 4 + 3] > -0.5 || o < 0.5) foot[t] = 1;
  }
  const none = new Float32Array(n);
  const split: [number, number] = [tip[0] + tx * CHANNEL, tip[1] + tz * CHANNEL];
  const trunk = route(grid, tip[0], tip[1], (t) => Math.hypot(at(t % size) - split[0], at((t / size) | 0) - split[1]) < 2, blocked, none) ?? [tip, split];
  const fork = trunk[trunk.length - 1];
  const found: [number, number][][] = [];
  for (let s = 0; s < p.streams; s++) {
    const aim = thrown + (p.streams > 1 ? (s / (p.streams - 1) - 0.5) * 2 * p.fan : 0);
    const sector = p.streams > 1 ? p.fan / (p.streams - 1) : Math.PI / 4;
    const goal = (t: number) => {
      const o = data[t * 4 + 3];
      if (o > -0.5 || o < -RIM_BAND) return false;
      const off = Math.atan2(at((t / size) | 0) - fork[1], at(t % size) - fork[0]) - aim;
      return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < sector / 2;
    };
    const way = route(grid, fork[0], fork[1], goal, blocked, crowding(grid, found.map((w) => w.slice(8)), 18));
    if (way && way.length > 2) found.push(way);
  }
  // On from where each way ends, outward to the rim's edge.
  const ways = found.map((way) => {
    const out = way.slice();
    let [x, z] = out[out.length - 1];
    for (let s = 0; s < 40 && outline(x, z) < -RIM_LIP; s++) {
      const [ux, uz] = outward(x, z), step = Math.min(0.5, -RIM_LIP - outline(x, z) + 0.01);
      x += ux * step; z += uz * step;
      out.push([x, z]);
    }
    return out;
  });
  const runnels = others.map((b) => route(grid, b.x, b.z, (t) => tear(at(t % size), at((t / size) | 0)) < -1, foot, none) ?? [[b.x, b.z], pool] as [number, number][]);

  // Shares by each stream's slope over its first SHARE_REACH metres (√ slope), summing to the flow.
  const slopeOf = (way: [number, number][]) => {
    const r = resample(way, 2), k = Math.min(SHARE_REACH / 2, r.length - 1);
    return Math.max((ground(...r[0]) - ground(...r[k])) / Math.max(k * 2, 1), 0.002);
  };
  const weights = ways.map((w) => Math.sqrt(slopeOf(w)));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const shares = weights.map((w) => (p.flow * w) / weightSum);
  const mainStream = shares.indexOf(Math.max(...shares));
  const widthOf = (q: number) => Math.min(Math.max(STREAM.width * Math.sqrt(q), 1.2), 14);

  // Each way: meanders laid along it (fading in and out), then its water level: only ever falling,
  // and below the lower of its banks (sampled across it, half a metre outside the bed).
  const wander = createNoise2D(seed + 78);
  const lay = (way: [number, number][], w: number, swing: number, start: number, halfAt: (k: number) => number): Way => {
    const base = resample(way, STREAM.step);
    base[base.length - 1] = way[way.length - 1];
    const total = (base.length - 1) * STREAM.step;
    let phase = rng() * 2 * Math.PI;
    const points = base.map(([x, z], k) => {
      const [ax, az] = base[Math.max(k - 1, 0)], [bx, bz] = base[Math.min(k + 1, base.length - 1)];
      const ux = bx - ax, uz = bz - az, ul = Math.hypot(ux, uz) || 1;
      const s = k * STREAM.step;
      phase += (2 * Math.PI * STREAM.step) / (STREAM.bend * (1 + 0.4 * wander(s / 70, w * 13.1)));
      const reach = swing * (0.75 + 0.6 * wander(s / 50 + 40, w * 7.7));
      const off = reach * Math.sin(phase) * smooth(0, 20, s) * smooth(0, 25, total - s);
      return [x - (uz / ul) * off, z + (ux / ul) * off] as [number, number];
    });
    const levels: number[] = [];
    points.forEach(([x, z], k) => {
      const [ax, az] = points[Math.max(k - 1, 0)], [bx, bz] = points[Math.min(k + 1, points.length - 1)];
      const ux = bx - ax, uz = bz - az, ul = Math.hypot(ux, uz) || 1;
      let low = ground(x, z);
      for (let side = halfAt(k) + 0.5; side <= halfAt(k) + CONTAIN; side += 1.5) {
        // (Not past the rim: there the ground falls away into the island's side.)
        for (const s of [-side, side]) {
          const gx = x - (uz / ul) * s, gz = z + (ux / ul) * s;
          if (outline(gx, gz) < -0.5) low = Math.min(low, ground(gx, gz));
        }
      }
      levels.push(Math.min(k ? levels[k - 1] : start, low - STREAM.water));
    });
    return { points, levels };
  };
  // Widths: the channel narrows from the teardrop's tip to its own width; each stream its share's.
  const tipWidth = radius * 0.9, channelWidth = widthOf(p.flow);
  const channelHalf = (k: number, m: number) => (tipWidth + (channelWidth - tipWidth) * smooth(0, 0.6, k / Math.max(m - 1, 1))) / 2;
  const streamHalf = (q: number) => (k: number) => (channelWidth + (widthOf(q) - channelWidth) * smooth(0, 8, k)) / 2;
  const trunkLength = resample(trunk, STREAM.step).length;
  const channel = lay(trunk, 99, p.meander * 0.3, poolLevel, (k) => channelHalf(k, trunkLength));
  const forkLevel = channel.levels[channel.levels.length - 1];
  const streams = ways.map((way, w) => lay(way, w, p.meander, forkLevel, streamHalf(shares[w])));
  const feeders = runnels.map((way, r) => lay(way, 50 + r, 1.5, others[r].level, () => widthOf(others[r].outlet.flow) / 2));

  // The plunge pool's flow: potential flow over the teardrop (potentialFlow.ts), from where the
  // falls land to its tip.
  const plungeField = (() => {
    const reach = radius * (TEAR + 1.2), step = 1;
    const x0 = pool[0] - reach, z0 = pool[1] - reach, cells = Math.ceil((2 * reach) / step) + 1;
    const mask = new Uint8Array(cells * cells);
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) if (tear(x0 + i * step, z0 + j * step) < 0.5) mask[j * cells + i] = 1;
    const [ex0, ez0, ex1, ez1] = probe.ends;
    const span = Math.max(Math.ceil(Math.hypot(ex1 - ex0, ez1 - ez0) / 2), 1);
    const sources: Source[] = [
      ...Array.from({ length: span + 1 }, (_, s) => ({ x: ex0 + ((ex1 - ex0) * s) / span, z: ez0 + ((ez1 - ez0) * s) / span, flow: main.flow / (span + 1), radius: 2 })),
      ...feeders.map((f, r) => ({ x: f.points[f.points.length - 1][0], z: f.points[f.points.length - 1][1], flow: others[r].outlet.flow, radius: 2 })),
      { x: tip[0] - tx * 1.5, z: tip[1] - tz * 1.5, flow: -p.flow, radius: Math.max(radius * 0.35, 2) },
    ];
    const { qx, qz } = potentialFlow({ x0, z0, step, nx: cells, nz: cells, mask }, sources);
    return { field: { x0, z0, step, nx: cells, nz: cells, mask }, qx, qz };
  })();

  // Every part over the ground: what it cuts, the water's level, how much it counts (for blending
  // levels and velocities where parts meet) and its velocity.
  const cut = new Float32Array(n);
  const level = new Float32Array(n).fill(-Infinity);
  const weight = new Float32Array(n), vxs = new Float32Array(n), vzs = new Float32Array(n);
  const part = (x0: number, z0: number, x1: number, z1: number, f: (x: number, z: number, h: number) => [number, number, number, number, number] | null) => {
    for (let j = Math.max(index(z0), 0); j <= Math.min(index(z1), size - 1); j++) {
      for (let i = Math.max(index(x0), 0); i <= Math.min(index(x1), size - 1); i++) {
        const t = j * size + i, r = f(at(i), at(j), data[t * 4]);
        if (!r) continue;
        const [c, water, w, vx, vz] = r;
        cut[t] = Math.max(cut[t], c);
        if (data[t * 4 + 3] > 0) continue; // past the rim: no water stands there
        level[t] = Math.max(level[t], water);
        weight[t] += w; vxs[t] += vx * w; vzs[t] += vz * w;
      }
    }
  };
  const reachOut = radius * 2.5;
  part(pool[0] - reachOut, pool[1] - reachOut, pool[0] + reachOut, pool[1] + reachOut, (x, z, h) => {
    const d = tear(x, z);
    // Its floor below its level (a dish), its banks rising from its shore.
    const c = Math.max(h - (poolLevel + PLUNGE.water - PLUNGE.depth * smooth(1.5, -3, d) + STREAM.bank * Math.max(d - 1.5, 0)), 0);
    if (d > 1.5) return c > 0 ? [c, -Infinity, 0, 0, 0] : null;
    const pd = Math.max(PLUNGE.depth * smooth(1.5, -3, d) - PLUNGE.water, 0.15);
    const q = sampleField(plungeField.field, plungeField.qx, plungeField.qz, x, z) ?? [0, 0];
    return [c, poolLevel, 1 - smooth(-2, 1.5, d), q[0] / pd, q[1] / pd];
  });
  for (const b of others) {
    part(b.x - 6, b.z - 6, b.x + 6, b.z + 6, (x, z) => {
      const d = Math.hypot(x - b.x, z - b.z) - BASIN.radius;
      if (d > 1.5) return null;
      return [BASIN.depth * smooth(1, -2, d), b.level, 1 - smooth(-1.5, 1.5, d), 0, 0];
    });
  }
  const along = ({ points, levels }: Way, halfAt: (k: number) => number, q: number) => {
    for (let k = 0; k + 1 < points.length; k++) {
      const [ax, az] = points[k], [bx, bz] = points[k + 1], half = halfAt(k), pad = half + 6;
      const ex = bx - ax, ez = bz - az, el = Math.hypot(ex, ez) || 1;
      const speed = Math.min(Math.max(q / (2 * half * STREAM.depth), 0.2), 2.5);
      part(Math.min(ax, bx) - pad, Math.min(az, bz) - pad, Math.max(ax, bx) + pad, Math.max(az, bz) + pad, (x, z, h) => {
        const t = Math.min(Math.max(((x - ax) * ex + (z - az) * ez) / (el * el), 0), 1);
        const d = Math.hypot(x - ax - ex * t, z - az - ez * t);
        const water = levels[k] + (levels[k + 1] - levels[k]) * t;
        const target = water - STREAM.bed * (1 - smooth(half - 1, half + 1.5, d)) + STREAM.bank * Math.max(d - half, 0);
        const c = Math.max(h - target, 0);
        if (d > half + 1.5) return c > 0 ? [c, -Infinity, 0, 0, 0] : null;
        // Along the way, fastest mid-stream; its weight falls off toward the banks (and so, where
        // parts meet, the nearer one leads).
        const v = speed * Math.max(1 - 0.8 * (d / half) ** 2, 0.2);
        return [c, water, (1 - smooth(half - 1, half + 1.5, d)) * 0.999 + 0.001, (ex / el) * v, (ez / el) * v];
      });
    }
  };
  along(channel, (k) => channelHalf(k, channel.points.length), p.flow);
  streams.forEach((st, w) => along(st, streamHalf(shares[w]), shares[w]));
  feeders.forEach((f, r) => along(f, () => widthOf(others[r].outlet.flow) / 2, others[r].outlet.flow));
  for (let t = 0; t < n; t++) data[t * 4] -= cut[t];
  fillGradients(grid);

  // The water's level evened where parts meet (over the water only), then run on a few texels
  // under the banks (hidden there; the shore itself is found per pixel), the velocity with it.
  const vx = new Float32Array(n), vz = new Float32Array(n);
  for (let t = 0; t < n; t++) if (weight[t] > 0) { vx[t] = vxs[t] / weight[t]; vz[t] = vzs[t] / weight[t]; }
  // In the shallows along a bank, no flow out toward the shore (the parts' velocities, blended at
  // a bend, could carry the water out over it): what runs toward the shallower side is taken off.
  {
    const depthAt = (t: number) => (level[t] > -Infinity ? level[t] - data[t * 4] : -1);
    const turned: [number, number, number][] = [];
    for (let t = 0; t < n; t++) {
      if (level[t] === -Infinity) continue;
      const dep = depthAt(t);
      if (dep > 0.4) continue;
      const i = t % size, j = (t / size) | 0;
      if (i < 1 || j < 1 || i >= size - 1 || j >= size - 1) continue;
      const gx = depthAt(t + 1) - depthAt(t - 1), gz = depthAt(t + size) - depthAt(t - size), gl = Math.hypot(gx, gz);
      if (gl < 1e-4) continue;
      const ux = gx / gl, uz = gz / gl, toward = vx[t] * ux + vz[t] * uz; // > 0: toward deeper water
      if (toward < 0) turned.push([t, vx[t] - toward * ux + 0.05 * ux, vz[t] - toward * uz + 0.05 * uz]);
    }
    for (const [t, a, b] of turned) { vx[t] = a; vz[t] = b; }
  }
  const neighbours = (t: number, f: (u: number) => void) => {
    const i = t % size, j = (t / size) | 0;
    if (i > 0) f(t - 1);
    if (i < size - 1) f(t + 1);
    if (j > 0) f(t - size);
    if (j < size - 1) f(t + size);
  };
  const wet: number[] = [];
  for (let t = 0; t < n; t++) if (level[t] > -Infinity) wet.push(t);
  for (let pass = 0; pass < SMOOTHING; pass++) {
    const next = level.slice();
    for (const t of wet) {
      let s = level[t], m = 1;
      neighbours(t, (u) => { if (level[u] > -Infinity) { s += level[u]; m++; } });
      next[t] = s / m;
    }
    level.set(next);
  }
  let edge = wet;
  for (let pass = 0; pass < UNDER_BANK; pass++) {
    const grown: number[] = [];
    const seen = new Set<number>();
    for (const t of edge) neighbours(t, (u) => { if (level[u] === -Infinity && data[u * 4 + 3] < 0.5) seen.add(u); });
    for (const u of seen) {
      let s = 0, a = 0, b = 0, m = 0;
      neighbours(u, (w) => { if (level[w] > -Infinity) { s += level[w]; a += vx[w]; b += vz[w]; m++; } });
      grown.push(u, s / m, a / m, b / m);
    }
    edge = [];
    for (let g = 0; g < grown.length; g += 4) {
      const u = grown[g];
      level[u] = grown[g + 1]; vx[u] = grown[g + 2]; vz[u] = grown[g + 3];
      edge.push(u);
    }
  }

  // The mesh: a vertex on every texel with water (or under a bank beside it), a quad where all
  // four corners have.
  const sheets: WaterSheet[] = [];
  const mask = new Uint8Array(n);
  let minI = size, maxI = -1, minJ = size, maxJ = -1;
  {
    const ids = new Int32Array(n).fill(-1);
    const pos: number[] = [], dep: number[] = [], flo: number[] = [], idx: number[] = [];
    for (let t = 0; t < n; t++) {
      if (level[t] === -Infinity) continue;
      const i = t % size, j = (t / size) | 0;
      ids[t] = pos.length / 3;
      pos.push(at(i), level[t], at(j));
      dep.push(level[t] - data[t * 4]);
      flo.push(vx[t], vz[t]);
      mask[t] = Math.round(255 * smooth(0, 0.25, level[t] - data[t * 4]));
      minI = Math.min(minI, i); maxI = Math.max(maxI, i); minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j);
    }
    for (let j = 0; j + 1 < size; j++) for (let i = 0; i + 1 < size; i++) {
      const t = j * size + i, a = ids[t], b = ids[t + 1], c = ids[t + size], d = ids[t + size + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      idx.push(a, c, b, b, c, d);
    }
    sheets.push({ positions: new Float32Array(pos), depths: new Float32Array(dep), flow: new Float32Array(flo), indices: new Uint32Array(idx) });
  }
  // The level as a field (bilinear over its water), for where falls land and the particles.
  let field: Water['field'] = null;
  if (maxI >= minI) {
    const nx = maxI - minI + 1, nz = maxJ - minJ + 1;
    field = { x0: at(minI), z0: at(minJ), step: texel, nx, nz, mask: new Uint8Array(nx * nz), vx: new Float32Array(nx * nz), vz: new Float32Array(nx * nz), level: new Float32Array(nx * nz).fill(NaN) };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const t = (j + minJ) * size + i + minI, u = j * nx + i;
      if (level[t] === -Infinity) continue;
      field.level[u] = level[t];
      field.vx[u] = vx[t]; field.vz[u] = vz[t];
      field.mask[u] = level[t] > data[t * 4] ? 1 : 0;
    }
  }
  const surface = (x: number, z: number) => {
    const s = field ? sampleField(field, field.level, field.level, x, z) : null;
    return s ? s[0] : -Infinity;
  };

  // The falls. The lowest pool's, onto the water below (or the meadow); the terrace's own between
  // its pools; each an impact where it lands.
  const impacts: Impact[] = [];
  const falls: FallMesh[] = [...terrace.falls];
  for (const o of bottom) {
    const fall = fallMesh({ lip: o.lip, offset: 0.6, below: (x, z) => Math.max(ground(x, z), surface(x, z)) });
    falls.push(fall);
    o.landing = fall.landing;
    impacts.push({ x: fall.landing[0], y: fall.landing[1], z: fall.landing[2], flow: o.flow, drop: fall.drop, spread: fall.spread, ends: fall.ends });
  }
  for (const pl of terrace.pools) for (const q of pl.inflows) if (q.drop > 0) impacts.push({ x: q.x, y: pl.level, z: q.z, flow: q.flow, drop: q.drop, spread: q.spread, ends: q.ends });
  // Over the rim, each stream into the cloud: its lip across its end (at the rim's edge, facing
  // straight out), the flow shared along it, fullest mid-stream.
  streams.forEach(({ points, levels }, w) => {
    const [lx, lz] = points[points.length - 1];
    const [dx, dz] = outward(lx, lz);
    const half = streamHalf(shares[w])(points.length), cols = 12;
    const lip: LipPoint[] = Array.from({ length: cols }, (_, c) => {
      const off = (c / (cols - 1) - 0.5) * 2 * half;
      return { x: lx - dz * off, y: levels[levels.length - 1], z: lz + dx * off, dx, dz, q: (shares[w] / (2 * half)) * 1.5 * (1 - ((2 * c) / (cols - 1) - 1) ** 2) };
    });
    falls.push(fallMesh({ lip, below: (x, z) => (outline(x, z) > 0 ? -Infinity : ground(x, z) - 1), maxDrop: OVER_RIM }));
  });
  const at3 = ({ points, levels }: Way) => points.map(([x, z], k) => [x, levels[k], z] as [number, number, number]);
  return {
    falls, impacts, sheets, mask, field,
    ways: [
      { points: at3(channel), flow: p.flow, main: true },
      ...streams.map((st, w) => ({ points: at3(st), flow: shares[w], main: w === mainStream })),
      ...feeders.map((f, r) => ({ points: at3(f), flow: others[r].outlet.flow, main: false })),
    ],
    plunge: { x: pool[0], z: pool[1], radius, level: poolLevel },
  };
}
