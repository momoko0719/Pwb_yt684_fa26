/**
 * colors.ts
 * ---------
 * Maps a normalised noise value (0…1) to an RGB triple [0…1, 0…1, 0…1].
 */

import type { ColorMode } from '../types';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Bilinear interpolation across a gradient ramp of stops [{t, r, g, b}]. */
function ramp(t: number, stops: { t: number; r: number; g: number; b: number }[]): [number, number, number] {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return [lerp(a.r, b.r, f), lerp(a.g, b.g, f), lerp(a.b, b.b, f)];
    }
  }
  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b];
}

const TERRAIN_STOPS = [
  { t: 0.00, r: 0.05, g: 0.15, b: 0.40 }, // deep water
  { t: 0.30, r: 0.20, g: 0.45, b: 0.75 }, // shallow water
  { t: 0.37, r: 0.80, g: 0.78, b: 0.55 }, // sand
  { t: 0.42, r: 0.45, g: 0.62, b: 0.30 }, // grass
  { t: 0.60, r: 0.28, g: 0.45, b: 0.18 }, // forest
  { t: 0.75, r: 0.50, g: 0.42, b: 0.32 }, // rock
  { t: 0.90, r: 0.72, g: 0.68, b: 0.62 }, // stone
  { t: 1.00, r: 1.00, g: 1.00, b: 1.00 }, // snow
];

const HEATMAP_STOPS = [
  { t: 0.00, r: 0.00, g: 0.00, b: 0.30 },
  { t: 0.25, r: 0.00, g: 0.00, b: 1.00 },
  { t: 0.50, r: 0.00, g: 1.00, b: 0.00 },
  { t: 0.75, r: 1.00, g: 0.65, b: 0.00 },
  { t: 1.00, r: 1.00, g: 0.00, b: 0.00 },
];

export function noiseToRGB(t: number, mode: ColorMode): [number, number, number] {
  const v = Math.max(0, Math.min(1, t));
  switch (mode) {
    case 'grayscale': return [v, v, v];
    case 'terrain':   return ramp(v, TERRAIN_STOPS);
    case 'heatmap':   return ramp(v, HEATMAP_STOPS);
  }
}

/** Returns a CSS hex color string for the given noise value. */
export function noiseToCSS(t: number, mode: ColorMode): string {
  const [r, g, b] = noiseToRGB(t, mode);
  const to255 = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}
