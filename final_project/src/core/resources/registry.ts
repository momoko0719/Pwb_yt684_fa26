/**
 * Shared catalogue helpers + Penglai-facing entries from SIZES.
 * Wonderland entries: `experiments/wonderland-terrain/resourceCatalog.ts`
 * (keeps core free of experiment imports).
 */
import { PERSON_HEIGHT, SIZES } from '../scale';
import type { ResourceDef, ResourceIsland } from './types';

export type { ResourceCategory, ResourceDef, ResourceIsland, SizeBox } from './types';
export { formatSizeBox } from './types';

/** Entries safe for any island / Scale parity (no experiment imports). */
export const SHARED_RESOURCES: ResourceDef[] = [
  {
    id: 'person',
    category: 'creatures',
    nameKey: 'person',
    islands: ['wonderland', 'penglai'],
    config: { height: [PERSON_HEIGHT, PERSON_HEIGHT] },
    ruleEn: 'Scale reference figure (1.7 m).',
    ruleZh: '尺度参照人形（1.7 m）。',
    preview: 'person',
  },
  {
    id: 'penglai-shrub',
    category: 'vegetation',
    nameKey: 'shrubPenglai',
    islands: ['penglai'],
    config: { height: [...SIZES.shrub.height] as [number, number] },
    ruleEn: 'Penglai forest-edge rhododendron thickets (forest.ts).',
    ruleZh: '蓬莱林缘杜鹃灌丛（forest.ts）。',
    preview: null,
    noteEn: 'Listed for scale parity; Wonderland uses its own shrub generator.',
    noteZh: '尺度对照收录；奇迹岛使用独立灌木生成器。',
  },
  {
    id: 'penglai-pine',
    category: 'vegetation',
    nameKey: 'pine',
    islands: ['penglai'],
    config: { height: [SIZES.pine.plateau[0], SIZES.pine.sheltered[1]] },
    ruleEn: 'Lone + forest pines (SIZES.pine / forest).',
    ruleZh: '孤松与林木（SIZES.pine / forest）。',
    preview: null,
  },
  {
    id: 'penglai-grass',
    category: 'vegetation',
    nameKey: 'grass',
    islands: ['penglai'],
    config: { height: [...SIZES.grass.height] as [number, number] },
    ruleEn: 'Penglai meadow blades (generators/grass.ts).',
    ruleZh: '蓬莱草叶（generators/grass.ts）。',
    preview: null,
  },
];

export function resourcesFor(island: ResourceIsland, extra: ResourceDef[] = []): ResourceDef[] {
  return [...SHARED_RESOURCES, ...extra].filter((r) => r.islands.includes(island));
}
