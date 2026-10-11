import type { TurtleParams } from './lsystem';
import type { TreeColors } from './lod';

export type PresetId = 'pine' | 'willow' | 'classic' | 'vine';

export interface Preset {
  axiom: string;
  rules: string;
  generations: number;
  params: TurtleParams;
  colors: TreeColors;
  /** Can it stand on the ground in the forest? (a hanging vine cannot) */
  forest: boolean;
}

export const PRESETS: Record<PresetId, Preset> = {
  // Huangshan "welcome pine": irregular whorls of long, almost level limbs carrying flat cloud pads.
  pine: {
    axiom: 'FFFA',
    rules: [
      'A = F[&B]*A : 0.4',
      'A = F[&B]**[&B]*A : 0.35',
      'A = FA : 0.25',
      'B = F[-C]B : 0.35',
      'B = F[+C]B : 0.35',
      'B = F[-C][+C]B : 0.3',
      'C = FL',
    ].join('\n'),
    generations: 7,
    params: { angle: 72, length: 0.9, width: 0.32, lengthDecay: 0.78, widthDecay: 0.55, taper: 0.94, gravity: 0.06, jitter: 0.45, pad: 0.75, heading: 'up' },
    colors: { bark: '#2f2924', leafTop: '#55634a', leafBottom: '#1d221d' },
    forest: true,
  },
  // Heavy gravity turns the same kind of grammar into hanging, weeping branches.
  willow: {
    axiom: 'FFFFA',
    rules: [
      'A = F[&B]*[&B]*A : 0.6',
      'A = F*[&B]A : 0.4',
      'B = FLB : 0.6',
      'B = F[-B][+B] : 0.4',
    ].join('\n'),
    generations: 10,
    params: { angle: 60, length: 0.75, width: 0.24, lengthDecay: 0.95, widthDecay: 0.45, taper: 0.93, gravity: 1.1, jitter: 0.35, pad: 0.26, heading: 'up' },
    colors: { bark: '#3a332c', leafTop: '#8a9a62', leafBottom: '#3e4a33' },
    forest: true,
  },
  // The textbook plant (Prusinkiewicz & Lindenmayer, fig. 1.24a): one rule, no randomness, flat in a plane.
  classic: {
    axiom: 'F',
    rules: 'F = F[+F]F[-F]F',
    generations: 4,
    params: { angle: 25.7, length: 0.32, width: 0.08, lengthDecay: 1, widthDecay: 0.7, taper: 0.995, gravity: 0, jitter: 0, pad: 0.2, heading: 'up' },
    colors: { bark: '#1b1a18', leafTop: '#55634a', leafBottom: '#1d221d' },
    forest: true,
  },
  // A vine hanging under a floating rock: it starts heading down and sometimes splits.
  vine: {
    axiom: 'V',
    rules: ['V = FLV : 0.5', 'V = F[+&V]V : 0.25', 'V = F[-^V]V : 0.25'].join('\n'),
    generations: 11,
    params: { angle: 28, length: 0.7, width: 0.07, lengthDecay: 0.9, widthDecay: 0.8, taper: 0.97, gravity: 0.25, jitter: 0.6, pad: 0.28, heading: 'down' },
    colors: { bark: '#3b3027', leafTop: '#6f8452', leafBottom: '#2a3424' },
    forest: false,
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
