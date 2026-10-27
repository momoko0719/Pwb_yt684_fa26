import type { ResourceDef, SizeBox } from '../../core/resources/types';
import { resourcesFor } from '../../core/resources/registry';
import { COVER_NEAR } from './CoverGrass';
import { ISLAND } from './layout';
import { STELE } from './stele';
import { SHRUB_HEIGHT, SHRUB_LOD, SHRUB_TONE_WEIGHTS, SHRUB_VARIANTS, SHRUB_WIDTH_RATIO } from './shrubs';
import { SIZES } from '../../core/scale';

/** Wonderland-only resource cards (generators on this island). */
export const WONDERLAND_RESOURCES: ResourceDef[] = [
  {
    id: 'wonderland-shrub',
    category: 'vegetation',
    nameKey: 'shrub',
    islands: ['wonderland'],
    config: {
      height: [...SHRUB_HEIGHT] as [number, number],
      width: [SHRUB_HEIGHT[0] * SHRUB_WIDTH_RATIO[0], SHRUB_HEIGHT[1] * SHRUB_WIDTH_RATIO[1]],
    },
    variants: SHRUB_VARIANTS,
    ruleEn: `Patches on 18 m grid; plants 1.4 m. Tone ${SHRUB_TONE_WEIGHTS.map((w) => Math.round(w * 100)).join('/')} grey-green/ochre/vermillion. LOD ${SHRUB_LOD.join('/')} m.`,
    ruleZh: `片区 18 m 网格；株距 1.4 m。色相目标 ${SHRUB_TONE_WEIGHTS.map((w) => Math.round(w * 100)).join('/')} 暖灰橄榄／赭黄／暗铁红（实际片区比因种子而异）。LOD ${SHRUB_LOD.join('/')} m。`,
    preview: 'shrub',
  },
  {
    id: 'wonderland-grass',
    category: 'vegetation',
    nameKey: 'grass',
    islands: ['wonderland'],
    config: { height: [COVER_NEAR.bladeH * 0.7, COVER_NEAR.bladeH * 1.2] },
    ruleEn: `Near clumps ≤${COVER_NEAR.radius} m; ${COVER_NEAR.blades[0]}–${COVER_NEAR.blades[1]} blades, shared root + outward fan.`,
    ruleZh: `近景 ≤${COVER_NEAR.radius} m；每丛 ${COVER_NEAR.blades[0]}–${COVER_NEAR.blades[1]} 叶，共根外展。`,
    preview: 'grass',
  },
  {
    id: 'wonderland-flower',
    category: 'vegetation',
    nameKey: 'flower',
    islands: ['wonderland'],
    config: { height: [COVER_NEAR.stemH * 0.8, COVER_NEAR.stemH + COVER_NEAR.head] },
    ruleEn: 'Cover niche anchors; a few heads per clump in the focus disc.',
    ruleZh: '地被生境锚点；近景盘内每簇数个花头。',
    preview: 'flower',
  },
  {
    id: 'wonderland-pine',
    category: 'vegetation',
    nameKey: 'pine',
    islands: ['wonderland'],
    config: { height: [...SIZES.forest.height] as [number, number] },
    ruleEn: 'Woodland groves + lone pines (woods.ts); Penglai pine LOD.',
    ruleZh: '林地树丛与孤松（woods.ts）；复用蓬莱松 LOD。',
    preview: 'pine',
  },
  {
    id: 'wonderland-creature',
    category: 'creatures',
    nameKey: 'creature',
    islands: ['wonderland'],
    config: { height: [1.1, 1.4], width: [0.6, 0.9], depth: [1.2, 1.8] },
    ruleEn: 'One dwelling creature; homes A/B/C by seed.',
    ruleZh: '一只栖居生灵；家园 A/B/C 由种子决定。',
    preview: null,
    noteEn: 'No stand-alone mesh preview — use Locate on the island. Mesh lives in creature.tsx.',
    noteZh: '暂无独立预览（不用代理锥体）— 请用「定位」。形体在 creature.tsx。',
  },
  {
    id: 'wonderland-stele',
    category: 'props',
    nameKey: 'stele',
    islands: ['wonderland'],
    config: {
      height: [STELE.height * 0.9, STELE.height * 1.1],
      width: [STELE.face * 0.9, STELE.face * 1.1],
      depth: [STELE.thick * 0.9, STELE.thick * 1.1],
    },
    ruleEn: 'Watching-stone stele at the corner overlook.',
    ruleZh: '观景角守望石碑。',
    preview: 'stele',
  },
  {
    id: 'wonderland-island',
    category: 'terrain',
    nameKey: 'island',
    islands: ['wonderland'],
    config: { width: [ISLAND.across * 0.95, ISLAND.across * 1.05], depth: [ISLAND.deep * 0.95, ISLAND.deep * 1.05] },
    ruleEn: 'Whole island footprint (layout.ts).',
    ruleZh: '整岛平面（layout.ts）。',
    preview: null,
    noteEn: 'Locate only — no proxy mesh.',
    noteZh: '仅定位 — 无代理模型。',
  },
  {
    id: 'wonderland-peak',
    category: 'terrain',
    nameKey: 'peak',
    islands: ['wonderland'],
    config: { height: [100, 150] },
    ruleEn: 'Main range peak height (Advanced → Tallest peaks).',
    ruleZh: '主脉峰高（高级生成 → 最高峰）。',
    preview: null,
    noteEn: 'Locate only — no proxy mesh.',
    noteZh: '仅定位 — 无代理模型。',
  },
  {
    id: 'wonderland-pool',
    category: 'terrain',
    nameKey: 'pool',
    islands: ['wonderland'],
    config: { width: [8, 40] },
    ruleEn: 'Terrace basin pools (across).',
    ruleZh: '梯池水池（横向跨度）。',
    preview: null,
    noteEn: 'Locate only — no proxy mesh.',
    noteZh: '仅定位 — 无代理模型。',
  },
];

export function wonderlandResourceList(): ResourceDef[] {
  return resourcesFor('wonderland', WONDERLAND_RESOURCES);
}

/** Live stats for one resource type on the current island (not config). */
export interface IslandResourceStats {
  count: number;
  /** Measured instance size range on this island. */
  islandSize: SizeBox;
  /** A concrete locate target, or null when count is 0. */
  locate: { x: number; y: number; z: number } | null;
  /** Near-camera loaded count (grass/flowers); omit when `count` is island-wide. */
  loadedCount?: number;
  /** Island-wide anchors when known; `null` = not tracked (never display as 0). */
  islandAnchors?: number | null;
  note?: string;
}

export type IslandResourceMap = Partial<Record<string, IslandResourceStats>>;
