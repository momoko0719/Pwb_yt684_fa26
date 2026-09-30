import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createNoise2D, fbm, type Noise2D } from '../noise';
import { createRng } from '../rng';
import { SURFACE_RULES, type IslandParams } from '../params/island';
import { placePools, poolBasin, type Pool } from './pools';

/** fbm layers. Fixed: on a plateau this gentle, finer octaves fall below what the mesh can show. */
export const OCTAVES = 7;

/** Plateau, cliff and root profile. Lengths are fractions of `radius` unless noted. */
const PLATEAU_EDGE = 0.78; // fraction of the rim radius where the plateau starts to roll over
const PLATEAU_RELIEF = 0.06;
const SHOULDER_DROP = 0.1;
const SHOULDER_POWER = 2.5;
const RIM_WOBBLE = 0.3;
const RIM_BAYS = 0.65; // share of the rim wobble from the lowest frequency (large bays and headlands)
const FBM_GAIN = 0.5; // each fbm layer is half as strong as the one before

/**
 * Underside: an inverted height field under the plateau. A wall drops from the rim and rolls in,
 * and a few blunt hanging rocks (inverted peaks) hang from it, one main rock deepest.
 */
const WALL_DEPTH = 0.45; // the outer wall drops this far before rolling in, fraction of radius
const WALL_POWER = 6; // how late the wall rolls in: higher keeps it upright closer to the rim
const WALL_VARIATION = 0.4; // broad variation of the roll-in around the island
const WALL_RIDGES = 0.3; // vertical ridges on the wall, as variation of the roll-in
const WALL_ROUGHNESS = 0.3;
const WALL_RIDGE_FREQ = 3.5; // angular frequency of the wall ridges (about 8 to 12 around the island)
const CEILING_SLOPE = 0.7; // under the wall the rock keeps deepening toward the center, so there is no flat ceiling
// Rock depth follows (1 - u^p)^q across its footprint: q above 1 flares the root into the rock above,
// a large p keeps the bottom blunt. At taper 0 (blunt) and 1 (tapered).
const ROCK_SHAPE_P: Range = [3, 2];
const ROCK_SHAPE_Q: Range = [1.5, 3];
const MAIN_ROCK_RADIUS = 0.55; // footprint of the main hanging rock, fraction of radius
const MAIN_ROCK_OFFSET: Range = [0.08, 0.25]; // fraction of radius
const SIDE_ROCK_RADIUS: Range = [0.3, 0.42]; // fraction of radius
const SIDE_ROCK_DEPTH: Range = [0.5, 0.8]; // fraction of undersideDepth, spread evenly across the side rocks
const ROCK_REACH = 0.85; // rock footprints stay within this fraction of the rim
const ROCK_SPACING = 0.45; // rock centers stay this many summed radii apart, so they overlap but read as separate
const ROCK_SHRINK = 0.96;
const ROCK_WOBBLE = 0.18; // outline irregularity, fraction of the rock radius
const ROCK_RIDGES = 0.08; // vertical ridges down the rock sides, fraction of the rock radius
const ROCK_RIDGE_FREQ = 3;
const ROCK_BUMPS = 0.15; // outline irregularity from position noise, so ridges are not evenly spaced ribs
const ROCK_BLEND = 0.6; // smooth-union width between rocks and the rock above, fraction of radius
const UNDERSIDE_LUMPS = 0.1; // large lumps over the underside, fraction of radius
const UNDERSIDE_RINGS = 2; // underside rings per top ring
const UNDERSIDE_SAMPLES = 2; // samples per underside ring along each ray, before resampling by arc length
const ROCK_SEED_SALT = 0x85ebca6b;
/** Depth below the rim, fraction of radius, over which the underside's rim weight fades from 1 to 0. */
export const SEAM_BAND = 0.12;

