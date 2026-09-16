/**
 * erosion.ts  —  Hydraulic Erosion Simulation
 * ─────────────────────────────────────────────
 *
 * WHAT IS HYDRAULIC EROSION?
 * Hydraulic erosion is the physical process where flowing water reshapes terrain:
 *   • Rain hits the ground → forms tiny streams
 *   • Streams carry loose sediment (soil/rock particles) downhill
 *   • Where water slows (flat areas, valleys) it drops the sediment
 *   • Over time, this carves valleys, sharpens ridges, and smooths plains
 *
 * WHY IS IT IMPORTANT?
 * Raw noise looks "bumpy" in all directions with no sense of natural flow.
 * Hydraulic erosion makes terrain look BELIEVABLE because:
 *   • Mountains get sharp ridges and eroded valleys
 *   • Rivers and drainage channels emerge naturally
 *   • Flat areas accumulate sediment deposits (like alluvial plains)
 *   • The result matches patterns we see in real-world satellite imagery
 *
 * ALGORITHM (particle-based, after Sebastian Lague / Beyer 2015):
 *   For each simulated water droplet:
 *     1. Start at random position on the heightmap
 *     2. Roll downhill following the surface gradient (slope direction)
 *     3. Pick up sediment (erode) where it moves fast / slope is steep
 *     4. Deposit sediment where it slows down or the slope flattens
 *     5. Evaporate gradually — droplet lifetime is limited
 *     6. Repeat for thousands of droplets → cumulative terrain change
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ErosionSettings {
  /** Droplets simulated per animation step (more = faster erosion but slower per step) */
  dropletsPerStep: number;   // default 3 000,  range 500–20 000
  /** How much the droplet's direction persists. 0 = instant turn, 1 = straight. */
  inertia: number;           // default 0.05,   range 0.0–0.9
  /** Maximum sediment a droplet carries per unit speed × slope. */
  sedimentCapacity: number;  // default 8,      range 1–20
  /** Fraction of the capacity–sediment gap eroded per step. */
  erosionRate: number;       // default 0.3,    range 0.01–0.9
  /** Fraction of excess sediment deposited per step. */
  depositionRate: number;    // default 0.3,    range 0.01–0.9
  /** Fraction of water evaporated each step. */
  evaporation: number;       // default 0.02,   range 0.001–0.2
  /** Gravity constant — steeper = faster droplets. */
  gravity: number;           // default 4,      range 1–20
  /** Max steps a droplet travels before stopping. */
  maxSteps: number;          // default 64,     range 8–256
  /** Minimum effective slope (prevents erosion on perfectly flat ground). */
  minSlope: number;          // default 0.001
}

export const DEFAULT_EROSION: ErosionSettings = {
  dropletsPerStep:  3000,
  inertia:          0.05,
  sedimentCapacity: 8,
  erosionRate:      0.3,
  depositionRate:   0.3,
  evaporation:      0.02,
  gravity:          4,
  maxSteps:         64,
  minSlope:         0.001,
};

// ─── Heightmap helpers ───────────────────────────────────────────────────────

/** Bilinear interpolation: read height at floating-point (x, y). */
function sampleH(map: Float32Array, res: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const c = (r: number, c: number) => map[Math.max(0, Math.min(res - 1, r)) * res + Math.max(0, Math.min(res - 1, c))];
  return c(yi, xi) * (1 - fx) * (1 - fy)
       + c(yi, xi + 1) * fx * (1 - fy)
       + c(yi + 1, xi) * (1 - fx) * fy
       + c(yi + 1, xi + 1) * fx * fy;
}

/** Surface gradient at (x, y) using central finite differences. */
function gradient(map: Float32Array, res: number, x: number, y: number): [number, number] {
  return [
    sampleH(map, res, x + 0.5, y) - sampleH(map, res, x - 0.5, y),
    sampleH(map, res, x, y + 0.5) - sampleH(map, res, x, y - 0.5),
  ];
}

