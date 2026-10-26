/**
 * Named color themes. Paintings supply the hues; light is split into a warm
 * key (`lightWarm`) and a cool fill (`shadowCool`). Skies stay teal, azure and
 * gold, never pink or magenta; soft lavender appears only in the cloud sea's shade.
 */

export type Theme = 'qinglv' | 'liuli' | 'guixu';
export const THEMES: Theme[] = ['qinglv', 'liuli', 'guixu'];

export type TimeOfDay = 'dawn' | 'noon' | 'dusk' | 'night';
export const TIMES_OF_DAY: TimeOfDay[] = ['dawn', 'noon', 'dusk', 'night'];

export interface WorldPalette {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  fog: string;
  /** Gentle slopes: grass over thin soil. */
  meadow: string;
  /** Steeper bare stone: warm grey, pale ochre. */
  rock: string;
  /** The steepest walls: deeper and colder than `rock`. */
  rockFace: string;
  /** Azurite / malachite, only in shadowed rock and along the plateau rim. */
  mineral: string;
  rim: string;
  accent: string;
  /** Color of the key light on sunlit faces. */
  lightWarm: string;
  /** Color of the fill light on faces turned away from the sun. */
  shadowCool: string;
  /** Cloud sea where it catches the light: warm gold. */
  cloudLight: string;
  /** Cloud sea in its own shade and far off: soft lavender (cold teal in guixu). */
  cloudShade: string;
  /** Azurite on the summits: blue-green painting lays ochre at the foot and azurite on top. */
  peakTop: string;
}

/**
 * Blue-green landscape: azurite sky, fresh malachite green, warm ochre stone, silk-beige light.
 * Brighter than the classical blue-green scroll: a clear azure sky that stays blue down toward
 * the horizon, spring-green meadow, warmer stone and bluer (not grey) shadows.
 */
const QINGLV: Record<TimeOfDay, WorldPalette> = {
  dawn: {
    skyTop: '#3a86bc', skyMid: '#8cc4d4', skyHorizon: '#ecd9ac', fog: '#d6d2ba',
    meadow: '#588a4e', rock: '#d6bf94', rockFace: '#9a8a70', mineral: '#2a7e6e',
    rim: '#ffe0ac', accent: '#f0a24a', lightWarm: '#ffdaa6', shadowCool: '#88bcd6',
    cloudLight: '#ffe2b0', cloudShade: '#bcb2dc', peakTop: '#3f6f9a',
  },
  noon: {
    skyTop: '#1f78c4', skyMid: '#6cbde0', skyHorizon: '#d8ece2', fog: '#cfe4dc',
    meadow: '#5e9452', rock: '#dcc8a0', rockFace: '#a39070', mineral: '#258272',
    rim: '#fff2d6', accent: '#ec8d45', lightWarm: '#fff1d8', shadowCool: '#96cae6',
    cloudLight: '#fff4dc', cloudShade: '#c6cae8', peakTop: '#3a74a8',
  },
  dusk: {
    skyTop: '#245e92', skyMid: '#6aa2bc', skyHorizon: '#ecb574', fog: '#c8ae8c',
    meadow: '#4a6e44', rock: '#c4a078', rockFace: '#7a6a56', mineral: '#27645a',
    rim: '#ffc486', accent: '#f08a3a', lightWarm: '#ffc88e', shadowCool: '#6c98bc',
    cloudLight: '#ffc890', cloudShade: '#a898c8', peakTop: '#34587e',
  },
  night: {
    skyTop: '#0a1a30', skyMid: '#16324a', skyHorizon: '#335468', fog: '#233846',
    meadow: '#1b3024', rock: '#52524c', rockFace: '#2c2a28', mineral: '#12302c',
    rim: '#a8c8d8', accent: '#e0a85a', lightWarm: '#8298b0', shadowCool: '#2a465e',
    cloudLight: '#6a86a8', cloudShade: '#2a3050', peakTop: '#16283c',
  },
};