/** Peak placement and shape. Peak radii are base radii, where the foot meets the plateau. */
const PEAK_LIMIT: Range = [0.4, 0.82]; // summits stay within this fraction of the rim at their angle, at peakSpread 0 and 1
const CLUSTER_RADIUS: Range = [0.2, 0.95]; // peak cluster radius at peakSpread 0 and 1, fraction of radius
const CLUSTER_OFFSET = 0.2; // a tight cluster sits off-center by this much, leaving plain on the far side
const PEAK_GAP: Range = [0.02, 0.12]; // minimum gap between summits at peakSpread 0 and 1
const MAIN_PEAK_RADIUS = 0.3;
const MAIN_OFFSET: Range = [0.1, 0.5]; // fraction of the cluster radius
const SPIRE_RADIUS: Range = [0.45, 0.8]; // fraction of the main peak radius
const SPIRE_HEIGHT: Range = [0.4, 0.7]; // fraction of peakHeight, spread evenly across the spires
const SPIRE_SHRINK = 0.96; // a spire that does not fit shrinks by this much per attempt
const PEAK_CORE = 0.3; // share of the base radius that must stay clear of other summits and the shoulder
const PEAK_POWER = 2.2; // height falls as (1 - d / base)^PEAK_POWER: steep near the summit, spreading at the foot
const SUMMIT_ROUND = 0.06; // summit rounding, fraction of the base radius
const PEAK_WOBBLE = 0.25; // outline irregularity, fraction of the base radius
const PEAK_RIDGES = 0.35; // spurs radiating from the summit: how far a ridge reaches past a gully, in base radii
const PEAK_RIDGE_FREQ = 2.4; // angular frequency of the spurs
const PEAK_BLEND = 0.2; // smooth-union width between neighbouring peaks, fraction of peakHeight
const PLACEMENT_TRIES = 60;
const PEAK_SEED_SALT = 0x9e3779b9;

type Range = [number, number];
export interface Peak { x: number; z: number; radius: number; height: number }

/** The island as functions of world position, shared by the mesh and the 2D technique maps. */
export interface IslandField {
  noise: Noise2D;
  peaks: Peak[];
  /** Outline radius at an angle. */
  rim(angle: number): number;
  /** Plateau noise before scaling, 0..1. */
  plateau(x: number, z: number): number;
  /** Peak height at a point, 0 off the peaks. */
  lift(x: number, z: number): number;
  /** Top-surface height at a point whose radial fraction of the rim is t. */
  heightAt(x: number, z: number, t: number): number;
  /** Top-surface height, or null outside the rim. */
  top(x: number, z: number): number | null;
  rimY: number;
  /** Rock pools; their bowls are already cut into `heightAt` and `top`. */
  pools: Pool[];
  /** Hanging rocks under the plateau; `height` is the depth below the rim. */
  rocks: Peak[];
  /** Roll-in exponent of the underside wall at an angle (it varies around the island). */
  wallPower(angle: number): number;
  /** Underside depth below the rim at a point whose radial fraction of the rim is rho. */
  depthAt(x: number, z: number, rho: number, wallPower: number): number;
}

