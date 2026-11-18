/**
 * The school's rule (docs/plan-2026-11-18-school-herd.md), after Couzin et al. 2002's three zones
 * (and Reynolds' boids): each fish looks only at its neighbours, in body lengths,
 * - closer than `repel`: turn away from them (this wins over the rest);
 * - between `repel` and `align`: turn to their mean heading;
 * - between `align` and `attract`: turn toward them;
 * and does not see the ones in the `blind` cone behind it. Pure, no three: the live fish
 * (FishSchool.tsx) and the atlas's school view read the same function.
 */
export interface SchoolParams {
  /** Body lengths. */
  repel: number;
  align: number;
  attract: number;
  /** Degrees of the blind cone behind a fish. */
  blind: number;
}

export const SCHOOL_DEFAULT: SchoolParams = { repel: 1, align: 3, attract: 7, blind: 60 };

export const SCHOOL_LIMITS = {
  repel: [0.5, 2.5], align: [1, 6], attract: [2, 12], blind: [0, 160],
} as const;

export interface Swimmer { x: number; z: number; heading: number; length: number }

/**
 * Which way the neighbours pull a fish: a unit direction (x, z), or null when it sees none;
 * `repelled` when the innermost zone decided it.
 */
export function schoolPull(self: Swimmer, others: Swimmer[], p: SchoolParams): { dir: [number, number] | null; repelled: boolean } {
  const L = self.length, hx = Math.cos(self.heading), hz = Math.sin(self.heading);
  const behind = Math.cos(Math.PI - (p.blind * Math.PI) / 360);
  let rx = 0, rz = 0, ax = 0, az = 0, cx = 0, cz = 0, nr = 0, na = 0, nc = 0;
  for (const o of others) {
    if (o === self) continue;
    const dx = o.x - self.x, dz = o.z - self.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) continue;
    // In the cone straight behind it: unseen.
    if ((dx * hx + dz * hz) / d < behind) continue;
    if (d < p.repel * L) { rx -= dx / d; rz -= dz / d; nr++; }
    else if (d < p.align * L) { ax += Math.cos(o.heading); az += Math.sin(o.heading); na++; }
    else if (d < p.attract * L) { cx += dx / d; cz += dz / d; nc++; }
  }
  const unit = (x: number, z: number): [number, number] | null => { const l = Math.hypot(x, z); return l > 1e-6 ? [x / l, z / l] : null; };
  if (nr) return { dir: unit(rx, rz), repelled: true };
  const a = na ? unit(ax, az) : null, c = nc ? unit(cx, cz) : null;
  if (!a && !c) return { dir: null, repelled: false };
  return { dir: unit((a?.[0] ?? 0) + (c?.[0] ?? 0), (a?.[1] ?? 0) + (c?.[1] ?? 0)), repelled: false };
}

/** How the school is doing, for checks and the atlas: its centre, spread (m), and how aligned (0 to 1). */
export function schoolShape(fish: Swimmer[]) {
  const n = fish.length || 1;
  const cx = fish.reduce((s, f) => s + f.x, 0) / n, cz = fish.reduce((s, f) => s + f.z, 0) / n;
  const spread = Math.sqrt(fish.reduce((s, f) => s + (f.x - cx) ** 2 + (f.z - cz) ** 2, 0) / n);
  const hx = fish.reduce((s, f) => s + Math.cos(f.heading), 0) / n, hz = fish.reduce((s, f) => s + Math.sin(f.heading), 0) / n;
  return { centre: [cx, cz] as [number, number], spread, order: Math.hypot(hx, hz) };
}
