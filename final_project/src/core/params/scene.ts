import { keyframesAround, type Theme, type TimeOfDay } from '../palette';
import type { IslandParams, SurfaceParams } from './island';

export interface SceneParams {
  theme: Theme;
  /** 0..24, continuous; palettes and sun height blend between the four keyframes. */
  hour: number;
  /** 0..1, strength of the one wind shared by everything that moves: 0 still. */
  wind: number;
}

export const DEFAULT_SCENE: SceneParams = {
  theme: 'qinglv',
  hour: 12,
  wind: 0.5,
};

/** Sun (or moon) elevation in degrees at each keyframe. Always low, so objects stay backlit. */
const SUN_ELEVATION: Record<TimeOfDay, number> = {
  dawn: 6,
  noon: 24,
  dusk: 4,
  night: 14,
};

/** Sun elevation at any hour, blended linearly between the keyframes. */
export function sunElevation(hour: number): number {
  const [a, b, t] = keyframesAround(hour);
  return SUN_ELEVATION[a] + (SUN_ELEVATION[b] - SUN_ELEVATION[a]) * t;
}

/**
 * How the Zhuyu flowers respond to the hour: `bloom` 1 is open (day), 0 a folded bud;
 * `glow` 1 is their own cold light (night). They fold as the sun goes down and start to glow at
 * the same time, and open again after sunrise.
 */
export function flowerPhase(hour: number): { bloom: number; glow: number } {
  const h = ((hour % 24) + 24) % 24;
  const soft = (a: number, b: number, x: number) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  };
  return {
    bloom: soft(5.5, 8, h) * (1 - soft(16.5, 19, h)),
    glow: Math.max(1 - soft(5, 7, h), soft(17, 19.5, h)),
  };
}

/** Shape of an island preset file in core/presets/. */
export interface IslandPreset {
  island: IslandParams;
  surface: SurfaceParams;
  scene: SceneParams;
}