export function createIslandField(p: IslandParams): IslandField {
  const noise = createNoise2D(p.seed);
  const rims = new Map<number, number>();
  const rim = (angle: number) => {
    if (!rims.has(angle)) rims.set(angle, rimRadius(noise, p, angle));
    return rims.get(angle)!;
  };
  const peaks = placePeaks(p, rim);
  const rimY = -SHOULDER_DROP * p.radius;
  const plateau = (x: number, z: number) => plateauNoise(noise, p, x, z);
  const blend = PEAK_BLEND * p.peakHeight;
  const lift = (x: number, z: number) => peakLift(noise, peaks, blend, x, z);

  // t is the fraction of the rim radius at this point's angle.
  const groundAt = (x: number, z: number, t: number) => {
    const drop = shoulderDrop(t);
    const relief = PLATEAU_RELIEF * p.radius * (2 * plateau(x, z) - 1);
    return (relief + lift(x, z)) * (1 - drop) + rimY * drop;
  };
  const inside = (x: number, z: number, height: (x: number, z: number, t: number) => number) => {
    const t = Math.hypot(x, z) / rim(Math.atan2(z, x));
    return t > 1 ? null : height(x, z, t);
  };

  // Pools are placed on the uncarved ground, then their bowls are cut into it.
  const pools = placePools((x, z) => inside(x, z, groundAt), lift, rim, p);
  const heightAt = (x: number, z: number, t: number) => groundAt(x, z, t) - poolBasin(pools, x, z);
  const top = (x: number, z: number) => inside(x, z, heightAt);

  // Underside. Angular noise is sampled on circles (cos, sin), so no direction is favored.
  const gain = FBM_GAIN;
  const rocks = placeRocks(p, rim);
  const shape: Range = [lerp(ROCK_SHAPE_P, p.taper), lerp(ROCK_SHAPE_Q, p.taper)];
  const wallScale = Math.min(1, p.undersideDepth / p.radius);
  const rockBlend = ROCK_BLEND * p.radius;

  const wallPower = (angle: number) => {
    const cx = Math.cos(angle);
    const cz = Math.sin(angle);
    const broad = fbm(noise, cx * 0.8 + 40, cz * 0.8 - 40, { octaves: 2 });
    const fold = noise(cx * WALL_RIDGE_FREQ - 70, cz * WALL_RIDGE_FREQ + 90);
    const ridge = (1 - Math.sqrt(fold * fold + 0.01)) ** 2 - 0.45; // softened ridged noise, roughly centered
    const grain = fbm(noise, cx * 3 + 50, cz * 3 + 50, { octaves: 4, gain });
    return WALL_POWER * (1 + WALL_VARIATION * broad + WALL_RIDGES * ridge + WALL_ROUGHNESS * grain);
  };

  // The wall term is (1 - rho^n)^0.5, vertical at the rim; n varies around the island, which puts
  // vertical ridges on the wall. Rocks join the wall by smooth union and fade out near the rim,
  // so the seam stays closed.
  const depthAt = (x: number, z: number, rho: number, power: number) => {
    const inner = 1 - smoothstep(0.85, 1, rho);
    const wall = WALL_DEPTH * Math.sqrt(Math.max(1 - rho ** power, 0)) + CEILING_SLOPE * (1 - rho) ** 1.2;
    let depth = wallScale * p.radius * wall;
    rocks.forEach((q, i) => { depth = smoothMax(depth, inner * rockDepth(noise, q, i, shape, x, z), rockBlend); });
    const lumps = fbm(noise, (x / p.radius) * 2.5 + 30, (z / p.radius) * 2.5 - 60, { octaves: 3, gain });
    return depth + inner * UNDERSIDE_LUMPS * p.radius * lumps;
  };

  return { noise, peaks, rim, plateau, lift, heightAt, top, rimY, pools, rocks, wallPower, depthAt };
}

/** Maps angle and radial fraction t to a vertex and its rim weight (0..1). */
type Surface = (angle: number, t: number) => [number, number, number, number];

/**
 * A floating island: a broad plateau carrying one main peak and several
 * spires, dropping over a near-vertical cliff under which a few blunt rocks hang.
 * Pure function: same params, same geometry.
 */
