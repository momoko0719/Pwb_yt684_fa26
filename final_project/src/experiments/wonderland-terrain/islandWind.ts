import { createNoise2D } from '../../core/noise';
import { WIND_DIR, WIND_GRID, type WindField } from '../../core/generators/wind';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';

/**
 * White Jade Island's wind as a vector field (the same shape as Penglai's, core/generators/wind.ts,
 * so the grass and flower shaders read it the same way), from the ground as built:
 *
 * 1. the prevailing wind, along WIND_DIR;
 * 2. turned aside by rising ground: the part of it that would blow uphill is turned along the
 *    slope, more the steeper it is, so the air goes round the peaks and down the valleys;
 * 3. faster where the ground stands above its surroundings (crests, the rim), slower in hollows;
 * 4. stilled in the lee: behind ground that stands higher upwind, the air is calm;
 * 5. small eddies, curl noise (they never pile up or drain away).
 *
 * Pure: the same ground and seed give the same field.
 */
const RULE = {
  /** Metres over which the ground's slope is read (the air feels hills, not stones). */
  reach: 24,
  /** How much of the uphill part is turned along the slope, at full steepness. */
  turn: 0.85,
  /** Slope at which the turning is full. */
  steep: 0.7,
  /** Exposure: the speed grows by 1 for every `per` metres the ground stands above the ring `ring` m round it. */
  exposure: { ring: 30, per: 45, least: 0.6, most: 1.5 },
  /** Lee: ground this much higher upwind (allowing a fall of `drop` per metre) calms the air fully. */
  lee: { at: [25, 50, 90], drop: 0.12, full: 40, calm: 0.7 },
  eddy: { scale: 140, size: 0.14 },
};

export function islandWind(grid: HeightGrid, seed: number): WindField {
  const half = ((grid.size - 1) / 2) * grid.texel * 1.1;
  const [dx, dz] = WIND_DIR;
  const len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const noise = createNoise2D(seed + 913);
  // Off the island the air is open: its height counts as the island's lowest.
  const H = (x: number, z: number) => (sampleGrid(grid, x, z, 3) > 0 ? grid.bottom : sampleGrid(grid, x, z));
  const psi = (x: number, z: number) => noise(x / RULE.eddy.scale + 11, z / RULE.eddy.scale - 5);
  const data = new Float32Array(WIND_GRID * WIND_GRID * 2);
  const R = RULE.reach, E = RULE.exposure, L = RULE.lee;
  for (let j = 0; j < WIND_GRID; j++) for (let i = 0; i < WIND_GRID; i++) {
    const x = (i / (WIND_GRID - 1) * 2 - 1) * half, z = (j / (WIND_GRID - 1) * 2 - 1) * half;
    const h = H(x, z);
    let vx = ux, vz = uz;
    // 2. Round the hills: turn the uphill part along the contour.
    const gx = (H(x + R, z) - H(x - R, z)) / (2 * R), gz = (H(x, z + R) - H(x, z - R)) / (2 * R);
    const g = Math.hypot(gx, gz);
    if (g > 1e-4) {
      const nx = gx / g, nz = gz / g, up = vx * nx + vz * nz;
      if (up > 0) {
        const k = RULE.turn * Math.min(g / RULE.steep, 1);
        vx -= nx * up * k; vz -= nz * up * k;
        const m = Math.hypot(vx, vz) || 1;
        vx /= m; vz /= m; // the air keeps its speed going round
      }
    }
    // 3. Exposure against the ground round about.
    let ring = 0;
    for (let a = 0; a < 8; a++) ring += H(x + Math.cos(a * Math.PI / 4) * E.ring, z + Math.sin(a * Math.PI / 4) * E.ring);
    let speed = Math.min(Math.max(1 + (h - ring / 8) / E.per, E.least), E.most);
    // 4. The lee of higher ground upwind.
    let block = 0;
    for (const d of L.at) block = Math.max(block, H(x - ux * d, z - uz * d) - h - d * L.drop);
    const s = Math.min(Math.max(block / L.full, 0), 1);
    speed *= 1 - L.calm * s * s * (3 - 2 * s);
    vx *= speed; vz *= speed;
    // 5. Eddies: the noise's gradient turned a quarter.
    const e = 2;
    const cx = (psi(x + e, z) - psi(x - e, z)) / (2 * e), cz = (psi(x, z + e) - psi(x, z - e)) / (2 * e);
    vx += RULE.eddy.size * RULE.eddy.scale * cz;
    vz += -RULE.eddy.size * RULE.eddy.scale * cx;
    data[(j * WIND_GRID + i) * 2] = vx;
    data[(j * WIND_GRID + i) * 2 + 1] = vz;
  }
  const at = (x: number, z: number): [number, number] => {
    const fx = ((x / half + 1) / 2) * (WIND_GRID - 1), fz = ((z / half + 1) / 2) * (WIND_GRID - 1);
    if (fx < 0 || fz < 0 || fx > WIND_GRID - 1 || fz > WIND_GRID - 1) return [ux, uz];
    const i = Math.min(Math.floor(fx), WIND_GRID - 2), j = Math.min(Math.floor(fz), WIND_GRID - 2);
    const tx = fx - i, tz = fz - j;
    const v = (ii: number, jj: number, c: number) => data[(jj * WIND_GRID + ii) * 2 + c];
    const mix = (c: number) => (v(i, j, c) * (1 - tx) + v(i + 1, j, c) * tx) * (1 - tz) + (v(i, j + 1, c) * (1 - tx) + v(i + 1, j + 1, c) * tx) * tz;
    return [mix(0), mix(1)];
  };
  return { data, half, at };
}
