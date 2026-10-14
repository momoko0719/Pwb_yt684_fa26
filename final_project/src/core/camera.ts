import type { IslandField } from './generators/island';
import type { IslandParams } from './params/island';

/**
 * Keeps the orbit camera out of the island. Over the top it stays a little above the ground; under
 * the island it stays a little below the hanging rock; near the cliff it keeps the same clearance.
 * Pure: returns the corrected height, or null when the camera is already clear.
 */
export const CAMERA_CLEARANCE = 1.5; // world units on a radius-31 island; scales with the radius
const EDGE = 1.03; // checks reach a little past the rim, so the near plane does not graze the cliff

export function clearHeight(field: IslandField, p: IslandParams, x: number, y: number, z: number): number | null {
  const angle = Math.atan2(z, x);
  const rho = Math.hypot(x, z) / field.rim(angle);
  if (rho > EDGE) return null;
  const clearance = CAMERA_CLEARANCE * (p.radius / 31);
  const t = Math.min(rho, 1);
  const top = field.heightAt(x, z, t);
  const bottom = field.rimY - field.depthAt(x, z, t, field.wallPower(angle));
  if (y > top + clearance || y < bottom - clearance) return null;
  // Inside the rock or too close to it: leave by the nearer side.
  return y - bottom < top - y ? bottom - clearance : top + clearance;
}
