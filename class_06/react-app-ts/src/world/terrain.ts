import { createNoise, fbm, smoothstep } from './noise';
import { nearest, type P2 } from './spline';

/** The landscape is a square of SIZE world units, sampled on an N x N grid. */
export const SIZE = 100;
export const N = 128;
export const RIVER_WIDTH = 3;
export const ROAD_WIDTH = 1.6;
const RIVER_DEPTH = 3.2;
const HEIGHT = 24;

export type StrokeKind = 'river' | 'road';
export interface Stroke {
  kind: StrokeKind;
  path: P2[];
}

/** Everything the other systems read from the ground: one value per grid vertex. */
export interface Land {
  height: Float32Array;
  /** Distance to the nearest river, world units (Infinity with no river). */
  river: Float32Array;
  road: Float32Array;
  /** 1 - normal.y: 0 flat, toward 1 a cliff. */
  slope: Float32Array;
  /** 0 dry .. 1 wet: high near rivers and in low ground. */
  moisture: Float32Array;
  /** Water surface height along each river, per path point. */
  waterY: number[][];
  heightAt(x: number, z: number): number;
  /** Bilinear lookup of any per-vertex map. */
  sample(map: Float32Array, x: number, z: number): number;
  noise: (x: number, y: number) => number;
}

const cell = SIZE / N;
const toWorld = (i: number) => -SIZE / 2 + i * cell;

/**
 * Builds the ground: noise hills, then every stroke changes the mesh. A river carves a channel
 * (the line pushes the terrain down); a road levels the ground along it. Moisture then spreads
 * out from the rivers, so the strokes also decide where things grow.
 */
export function buildLand(seed: number, strokes: Stroke[]): Land {
  const noise = createNoise(seed);
  const rows = N + 1;
  const height = new Float32Array(rows * rows);
  const river = new Float32Array(rows * rows).fill(Infinity);
  const road = new Float32Array(rows * rows).fill(Infinity);
  const base = (x: number, z: number) => {
    const edge = 1 - smoothstep(SIZE * 0.38, SIZE * 0.5, Math.max(Math.abs(x), Math.abs(z)));
    return (fbm(noise, x * 0.025 + 7, z * 0.025 - 3, 5) - 0.42) * HEIGHT * (0.35 + 0.65 * edge);
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < rows; i++) {
      const x = toWorld(i);
      const z = toWorld(j);
      let h = base(x, z);
      for (const s of strokes) {
        const near = nearest(s.path, x, z);
        if (s.kind === 'river') {
          river[j * rows + i] = Math.min(river[j * rows + i], near.dist);
          h -= RIVER_DEPTH * (1 - smoothstep(RIVER_WIDTH * 0.5, RIVER_WIDTH * 2.4, near.dist));
        } else {
          road[j * rows + i] = Math.min(road[j * rows + i], near.dist);
          const level = 1 - smoothstep(ROAD_WIDTH, ROAD_WIDTH * 3, near.dist);
          h += (base(near.px, near.pz) + 0.15 - h) * level;
        }
      }
      height[j * rows + i] = h;
    }
  }

  const slope = new Float32Array(rows * rows);
  const moisture = new Float32Array(rows * rows);
  const at = (i: number, j: number) => height[Math.min(Math.max(j, 0), N) * rows + Math.min(Math.max(i, 0), N)];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < rows; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell);
      const dz = (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      const k = j * rows + i;
      slope[k] = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
      const nearWater = 1 - smoothstep(RIVER_WIDTH, 22, river[k]);
      const low = 1 - smoothstep(-4, 8, height[k]);
      const patch = fbm(noise, toWorld(i) * 0.05 - 40, toWorld(j) * 0.05 + 11, 3);
      moisture[k] = Math.min(1, 0.75 * nearWater + 0.25 * low + 0.35 * (patch - 0.4));
    }
  }

  const sample = (map: Float32Array, x: number, z: number) => {
    const fx = Math.min(Math.max((x + SIZE / 2) / cell, 0), N - 1e-6);
    const fz = Math.min(Math.max((z + SIZE / 2) / cell, 0), N - 1e-6);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const m = (a: number, b: number) => map[b * rows + a];
    return (m(i, j) * (1 - u) + m(i + 1, j) * u) * (1 - v) + (m(i, j + 1) * (1 - u) + m(i + 1, j + 1) * u) * v;
  };
  const heightAt = (x: number, z: number) => sample(height, x, z);

  // The water surface follows the carved bed, a little above its lowest point nearby.
  const waterY = strokes
    .filter((s) => s.kind === 'river')
    .map((s) => s.path.map(([x, z]) => heightAt(x, z) + 1.2));
  return { height, river, road, slope, moisture, waterY, heightAt, sample, noise };
}