/** Glazed tile: lapis sky, emerald meadow, white-jade stone, glaze-teal cliffs, gold accent. Vivid, a little unreal. */
const LIULI: Record<TimeOfDay, WorldPalette> = {
  dawn: {
    skyTop: '#3a4fa0', skyMid: '#6fa8d0', skyHorizon: '#f2d68c', fog: '#c8d4c8',
    meadow: '#2f8a5c', rock: '#d8dcc8', rockFace: '#4a7a86', mineral: '#1f6fa0',
    rim: '#ffe08a', accent: '#f2b62c', lightWarm: '#ffe0a0', shadowCool: '#86a8e0',
    cloudLight: '#ffe6a8', cloudShade: '#aab0e2', peakTop: '#7896cc',
  },
  noon: {
    skyTop: '#2a50b8', skyMid: '#5fb4e0', skyHorizon: '#d8f0ec', fog: '#c4e2e0',
    meadow: '#2e9660', rock: '#e4e6d6', rockFace: '#4e8490', mineral: '#1a74b0',
    rim: '#fff6c8', accent: '#f4b82a', lightWarm: '#fff4d0', shadowCool: '#94b8ec',
    cloudLight: '#fffbe8', cloudShade: '#bec9f0', peakTop: '#86a6de',
  },
  dusk: {
    skyTop: '#28307a', skyMid: '#5a6aa8', skyHorizon: '#f0a860', fog: '#a8a0a8',
    meadow: '#23704a', rock: '#c8c0b0', rockFace: '#3c5c70', mineral: '#1a5a8c',
    rim: '#ffc070', accent: '#f4a020', lightWarm: '#ffc080', shadowCool: '#6c7cc8',
    cloudLight: '#ffc47a', cloudShade: '#8c88c8', peakTop: '#5a6aa8',
  },
  night: {
    skyTop: '#080c24', skyMid: '#141e48', skyHorizon: '#26406a', fog: '#1c2a48',
    meadow: '#0f3426', rock: '#48505a', rockFace: '#1c2a3c', mineral: '#0e2c56',
    rim: '#9cc8f0', accent: '#e0b040', lightWarm: '#7c96d0', shadowCool: '#243c78',
    cloudLight: '#5c7cb8', cloudShade: '#1c2450', peakTop: '#1c2a50',
  },
};

/**
 * Depths of Guixu, for sunken regions: grey-green, deep blue, faint cold glow.
 * The one exception to the warm-accent rule: `accent` and `lightWarm` are cold here.
 */
const GUIXU: Record<TimeOfDay, WorldPalette> = {
  dawn: {
    skyTop: '#0f2433', skyMid: '#274554', skyHorizon: '#4f6f76', fog: '#3c5a62',
    meadow: '#2a4a3f', rock: '#626f6a', rockFace: '#243339', mineral: '#1c2e33',
    rim: '#9fd6dc', accent: '#7fe0e6', lightWarm: '#7f9ea6', shadowCool: '#2d4a58',
    cloudLight: '#7fa8b0', cloudShade: '#2c4050', peakTop: '#264456',
  },
  noon: {
    skyTop: '#143044', skyMid: '#2f5563', skyHorizon: '#5d7f84', fog: '#4a6a70',
    meadow: '#2f5246', rock: '#6d7a75', rockFace: '#2a3b42', mineral: '#20343a',
    rim: '#b2e0e4', accent: '#86e6ea', lightWarm: '#93b0b5', shadowCool: '#365666',
    cloudLight: '#9cc0c4', cloudShade: '#3a5a68', peakTop: '#2a4a5c',
  },
  dusk: {
    skyTop: '#0c1d2b', skyMid: '#213b4a', skyHorizon: '#43606a', fog: '#33505a',
    meadow: '#253f36', rock: '#56635f', rockFace: '#1f2e34', mineral: '#18282d',
    rim: '#8ccbd3', accent: '#74d8e0', lightWarm: '#6f8e98', shadowCool: '#27414f',
    cloudLight: '#6c9098', cloudShade: '#243a48', peakTop: '#1e3848',
  },
  night: {
    skyTop: '#050c13', skyMid: '#0e1e2a', skyHorizon: '#1f3842', fog: '#182c35',
    meadow: '#12221c', rock: '#343f3d', rockFace: '#111b20', mineral: '#0d171b',
    rim: '#6fb4c0', accent: '#6fd2dc', lightWarm: '#4a6a74', shadowCool: '#1a2e3a',
    cloudLight: '#3c5c68', cloudShade: '#10202a', peakTop: '#0e1c26',
  },
};

