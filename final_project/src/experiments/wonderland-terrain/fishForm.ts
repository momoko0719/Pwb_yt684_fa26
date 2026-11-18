import { createRng } from '../../core/rng';

/**
 * A streamling's form, as rules (no React, no three): the body's profile, the patches, the fins'
 * outlines, and how it swims. The live fish (FishSchool.tsx), its atlas model and the atlas's
 * growth steps (FishGrowth.tsx) all read these, so what the steps show is what the fish is.
 */
export interface FishForm {
  seed: number;
  /** Body length, metres. */
  length: number;
  /** Deepest depth, metres. */
  depth: number;
  /** How deep the tail's fork is, 0 (square) to 1 (deeply forked). */
  fork: number;
  /** How many jade patches. */
  marks: number;
  /** Fin size, 0 short and round to 1 long and trailing. */
  fin: number;
}

export const FORM_RULES = {
  /** A grown carp in a mountain pool: 45 to 75 cm; deepest at a quarter to under a third of its length. */
  length: [0.45, 0.75] as const,
  depthRatio: [0.24, 0.3] as const,
  fork: [0.3, 0.7] as const,
  marks: [2, 5] as const,
  /** Where it is deepest (fraction of its length from the nose), and the peduncle's depth (of the deepest). */
  deepestAt: 0.33,
  peduncle: 0.26,
};

/**
 * How it swims, from its size (not set per fish): it cruises at 0.4 to 0.8 body lengths a second;
 * its tail beats at the Strouhal number most swimming fish keep (frequency × tail sweep ÷ speed ≈
 * 0.3), its tail sweeping a fifth of its length; the wave down its body is one body length long.
 */
export const SWIM = { cruise: [0.4, 0.8] as const, strouhal: 0.3, sweep: 0.2, wavelength: 1, holdBeat: 0.35 };

/** Tail beats a second at `speed` m/s. */
export const tailBeatHz = (form: Pick<FishForm, 'length'>, speed: number) => SWIM.strouhal * speed / (SWIM.sweep * form.length);

export function formFromSeed(seed: number): FishForm {
  const rand = createRng(seed * 131 + 17);
  const pick = (r: readonly [number, number]) => r[0] + rand() * (r[1] - r[0]);
  const length = pick(FORM_RULES.length);
  return {
    seed, length, depth: length * pick(FORM_RULES.depthRatio), fork: pick(FORM_RULES.fork),
    marks: FORM_RULES.marks[0] + Math.floor(rand() * (FORM_RULES.marks[1] - FORM_RULES.marks[0] + 1)), fin: rand(),
  };
}

const smooth = (a: number, b: number, v: number) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/** The body's height (0 to 1 of its deepest) at u along it, nose 0 to tail base 1. */
export function fishProfile(u: number) {
  const at = FORM_RULES.deepestAt;
  if (u < at) return Math.pow(Math.sin((Math.PI / 2) * (0.08 + 0.92 * u / at)), 0.6);
  return 1 - (1 - FORM_RULES.peduncle) * smooth(at, 0.9, u);
}

export interface Patch { u: number; a: number; r: number; w: number; k: number }

/** Seeded patches on the back and flanks: where along (u), how far round from the top (a, radians), how big (m), each edge's wobble. */
export function fishPatches(form: FishForm): Patch[] {
  const rand = createRng(form.seed);
  return Array.from({ length: form.marks }, () => ({
    u: 0.1 + rand() * 0.72, a: (rand() * 2 - 1) * 1.2, r: form.length * (0.05 + rand() * 0.07), w: rand() * 6.28, k: 2 + Math.floor(rand() * 3),
  }));
}

type P2 = [number, number];

/** A closed Catmull-Rom curve through `points`: rounded corners everywhere. */
export function roundOutline(points: P2[], steps = 6): P2[] {
  const out: P2[] = [], n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as P2);
    }
  }
  return out;
}

export interface FinShape { outline: P2[]; centre: P2 }

/**
 * The fins, each a rounded outline in its own plane (x back along the body is negative, y up),
 * root at the origin: a long dorsal, a paddle pectoral, small pelvic and anal fins, a two-lobed tail
 * whose notch is as deep as its fork. `fin` lengthens them all.
 */
export function finShapes(form: FishForm): Record<'dorsal' | 'pectoral' | 'small' | 'tail', FinShape> {
  const L = form.length, D = form.depth, f = 0.8 + 0.5 * form.fin;
  return {
    dorsal: { outline: roundOutline([[0, -0.01], [0, D * 0.36 * f], [-L * 0.1, D * 0.3 * f], [-L * 0.22, D * 0.15 * f], [-L * 0.3, D * 0.04], [-L * 0.3, -0.01]]), centre: [-L * 0.14, 0] },
    pectoral: { outline: roundOutline([[0, D * 0.02], [-L * 0.05 * f, D * 0.08], [-L * 0.13 * f, D * 0.03], [-L * 0.12 * f, -D * 0.05], [-L * 0.03, -D * 0.04]]), centre: [-L * 0.04, 0] },
    small: { outline: roundOutline([[0, 0.005], [-L * 0.02, -D * 0.2 * f], [-L * 0.09, -D * 0.18 * f], [-L * 0.08, 0.005]]), centre: [-L * 0.045, -D * 0.05] },
    tail: { outline: roundOutline([[0.01, D * 0.12], [-L * 0.2 * f, D * 0.46], [-L * 0.2 * f * (1 - 0.6 * form.fork), 0], [-L * 0.2 * f, -D * 0.44], [0.01, -D * 0.12]]), centre: [-L * 0.03, 0] },
  };
}
