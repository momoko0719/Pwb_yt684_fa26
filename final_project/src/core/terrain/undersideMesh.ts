import { createNoise2D, fbm, type Noise2D } from '../noise';
import { createRng } from '../rng';
import { fixWinding } from './basinMesh';

/**
 * The island's underside as a mesh, after Penglai's (core/generators/island.ts, which the owner
 * likes): an inverted height field hanging from the side. A wall drops from the rim and rolls in,
 * how late it rolls in varying around the island (so the wall has broad vertical folds); under it
 * the rock keeps deepening toward the middle; a few blunt hanging rocks (inverted peaks: depth
 * (1 − u^p)^q across their footprint) join it by smooth union, one main rock deepest. Wonderland's
 * is plainer than Penglai's (the owner: fewer lines): ridges and lumps about half as strong.
 *
 * Built along rays from the island's centre to each rim point, sampled densely and resampled at
 * equal arc length, so the steep wall and the rock sides get as many rings as the flatter parts.
 * Plain arrays, so it can be built in a worker and sent back.
 */
export interface UndersideShape {
  /** The rim: a ring of points (x, z, height), around the origin. */
  rim: Float32Array;
  /** Where the underside starts (the side's wall ends): height. */
  top: number;
  /** The main hanging rock's place (x, z) and how far below `top` it hangs. */
  keel: [number, number];
  depth: number;
  /** Hanging rocks, the main one counted. */
  rocks: number;
  seed: number;
}

export interface UndersideMesh {
  positions: Float32Array;
  normals: Float32Array;
  occlusion: Float32Array;
  indices: Uint32Array;
}

type Range = [number, number];
const lerp = ([a, b]: Range, t: number) => a + (b - a) * Math.min(Math.max(t, 0), 1);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

const WALL_DEPTH = 0.3; // the wall drops this far before rolling in, share of the mean radius
const WALL_POWER = 6; // how late it rolls in (higher: upright nearer the rim)
const WALL_VARIATION = 0.4; // broad variation of the roll-in around the island
const WALL_RIDGES = 0.15; // vertical folds on the wall (Penglai: 0.3)
const WALL_RIDGE_FREQ = 3;
const CEILING_SLOPE = 0.45; // under the wall the rock deepens toward the middle (no flat ceiling)
const ROCK_SHAPE: Range = [2.6, 2]; // p (blunt bottom), q (flared root)
const MAIN_ROCK_RADIUS = 0.5; // share of the mean radius
const SIDE_ROCK_RADIUS: Range = [0.26, 0.38];
const SIDE_ROCK_DEPTH: Range = [0.45, 0.75]; // share of the main rock's depth
const ROCK_REACH = 0.8; // rocks stay within this share of the rim
const ROCK_SPACING = 0.45; // rock centres this many summed radii apart
const ROCK_WOBBLE = 0.16;
const ROCK_RIDGES = 0.04; // (Penglai: 0.08)
const ROCK_BLEND = 0.5; // smooth union width, share of the mean radius
const LUMPS = 0.04; // broad lumps over it all, share of the mean radius (Penglai: 0.1)
const SAMPLES = 160; // along each ray, before resampling
const RINGS = 72; // rings after resampling
const STRIDE = 1; // every rim point — matches rimWall density so the wall/underside join has no chord gaps

interface Rock { x: number; z: number; radius: number; depth: number }

function smoothMax(a: number, b: number, width: number) {
  const k = Math.min(width, a + b);
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
}

function rockDepth(noise: Noise2D, q: Rock, i: number, x: number, z: number) {
  const dx = x - q.x, dz = z - q.z, dist = Math.hypot(dx, dz);
  if (dist >= q.radius * (1 + ROCK_WOBBLE + ROCK_RIDGES + 0.1)) return 0;
  const cx = dx / (dist || 1), cz = dz / (dist || 1);
  const lobes = fbm(noise, cx * 1.4 + i * 5.3 + 100, cz * 1.4 - i * 2.9, { octaves: 2 });
  const n = noise(cx * 3 + i * 3.3 - 40, cz * 3 - i * 1.7 + 20);
  const ridge = (1 - Math.sqrt(n * n + 0.02)) ** 2;
  const outline = q.radius * (1 + ROCK_WOBBLE * lobes + ROCK_RIDGES * (ridge - 0.5));
  const u = Math.min(dist / outline, 1);
  return q.depth * Math.pow(1 - Math.pow(u, ROCK_SHAPE[0]), ROCK_SHAPE[1]);
}