const PALETTES: Record<Theme, Record<TimeOfDay, WorldPalette>> = {
  qinglv: QINGLV,
  liuli: LIULI,
  guixu: GUIXU,
};

/** Keyframe hours on a 24-hour clock. */
export const TIME_HOURS: Record<TimeOfDay, number> = { night: 0, dawn: 6, noon: 12, dusk: 18 };

/** The two keyframes an hour falls between, and how far it is from the first (0..1). */
export function keyframesAround(hour: number): [TimeOfDay, TimeOfDay, number] {
  const h = ((hour % 24) + 24) % 24;
  const order = [...TIMES_OF_DAY].sort((x, y) => TIME_HOURS[x] - TIME_HOURS[y]);
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    const b = order[(i + 1) % order.length];
    const start = TIME_HOURS[a];
    const end = TIME_HOURS[b] > start ? TIME_HOURS[b] : TIME_HOURS[b] + 24;
    if (h >= start && h < end) return [a, b, (h - start) / (end - start)];
  }
  return [order[0], order[0], 0];
}

/** The keyframe closest to an hour, for labels. */
export function nearestTimeOfDay(hour: number): TimeOfDay {
  const [a, b, t] = keyframesAround(hour);
  return t < 0.5 ? a : b;
}

/** Palette at any hour, blended channel by channel between the two surrounding keyframes. */
export function getPalette(theme: Theme, hour: number): WorldPalette {
  const [a, b, t] = keyframesAround(hour);
  const from = PALETTES[theme][a];
  const to = PALETTES[theme][b];
  const keys = Object.keys(from) as (keyof WorldPalette)[];
  return Object.fromEntries(keys.map((k) => [k, mixHex(from[k], to[k], t)])) as unknown as WorldPalette;
}

function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Pines (L-system, Class 07): evergreen, so they keep their colour through the seasons and stay a
 * dark ink accent on the meadow; only snow on the pads changes with the solar term.
 */
export const TREE = {
  bark: '#3a3029',
  needle: '#3a6340',
  needleShade: '#1d2b22',
  snow: '#eef2f2',
};

/**
 * The meadow through the solar terms (core/season.ts): the theme's green in summer, autumn gold,
 * dry straw in winter and early spring; snow on the peaks, the pines and, deep in winter, the meadow.
 */
export const SEASON = {
  gold: '#c4a24c',
  dry: '#9c946e',
  snow: '#eef2f2',
};

/**
 * Built things: the footpath's flagstones and steps, and the pavilion at the lookout (cinnabar
 * columns, dark beams, a glazed blue-green roof, a gilt finial), as in blue-green paintings.
 */
export const PROPS = {
  stone: '#9c937f',
  step: '#8c8370',
  column: '#a3392a',
  beam: '#3a2f2a',
  roof: '#2f4a55',
  roofEdge: '#4b6d6e',
  finial: '#c9a14a',
  plinth: '#c8bea6',
};

/**
 * The scale view: an ink survey drawn over the world. Grid and contours in ink, measured boxes in
 * ink, the 1.7 m figures in cinnabar so the eye finds them first.
 */
export const SCALE_VIEW = {
  grid: '#141210',
  contour: '#3d3730',
  box: '#141210',
  person: '#b8452f',
};

/**
 * Ground cover: the forest floor under the pines (seen from afar, where single trees blur into the
 * stand), rhododendron thickets, and granite boulders a little paler than the rock they sit on.
 */
export const GROUND = {
  forestFloor: '#2f3d2c',
  shrub: '#3a4a30',
  boulder: '#a39b8a',
};

/**
 * Wonderland's plan map: a quiet map in the porcelain palette (docs/wonderland.md), zones by tone,
 * water in blue, sites in cinnabar.
 */
export const PLAN_VIEW = {
  plateau: '#e9e4d8',
  terrace: '#c3ded8',
  peak: '#9fa8a9',
  pass: '#c9a45c',
  rim: '#d3cec2',
  water: '#4f86a3',
  site: '#b8452f',
  ink: '#141210',
};

/**
 * Wonderland by day: white porcelain (docs/wonderland.md). One body colour; light faces go to
 * white, faces turned away cool, creases darker still; a soft sheen at grazing angles.
 */
