/**
 * The island pipeline, one stage per technique from class:
 *   1 noise (fBm)  →  2 shaping  →  3 island mask  →  4 hydraulic erosion
 * Every stage is kept as its own map so the panel can show how each one changes the land.
 */
import type { NoiseType, ShapingFn } from '../types';
import { createNoiseFunctions, fbm } from './noise';
import { applyShaping } from './shaping';

export const RES = 128;

export interface Params {
  noise: NoiseType;
  scale: number;
  octaves: number;
  persistence: number;
  shaping: ShapingFn;
  shapingParam: number;
  radius: number; // island radius, 0..1 of the half-width
  edge: number; // how soft the coast is
  seed: number;
}

export const DEFAULTS: Params = {
  noise: 'perlin',
  scale: 3,
  octaves: 5,
  persistence: 0.5,
  shaping: 'ridged',
  shapingParam: 2,
  radius: 0.78,
  edge: 0.45,
  seed: 3,
};

export interface Stages {
  noise: Float32Array;
  shaped: Float32Array;
  mask: Float32Array;
  island: Float32Array;
}

export function buildStages(p: Params): Stages {
  const fns = createNoiseFunctions(42 + p.seed);
  const base = fns[p.noise];
  const n = RES * RES;
  const noise = new Float32Array(n);
  const shaped = new Float32Array(n);
  const mask = new Float32Array(n);
  const island = new Float32Array(n);
  // A second, slow noise wobbles the coastline so the island is not a perfect circle.
  const coast = fns.perlin;
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const raw = fbm((i / (RES - 1)) * p.scale + p.seed * 7.1, (j / (RES - 1)) * p.scale + p.seed * 3.3, base, p.octaves, p.persistence, 2);
      noise[j * RES + i] = raw;
      lo = Math.min(lo, raw);
      hi = Math.max(hi, raw);
    }
  }
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const k = j * RES + i;
      const u = i / (RES - 1);
      const v = j / (RES - 1);
      // fBm sums bunch up around the middle; stretch them to fill 0..1 so shaping has range to work on.
      noise[k] = (noise[k] - lo) / (hi - lo || 1);
      shaped[k] = applyShaping(noise[k], p.shaping, p.shapingParam);
      const dx = u * 2 - 1;
      const dy = v * 2 - 1;
      const r = Math.hypot(dx, dy) * (1 + 0.25 * coast(u * 2.5 + 40, v * 2.5 + 40));
      const t = Math.min(Math.max((p.radius - r) / Math.max(p.edge * p.radius, 0.01), 0), 1);
      mask[k] = t * t * (3 - 2 * t);
      // The mask cuts the coast and adds a gentle dome, so the island rises toward its middle.
      island[k] = mask[k] * (0.15 + 0.6 * shaped[k] + 0.25 * mask[k]);
    }
  }
  return { noise, shaped, mask, island };
}
