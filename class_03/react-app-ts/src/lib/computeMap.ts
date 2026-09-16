/**
 * computeMap.ts
 * -------------
 * Computes a flat Float32Array noise map [0…1] of size resolution×resolution
 * by evaluating and blending every enabled NoiseLayer.
 */

import type { NoiseLayer } from '../types';
import { createNoiseFunctions, fbm } from './noise';
import { applyShaping } from './shaping';

const noiseFns = createNoiseFunctions(42);

/** Sample a single layer at normalised position (nx, ny) ∈ [0, 1]. Returns 0…1. */
function sampleLayer(layer: NoiseLayer, nx: number, ny: number): number {
  const x = (nx + layer.offsetX) * layer.scale;
  const y = (ny + layer.offsetY) * layer.scale;

  // Select base noise function
  const base =
    layer.noiseType === 'perlin'   ? noiseFns.perlin   :
    layer.noiseType === 'value'    ? noiseFns.value     :
    layer.noiseType === 'cellular' ? noiseFns.cellular  :
    noiseFns.worley;

  // Apply fBm (even for octaves=1 this just returns the raw noise)
  const raw = fbm(x, y, base, layer.octaves, layer.persistence, layer.lacunarity);

  // Normalise –1…+1  →  0…1
  const t = (raw + 1) / 2;

  // Apply shaping
  return applyShaping(t, layer.shapingFn, layer.shapingParam);
}

/**
 * Compute the blended noise map for all layers.
 * Returns a Float32Array of length resolution² with values in 0…1.
 */
export function computeNoiseMap(layers: NoiseLayer[], resolution: number): Float32Array {
  const map = new Float32Array(resolution * resolution);

  for (let yi = 0; yi < resolution; yi++) {
    for (let xi = 0; xi < resolution; xi++) {
      const nx = xi / (resolution - 1);
      const ny = yi / (resolution - 1);

      let accumulated = 0; // running blended value

      for (const layer of layers) {
        if (!layer.enabled) continue;

        const v = sampleLayer(layer, nx, ny); // 0…1

        switch (layer.blendMode) {
          case 'add':
            accumulated = accumulated + v * layer.opacity;
            break;
          case 'subtract':
            accumulated = accumulated - v * layer.opacity;
            break;
          case 'multiply':
            // lerp between 1 (no change) and v, weighted by opacity
            accumulated = accumulated * (1 - layer.opacity + v * layer.opacity);
            break;
          case 'max':
            accumulated = Math.max(accumulated, v * layer.opacity);
            break;
        }
      }

      map[yi * resolution + xi] = Math.max(0, Math.min(1, accumulated));
    }
  }

  return map;
}
