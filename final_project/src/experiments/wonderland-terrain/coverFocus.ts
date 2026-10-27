/**
 * Cover stream focus — retention around the camera; look-hit only prefetches.
 *
 * Walk: under the camera (slight look-ahead) so feet stay in the grass disc.
 * Orbit: **load/visibility** from camera→ground-under-foot; view ray only suggests
 * extra chunks to warm (prefetch). Turning the head must not unload grass at the feet.
 *
 * Load vs display use orbit-range (height weighted). This file is the single source
 * of truth — do not scatter magic numbers in CoverGrass.
 */
import type { Camera } from 'three';
import { Vector3 } from 'three';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';

/**
 * Sole Orbit/Walk cover-stream distances (metres / seconds).
 *
 * | Kind | Params | Meaning |
 * |---|---|---|
 * | Retention / load | loadOn / loadOff | Keep near grass when cam→foot range &lt; loadOn; drop only past loadOff |
 * | Display | fadeOn / fadeOff | Global visibility from **cam→foot** range (not look-hit) |
 * | Prefetch | prefetchMax | Look-hit may warm chunks if horiz(cam,hit) ≤ this |
 * | Per-blade | COVER_NEAR.fadeNear / fadeFar | Shader dither by camera→blade |
 * | Cache | COVER_NEAR.chunk / cacheMax | Keep chunks; unload when outside retention+prefetch budget |
 * | Miss | missHoldSec | Keep last look-hit this long for prefetch only |
 */
export const COVER_FOCUS = {
  walkLookAhead: 6,
  /** Re-assemble when retention centre moves more than this (m). */
  refocus: 16,
  /** Legacy mid-band label for probes. */
  nearView: 55,
  loadOn: 72,
  loadOff: 105,
  fadeOn: 48,
  fadeOff: 98,
  heightWeight: 0.4,
  raySteps: 96,
  /** Seconds to keep last look-hit for prefetch after a brief sky skim. */
  missHoldSec: 0.55,
  /** Look-hit farther than this (horiz m) does not pull prefetch chunks. */
  prefetchMax: 88,
};

export type CoverFocusMode = 'walk' | 'orbit';

export type CoverFocus = {
  /** Retention / assemble centre (camera foot or walk look-ahead). */
  x: number;
  z: number;
  /** Optional look-hit for prefetch (NaN if none). */
  prefetchX: number;
  prefetchZ: number;
  hasPrefetch: boolean;
  near: boolean;
  visibility: number;
  /** Cam→foot orbit-range used for load + global fade. */
  hitDist: number;
  /** Cam→look-hit orbit-range (diagnostics; does not drive unload). */
  lookDist: number;
  source: 'walk' | 'ray' | 'hold' | 'none';
};

export type CoverFocusLast = {
  x: number;
  z: number;
  near?: boolean;
  prefetchX?: number;
  prefetchZ?: number;
  /** performance.now() when ray last hit, or 0. */
  lastHitAt?: number;
};

const _dir = new Vector3();
const _p = new Vector3();

