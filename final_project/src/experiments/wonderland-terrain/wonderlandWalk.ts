import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { WALK, type Walker, type WalkInput } from '../../core/walk';
import { waterDepth, walkable, type DwellWorld } from './dwelling';
import { ZONE, zoneAt, type Zones } from './zones';

/**
 * Wonderland first-person browse — eye height from Penglai `WALK`, speeds tuned for island browse
 * (not the 1.3 m/s outdoor-walk default). Horizontal heading only; eye Y follows terrain separately.
 */

/** Interactive browse speeds (m/s). Defaults for demo — not physical standards. */
export const WONDER_BROWSE = {
  /** Comfortable island browse (default). */
  browse: 3.0,
  /** Real-ish walk when the panel is set near this. */
  walk: 1.4,
  /** Shift hold — absolute run speed. */
  run: 5.0,
  /** Approach target speed while keys held (/s). */
  accel: 14,
  /** Brake when no input (/s) — short stop, not a long slide. */
  stop: 22,
  /** Eye settle onto ground (/s). */
  settle: 12,
  eyeHeight: WALK.eyeHeight,
  maxClimb: WALK.maxClimb,
};

const EYE = WONDER_BROWSE.eyeHeight;
const FORBID = new Set<number>([ZONE.outside, ZONE.water, ZONE.terrace, ZONE.cliff, ZONE.ridge, ZONE.rockSlope]);

export function wonderFeetAt(world: DwellWorld, x: number, z: number): number | null {
  if (!walkable(world, x, z)) return null;
  if (FORBID.has(zoneAt(world.zones as Zones, x, z))) return null;
  if (waterDepth(world, x, z) >= 0.02) return null;
  const y = sampleGrid(world.grid, x, z);
  return Number.isFinite(y) ? y : null;
}

function canStep(world: DwellWorld, x0: number, z0: number, x1: number, z1: number): boolean {
  const to = wonderFeetAt(world, x1, z1);
  const from = wonderFeetAt(world, x0, z0);
  if (to === null || from === null) return false;
  const run = Math.hypot(x1 - x0, z1 - z0);
  return run === 0 || (to - from) / run <= WONDER_BROWSE.maxClimb;
}

/**
 * Spawn on walkable land. Prefer ~6–12 m from `near` (creature home) so Walk opens on the
 * dwelling; otherwise search the island (habitat / open / wetShore / woodland).
 */