/**
 * Wonderland's blockout (the placeholders in experiments/wonderland-terrain/blocks.tsx): one plain colour per zone, so the
 * layout reads at a glance. Placeholders only, not the island's look.
 */
export const BLOCKOUT = {
  base: '#D9D3C7',
  meadow: '#B9C9A3',
  terrace: '#EDE7DA',
  lake: '#7DB8B2',
  peaks: '#F6F3EE',
  stair: '#CFE0DA',
  water: '#8CC3BC',
  fall: '#FFFFFF',
  grove: '#9DB8A8',
  building: '#C9A45C',
  bridge: '#F4F1EA',
  site: '#C0492F',
  creature: '#FFFFFF',
  roam: '#DCE6CF',
  underside: '#C8C2B6',
  person: '#2B2B2B',
  label: '#2B2B2B',
  skyLight: '#FFFFFF',
  groundLight: '#B8B0A2',
};

export const PORCELAIN = {
  body: '#F4F1EA',
  warmShadow: '#DCD8CF',
  coolShadow: '#BAC4C5',
  crease: '#8E9496',
  sheen: '#FFFFFF',
  /** The one cool color: milky jade water, light enough to sit with the white. */
  water: '#93C7C0',
  /** Deep water's own colour (light scattered back from within it): a clear teal blue. */
  waterDeep: '#3FA6B8',
  /** What a metre of water lets through (white light in, this out): red goes first, so shallow water over the cream floor turns cyan. */
  waterTint: '#CBEAEA',
  /**
   * Stone turned jade by dwelling (栖居成玉), restrained: where it walks, a pale celadon; where
   * it drinks, a grey-green (灰青); where it rests, a bluish white (青白).
   */
  jadeWalk: '#CAD9D1',
  jadeDrink: '#A8C1B8',
  jadeRest: '#C6D8D2',
  /** A creature's soft shadow on the ground. */
  contactShadow: '#8E9496',
  /** Pines on the white island: a restrained grey-green crown, a grey-brown trunk. */
  pineBark: '#6B625A',
  pineNeedle: '#7E9184',
  pineNeedleShade: '#4C5A52',
};

/** The dwelling's debug view: where it walks, drinks, rests (the contact map's three channels). */
export const WEAR_DEBUG = {
  walk: '#D9534F',
  drink: '#2E86C1',
  rest: '#E5A92B',
};

/** Wonderland's zones, the debug view (zones.ts order, outside first). */
export const ZONE_DEBUG = [
  '#2A2E36', // outside
  '#3FA6B8', // water
  '#96CDD7', // terrace
  '#5F5A58', // cliff
  '#968C82', // ridge
  '#C3BCB0', // rock slope
  '#78AA8C', // wet shore
  '#466E50', // woodland
  '#E6AA50', // habitat
  '#F5F2EB', // open stone
];

/** Wind streaks (the wind field made visible): a pale silk white, like mist. */
export const WIND_STREAK = '#f4f1e8';

/** Base pigments the UI is drawn from: ink, paper, and a cinnabar seal. */
const PIGMENT = {
  ink: '#121619',
  paper: '#e6dfcc',
  cinnabar: '#b8452f',
};

/** Site UI: ink ground, paper text, a single cinnabar seal accent. */
export const UI = {
  bg: PIGMENT.ink,
  text: PIGMENT.paper,
  textDim: '#8b887d',
  line: '#2d3336',
  accent: PIGMENT.cinnabar,
};

/** The atlas pages: paper ground and ink text, matching the class exercise apps (a research notebook). */
export const ATLAS_UI = {
  paper: '#efe8d8',
  card: '#f7f2e6',
  ink: '#1b1a18',
  inkDim: '#7a746a',
  rule: '#c9c0ac',
  seal: '#b33a2a',
};

/**
 * Panels floating over the 3D world (parameters, techniques, solar terms): opaque paper with a light
 * grain, all text in ink (no grey), ink buttons with paper lettering. Cinnabar only in small marks
 * (step numbers, a seal dot), never as a large fill.
 */
export const SILK_UI = {
  bg: '#f3ecdc',
  text: '#141210',
  textDim: '#3d3730',
  line: '#141210',
  accent: '#141210',
  input: '#e6dcc6',
  seal: '#b8452f',
};

export const palette = { world: getPalette, ui: UI, atlas: ATLAS_UI, silk: SILK_UI };
