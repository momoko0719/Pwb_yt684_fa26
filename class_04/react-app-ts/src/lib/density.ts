/**
 * Density shapes from the Class 04 lecture table.
 * Positive (or ≥ threshold) = solid, depending on how we sample.
 * We use: density > threshold ⇒ solid for meshing demos.
 *
 * Coordinates p are in roughly −1 … +1 world space.
 */

import { fbm2, fbm3 } from './noise3d';

export type DensityShape =
  | 'ground' | 'fbm3d' | 'ridged' | 'terraced' | 'islands' | 'planet' | 'strata';

export interface DensityParams {
  scale: number;   // noise frequency
  height: number;  // amplitude for height-based shapes
  terraceK: number;
  strataK: number;
  planetR: number;
  islandBand: number;
}

export const DEFAULT_DENSITY: DensityParams = {
  scale: 2.2,
  height: 0.35,
  terraceK: 0.18,
  strataK: 8,
  planetR: 0.72,
  islandBand: 0.35,
};

/** Sample density at world point. Higher = more solid. */
export function sampleDensity(
  shape: DensityShape,
  x: number, y: number, z: number,
  p: DensityParams,
): number {
  const s = p.scale;

  switch (shape) {
    case 'ground': {
      // h(x,z) - y  → solid below heightfield
      const h = fbm2(x * s, z * s) * p.height;
      return h - y;
    }
    case 'fbm3d':
      // blobby sponge
      return fbm3(x * s, y * s, z * s);
    case 'ridged': {
      const n = fbm3(x * s, y * s, z * s);
      return 1 - Math.abs(n) - 0.55; // shift so some solid remains
    }
    case 'terraced': {
      const raw = fbm2(x * s, z * s) * p.height;
      const k = Math.max(p.terraceK, 0.05);
      const stepped = Math.floor(raw / k) * k;
      const smooth = (raw - stepped) * 0.35;
      return stepped + smooth - y;
    }
    case 'islands': {
      const n = fbm3(x * s, y * s * 1.2, z * s);
      // falloff outside a vertical band around y=0
      const band = p.islandBand;
      const fall = Math.max(0, 1 - Math.abs(y) / band);
      return n * fall - 0.15;
    }
    case 'planet': {
      const len = Math.hypot(x, y, z) || 1e-6;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;
      const h = fbm3(nx * s * 2, ny * s * 2, nz * s * 2) * p.height * 0.5;
      return p.planetR + h - len;
    }
    case 'strata': {
      const ground = fbm2(x * s, z * s) * p.height - y;
      const layers = Math.sin(y * p.strataK + fbm2(x * s * 0.5, z * s * 0.5) * 2) * 0.08;
      return ground + layers;
    }
  }
}

export const SHAPE_ORDER: DensityShape[] = [
  'ground', 'fbm3d', 'ridged', 'terraced', 'islands', 'planet', 'strata',
];
