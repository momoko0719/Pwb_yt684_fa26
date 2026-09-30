import { fbm } from '../noise';
import { SURFACE_RULES, type IslandParams } from '../params/island';
import { createIslandField, flatGroundHeights, meadowLineHeight, OCTAVES } from './island';

export type StageId = 'noise' | 'fbm' | 'ridged' | 'peaks' | 'height' | 'underside' | 'slope';

/** A square top-down map. Values are 0..1; NaN means outside the island. */
export interface Stage {
  id: StageId;
  size: number;
  values: Float32Array;
}

/** Slope classes in the `slope` stage, matching the terrain shader. */
export const SLOPE_CLASS = { meadow: 0, rock: 0.5, face: 1 } as const;

/** How far past the base radius the maps extend, so the coastline stays in frame. */
const FRAME = 1.35;

/**
 * The generator's intermediate fields as 2D maps, from the same functions the mesh uses.
 * Pure function: same params, same maps.
 */
export function islandStages(p: IslandParams, meadowLine: number, size = 96): Stage[] {
  const field = createIslandField(p);
  const extent = p.radius * FRAME;
  const cell = (2 * extent) / (size - 1);
  const map = (fn: (x: number, z: number) => number) => {
    const values = new Float32Array(size * size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) values[j * size + i] = fn(-extent + i * cell, -extent + j * cell);
    }
    return values;
  };
  const scale = (x: number) => (x / p.radius) * p.frequency;

  const heights = map((x, z) => field.top(x, z) ?? NaN);
  const low = field.rimY;
  const high = Math.max(p.peakHeight, 1);
  const inside = (x: number, z: number) => Math.hypot(x, z) <= field.rim(Math.atan2(z, x));

  // Underside depth seen straight through the plateau: brighter hangs deeper.
  const deepest = Math.max(p.undersideDepth, 1);
  const underside = (x: number, z: number) => {
    const angle = Math.atan2(z, x);
    const rho = Math.hypot(x, z) / field.rim(angle);
    return rho > 1 ? NaN : field.depthAt(x, z, rho, field.wallPower(angle)) / deepest;
  };

  const line = meadowLineHeight(flatGroundHeights(field, p), meadowLine);
  const slope = new Float32Array(size * size).fill(NaN);
  for (let j = 1; j < size - 1; j++) {
    for (let i = 1; i < size - 1; i++) {
      const at = (di: number, dj: number) => heights[(j + dj) * size + i + di];
      const dx = (at(1, 0) - at(-1, 0)) / (2 * cell);
      const dz = (at(0, 1) - at(0, -1)) / (2 * cell);
      if (Number.isNaN(dx) || Number.isNaN(dz)) continue;
      const s = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
      const grass = s <= SURFACE_RULES.grassSlope && at(0, 0) <= line;
      slope[j * size + i] = s > SURFACE_RULES.faceSlope ? SLOPE_CLASS.face : grass ? SLOPE_CLASS.meadow : SLOPE_CLASS.rock;
    }
  }

  return [
    { id: 'noise', size, values: map((x, z) => 0.5 + 0.5 * field.noise(scale(x), scale(z))) },
    { id: 'fbm', size, values: map((x, z) => 0.5 + 0.5 * fbm(field.noise, scale(x), scale(z), { octaves: OCTAVES })) },
    { id: 'ridged', size, values: map((x, z) => field.plateau(x, z)) },
    { id: 'peaks', size, values: map((x, z) => (inside(x, z) ? field.lift(x, z) / high : NaN)) },
    { id: 'height', size, values: heights.map((h) => (h - low) / (high - low)) },
    { id: 'underside', size, values: map((x, z) => underside(x, z)) },
    { id: 'slope', size, values: slope },
  ];
}
