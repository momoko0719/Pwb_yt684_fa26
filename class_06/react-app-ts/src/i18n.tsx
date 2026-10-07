import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'zh';

const en = {
  title: 'One Stroke Landscape',
  subtitle: 'Class 06 · Distributions · Paths · Vector fields',
  chapter: 'Chapter',
  'chapter.scatter': '1 Scatter',
  'chapter.path': '2 Path',
  'chapter.flow': '3 Flow',
  'chapter.all': 'All',
  'about.scatter': 'Life is placed by rules, not by hand. Every candidate point asks the ground: how steep, how wet, how far from water and road. Rocks only on cliffs, reeds only on banks, pines in clumps on gentle slopes (smaller up high), flowers on wet flat ground, pavilions on the flattest high spots. Draw a river and watch everything regrow around it.',
  'about.path': 'Draw a stroke on the land. It becomes a smooth spline, projected onto the terrain. A river stroke carves a channel into the mesh and spreads moisture; a road stroke levels the ground and gets lanterns. The line changes the mesh, and the mesh decides what grows.',
  'about.flow': 'A vector field gives every point a direction. Here it is the sum of the river current (water flows the way you drew it), the whirlpools you drop, and wind bent by curl noise. Thousands of particles read the field each frame and leave trails like brush strokes.',
  'about.all': 'All three together: the strokes shape the ground, the ground decides where life grows, and the water you drew carries petals and ink downstream.',
  tools: 'Tool',
  'tool.look': 'Look',
  'tool.river': 'Draw river',
  'tool.road': 'Draw road',
  'tool.vortex': 'Drop whirlpool',
  'hint.look': 'Drag to orbit, scroll to zoom.',
  'hint.draw': 'Drag on the land to draw. Right-drag still orbits.',
  'hint.vortex': 'Click the land to drop a whirlpool. Hold Shift to spin the other way.',
  undo: 'Undo stroke',
  clear: 'Clear all',
  seed: 'New land',
  topView: 'Top view',
  style: 'Style',
  'style.ink': 'Ink',
  'style.qinglv': 'Blue-green',
  density: 'Density',
  layers: 'Layers',
  'sp.pine': 'Pines',
  'sp.reed': 'Reeds',
  'sp.flower': 'Flowers',
  'sp.rock': 'Rocks',
  'sp.pavilion': 'Pavilions',
  'sp.lantern': 'Lanterns',
  current: 'Current',
  wind: 'Wind',
  windAngle: 'Wind direction',
  particles: 'Particles',
  arrows: 'Show field arrows',
  stats: 'placed',
};

const zh: typeof en = {
  title: '一笔山河',
  subtitle: '第 6 课 · 散布 · 路径 · 向量场',
  chapter: '章节',
  'chapter.scatter': '一 散布',
  'chapter.path': '二 路径',
  'chapter.flow': '三 流场',
  'chapter.all': '全部',
  'about.scatter': '生命按规则生长，而不是手工摆放。每个候选点都去问地面：多陡、多湿、离水和路多远。岩石只在崖壁上，芦苇只在河岸边，松树成簇长在缓坡（越高越矮），花开在湿润的平地，亭子建在最平的高处。画一条河，看万物围着它重新生长。',
  'about.path': '在大地上画一笔，它会变成一条平滑的样条曲线，投影到地形上。画成河，就在网格上刻出河道，并让周围变湿；画成路，就把地面压平，路边亮起灯笼。线改变了网格，网格又决定了什么会生长。',
  'about.flow': '向量场给每一个点一个方向。这里它由三部分相加：河水的流向（你怎么画，水就怎么流）、你放下的漩涡，以及被旋度噪声（curl noise）吹弯的风。几千个粒子每一帧读取流场，留下像笔触一样的拖尾。',
  'about.all': '三者合一：笔画塑造大地，大地决定生命在哪里生长，你画的河把花瓣和墨点带向下游。',
  tools: '工具',
  'tool.look': '观看',
  'tool.river': '画河',
  'tool.road': '画路',
  'tool.vortex': '放漩涡',
  'hint.look': '拖动旋转，滚轮缩放。',
  'hint.draw': '在大地上拖动来画。右键拖动仍可旋转。',
  'hint.vortex': '点击大地放下漩涡。按住 Shift 反向旋转。',
  undo: '撤销一笔',
  clear: '全部清除',
  seed: '换一片地',
  topView: '俯视',
  style: '画风',
  'style.ink': '水墨',
  'style.qinglv': '青绿',
  density: '密度',
  layers: '图层',
  'sp.pine': '松树',
  'sp.reed': '芦苇',
  'sp.flower': '花',
  'sp.rock': '岩石',
  'sp.pavilion': '亭子',
  'sp.lantern': '灯笼',
  current: '水流',
  wind: '风力',
  windAngle: '风向',
  particles: '粒子',
  arrows: '显示流场箭头',
  stats: '已放置',
};

export type Key = keyof typeof en;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: 'en',
  setLang: () => {},
  t: (k) => en[k],
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');
  const t = (k: Key) => (lang === 'en' ? en : zh)[k];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