export function undersideMesh(s: UndersideShape): UndersideMesh {
  const rng = createRng(s.seed + 91);
  const noise = createNoise2D(s.seed + 92);
  const n = s.rim.length / 3;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += Math.hypot(s.rim[i * 3], s.rim[i * 3 + 1]) / n;
  const rimAt = (angle: number) => {
    const k = Math.round((((angle / (2 * Math.PI)) % 1) + 1) % 1 * n) % n;
    return Math.hypot(s.rim[k * 3], s.rim[k * 3 + 1]);
  };

  // The rocks: the main one at the keel; the others placed by seeded rejection.
  const fits = (x: number, z: number, r: number) => Math.hypot(x, z) + r <= ROCK_REACH * rimAt(Math.atan2(z, x));
  const rocks: Rock[] = [{ x: s.keel[0], z: s.keel[1], radius: MAIN_ROCK_RADIUS * mean, depth: s.depth }];
  for (let i = 0; i < s.rocks - 1; i++) {
    const rank = (i + rng()) / Math.max(s.rocks - 1, 1);
    let size = mean * lerp(SIDE_ROCK_RADIUS, 0.7 * rank + 0.3 * rng());
    for (let attempt = 0; attempt < 60; attempt++, size *= 0.96) {
      const a = rng() * 2 * Math.PI, d = Math.sqrt(rng()) * ROCK_REACH * mean;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (fits(x, z, size) && rocks.every((q) => Math.hypot(q.x - x, q.z - z) > ROCK_SPACING * (q.radius + size))) {
        rocks.push({ x, z, radius: size, depth: s.depth * lerp(SIDE_ROCK_DEPTH, rank) });
        break;
      }
    }
  }

  // Depth below `top` at a point at share rho of the way out along its ray.
  const wallPower = (angle: number) => {
    const cx = Math.cos(angle), cz = Math.sin(angle);
    const broad = fbm(noise, cx * 0.8 + 40, cz * 0.8 - 40, { octaves: 2 });
    const fold = noise(cx * WALL_RIDGE_FREQ - 70, cz * WALL_RIDGE_FREQ + 90);
    const ridge = (1 - Math.sqrt(fold * fold + 0.01)) ** 2 - 0.45;
    return WALL_POWER * (1 + WALL_VARIATION * broad + WALL_RIDGES * ridge);
  };
  const depthAt = (x: number, z: number, rho: number, power: number) => {
    const inner = 1 - smooth(0.85, 1, rho);
    let depth = mean * (WALL_DEPTH * Math.sqrt(Math.max(1 - rho ** power, 0)) + CEILING_SLOPE * (1 - rho) ** 1.2);
    rocks.forEach((q, i) => { depth = smoothMax(depth, inner * rockDepth(noise, q, i, x, z), ROCK_BLEND * mean); });
    return depth + inner * LUMPS * mean * fbm(noise, (x / mean) * 2.5 + 30, (z / mean) * 2.5 - 60, { octaves: 3 });
  };

  // Scaled so the deepest point (under one of the rocks) hangs exactly `depth` below the top.
  const raw = depthAt;
  let deepest = 0;
  for (const q of rocks) {
    const angle = Math.atan2(q.z, q.x), rho = Math.hypot(q.x, q.z) / rimAt(angle);
    deepest = Math.max(deepest, raw(q.x, q.z, rho, wallPower(angle)));
  }
  const scale = s.depth / Math.max(deepest, 1);
  const depthOf = (x: number, z: number, rho: number, power: number) => raw(x, z, rho, power) * scale;

  // Rays from the rim in to the centre, resampled at equal arc length.
  const rays = Math.floor(n / STRIDE);
  const positions = new Float32Array(rays * (RINGS + 1) * 3);
  const pts = new Float64Array((SAMPLES + 1) * 3), len = new Float64Array(SAMPLES + 1);
  for (let r = 0; r < rays; r++) {
    const k = r * STRIDE, ex = s.rim[k * 3], ez = s.rim[k * 3 + 1];
    const power = wallPower(Math.atan2(ez, ex));
    for (let j = 0; j <= SAMPLES; j++) {
      const rho = 1 - j / SAMPLES, x = ex * rho, z = ez * rho;
      pts[j * 3] = x; pts[j * 3 + 1] = s.top - depthOf(x, z, rho, power); pts[j * 3 + 2] = z;
      if (j) len[j] = len[j - 1] + Math.hypot(x - pts[j * 3 - 3], pts[j * 3 + 1] - pts[j * 3 - 2], z - pts[j * 3 - 1]);
    }
    for (let q = 0, j = 0; q <= RINGS; q++) {
      const target = (len[SAMPLES] * q) / RINGS;
      while (j < SAMPLES - 1 && len[j + 1] < target) j++;
      const f = Math.min(Math.max((target - len[j]) / (len[j + 1] - len[j] || 1), 0), 1);
      for (let c = 0; c < 3; c++) positions[(r * (RINGS + 1) + q) * 3 + c] = pts[j * 3 + c] + (pts[j * 3 + 3 + c] - pts[j * 3 + c]) * f;
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < rays; r++) {
    const o = ((r + 1) % rays) * (RINGS + 1), a0 = r * (RINGS + 1);
    for (let q = 0; q < RINGS; q++) indices.push(a0 + q, o + q, a0 + q + 1, a0 + q + 1, o + q, o + q + 1);
  }
  // Normals from the faces around each vertex, turned to face out and down.
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    // Facing down, or out from the centre where it stands upright (the wall).
    if (fy > 0 || (Math.abs(fy) < 1e-6 && fx * positions[a] + fz * positions[a + 2] < 0)) { fx = -fx; fy = -fy; fz = -fz; }
    for (const v of [a, b, c]) { normals[v] += fx; normals[v + 1] += fy; normals[v + 2] += fz; }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const l = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= l; normals[v + 1] /= l; normals[v + 2] /= l;
  }
  const idx = Array.from(indices);
  fixWinding(Array.from(positions), Array.from(normals), idx);
  const occlusion = new Float32Array(positions.length / 3).fill(0.85);
  return { positions, normals, occlusion, indices: new Uint32Array(idx) };
}
