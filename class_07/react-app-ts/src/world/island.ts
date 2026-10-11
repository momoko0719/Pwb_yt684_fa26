import { createNoise, createRng, fbm, smoothstep } from './noise';

/** A mountain island for the forest test: big enough that most trees are far from the camera. */
export const ISLAND = 240;
export const VARIANTS = 4;

export interface Island {
  heightAt: (x: number, z: number) => number;
}

export function buildIsland(seed: number): Island {
  const noise = createNoise(seed);
  const heightAt = (x: number, z: number) => {
    const r = Math.hypot(x, z) / (ISLAND * 0.5);
    const shape = 1 - smoothstep(0.15, 1, r);
    const n = fbm(noise, x * 0.018 + 10, z * 0.018 + 10, 5);
    return shape * (8 + 46 * n * n + 22 * shape) - 4;
  };
  return { heightAt };
}

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  variant: number;
}

/** Scatter (last week's lesson): random candidates, kept only on land, not too steep, in clumps. */
export function plantForest(island: Island, count: number, seed: number): TreeSpot[] {
  const rng = createRng(seed + 404);
  const clump = createNoise(seed + 77);
  const out: TreeSpot[] = [];
  for (let tries = 0; out.length < count && tries < count * 30; tries++) {
    const x = (rng() - 0.5) * ISLAND;
    const z = (rng() - 0.5) * ISLAND;
    const y = island.heightAt(x, z);
    if (y < 1) continue;
    const slope = Math.hypot(island.heightAt(x + 1, z) - y, island.heightAt(x, z + 1) - y);
    if (slope > 1.4) continue;
    if (clump(x * 0.05, z * 0.05) < 0.3 + rng() * 0.25) continue;
    out.push({ x, y: y - 0.2, z, scale: 0.75 + rng() * 0.5, yaw: rng() * Math.PI * 2, variant: Math.floor(rng() * VARIANTS) });
  }
  return out;
}
