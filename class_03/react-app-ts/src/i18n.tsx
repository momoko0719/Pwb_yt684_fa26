import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'zh';

const en = {
  title: 'Island Terrain',
  subtitle: 'Class 03 · Noise · Shaping · Erosion',
  about: 'A map of noise becomes a floating island in four steps: layer noise, shape it, cut a coast with a round mask, then let rain carve the valleys.',
  'stage.noise': 'Noise',
  'stage.shaped': 'Shaped',
  'stage.mask': 'Coast',
  'stage.island': 'Island',
  'h.noise': '1 Noise (fBm)',
  'h.shape': '2 Shaping',
  'h.island': '3 Coast',
  'h.erosion': '4 Erosion',
  'n.perlin': 'Perlin',
  'n.value': 'Value',
  'n.worley': 'Worley',
  'n.cellular': 'Cellular',
  scale: 'Scale',
  octaves: 'Octaves',
  persistence: 'Persistence',
  's.linear': 'None',
  's.ridged': 'Ridges',
  's.terrace': 'Terraces',
  's.power': 'Power',
  steps: 'Steps',
  exponent: 'Exponent',
  radius: 'Radius',
  edge: 'Soft coast',
  rain: 'Rain',
  pause: 'Pause',
  reset: 'Reset',
  drops: 'Drops per step',
  fallen: 'raindrops so far',
  view: 'View',
  height: 'Height',
  seed: 'New seed',
  'about.noise': 'Several layers (octaves) of the same noise, each finer and fainter: big hills plus small bumps.',
  'about.shape': 'A curve applied to every height: ridges fold the hills into sharp crests, terraces cut them into steps.',
  'about.island': 'A soft round mask (with a wobbly edge) cuts the coast; the same mask hangs a rock under the island.',
  'about.erosion': 'Thousands of raindrops roll downhill, picking up soil where they are fast and dropping it where they slow down.',
  hint: 'Drag to orbit, scroll to zoom.',
};

type Dict = Record<keyof typeof en, string>;
export type Key = keyof typeof en;

const zh: Dict = {
  title: '浮岛地形',
  subtitle: 'Class 03 · 噪声 · 塑形 · 侵蚀',
  about: '一张噪声图，四步变成一座浮岛：叠噪声，塑形，用圆形遮罩切出海岸，再让雨水冲出山沟。',
  'stage.noise': '噪声',
  'stage.shaped': '塑形',
  'stage.mask': '海岸',
  'stage.island': '浮岛',
  'h.noise': '1 噪声（fBm）',
  'h.shape': '2 塑形',
  'h.island': '3 海岸',
  'h.erosion': '4 侵蚀',
  'n.perlin': 'Perlin',
  'n.value': 'Value',
  'n.worley': 'Worley',
  'n.cellular': 'Cellular',
  scale: '尺度',
  octaves: '层数',
  persistence: '每层衰减',
  's.linear': '原样',
  's.ridged': '山脊',
  's.terrace': '梯田',
  's.power': '幂',
  steps: '台阶数',
  exponent: '指数',
  radius: '半径',
  edge: '海岸柔和度',
  rain: '下雨',
  pause: '暂停',
  reset: '重来',
  drops: '每步雨滴',
  fallen: '滴雨已落下',
  view: '视图',
  height: '高度',
  seed: '换种子',
  'about.noise': '同一种噪声叠好几层，一层比一层细、一层比一层淡：大山上长小起伏。',
  'about.shape': '给每个高度套一条曲线：山脊把山折成尖棱，梯田把山切成台阶。',
  'about.island': '一个边缘带抖动的圆形遮罩切出海岸；同一个遮罩也在岛下挂出一块山石。',
  'about.erosion': '成千上万滴雨往低处滚，跑得快的地方带走泥土，慢下来的地方放下泥土。',
  hint: '拖动旋转，滚轮缩放。',
};

const DICTS: Record<Lang, Dict> = { en, zh };

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: 'zh',
  setLang: () => {},
  t: (k) => zh[k],
});

export function LangProvider({ children }: { children: ReactNode }) {
  // ?lang=en in the address (the Guixu atlas passes the site's language) picks the starting language.
  const [lang, setLang] = useState<Lang>(() => (new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'zh'));
  return <LangContext.Provider value={{ lang, setLang, t: (k) => DICTS[lang][k] }}>{children}</LangContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => useContext(LangContext);
