import { useMemo } from 'react';
import { button, useControls } from 'leva';
import { ridgeCurve } from '../../core/generators/island';
import { getPalette, nearestTimeOfDay, THEMES, type Theme } from '../../core/palette';
import type { IslandParams, SurfaceParams } from '../../core/params/island';
import type { IslandPreset, SceneParams } from '../../core/params/scene';
import penglai from '../../core/presets/penglai.json';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { curve } from '../../leva/curve';
import { sunArc } from '../../leva/sunArc';
import { swatches } from '../../leva/swatches';

const PRESET = penglai as IslandPreset;

export interface ViewParams {
  /** First-person walk on the island instead of the orbit view. */
  walk: boolean;
  /** Walking speed in world units per second on a radius-31 island (Shift runs faster). */
  walkSpeed: number;
}

const ridgePreview = (s: number): [number, number][] =>
  Array.from({ length: 49 }, (_, i) => [i / 48, ridgeCurve((i / 48) * 2 - 1, s)]);

/** Colors a theme swatch shows: sky, horizon, meadow, rock, mineral, key light. */
const themeColors = (theme: string, hour: unknown) => {
  const p = getPalette(theme as Theme, typeof hour === 'number' ? hour : PRESET.scene.hour);
  return [p.skyTop, p.skyHorizon, p.meadow, p.rock, p.mineral, p.lightWarm];
};

/**
 * All leva controls for island-v1. Labels and hints follow the site language;
 * the schemas rebuild on language change, and leva keeps the current values.
 */
export function useIslandControls(): IslandPreset & { view: ViewParams } {
  const { language, t } = useLanguage();
  const text = (key: string) => ({ label: t(`leva.${key}` as StringKey), hint: t(`hint.${key}` as StringKey) });
  const field = (key: keyof IslandParams, min: number, max: number, step: number) =>
    ({ value: PRESET.island[key], min, max, step, ...text(key) });

  const shape = useControls('Shape', {
    seed: field('seed', 0, 9999, 1),
    radius: field('radius', 6, 120, 0.5),
    taper: field('taper', 0, 1, 0.05),
    peakHeight: field('peakHeight', 0, 30, 0.5),
    peakCount: field('peakCount', 0, 8, 1),
    peakSpread: field('peakSpread', 0, 1, 0.05),
    frequency: field('frequency', 0.2, 6, 0.05),
    ridgeSharpness: curve({ current: PRESET.island.ridgeSharpness, min: 0, max: 1, step: 0.05, shape: ridgePreview, ...text('ridgeSharpness') }),
    undersideDepth: field('undersideDepth', 2, 100, 0.5),
    rockCount: field('rockCount', 1, 6, 1),
    resolution: field('resolution', 16, 256, 1),
  }, [language]);

  // Rock pools sit with the other water in Surface, but they carve the ground, so the value
  // belongs to the island parameters.
  const { poolCount, ...surfaceValues } = useControls('Surface', {
    meadowLine: { value: PRESET.surface.meadowLine, min: 0, max: 1, step: 0.001, ...text('meadowLine') },
    grassDensity: { value: PRESET.surface.grassDensity, min: 0, max: 1, step: 0.05, ...text('grassDensity') },
    grassHeight: { value: PRESET.surface.grassHeight, min: 0, max: 1, step: 0.05, ...text('grassHeight') },
    flowerDensity: { value: PRESET.surface.flowerDensity, min: 0, max: 1, step: 0.05, ...text('flowerDensity') },
    fallCount: { value: PRESET.surface.fallCount, min: 0, max: 6, step: 1, ...text('fallCount') },
    poolCount: field('poolCount', 0, 8, 1),
  }, [language]);
  // A new object only when a value changes: the island mesh and everything built from it are
  // memoized on this object, and regenerating them on every render would cost ~200 ms each time.
  const islandKey = JSON.stringify({ ...shape, poolCount });
  const island: IslandParams = useMemo(() => JSON.parse(islandKey), [islandKey]);
  const surfaceKey = JSON.stringify(surfaceValues);
  const surface: SurfaceParams = useMemo(() => JSON.parse(surfaceKey), [surfaceKey]);

  const atmosphere = useControls('Atmosphere', {
    hour: sunArc({ hour: PRESET.scene.hour, describe: (h) => t(`option.${nearestTimeOfDay(h)}` as StringKey), ...text('timeOfDay') }),
    theme: swatches({
      selected: PRESET.scene.theme,
      options: THEMES.map((v) => ({ value: v, label: t(`option.${v}` as StringKey) })),
      colors: themeColors,
      watch: 'Atmosphere.hour',
      ...text('theme'),
    }),
    wind: { value: PRESET.scene.wind, min: 0, max: 1, step: 0.05, ...text('wind') },
  }, [language]);

  const view = useControls('Camera', {
    walk: { value: false, ...text('walk') },
    walkSpeed: {
      value: 4, min: 1, max: 12, step: 0.5, ...text('walkSpeed'),
      render: (get) => get('Camera.walk'),
    },
  }, [language]);

  useControls('Export', {
    [t('leva.export')]: button((get) => {
      const exported: IslandPreset = {
        island: Object.fromEntries(Object.keys(PRESET.island).map((k) => [k, get(`${k === 'poolCount' ? 'Surface' : 'Shape'}.${k}`)])) as IslandParams,
        surface: {
          meadowLine: get('Surface.meadowLine'),
          fallCount: get('Surface.fallCount'),
          grassDensity: get('Surface.grassDensity'),
          grassHeight: get('Surface.grassHeight'),
          flowerDensity: get('Surface.flowerDensity'),
        },
        scene: { theme: get('Atmosphere.theme'), hour: get('Atmosphere.hour'), wind: get('Atmosphere.wind') },
      };
      const json = JSON.stringify(exported, null, 2);
      console.log(json);
      navigator.clipboard?.writeText(json);
    }),
  }, [language]);

  const scene: SceneParams = {
    theme: atmosphere.theme as Theme,
    hour: atmosphere.hour,
    wind: atmosphere.wind,
  };
  return { island, surface, scene, view: view as ViewParams };
}