export function createIsland(p: IslandParams): BufferGeometry {
  const field = createIslandField(p);
  const { rim, rimY, depthAt } = field;

  const top: Surface = (angle, t) => {
    const r = rim(angle) * t;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const edge = Math.min(Math.max((t - PLATEAU_EDGE) / (1 - PLATEAU_EDGE), 0), 1);
    return [x, field.heightAt(x, z, t), z, smoothstep(0, 0.6, edge)];
  };

  // One ray from the rim (t = 0) to the center (t = 1), sampled densely, then resampled at equal
  // arc length so the steep rock sides get as many rings as the flatter parts.
  const underside = (angle: number, count: number) => {
    const cx = Math.cos(angle);
    const cz = Math.sin(angle);
    const edge = rim(angle);
    const wallPower = field.wallPower(angle);

    const samples = count * UNDERSIDE_SAMPLES;
    const points = new Float64Array((samples + 1) * 3);
    const length = new Float64Array(samples + 1);
    for (let j = 0; j <= samples; j++) {
      const rho = 1 - j / samples;
      const x = cx * edge * rho;
      const z = cz * edge * rho;
      const y = rimY - depthAt(x, z, rho, wallPower);
      points[j * 3] = x;
      points[j * 3 + 1] = y;
      points[j * 3 + 2] = z;
      if (j > 0) length[j] = length[j - 1] + Math.hypot(x - points[j * 3 - 3], y - points[j * 3 - 2], z - points[j * 3 - 1]);
    }
    const ray = new Float64Array((count + 1) * 3);
    for (let k = 0, j = 0; k <= count; k++) {
      const target = (length[samples] * k) / count;
      while (j < samples - 1 && length[j + 1] < target) j++;
      const f = Math.min(Math.max((target - length[j]) / (length[j + 1] - length[j] || 1), 0), 1);
      for (let c = 0; c < 3; c++) ray[k * 3 + c] = points[j * 3 + c] + (points[j * 3 + 3 + c] - points[j * 3 + c]) * f;
    }
    return ray;
  };

  const rings = Math.max(4, Math.round(p.resolution));
  const segments = rings * 3;
  const bottomRings = rings * UNDERSIDE_RINGS;
  const rays = new Map<number, Float64Array>();
  const bottom: Surface = (angle, t) => {
    if (!rays.has(angle)) rays.set(angle, underside(angle, bottomRings));
    const ray = rays.get(angle)!;
    const k = Math.round(t * bottomRings) * 3;
    // The rim weight continues from the top (1 at the seam) and fades out down the cliff,
    // so the shader can blend both sides of the seam into the same stone color.
    const seam = 1 - smoothstep(0, SEAM_BAND * p.radius, rimY - ray[k + 1]);
    return [ray[k], ray[k + 1], ray[k + 2], seam];
  };

  const buffers = { positions: [] as number[], rims: [] as number[], indices: [] as number[] };
  addSurface(top, rings, segments, buffers);
  const topVertices = buffers.positions.length / 3;
  addSurface(bottom, bottomRings, segments, buffers);

  // Per vertex: rise on its own peak and that peak's prominence (see peakTone); 0 off the peaks
  // and on the underside.
  const tones = new Float32Array((buffers.positions.length / 3) * 2);
  for (let v = 0; v < topVertices; v++) {
    tones.set(peakTone(field.noise, field.peaks, buffers.positions[v * 3], buffers.positions[v * 3 + 2]), v * 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('aRim', new Float32BufferAttribute(buffers.rims, 1));
  geometry.setAttribute('aPeak', new Float32BufferAttribute(tones, 2));
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const FLAT_SAMPLES = 4096; // top-surface samples used to find the heights of flat ground
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const NO_LINE = 1e6; // a meadow line height beyond any terrain

/**
 * Heights of the flat ground on top (slope below SURFACE_RULES.grassSlope), sorted low to high.
 * Samples follow a sunflower pattern, so they cover the disc evenly and never change for the same params.
 */
export function flatGroundHeights(field: IslandField, p: IslandParams): number[] {
  const heights: number[] = [];
  const step = p.radius / 64;
  for (let i = 0; i < FLAT_SAMPLES; i++) {
    const r = Math.sqrt((i + 0.5) / FLAT_SAMPLES) * p.radius * (1 + RIM_WOBBLE);
    const x = Math.cos(i * GOLDEN_ANGLE) * r;
    const z = Math.sin(i * GOLDEN_ANGLE) * r;
    const h = field.top(x, z);
    const hx = field.top(x + step, z);
    const hz = field.top(x, z + step);
    if (h === null || hx === null || hz === null) continue;
    const gradient = ((hx - h) / step) ** 2 + ((hz - h) / step) ** 2;
    if (1 - 1 / Math.sqrt(1 + gradient) <= SURFACE_RULES.grassSlope) heights.push(h);
  }
  return heights.sort((a, b) => a - b);
}

/** World height of the meadow line: meadowLine is the share of flat ground that is meadow, lowest first. */
export function meadowLineHeight(flatHeights: number[], meadowLine: number): number {
  if (flatHeights.length === 0 || meadowLine <= 0) return -NO_LINE;
  if (meadowLine >= 1) return NO_LINE;
  return flatHeights[Math.floor(meadowLine * flatHeights.length)];
}

const lerp = ([a, b]: Range, t: number) => a + (b - a) * Math.min(Math.max(t, 0), 1);

/** 0..1 drop of the plateau shoulder at radial fraction t (Class 03 shaping: power). */
function shoulderDrop(t: number): number {
  const edge = Math.min(Math.max((t - PLATEAU_EDGE) / (1 - PLATEAU_EDGE), 0), 1);
  return Math.pow(edge, SHOULDER_POWER);
}

/**
 * Depth of one hanging rock: an inverted peak whose depth follows (1 - u^p)^q across its footprint
 * (Class 03 shaping: power). q above 1 flares the root, a large p keeps the bottom blunt. The
 * outline is angular fbm plus ridged angular noise (Class 03), blended between two ridge patterns
 * from root to bottom and roughened by position fbm, so the ridges do not run as even ribs.
 */
function rockDepth(noise: Noise2D, q: Peak, i: number, [power, flare]: Range, x: number, z: number): number {
  const dx = x - q.x;
  const dz = z - q.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= q.radius * (1 + ROCK_WOBBLE + ROCK_RIDGES + ROCK_BUMPS)) return 0;
  const cx = dx / (dist || 1);
  const cz = dz / (dist || 1);
  const lobes = fbm(noise, cx * 1.4 + i * 5.3 + 100, cz * 1.4 - i * 2.9, { octaves: 2 });
  const ridged = (n: number) => (1 - Math.sqrt(n * n + 0.02)) ** 2;
  const root = ridged(noise(cx * ROCK_RIDGE_FREQ + i * 3.3 - 40, cz * ROCK_RIDGE_FREQ - i * 1.7 + 20));
  const tip = ridged(noise(cx * ROCK_RIDGE_FREQ * 1.3 + i * 2.1 + 60, cz * ROCK_RIDGE_FREQ * 1.3 - i * 4.2 - 10));
  const spur = root + (tip - root) * smoothstep(0.2, 0.9, 1 - dist / q.radius);
  const bumps = fbm(noise, (x / q.radius) * 1.2 + i * 9.1, (z / q.radius) * 1.2 - i * 4.3, { octaves: 2 });
  const outline = q.radius * (1 + ROCK_WOBBLE * lobes + ROCK_RIDGES * (spur - 0.5) + ROCK_BUMPS * bumps);
  const u = Math.min(dist / outline, 1);
  return q.height * Math.pow(1 - Math.pow(u, power), flare);
}

/** Smooth maximum (Class 04 smooth union). The width shrinks to a + b so two zero heights stay zero. */
function smoothMax(a: number, b: number, width: number): number {
  const k = Math.min(width, a + b);
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
}

/** Blends a noise value n in -1..1 from rounded (0..1) toward ridged (1 - |n|)^2 (Class 03 shaping: ridged). */
export function ridgeCurve(n: number, ridgeSharpness: number): number {
  const rounded = n * 0.5 + 0.5;
  const ridged = (1 - Math.abs(n)) ** 2;
  return rounded + (ridged - rounded) * ridgeSharpness;
}

/** Unwarped fbm in 0..1, blended toward ridged by ridgeSharpness. */
function plateauNoise(noise: Noise2D, p: IslandParams, x: number, z: number): number {
  const n = fbm(noise, (x / p.radius) * p.frequency, (z / p.radius) * p.frequency, { octaves: OCTAVES, gain: FBM_GAIN });
  return ridgeCurve(n, p.ridgeSharpness);
}

/** Outline radius: large bays from one low frequency, plus detail whose strength varies along the coast. */
function rimRadius(noise: Noise2D, p: IslandParams, angle: number): number {
  const cx = Math.cos(angle);
  const cz = Math.sin(angle);
  const bays = fbm(noise, cx * 0.9 + 17, cz * 0.9 + 17, { octaves: 2 });
  const detail = fbm(noise, cx * 2.5 + 31, cz * 2.5 - 8, { octaves: 4 });
  const roughness = 0.5 + 0.5 * noise(cx * 0.7 - 11, cz * 0.7 + 5);
  return p.radius * (1 + RIM_WOBBLE * (RIM_BAYS * bays + (1 - RIM_BAYS) * detail * roughness));
}

/**
 * One off-centre main peak, then spires placed by rejection so gaps stay open between summits.
 * The allowed area grows with peakSpread and follows the rim, so at 1 peaks reach the shoulder.
 */
function placePeaks(p: IslandParams, rim: (angle: number) => number): Peak[] {
  const rng = createRng((p.seed ^ PEAK_SEED_SALT) >>> 0);
  const pick = ([lo, hi]: Range) => lo + (hi - lo) * rng();
  const zone = p.radius * lerp(CLUSTER_RADIUS, p.peakSpread);
  const gap = p.radius * lerp(PEAK_GAP, p.peakSpread);
  const limit = lerp(PEAK_LIMIT, p.peakSpread);
  const mainRadius = p.radius * MAIN_PEAK_RADIUS;
  const core = (radius: number) => radius * PEAK_CORE * (1 + PEAK_WOBBLE);

  // The cluster sits off-center when tight, so the rest of the plateau stays open plain.
  const side = rng() * Math.PI * 2;
  const shift = p.radius * CLUSTER_OFFSET * (1 - p.peakSpread);
  const [ox, oz] = [Math.cos(side) * shift, Math.sin(side) * shift];
  const fits = (x: number, z: number, radius: number) =>
    Math.hypot(x, z) + core(radius) <= limit * rim(Math.atan2(z, x));

  // The main peak slides toward the center until it fits.
  const angle = rng() * Math.PI * 2;
  const offset = pick(MAIN_OFFSET) * zone;
  let [mx, mz] = [ox + Math.cos(angle) * offset, oz + Math.sin(angle) * offset];
  for (let attempt = 0; attempt < PLACEMENT_TRIES && !fits(mx, mz, mainRadius); attempt++) [mx, mz] = [mx * 0.9, mz * 0.9];
  const peaks: Peak[] = [{ x: mx, z: mz, radius: mainRadius, height: p.peakHeight }];

  // Each spire gets its own height band so they never come out nearly equal; taller spires are thicker.
  const count = Math.round(p.peakCount);
  const bands = shuffle(Array.from({ length: count }, (_, i) => i), rng);
  for (let i = 0; i < count; i++) {
    const rank = (bands[i] + rng()) / Math.max(count, 1);
    const height = p.peakHeight * (SPIRE_HEIGHT[0] + (SPIRE_HEIGHT[1] - SPIRE_HEIGHT[0]) * rank);
    let radius = mainRadius * (SPIRE_RADIUS[0] + (SPIRE_RADIUS[1] - SPIRE_RADIUS[0]) * (0.7 * rank + 0.3 * rng()));
    for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++, radius *= SPIRE_SHRINK) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * zone;
      const x = ox + Math.cos(a) * d;
      const z = oz + Math.sin(a) * d;
      const clear = fits(x, z, radius)
        && peaks.every((q) => Math.hypot(q.x - x, q.z - z) > core(q.radius) + core(radius) + gap);
      if (clear) {
        peaks.push({ x, z, radius, height });
        break;
      }
    }
  }
  return peaks;
}