/** Bilinear deposition: add `amount` distributed to the 4 surrounding cells. */
function deposit(map: Float32Array, res: number, x: number, y: number, amount: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const clamp = (v: number) => Math.max(0, Math.min(res - 1, v));
  map[clamp(yi)     * res + clamp(xi)]     += amount * (1 - fx) * (1 - fy);
  map[clamp(yi)     * res + clamp(xi + 1)] += amount * fx       * (1 - fy);
  map[clamp(yi + 1) * res + clamp(xi)]     += amount * (1 - fx) * fy;
  map[clamp(yi + 1) * res + clamp(xi + 1)] += amount * fx       * fy;
}

// ─── Main erosion function ───────────────────────────────────────────────────

/**
 * Runs one simulation step (dropletsPerStep droplets) on a COPY of `map`.
 * Returns the new heightmap (values may temporarily exceed 0–1; call normalise after).
 */
export function runErosionStep(
  map: Float32Array,
  resolution: number,
  s: ErosionSettings = DEFAULT_EROSION
): Float32Array {
  const result = new Float32Array(map); // work on a copy
  const { dropletsPerStep, inertia, sedimentCapacity, erosionRate,
          depositionRate, evaporation, gravity, maxSteps, minSlope } = s;

  for (let d = 0; d < dropletsPerStep; d++) {
    // ── 1. Spawn droplet at random position ─────────────────────────────────
    let x   = Math.random() * (resolution - 2) + 0.5;
    let y   = Math.random() * (resolution - 2) + 0.5;
    let dx  = 0, dy = 0;           // current direction
    let speed    = 1;              // current speed
    let water    = 1;              // remaining water
    let sediment = 0;             // sediment currently carried

    for (let step = 0; step < maxSteps; step++) {
      // ── 2. Compute gradient and update direction ─────────────────────────
      const [gx, gy] = gradient(result, resolution, x, y);
      dx = dx * inertia - gx * (1 - inertia);
      dy = dy * inertia - gy * (1 - inertia);

      // Normalise direction (if stuck, stop)
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-5) break;
      dx /= len; dy /= len;

      const oldX = x, oldY = y;
      x += dx; y += dy;

      // ── 3. Bounds check ─────────────────────────────────────────────────
      if (x < 0.5 || x >= resolution - 1.5 || y < 0.5 || y >= resolution - 1.5) break;

      // ── 4. Height difference at new position ────────────────────────────
      const oldH = sampleH(result, resolution, oldX, oldY);
      const newH = sampleH(result, resolution, x, y);
      const dh   = newH - oldH; // negative = moving downhill

      // ── 5. Sediment capacity (function of slope and speed) ───────────────
      const capacity = Math.max(-dh, minSlope) * speed * water * sedimentCapacity;

      if (sediment > capacity || dh > 0) {
        // ── 6a. Going uphill or over capacity → deposit ────────────────────
        const depositAmt = dh > 0
          ? Math.min(sediment, dh)                    // fill hollow going uphill
          : (sediment - capacity) * depositionRate;
        deposit(result, resolution, oldX, oldY, depositAmt);
        sediment -= depositAmt;
      } else {
        // ── 6b. Going downhill with capacity → erode ──────────────────────
        const erodeAmt = Math.min((capacity - sediment) * erosionRate, -dh);
        deposit(result, resolution, oldX, oldY, -erodeAmt); // negative = remove height
        sediment += erodeAmt;
      }

      // ── 7. Update physics ────────────────────────────────────────────────
      speed = Math.sqrt(Math.max(0, speed * speed + Math.abs(dh) * gravity));
      water *= (1 - evaporation);
      if (water < 0.01) break;
    }

    // Deposit remaining sediment at final position
    deposit(result, resolution, x, y, sediment * depositionRate);
  }

  // Renormalise to 0–1 (erosion can push values slightly outside range)
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < result.length; i++) {
    if (result[i] < min) min = result[i];
    if (result[i] > max) max = result[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < result.length; i++) result[i] = (result[i] - min) / range;

  return result;
}
