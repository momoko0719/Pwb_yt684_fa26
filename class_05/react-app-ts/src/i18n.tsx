import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'zh';

const en = {
  title: 'Glaze · Pearl · Glow',
  subtitle: 'Class 05 · Shaders',
  about: 'Three materials for Guixu, each one short shader. A shader decides the colour of every pixel; most of the magic is a single 0..1 number (a mask) computed from the surface and the view.',
  'm.glaze': 'Glaze',
  'm.pearl': 'Pearl',
  'm.glow': 'Glow',
  'about.glaze': 'Glazed-tile stone. The Fresnel mask is bright where the surface turns away from you, so the rim catches gold light; the glaze is deeper low down and thins to azure on top.',
  'about.pearl': 'A pearly petal, after silicone and pearl flowers. Thin-film interference shifts the hue with the viewing angle; light from behind shows through the petal.',
  'about.glow': 'A bioluminescent sea at night. Plankton glow where the water is stirred: on wave crests, and in a ring wherever you move the mouse over the sea.',
  key: 'The key line',
  power: 'Rim sharpness',
  rim: 'Rim light',
  film: 'Film thickness',
  irid: 'Iridescence',
  back: 'Backlight',
  glow: 'Glow',
  waves: 'Waves',
  mask: 'Show the mask (the 0..1 number behind the colour)',
  hint: 'Drag to orbit, scroll to zoom.',
  hintGlow: 'Move the mouse over the sea to stir it.',
};

type Dict = Record<keyof typeof en, string>;
export type Key = keyof typeof en;

const zh: Dict = {
  title: '琉璃 · 珠光 · 荧光',
  subtitle: 'Class 05 · Shader 着色器',
  about: '给归墟做的三种材质，每种是一小段 shader。Shader 决定每个像素的颜色；大部分“魔法”其实只是一个 0 到 1 的数（遮罩），由表面和视线算出来。',
  'm.glaze': '琉璃',
  'm.pearl': '珠光',
  'm.glow': '荧光',
  'about.glaze': '上了琉璃釉的石头。Fresnel 遮罩在表面背过视线的地方最亮，所以边缘泛起金光；釉在低处积得深，往上薄成石青。',
  'about.pearl': '珠光花瓣，参考硅胶花和珍珠。薄膜干涉让颜色随视角变化；光从背后照过来时会透过花瓣。',
  'about.glow': '夜里的荧光海。海水被搅动的地方浮游生物就会发光：浪尖上，还有鼠标划过的地方会荡开一圈光。',
  key: '关键的一行',
  power: '边缘锐度',
  rim: '边缘光',
  film: '薄膜厚度',
  irid: '虹彩',
  back: '背光透射',
  glow: '亮度',
  waves: '浪',
  mask: '显示遮罩（颜色背后那个 0 到 1 的数）',
  hint: '拖动旋转，滚轮缩放。',
  hintGlow: '鼠标在海面上划过，搅动海水。',
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
