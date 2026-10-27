import type { HeightGrid } from '../../core/terrain/heightGrid';

/**
 * The mountains' folds, for the rock's colour (docs/rock-folds-2026-10-27.md): where the range
 * stands, and how far each place lies in a hollow of it. An artistic form proxy (white stone with
 * structure and local colour), not a deposit or a drainage model.
 *
 * - mountain: how far the range raises the ground above the plain (final height − the meadow),
 *   eased in over FOLD.lift: zero on the plain and by the terrace, fading toward the foot.
 * - concavity at two scales: the ground blurred over about r metres, minus the ground (three box
 *   passes each way, near a gaussian: no ring of samples). Positive in a hollow, negative on a
 *   ridge, zero on an even slope however steep (steep is not concave).
 * - fold: both scales eased into 0..1: the broad one the big folds between spurs, the fine one the
 *   gullies and grooves. This channel is the original hierarchy (not replaced by the wide tint).
 * - wide: cross-slope hollow — how far this point sits below the ground to its left and right,
 *   across the slope. Isotropic blur(height)−height at a large radius lights the toe, where the
 *   kernel mixes peaks and plain, and stays near zero on a planar face. Cross-slope does the
 *   opposite: a face between two ridges scores high; a ridge and a uniform toe do not.
 *
 * On the height grid's own texels, from its final heights (after the water has dug it): the shader
 * reads it with the light map's coordinates, so it never depends on the displayed level of detail.
 * Packed RGBA bytes: R mountain, G fold (6 m / 18 m), B fine, A wide cross-slope hollow.
 */
export const FOLD = {
  // (From 6 m, not 2: where the range meets the plain the ground is concave too, and the whole
  // foot took colour in a ring.)
  lift: [6, 30] as [number, number], // metres above the plain: no mountain below the first, full at the second
  fine: { radius: 6, from: 0.15, to: 0.9 },
  broad: { radius: 18, from: 0.35, to: 2.6 },
  /** Metres across the slope. Spur spacing is on the order of a few tens of metres. */
  wide: { radius: 28, from: 2.0, to: 6.0 },
  fineShare: 0.5, // original fold mix — do not starve the gullies for the wide tint
  // (The weight blurred again: on steep faces a 1 m texel spans metres of height, and a weight that
  // changed fast across the face drew jagged tongues down it.)
  smooth: 4, // metres
};

/** Panel default. Linear weight: 1 means a full fold is the light olive; a partial fold is that fraction of the way. */
export const ROCK_FOLD_MIX = 1;

export interface RockFolds {
  size: number;
  rgba: Uint8Array;
  ms: number;
}

const ease = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Metres this point sits below the ground across the slope (positive in a hollow between ridges).
 * `radius` is in texels. Flat ground (no reliable across-direction) stays 0.
 */
export function crossHollow(h: Float32Array, size: number, radius: number): Float32Array {
  const out = new Float32Array(h.length);
  const r = Math.max(2, Math.round(radius));
  const sample = (i: number, j: number) => h[Math.min(size - 1, Math.max(0, j)) * size + Math.min(size - 1, Math.max(0, i))];
  for (let j = 1; j < size - 1; j++) {
    for (let i = 1; i < size - 1; i++) {
      const t = j * size + i;
      const gx = h[t + 1] - h[t - 1];
      const gz = h[t + size] - h[t - size];
      const len = Math.hypot(gx, gz);
      if (len < 0.2) continue;
      const px = -gz / len, pz = gx / len;
      let acc = 0;
      for (const rad of [r * 0.55, r]) {
        const a = sample(Math.round(i + px * rad), Math.round(j + pz * rad));
        const b = sample(Math.round(i - px * rad), Math.round(j - pz * rad));
        acc += 0.5 * (a + b) - h[t];
      }
      out[t] = acc * 0.5;
    }
  }
  return out;
}

