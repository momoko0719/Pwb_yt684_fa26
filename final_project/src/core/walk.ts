import type { IslandField } from './generators/island';
import type { IslandParams } from './params/island';

/**
 * Walking on an island: a first-person visitor who follows the ground, cannot climb steep rock,
 * cannot step off the rim, and wades into pools. Pure functions, so they can be tested outside
 * the browser: same state and input, same next state.
 */

/** Tuning, in world units for a radius-31 island; lengths and speeds scale with the radius. */
export const WALK = {
  eyeHeight: 1.7,
  runFactor: 2.5,
  /** How quickly speed follows the keys, per second: a short start and a short stop. */
  accel: 8,
  /** How quickly the eye follows the ground up and down, per second. */
  settle: 10,
  /** Steepest climb, rise over run: about 45 degrees. Downhill is always allowed. */
  maxClimb: 1,
  /** Stop at this fraction of the rim, so the visitor can stand at the edge and look down. */
  edge: 0.97,
  /** How far the feet sink below a pool's surface while wading. */
  wade: 0.35,
  referenceRadius: 31,
};

export interface Walker {
  x: number;
  z: number;
  /** Eye height (world y), eased toward the ground. */
  y: number;
  vx: number;
  vz: number;
}

export interface WalkInput {
  /** -1 back, 0, 1 forward. */
  forward: number;
  /** -1 left, 0, 1 right. */
  strafe: number;
  run: boolean;
  /** Heading of the camera: the horizontal direction it looks along, as an angle (atan2(z, x)). */
  heading: number;
}

/** Scale of the walker on this island. */
const scaleOf = (p: IslandParams) => p.radius / WALK.referenceRadius;

/**
 * Height of the feet at a point: the ground, or while wading, a little under the pool's surface.
 * Null past the rim.
 */
export function feetAt(field: IslandField, x: number, z: number): number | null {
  const ground = field.top(x, z);
  if (ground === null) return null;
  const pool = field.pools.find((q) => Math.hypot(x - q.x, z - q.z) < q.radius && ground < q.level);
  return pool ? Math.max(ground, pool.level - WALK.wade) : ground;
}

/** Whether a step from (x0, z0) to (x1, z1) is allowed: on the island, inside the edge, not too steep. */
function canStep(field: IslandField, x0: number, z0: number, x1: number, z1: number): boolean {
  const to = feetAt(field, x1, z1);
  const from = feetAt(field, x0, z0);
  if (to === null || from === null) return false;
  if (Math.hypot(x1, z1) > WALK.edge * field.rim(Math.atan2(z1, x1))) return false;
  const run = Math.hypot(x1 - x0, z1 - z0);
  return run === 0 || (to - from) / run <= WALK.maxClimb;
}

/** Where to start: flat meadow near the middle, a little way from the main peak, facing it. */
export function spawnWalker(field: IslandField, p: IslandParams): { walker: Walker; heading: number } {
  const main = field.peaks[0] ?? { x: 0, z: 0, radius: p.radius * 0.3 };
  const samples = 600;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const e = p.radius / 64;
  let best = { x: 0, z: 0, score: Infinity };
  for (let i = 0; i < samples; i++) {
    const r = Math.sqrt((i + 0.5) / samples) * p.radius * 0.6;
    const x = Math.cos(i * golden) * r;
    const z = Math.sin(i * golden) * r;
    const h = feetAt(field, x, z);
    const hx = feetAt(field, x + e, z);
    const hz = feetAt(field, x, z + e);
    if (h === null || hx === null || hz === null) continue;
    if (field.pools.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius)) continue;
    const slope = Math.hypot(hx - h, hz - h) / e;
    const away = Math.abs(Math.hypot(x - main.x, z - main.z) - main.radius * 1.4) / p.radius;
    const score = slope * 4 + away + field.lift(x, z) / Math.max(p.peakHeight, 1);
    if (score < best.score) best = { x, z, score };
  }
  const y = (feetAt(field, best.x, best.z) ?? 0) + WALK.eyeHeight * scaleOf(p);
  return {
    walker: { x: best.x, z: best.z, y, vx: 0, vz: 0 },
    heading: Math.atan2(main.z - best.z, main.x - best.x),
  };
}

/**
 * One step of `dt` seconds. Speed eases toward what the keys ask for; a blocked move slides
 * along whichever axis is still free; the eye eases toward the feet plus the eye height.
 */
export function stepWalker(field: IslandField, p: IslandParams, w: Walker, input: WalkInput, speed: number, dt: number): Walker {
  const scale = scaleOf(p);
  const fx = Math.cos(input.heading);
  const fz = Math.sin(input.heading);
  // Right of the heading, for strafing (y up, so right is (-fz, fx) turned the other way).
  const rx = -fz;
  const rz = fx;
  let dx = fx * input.forward + rx * input.strafe;
  let dz = fz * input.forward + rz * input.strafe;
  const len = Math.hypot(dx, dz);
  if (len > 0) [dx, dz] = [dx / len, dz / len];
  const target = speed * scale * (input.run ? WALK.runFactor : 1);
  const ease = 1 - Math.exp(-dt * WALK.accel);
  let vx = w.vx + (dx * target - w.vx) * ease;
  let vz = w.vz + (dz * target - w.vz) * ease;

  let { x, z } = w;
  const nx = x + vx * dt;
  const nz = z + vz * dt;
  if (canStep(field, x, z, nx, nz)) [x, z] = [nx, nz];
  else if (canStep(field, x, z, nx, z)) [x, vz] = [nx, 0];
  else if (canStep(field, x, z, x, nz)) [z, vx] = [nz, 0];
  else [vx, vz] = [0, 0];

  const eye = (feetAt(field, x, z) ?? w.y - WALK.eyeHeight * scale) + WALK.eyeHeight * scale;
  const y = w.y + (eye - w.y) * (1 - Math.exp(-dt * WALK.settle));
  return { x, z, y, vx, vz };
}