/**
 * Hanging rocks under the plateau: one main rock off-center that reaches undersideDepth, then
 * smaller, shallower rocks placed by seeded rejection so they overlap but stay distinct.
 * `height` is the depth below the rim.
 */
function placeRocks(p: IslandParams, rim: (angle: number) => number): Peak[] {
  const rng = createRng((p.seed ^ ROCK_SEED_SALT) >>> 0);
  const pick = ([lo, hi]: Range) => lo + (hi - lo) * rng();
  const fits = (x: number, z: number, radius: number) => Math.hypot(x, z) + radius <= ROCK_REACH * rim(Math.atan2(z, x));

  // The main rock slides toward the center, and shrinks, until it fits.
  const angle = rng() * Math.PI * 2;
  const offset = pick(MAIN_ROCK_OFFSET) * p.radius;
  let [x, z, radius] = [Math.cos(angle) * offset, Math.sin(angle) * offset, MAIN_ROCK_RADIUS * p.radius];
  for (let attempt = 0; attempt < PLACEMENT_TRIES && !fits(x, z, radius); attempt++) [x, z, radius] = [x * 0.9, z * 0.9, radius * 0.98];
  const rocks: Peak[] = [{ x, z, radius, height: p.undersideDepth }];

  // Each side rock gets its own depth band, so no two hang to nearly the same depth.
  const count = Math.max(Math.round(p.rockCount), 1) - 1;
  const bands = shuffle(Array.from({ length: count }, (_, i) => i), rng);
  for (let i = 0; i < count; i++) {
    const rank = (bands[i] + rng()) / count;
    const height = p.undersideDepth * lerp(SIDE_ROCK_DEPTH, rank);
    let size = p.radius * lerp(SIDE_ROCK_RADIUS, 0.7 * rank + 0.3 * rng());
    for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++, size *= ROCK_SHRINK) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * ROCK_REACH * p.radius;
      const [rx, rz] = [Math.cos(a) * d, Math.sin(a) * d];
      if (fits(rx, rz, size) && rocks.every((q) => Math.hypot(q.x - rx, q.z - rz) > ROCK_SPACING * (q.radius + size))) {
        rocks.push({ x: rx, z: rz, radius: size, height });
        break;
      }
    }
  }
  return rocks;
}

