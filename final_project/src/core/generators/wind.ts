import { createNoise2D } from '../noise';
import type { IslandParams } from '../params/island';
import type { IslandField } from './island';

/**
 * The island's wind as a vector field (Class 06): a direction and strength stored on a grid over the
 * island, read by the grass, the flowers and the wind streaks. Pure: same island, same field.
 *
 * Sum of three parts:
 *   1. the prevailing wind, along WIND_DIR (the same direction the old noise wind used);
 *   2. flow around each peak, as ideal flow past a cylinder: air speeds up over the flanks, slows
 *      in front, and a wake of still air trails behind the peak;
 *   3. curl noise, small eddies that never pile up or drain away.
 */
export const WIND_GRID = 48;
export const WIND_DIR: [number, number] = [0.8, 0.6];
const RANGE = 1.4; // the grid covers this many radii on each side of the centre
const EDDY = 0.12; // small next to the prevailing wind, so the flow still reads as one direction
const WAKE = 0.6; // how much a peak calms the air behind it

export interface WindField {
  /** Grid of (vx, vz), row-major, z then x. */
  data: Float32Array;
  /** World extent covered by the grid: [-half, half] on x and z. */
  half: number;
  /** Bilinear sample at a world point; the prevailing wind outside the grid. */
  at(x: number, z: number): [number, number];
}

export function createWindField(field: IslandField, p: IslandParams): WindField {
  const half = RANGE * p.radius;
  const noise = createNoise2D(p.seed + 911);
  const [dx, dz] = WIND_DIR;
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  const data = new Float32Array(WIND_GRID * WIND_GRID * 2);
  const eps = 0.5;
  const psi = (x: number, z: number) => noise((x / p.radius) * 1.6 + 7, (z / p.radius) * 1.6 - 3);

  for (let j = 0; j < WIND_GRID; j++) {
    for (let i = 0; i < WIND_GRID; i++) {
      const x = (i / (WIND_GRID - 1) * 2 - 1) * half;
      const z = (j / (WIND_GRID - 1) * 2 - 1) * half;
      let vx = ux, vz = uz;
      for (const peak of field.peaks) {
        const a = peak.radius * 0.7; // the peak's footprint as a cylinder
        const weight = Math.min(peak.height / Math.max(p.peakHeight, 1), 1);
        // Rotate into the wind's frame: s along the wind, n across it.
        const rx = x - peak.x, rz = z - peak.z;
        const s = rx * ux + rz * uz, n = -rx * uz + rz * ux;
        const r2 = Math.max(s * s + n * n, (a * 0.5) ** 2);
        // Ideal flow past a cylinder: u - iv = U (1 - a² / w²), w = s + i n.
        const k = (a * a) / (r2 * r2);
        let us = 1 - k * (s * s - n * n);
        let un = -k * (2 * s * n);
        // Wake: calmer air in a band behind the peak.
        if (s > 0) {
          const calm = WAKE * Math.exp(-((n / (a * 1.2)) ** 2)) * Math.exp(-s / (a * 4));
          us *= 1 - calm;
          un *= 1 - calm;
        }
        vx += weight * (us * ux - un * uz - ux);
        vz += weight * (us * uz + un * ux - uz);
      }
      // Curl noise: the gradient of a noise field turned 90 degrees.
      const gx = (psi(x + eps, z) - psi(x - eps, z)) / (2 * eps);
      const gz = (psi(x, z + eps) - psi(x, z - eps)) / (2 * eps);
      vx += EDDY * p.radius * gz;
      vz += -EDDY * p.radius * gx;
      data[(j * WIND_GRID + i) * 2] = vx;
      data[(j * WIND_GRID + i) * 2 + 1] = vz;
    }
  }

  const at = (x: number, z: number): [number, number] => {
    const fx = ((x / half + 1) / 2) * (WIND_GRID - 1);
    const fz = ((z / half + 1) / 2) * (WIND_GRID - 1);
    if (fx < 0 || fz < 0 || fx > WIND_GRID - 1 || fz > WIND_GRID - 1) return [ux, uz];
    const i = Math.min(Math.floor(fx), WIND_GRID - 2), j = Math.min(Math.floor(fz), WIND_GRID - 2);
    const tx = fx - i, tz = fz - j;
    const v = (ii: number, jj: number, c: number) => data[(jj * WIND_GRID + ii) * 2 + c];
    const mix = (c: number) =>
      (v(i, j, c) * (1 - tx) + v(i + 1, j, c) * tx) * (1 - tz) + (v(i, j + 1, c) * (1 - tx) + v(i + 1, j + 1, c) * tx) * tz;
    return [mix(0), mix(1)];
  };
  return { data, half, at };
}