function softstep(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function onLand(grid: HeightGrid, x: number, z: number): number | null {
  const half = ((grid.size - 1) * grid.texel) / 2;
  if (Math.abs(x) > half * 0.98 || Math.abs(z) > half * 0.98) return null;
  const y = sampleGrid(grid, x, z);
  if (!(y > -50)) return null;
  if (sampleGrid(grid, x, z, 3) > -1.2) return null;
  return y;
}

export function orbitRange(
  camX: number, camY: number, camZ: number,
  hitX: number, hitY: number, hitZ: number,
): number {
  const horiz = Math.hypot(hitX - camX, hitZ - camZ);
  const vert = Math.abs(camY - hitY);
  return Math.hypot(horiz, vert * COVER_FOCUS.heightWeight);
}

/** Ground under the camera (XZ). Retention centre for Orbit. */
export function cameraFoot(grid: HeightGrid, camera: Camera): { x: number; z: number; y: number } | null {
  const x = camera.position.x, z = camera.position.z;
  const y = onLand(grid, x, z);
  if (y === null) return null;
  return { x, z, y };
}

export function groundLookAt(grid: HeightGrid, camera: Camera): { x: number; z: number; y: number } | null {
  camera.getWorldDirection(_dir);
  _p.copy(camera.position);
  for (let k = 0; k < COVER_FOCUS.raySteps; k++) {
    const gy = onLand(grid, _p.x, _p.z);
    const above = gy === null ? Infinity : _p.y - gy;
    if (gy !== null && above <= 0.85) return { x: _p.x, z: _p.z, y: gy };
    const step = Number.isFinite(above) ? Math.max(above * 0.45, 2) : 45;
    _p.addScaledVector(_dir, step);
    if (_p.y < -250) return null;
  }
  return null;
}

function visibilityFromDist(dist: number): number {
  if (!(dist < Infinity)) return 0;
  return 1 - softstep(COVER_FOCUS.fadeOn, COVER_FOCUS.fadeOff, dist);
}

function loadWithHysteresis(dist: number, wasNear: boolean): boolean {
  if (!(dist < Infinity)) return false;
  if (dist < COVER_FOCUS.loadOn) return true;
  if (dist > COVER_FOCUS.loadOff) return false;
  return wasNear;
}

function prefetchFromHit(
  camera: Camera,
  hit: { x: number; z: number; y: number } | null,
): { prefetchX: number; prefetchZ: number; hasPrefetch: boolean; lookDist: number } {
  if (!hit) {
    return { prefetchX: NaN, prefetchZ: NaN, hasPrefetch: false, lookDist: Infinity };
  }
  const lookDist = orbitRange(
    camera.position.x, camera.position.y, camera.position.z,
    hit.x, hit.y, hit.z,
  );
  const horiz = Math.hypot(hit.x - camera.position.x, hit.z - camera.position.z);
  if (horiz > COVER_FOCUS.prefetchMax) {
    return { prefetchX: NaN, prefetchZ: NaN, hasPrefetch: false, lookDist };
  }
  return { prefetchX: hit.x, prefetchZ: hit.z, hasPrefetch: true, lookDist };
}

export function resolveCoverFocus(
  grid: HeightGrid,
  camera: Camera,
  mode: CoverFocusMode,
  last: CoverFocusLast,
  now = performance.now(),
): CoverFocus {
  const wasNear = !!last.near;

  if (mode === 'walk') {
    camera.getWorldDirection(_dir);
    const flat = Math.hypot(_dir.x, _dir.z) || 1;
    const x = camera.position.x + (_dir.x / flat) * COVER_FOCUS.walkLookAhead;
    const z = camera.position.z + (_dir.z / flat) * COVER_FOCUS.walkLookAhead;
    return {
      x, z,
      prefetchX: NaN, prefetchZ: NaN, hasPrefetch: false,
      near: true, visibility: 1, hitDist: 0, lookDist: 0, source: 'walk',
    };
  }

  // Retention: ground under the camera — turning the head does not move this.
  const foot = cameraFoot(grid, camera);
  const hitDist = foot
    ? orbitRange(camera.position.x, camera.position.y, camera.position.z, foot.x, foot.y, foot.z)
    : Infinity;
  const near = loadWithHysteresis(hitDist, wasNear);
  const visibility = visibilityFromDist(hitDist);
  const rx = foot ? foot.x : (Number.isFinite(last.x) ? last.x : camera.position.x);
  const rz = foot ? foot.z : (Number.isFinite(last.z) ? last.z : camera.position.z);

  const hit = groundLookAt(grid, camera);
  if (hit) {
    const pref = prefetchFromHit(camera, hit);
    return {
      x: rx, z: rz,
      ...pref,
      near, visibility, hitDist,
      source: 'ray',
    };
  }

  // Miss: keep last look-hit briefly for prefetch only; never clear retention for sky skim.
  const age = last.lastHitAt ? (now - last.lastHitAt) / 1000 : Infinity;
  if (age <= COVER_FOCUS.missHoldSec && Number.isFinite(last.prefetchX) && Number.isFinite(last.prefetchZ)) {
    const gy = onLand(grid, last.prefetchX!, last.prefetchZ!);
    const heldHit = gy === null ? null : { x: last.prefetchX!, z: last.prefetchZ!, y: gy };
    const pref = prefetchFromHit(camera, heldHit);
    return {
      x: rx, z: rz,
      ...pref,
      near, visibility, hitDist,
      source: 'hold',
    };
  }

  return {
    x: rx, z: rz,
    prefetchX: NaN, prefetchZ: NaN, hasPrefetch: false,
    near, visibility, hitDist, lookDist: Infinity,
    source: foot ? 'hold' : 'none',
  };
}
