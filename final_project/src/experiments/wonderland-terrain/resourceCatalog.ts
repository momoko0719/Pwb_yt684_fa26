import type { ResourceDef, SizeBox } from '../../core/resources/types';
import { resourcesFor } from '../../core/resources/registry';
import { COVER_NEAR } from './CoverGrass';
import { STELE } from './stele';
import { SHRUB_HEIGHT, SHRUB_VARIANTS, SHRUB_WIDTH_RATIO } from './shrubs';
import { SIZES } from '../../core/scale';
import { BROADLEAF } from './broadleaf';

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
    ruleEn: 'Grown by an L-system: four to six stems rise from one root, fork low, and end in tufts of fine leaves, so the bush is wider than tall. It grows in patches on slopes and under trees, grey-green, ochre or iron red.',
    ruleZh: '由 L-system 长成：一个根上冒出四到六根茎，低处就分叉，枝梢簇着细叶，所以灌丛比它高的还宽。成片长在坡上和林下，有灰绿、赭黄、铁红三种颜色。',
    preview: 'shrub',
  },
  {
    id: 'wonderland-grass',
    category: 'vegetation',
    nameKey: 'grass',
    islands: ['wonderland'],
    config: { height: [COVER_NEAR.bladeH * 0.7, COVER_NEAR.bladeH * 1.2] },
    ruleEn: `Not an L-system: each clump is ${COVER_NEAR.blades[0]}–${COVER_NEAR.blades[1]} blades fanning out from one root, each a little taller, shorter or more bent at random. Clumps are laid only near you and fade with distance.`,
    ruleZh: `不是 L-system：每丛是从一个根点向外散开的 ${COVER_NEAR.blades[0]}–${COVER_NEAR.blades[1]} 片叶，高矮、弯度随机。草丛只铺在你附近，走远就淡去。`,
    preview: 'grass',
  },
  {
    id: 'wonderland-flower',
    category: 'vegetation',
    nameKey: 'flower',
    islands: ['wonderland'],
    config: { height: [COVER_NEAR.stemH * 0.8, COVER_NEAR.stemH + COVER_NEAR.head] },
    ruleEn: 'Not an L-system: a stem with one small head, a few to a clump. They open in the meadow where the ground suits flowers.',
    ruleZh: '不是 L-system：一根茎顶一朵小花，几朵一簇。开在草地里适合开花的地方。',
    preview: 'flower',
  },
  {
    id: 'wonderland-pine',
    category: 'vegetation',
    nameKey: 'pine',
    islands: ['wonderland'],
    config: { height: [...SIZES.forest.height] as [number, number] },
    ruleEn: 'Grown by an L-system: the trunk climbs step by step, and every step puts out a whorl of nearly level limbs. In the last generations the top stops climbing and spreads flat. Pines stand in groves, and a few alone on the slopes.',
    ruleZh: '由 L-system 长成：树干一节一节往上长，每节伸出一圈几乎平展的枝。最后几代树顶不再长高，摊成平顶。成片长在林地，也有几棵孤松站在坡上。',
    preview: 'pine',
  },
  {
    id: 'wonderland-parasol',
    category: 'vegetation',
    nameKey: 'parasol',
    islands: ['wonderland'],
    config: { height: [...BROADLEAF.parasol.height] as [number, number], width: [8, 11] },
    ruleEn: 'Grown by an L-system: a short trunk forks into three or four limbs leaning out, and the twigs turn up toward the light. The leaf clumps at their tips meet in one flat-topped parasol. It grows where woodland meets meadow.',
    ruleZh: '由 L-system 长成：一根短干分成三四根粗枝斜着伸出去，细枝朝着光往上翘。枝梢的叶团连成一把平顶的伞。长在林子和草地交界的地方。',
    preview: 'parasol',
  },
  {
    id: 'wonderland-weeping',
    category: 'vegetation',
    nameKey: 'weeping',
    islands: ['wonderland'],
    config: { height: [...BROADLEAF.weeping.height] as [number, number], width: [11, 14] },
    ruleEn: 'Grown by an L-system: a thick trunk splits in two or three, and the limbs arch out and down. Thin whips hang from every branch, the top too, so the blossom falls like a curtain. It grows only by water.',
    ruleZh: '由 L-system 长成：粗壮的树干分成两三根，粗枝拱出去再弯下来。每根枝上都挂着细细的垂枝，连冠顶也弯，花像一道帘子垂下。只长在水边。',
    preview: 'weeping',
  },
  {
    id: 'wonderland-creature',
    category: 'creatures',
    nameKey: 'creature',
    islands: ['wonderland'],
    config: { height: [1.1, 1.4], width: [0.6, 0.9], depth: [1.2, 1.8] },
    ruleEn: 'One creature. The seed picks a dry habitat and a shore stand it can walk to. It rests, walks and drinks. Planted feet, the body and the lie write a contact map; enough contact turns the stone toward jade.',
    ruleZh: '一只。种子在干地上选栖息地，并选一处走得到的岸边饮水点。它休息、走路、饮水。落下的脚、身体和卧位写入接触图；接触够了，石头偏向玉。',
    preview: null,
    noteEn: 'No stand-alone mesh preview — use Locate on the island. Mesh lives in creature.tsx.',
    noteZh: '暂无独立预览（不用代理锥体）— 请用「定位」。形体在 creature.tsx。',
  },
  {
    id: 'wonderland-stream-fish', category: 'creatures', nameKey: 'streamFish', islands: ['wonderland'],
    config: { depth: [0.45, 0.75] },
    ruleEn: 'Seeded jade stream fish: body length, depth, tail fork, jade patches and swimming speed vary. Pool depth and flow decide where they live and how they hold position.',
    ruleZh: '玉鳞溪灵：种子决定体长、体高、尾鳍分叉、玉斑和游速；真实池深与水流决定栖息位置和悬停方向。',
    preview: null,
  },
  {
    id: 'wonderland-den', category: 'creatures', nameKey: 'den', islands: ['wonderland'],
    config: { width: [4.5, 6], depth: [4.5, 6.5], height: [3.6, 4.6] },
    ruleEn: 'One rock with an open-fronted cave, grown in five steps (boulder, lumps, swells, cave, weathering) round the air the creature uses.',
    ruleZh: '一整块岩石，正面敞开的洞，分五步长成（圆石、鼓包、起伏、掏洞、风化），围着兽使用的空间。',
    preview: null,
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
  noteEn?: string;
  noteZh?: string;
}

export type IslandResourceMap = Partial<Record<string, IslandResourceStats>>;
