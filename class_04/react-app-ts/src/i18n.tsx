import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'zh';

const en = {
  title: 'Grotto Heaven',
  subtitle: 'Class 04 · Voxels · Density · CSG · Meshing',
  about: 'A heightmap has one height per spot, so it cannot hold a cave. Here the island is a density field (solid or empty at every point in space), so it can be hollowed out into a grotto-heaven: a hidden world inside the mountain.',
  'stage.base': 'Island (section)',
  'stage.carved': 'Carved (section)',
  'stage.cave': 'Cave level (from above)',
  'h.density': '1 Density',
  'h.carve': '2 Carve (CSG)',
  'h.mesh': '3 Mesh',
  'about.density': 'An island shape (a dome on a hanging cone) plus 3D noise. Wherever the value is above zero, there is rock.',
  'about.carve': 'Shapes subtracted from the field: a winding cave, a skylight shaft from the top, a hollow under the rim. Smooth subtraction rounds the edges.',
  'about.mesh': 'Turning the field into triangles: blocks keep each voxel as a cube; marching cubes slides the surface to where the field crosses zero.',
  roughness: 'Roughness',
  noiseScale: 'Noise scale',
  cave: 'Cave',
  shaft: 'Skylight',
  hollow: 'Overhang',
  smooth: 'Smooth edge',
  blocks: 'Blocks',
  marching: 'Marching cubes',
  resolution: 'Voxels per side',
  tris: 'triangles',
  ms: 'ms',
  view: 'View',
  seed: 'New seed',
  hint: 'Drag to orbit, scroll to zoom. Look into the cave from the side.',
};

type Dict = Record<keyof typeof en, string>;
export type Key = keyof typeof en;

const zh: Dict = {
  title: '洞天',
  subtitle: 'Class 04 · 体素 · 密度场 · CSG · 网格化',
  about: '高度图每个位置只有一个高度，装不下山洞。这里把岛做成密度场（空间里每一点要么是石头、要么是空的），所以能挖空，变成“洞天”：藏在山里的另一个世界。',
  'stage.base': '岛（剖面）',
  'stage.carved': '挖空后（剖面）',
  'stage.cave': '洞穴层（俯视）',
  'h.density': '1 密度',
  'h.carve': '2 挖切（CSG）',
  'h.mesh': '3 网格',
  'about.density': '一个岛形（上面的穹顶接下面倒挂的锥）加上三维噪声。数值大于零的地方就是石头。',
  'about.carve': '从密度场里减去几个形状：一条弯曲的山洞、一口从山顶通下来的天井、岸边下方的凹洞。平滑相减让边缘变圆。',
  'about.mesh': '把密度场变成三角形：方块法把每个体素画成一个立方体；Marching cubes 把表面放在数值正好过零的地方。',
  roughness: '粗糙度',
  noiseScale: '噪声尺度',
  cave: '山洞',
  shaft: '天井',
  hollow: '悬空凹洞',
  smooth: '边缘平滑',
  blocks: '方块',
  marching: 'Marching cubes',
  resolution: '每边体素数',
  tris: '三角面',
  ms: '毫秒',
  view: '视图',
  seed: '换种子',
  hint: '拖动旋转，滚轮缩放。从侧面往山洞里看。',
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