export function spawnWonderWalker(
  world: DwellWorld,
  zones: Zones,
  near?: { x: number; z: number } | null,
): { walker: Walker; heading: number } {
  const e = 1.2;
  const prefer = new Set<number>([ZONE.habitat, ZONE.open, ZONE.wetShore, ZONE.woodland]);

  if (near && Number.isFinite(near.x) && Number.isFinite(near.z)) {
    let pick: { x: number; z: number; score: number } | null = null;
    for (const dist of [8, 6, 10, 12, 5, 14]) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2 + dist * 0.17;
        const x = near.x + Math.cos(ang) * dist;
        const z = near.z + Math.sin(ang) * dist;
        const h = wonderFeetAt(world, x, z);
        if (h === null) continue;
        const zk = zoneAt(zones, x, z);
        if (!prefer.has(zk) && zk !== ZONE.habitat) continue;
        const hx = wonderFeetAt(world, x + e, z);
        const hz = wonderFeetAt(world, x, z + e);
        if (hx === null || hz === null) continue;
        const slope = Math.hypot(hx - h, hz - h) / e;
        // Prefer clear sight of the home: stand slightly downhill/side, face home.
        const score = slope * 4 + Math.abs(dist - 8) * 0.15;
        if (!pick || score < pick.score) pick = { x, z, score };
      }
      if (pick && pick.score < 2) break;
    }
    if (pick) {
      const y = (wonderFeetAt(world, pick.x, pick.z) ?? 0) + EYE;
      const heading = Math.atan2(near.z - pick.z, near.x - pick.x);
      return { walker: { x: pick.x, z: pick.z, y, vx: 0, vz: 0 }, heading };
    }
  }

  const samples = 800;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const half = ((world.grid.size - 1) * world.grid.texel) / 2;
  let best = { x: 0, z: 0, score: Infinity };
  for (let i = 0; i < samples; i++) {
    const r = Math.sqrt((i + 0.5) / samples) * half * 0.72;
    const x = Math.cos(i * golden) * r;
    const z = Math.sin(i * golden) * r;
    const h = wonderFeetAt(world, x, z);
    if (h === null) continue;
    const zk = zoneAt(zones, x, z);
    if (!prefer.has(zk)) continue;
    const hx = wonderFeetAt(world, x + e, z);
    const hz = wonderFeetAt(world, x, z + e);
    if (hx === null || hz === null) continue;
    const slope = Math.hypot(hx - h, hz - h) / e;
    const score = slope * 5 + (zk === ZONE.habitat ? 0 : zk === ZONE.open ? 0.2 : 0.45);
    if (score < best.score) best = { x, z, score };
  }
  if (!Number.isFinite(best.score) || best.score === Infinity) {
    for (let i = 0; i < samples; i++) {
      const r = Math.sqrt((i + 0.5) / samples) * half * 0.8;
      const x = Math.cos(i * golden) * r, z = Math.sin(i * golden) * r;
      if (wonderFeetAt(world, x, z) !== null) { best = { x, z, score: 0 }; break; }
    }
  }
  const y = (wonderFeetAt(world, best.x, best.z) ?? 0) + EYE;
  const lookX = -best.x, lookZ = -best.z;
  const heading = Math.hypot(lookX, lookZ) > 1 ? Math.atan2(lookZ, lookX) : 0;
  return { walker: { x: best.x, z: best.z, y, vx: 0, vz: 0 }, heading };
}

/**
 * One step. `speed` = panel base (m/s). Shift uses absolute `WONDER_BROWSE.run`.
 * Diagonal input is normalised. Stop uses a higher rate than start.
 */
export function stepWonderWalker(world: DwellWorld, w: Walker, input: WalkInput, speed: number, dt: number): Walker {
  const fx = Math.cos(input.heading), fz = Math.sin(input.heading);
  const rx = -fz, rz = fx;
  let dx = fx * input.forward + rx * input.strafe;
  let dz = fz * input.forward + rz * input.strafe;
  const len = Math.hypot(dx, dz);
  if (len > 0) [dx, dz] = [dx / len, dz / len];
  const target = input.run ? WONDER_BROWSE.run : speed;
  const rate = len > 0 ? WONDER_BROWSE.accel : WONDER_BROWSE.stop;
  const ease = 1 - Math.exp(-dt * rate);
  let vx = w.vx + (dx * target - w.vx) * ease;
  let vz = w.vz + (dz * target - w.vz) * ease;
  // Snap tiny residual after release so we do not crawl forever.
  if (len === 0 && Math.hypot(vx, vz) < 0.05) { vx = 0; vz = 0; }

  let { x, z } = w;
  const nx = x + vx * dt, nz = z + vz * dt;
  if (canStep(world, x, z, nx, nz)) [x, z] = [nx, nz];
  else if (canStep(world, x, z, nx, z)) [x, vz] = [nx, 0];
  else if (canStep(world, x, z, x, nz)) [z, vx] = [nz, 0];
  else [vx, vz] = [0, 0];

  const eye = (wonderFeetAt(world, x, z) ?? w.y - EYE) + EYE;
  const y = w.y + (eye - w.y) * (1 - Math.exp(-dt * WONDER_BROWSE.settle));
  return { x, z, y, vx, vz };
}

export function groundHeight(grid: HeightGrid, x: number, z: number): number {
  return sampleGrid(grid, x, z);
}