/**
 * Peaks from a distance mask (Class 05 distance): height falls from a rounded summit along
 * (1 - d / outline)^PEAK_POWER (Class 03 shaping: power). The outline is angular noise plus
 * ridged angular noise (Class 03 ridged), so every contour is a star and spurs run from the
 * summit to the foot. Neighbouring peaks merge with a smooth union and share saddles.
 */
function peakLift(noise: Noise2D, peaks: Peak[], blend: number, x: number, z: number): number {
  let lift = 0;
  peaks.forEach((q, i) => {
    lift = smoothMax(lift, peakShape(noise, q, i, x, z), blend);
  });
  return lift;
}

/** One peak's own height at a point, 0 past its foot. */
function peakShape(noise: Noise2D, q: Peak, i: number, x: number, z: number): number {
  const dx = x - q.x;
  const dz = z - q.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= q.radius * (1 + PEAK_WOBBLE + PEAK_RIDGES)) return 0;
  const cx = dx / (dist || 1);
  const cz = dz / (dist || 1);
  const lobes = fbm(noise, cx * 1.6 + i * 7.3, cz * 1.6 - i * 3.1, { octaves: 4 });
  const fold = noise(cx * PEAK_RIDGE_FREQ - i * 5.1, cz * PEAK_RIDGE_FREQ + i * 2.7);
  const spur = (1 - Math.sqrt(fold * fold + 0.02)) ** 2; // softened ridged noise, so crests stay wider than a grid cell
  const outline = q.radius * (1 + PEAK_WOBBLE * lobes + PEAK_RIDGES * (spur - 0.5));
  const round = SUMMIT_ROUND * q.radius;
  const d = Math.sqrt(dist * dist + round * round) - round;
  const s = Math.max(1 - d / outline, 0);
  return q.height * Math.pow(s, PEAK_POWER);
}

