// ─── Noise ───────────────────────────────────────────────────────────────────

export type NoiseType = 'perlin' | 'value' | 'worley' | 'cellular';

export const NOISE_META: Record<NoiseType, { label: string; description: string }> = {
  perlin: {
    label: 'Perlin',
    description:
      'Gradient noise — smooth, continuous, organic feel. Great for terrain, clouds, and natural textures.',
  },
  value: {
    label: 'Value',
    description:
      'Interpolated random grid values. Slightly blockier than Perlin but simpler and fast.',
  },
  worley: {
    label: 'Worley (F1)',
    description:
      'Distance to the nearest feature point (F1). Creates filled cell blobs. Good for rock, skin, and bubble patterns.',
  },
  cellular: {
    label: 'Cellular (F2−F1)',
    description:
      'Difference between the two nearest feature points. Creates sharp veins and crack networks — great for dried mud, stone fractures, and dragon scales.',
  },
};

// ─── Shaping ─────────────────────────────────────────────────────────────────

export type ShapingFn =
  | 'linear'
  | 'smoothstep'
  | 'power'
  | 'abs'
  | 'billow'
  | 'ridged'
  | 'terrace';

export const SHAPING_META: Record<ShapingFn, { label: string; description: string }> = {
  linear:     { label: 'Linear',     description: 'No shaping — output equals input (0 → 1).' },
  smoothstep: { label: 'Smooth Step',description: 'S-curve easing. Softens transitions, increases mid-range contrast.' },
  power:      { label: 'Power',      description: 'Raises to an exponent. <1 flattens peaks; >1 sharpens and accentuates highs.' },
  abs:        { label: 'Absolute',   description: 'Absolute value. Creates ridges/valleys at zero crossings.' },
  billow:     { label: 'Billow',     description: 'Soft, rounded bumps. 1 − |value|.' },
  ridged:     { label: 'Ridged',     description: 'Sharp mountain-like ridges. Inverted abs with steeper falloff.' },
  terrace:    { label: 'Terrace',    description: 'Quantises into flat steps. Creates plateaus and cliffs.' },
};

// ─── Blend ───────────────────────────────────────────────────────────────────

export type BlendMode = 'add' | 'multiply' | 'subtract' | 'max';

export const BLEND_META: Record<BlendMode, { label: string; description: string }> = {
  add:      { label: 'Add',      description: 'Weighted sum of layers.' },
  multiply: { label: 'Multiply', description: 'Multiplies this layer into the accumulated result.' },
  subtract: { label: 'Subtract', description: 'Subtracts this layer from the accumulated result.' },
  max:      { label: 'Max',      description: 'Takes the maximum of the accumulated result and this layer.' },
};

// ─── Layer ───────────────────────────────────────────────────────────────────

export interface NoiseLayer {
  id: string;
  name: string;
  enabled: boolean;
  expanded: boolean;

  noiseType: NoiseType;

  // fBm (Fractal Brownian Motion) parameters
  scale: number;        // frequency multiplier   0.1 – 10
  octaves: number;      // stacked octave count   1 – 8
  persistence: number;  // amplitude per octave   0.1 – 1.0
  lacunarity: number;   // frequency per octave   1.0 – 4.0
  offsetX: number;      // scroll offset          0 – 10
  offsetY: number;

  // Layer blend
  opacity: number;      // 0 – 1
  blendMode: BlendMode;

  // Shaping
  shapingFn: ShapingFn;
  shapingParam: number; // exponent / step count  0.1 – 8
}

// ─── Global ──────────────────────────────────────────────────────────────────

export type ColorMode = 'grayscale' | 'terrain' | 'heatmap';
export type ViewMode  = '2d' | '3d';

export interface GlobalSettings {
  resolution:  number;    // grid resolution   16 – 256
  heightScale: number;    // 3-D height mult   0 – 5
  wireframe:   boolean;
  colorMode:   ColorMode;
}
