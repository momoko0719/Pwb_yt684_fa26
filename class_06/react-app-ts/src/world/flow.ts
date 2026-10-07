import { smoothstep } from './noise';
import { nearest } from './spline';
import { RIVER_WIDTH, SIZE, type Land, type Stroke } from './terrain';

/** A whirlpool the visitor dropped: positive strength turns counter-clockwise. */
export interface Vortex {
  x: number;
  z: number;
  strength: number;
}

export interface FlowParams {
  /** Speed of the river current along the drawn direction. */
  current: number;
  wind: number;
  /** Wind direction, radians. */
  windAngle: number;
}

const G = 80; // field cells across
const VORTEX_RADIUS = 9;

/**
 * A vector field: one 2D velocity per grid cell, summed from three sources.
 * - River current: near a river, water flows along the stroke, in the direction it was drawn.
 * - Vortices: each whirlpool adds a swirl (tangent to the circle around it) and a slight pull inward.
 * - Wind: a steady direction plus curl noise, which bends it into eddies without sinks or sources.
 * Particles then read this field every frame and move with it.
 */
export function buildFlow(land: Land, strokes: Stroke[], vortices: Vortex[], p: FlowParams) {
  const vx = new Float32Array(G * G);
  const vz = new Float32Array(G * G);
  const cell = SIZE / G;
  const rivers = strokes.filter((s) => s.kind === 'river');
  const e = 0.5;
  const potential = (x: number, z: number) => land.noise(x * 0.06 + 13, z * 0.06 - 7);

  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const x = -SIZE / 2 + (i + 0.5) * cell;
      const z = -SIZE / 2 + (j + 0.5) * cell;
      let fx = 0;
      let fz = 0;
      let water = 0;
      for (const r of rivers) {
        const near = nearest(r.path, x, z);
        const w = 1 - smoothstep(RIVER_WIDTH * 0.4, RIVER_WIDTH * 3.5, near.dist);
        fx += near.tx * p.current * w;
        fz += near.tz * p.current * w;
        water = Math.max(water, w);
      }
      for (const v of vortices) {
        const dx = x - v.x;
        const dz = z - v.z;
        const r = Math.hypot(dx, dz) + 0.5;
        const fall = Math.exp(-((r / VORTEX_RADIUS) ** 2));
        fx += ((-dz / r) * v.strength - (dx / r) * Math.abs(v.strength) * 0.25) * fall;
        fz += ((dx / r) * v.strength - (dz / r) * Math.abs(v.strength) * 0.25) * fall;
      }
      // Curl noise: rotate the gradient of a noise potential by 90 degrees.
      const curlX = (potential(x, z + e) - potential(x, z - e)) / (2 * e);
      const curlZ = -(potential(x + e, z) - potential(x - e, z)) / (2 * e);
      const air = 1 - 0.7 * water; // over the river the current dominates
      fx += (Math.cos(p.windAngle) * p.wind + curlX * p.wind * 6) * air;
      fz += (Math.sin(p.windAngle) * p.wind + curlZ * p.wind * 6) * air;
      vx[j * G + i] = fx;
      vz[j * G + i] = fz;
    }
  }

  /** Bilinear lookup of the field at a world position. */
  const sample = (x: number, z: number): [number, number] => {
    const fx = Math.min(Math.max((x + SIZE / 2) / cell - 0.5, 0), G - 1.001);
    const fz = Math.min(Math.max((z + SIZE / 2) / cell - 0.5, 0), G - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const m = (a: Float32Array) =>
      (a[j * G + i] * (1 - u) + a[j * G + i + 1] * u) * (1 - v) + (a[(j + 1) * G + i] * (1 - u) + a[(j + 1) * G + i + 1] * u) * v;
    return [m(vx), m(vz)];
  };
  return { sample, G, vx, vz };
}

export type Flow = ReturnType<typeof buildFlow>;