/**
 * Where a point sits on the peaks, for painting them: `rise` is how far up its own peak it is
 * (0 at the foot, 1 at the summit) and `prominence` how tall that peak is next to the main one
 * (1 for the main peak). Near a saddle both blend between the two peaks, weighted by how much
 * each one lifts the point, so the colors never jump from one peak to the next.
 */
export function peakTone(noise: Noise2D, peaks: Peak[], x: number, z: number): [number, number] {
  const main = Math.max(...peaks.map((q) => q.height), 1e-6);
  let weight = 0;
  let rise = 0;
  let prominence = 0;
  peaks.forEach((q, i) => {
    const own = peakShape(noise, q, i, x, z);
    if (own <= 0 || q.height <= 0) return;
    const w = own * own;
    weight += w;
    rise += w * (own / q.height);
    prominence += w * (q.height / main);
  });
  return weight > 0 ? [rise / weight, prominence / weight] : [0, 0];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Appends a polar grid (t = 0..1 across rings, angle = 0..2PI across segments) to the buffers. */
function addSurface(surface: Surface, rings: number, segments: number, out: { positions: number[]; rims: number[]; indices: number[] }) {
  const row = segments + 1;
  const start = out.positions.length / 3;
  for (let k = 0; k <= rings; k++) {
    for (let s = 0; s <= segments; s++) {
      const [x, y, z, rimWeight] = surface((s / segments) * Math.PI * 2, k / rings);
      out.positions.push(x, y, z);
      out.rims.push(rimWeight);
    }
  }
  for (let k = 0; k < rings; k++) {
    for (let s = 0; s < segments; s++) {
      const a = start + k * row + s;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      out.indices.push(a, b, c, b, d, c);
    }
  }
}
