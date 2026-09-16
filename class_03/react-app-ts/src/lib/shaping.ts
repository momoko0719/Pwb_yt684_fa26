/**
 * shaping.ts
 * ----------
 * Math shaping / transfer functions applied to a normalised noise value.
 * Input and output are both in 0 … 1.
 */

import type { ShapingFn } from '../types';

export function applyShaping(t: number, fn: ShapingFn, param: number): number {
  // clamp input
  const v = Math.max(0, Math.min(1, t));

  switch (fn) {
    // ── No change ──────────────────────────────────────────────────
    case 'linear':
      return v;

    // ── S-curve easing ─────────────────────────────────────────────
    case 'smoothstep':
      return v * v * (3 - 2 * v);

    // ── Exponent (param = exponent, default ~1) ────────────────────
    case 'power':
      return Math.pow(v, Math.max(0.05, param));

    // ── Absolute value → V-shape ───────────────────────────────────
    // Maps 0…1 → re-centred absolute: high at edges, low at centre
    case 'abs':
      return Math.abs(v * 2 - 1);

    // ── Billow: soft bumps, high at centre ─────────────────────────
    case 'billow':
      return 1 - Math.abs(v * 2 - 1);

    // ── Ridged: sharp peaks ────────────────────────────────────────
    case 'ridged': {
      const r = 1 - Math.abs(v * 2 - 1);
      return r * r; // square for steeper ridges
    }

    // ── Terrace: quantise into flat steps (param = step count) ─────
    case 'terrace': {
      const steps = Math.max(1, Math.round(param));
      return Math.round(v * steps) / steps;
    }

    default:
      return v;
  }
}