/** A grid field blurred over about `radius` texels (three box passes each way). */
function blurred(src: Float32Array, size: number, radius: number): Float32Array {
  const a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (from: Float32Array, to: Float32Array, step: number, along: number) => {
    // `step` moves along a line, `along` from line to line.
    for (let line = 0; line < size; line++) {
      const base = line * along;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += from[base + Math.min(Math.max(k, 0), size - 1) * step];
      for (let k = 0; k < size; k++) {
        to[base + k * step] = sum / (2 * radius + 1);
        sum += from[base + Math.min(k + radius + 1, size - 1) * step] - from[base + Math.max(k - radius, 0) * step];
      }
    }
  };
  for (let p = 0; p < 3; p++) { pass(a, b, 1, size); pass(b, a, size, 1); }
  return a;
}

/** The folds for this ground; `meadow` is the plain's height (ground.ts `rules.meadow`). */
export function buildRockFolds(grid: HeightGrid, meadow: (x: number, z: number, edge: number) => number): RockFolds {
  const t0 = performance.now();
  const { size, texel, data } = grid;
  const n = size * size, at = (i: number) => (i - (size - 1) / 2) * texel;
  const h = new Float32Array(n), mountain = new Float32Array(n);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const t = j * size + i, edge = data[t * 4 + 3];
    h[t] = data[t * 4];
    if (edge >= 0) continue;
    mountain[t] = ease(FOLD.lift[0], FOLD.lift[1], h[t] - meadow(at(i), at(j), edge));
  }
  const fineBlur = blurred(h, size, Math.max(1, Math.round(FOLD.fine.radius / texel)));
  const broadBlur = blurred(h, size, Math.max(1, Math.round(FOLD.broad.radius / texel)));
  const cross = crossHollow(h, size, FOLD.wide.radius / texel);
  // (The mountain eased over the broad scale too: its edge on the plain has no ring.)
  const soft = blurred(mountain, size, Math.max(1, Math.round(FOLD.fine.radius / texel)));
  const fineW = new Float32Array(n), broadW = new Float32Array(n), foldW = new Float32Array(n), wideW = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    fineW[t] = ease(FOLD.fine.from, FOLD.fine.to, fineBlur[t] - h[t]);
    broadW[t] = ease(FOLD.broad.from, FOLD.broad.to, broadBlur[t] - h[t]);
    // Original hierarchy only. A large isotropic bowl is not folded in here.
    foldW[t] = 1 - (1 - broadW[t]) * (1 - FOLD.fineShare * fineW[t]);
    wideW[t] = ease(FOLD.wide.from, FOLD.wide.to, cross[t]);
  }
  const foldSoft = blurred(foldW, size, Math.max(1, Math.round(FOLD.smooth / texel)));
  const wideSoft = blurred(wideW, size, Math.max(1, Math.round(FOLD.smooth / texel)));
  const rgba = new Uint8Array(n * 4);
  for (let t = 0; t < n; t++) {
    rgba[t * 4] = Math.round(soft[t] * 255);
    rgba[t * 4 + 1] = Math.round(foldSoft[t] * 255);
    rgba[t * 4 + 2] = Math.round(fineW[t] * 255);
    rgba[t * 4 + 3] = Math.round(wideSoft[t] * 255);
  }
  return { size, rgba, ms: performance.now() - t0 };
}

/** Concavity statistics on mountain texels (for tuning: scripts/check-rock-folds.ts). */
export function foldStats(grid: HeightGrid, meadow: (x: number, z: number, edge: number) => number, radius: number) {
  const { size, texel, data } = grid;
  const h = new Float32Array(size * size);
  for (let t = 0; t < h.length; t++) h[t] = data[t * 4];
  const b = blurred(h, size, Math.round(radius / texel));
  const vals: number[] = [];
  for (let j = 0; j < size; j += 2) for (let i = 0; i < size; i += 2) {
    const t = j * size + i, edge = data[t * 4 + 3];
    if (edge >= 0) continue;
    const lift = h[t] - meadow((i - (size - 1) / 2) * texel, (j - (size - 1) / 2) * texel, edge);
    if (lift > FOLD.lift[1]) vals.push(b[t] - h[t]);
  }
  vals.sort((p, q) => p - q);
  const q = (f: number) => vals[Math.floor(f * (vals.length - 1))];
  return { n: vals.length, p10: q(0.1), p50: q(0.5), p75: q(0.75), p90: q(0.9), p97: q(0.97) };
}
