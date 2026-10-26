import type { Noise2D } from '../../core/noise';
import { createRng } from '../../core/rng';
import { smoothstep } from '../../core/sdf/sdf';

/**
 * The range of peaks around the terrace (part 3), after the owner's reference (white porcelain
 * mountains): steep, round-headed peaks in two rows, the front row lower, the back row along the
 * rim; open to the west, where the water leaves.
 *
 * Its relief comes from its structure, as a real range's does, not from a texture laid over it
 * (chosen in a lo-fi comparison, "spurs and a few gullies"): each main peak sends two or three
 * spurs down from its summit, lower shoulders reaching out in directions of their own, and between
 * the spurs the ground falls into valleys; and here and there, not everywhere, a few broad gullies
 * run down the slopes, shallow near the summits, deepest on the lower flanks. (Folds ribbing every
 * peak from its summit, the first version, read as a row of steamed buns.)
 *
 * The rule, not a placement: each row is a line set in from the island's oval by a fixed distance,
 * over the angles around the range's centre that face away from the pass. Along it, peaks are
 * spaced about SPACING degrees apart, each nudged by chance; a peak's height falls from TOP in the
 * east toward both arms (a power of the cosine of half its angle), each peak varied by chance. All
 * the peaks and spurs run together where they overlap (a smooth maximum, so between two summits
 * there is a saddle, not a seam).
 */
export const RANGE = {
  reach: 110, // degrees either side of the back the range runs to (open toward the front beyond)
  top: 110, // metres, the tallest peaks (in the east)
  foot: 30, // metres, the peaks at the ends of the arms
  spacing: 11, // degrees between neighbouring peaks
  /** The two rows: inset from the oval (metres), height as a share of the back row's. */
  rows: [{ inset: 50, share: 1 }, { inset: 88, share: 0.68 }],
  spurs: [2, 3] as [number, number], // spurs from each main peak, fewest and most
  gullyDepth: 5, // metres, at most
  gullySpacing: 34, // metres between neighbouring gullies, along the range
};
/** The rule's numbers (sliders may change them; RANGE holds the agreed ones). */
export type RangeParams = typeof RANGE;

export interface Peak {
  x: number;
  z: number;
  /** Height above the ground, metres. */
  height: number;
  /** Half-widths along its long axis and across it, metres. */
  along: number;
  across: number;
  /** The direction its long axis lies across (radians): a main peak lies along the range. */
  angle: number;
  /** A main peak (true) or one of its spurs. */
  main: boolean;
  row: number;
}

const SPUR_FAN = 1.1; // radians between neighbouring spurs
const UNION = 0.09; // 1/metres: how sharply the smooth maximum turns (larger: sharper saddles)

/** Where a line from the range's centre at `angle` meets the oval set in by `inset` metres. */
function onRow(angle: number, inset: number, rx: number, rz: number, centre: [number, number]): [number, number] {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  const [cx, cz] = centre;
  // Bisect along the line for the inset oval (x/(rx-inset))^2 + (z/(rz-inset))^2 = 1.
  const ax = rx - inset, az = rz - inset;
  let lo = 0, hi = Math.max(rx, rz) * 2;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2, x = cx + dx * m, z = cz + dz * m;
    if ((x / ax) ** 2 + (z / az) ** 2 < 1) lo = m; else hi = m;
  }
  return [cx + dx * lo, cz + dz * lo];
}

/** The peaks and their spurs, from the rule above, for an island whose oval has half-axes rx, rz. */
export function rangePeaks(seed: number, rx: number, rz: number, R: RangeParams, centre: [number, number], back: number): Peak[] {
  const rng = createRng(seed + 31);
  const peaks: Peak[] = [];
  R.rows.forEach((row, r) => {
    // The front row sits between the back row's peaks.
    for (let deg = -R.reach + (r ? R.spacing / 2 : 0); deg <= R.reach; deg += R.spacing) {
      // (Its angle from the back, which sets its height; and its bearing from the range's centre.)
      const angle = ((deg + 0.6 * R.spacing * (rng() - 0.5)) * Math.PI) / 180, bearing = back + angle;
      // Fewer peaks in the front row: about every other place.
      if (r && rng() < 0.45) continue;
      const fall = Math.cos(angle / 2) ** 2.5;
      const height = (R.foot + (R.top - R.foot) * fall) * row.share * (0.75 + 0.35 * rng());
      const [x, z] = onRow(bearing, row.inset + 10 * (rng() - 0.5), rx, rz, centre);
      const along = 16 + 0.2 * height;
      peaks.push({ x, z, height, along, across: 15 + 0.18 * height, angle: bearing, main: true, row: r });
      // Its spurs: fanned out toward the rim or toward the terrace, each lower and narrower,
      // reaching out from the summit by a share of the peak's size.
      const n = R.spurs[0] + Math.floor(rng() * (R.spurs[1] - R.spurs[0] + 1));
      for (let q = 0; q < n; q++) {
        const dir = bearing + (q - (n - 1) / 2) * SPUR_FAN + 0.5 * (rng() - 0.5) + (rng() < 0.5 ? 0 : Math.PI);
        const reach = 0.55 * along + 0.3 * height * rng();
        const h = height * (0.45 + 0.25 * rng());
        peaks.push({
          x: x + Math.cos(dir) * reach, z: z + Math.sin(dir) * reach, height: h,
          along: 10 + 0.35 * h, across: 9 + 0.25 * h, angle: dir + Math.PI / 2, main: false, row: r,
        });
      }
    }
  });
  return peaks;
}

/**
 * The range's height at (x, z), metres above the ground (0 away from it). Each peak and spur is
 * steep-sided and round-headed (1 - t^2.4 over its footprint, t its distance out over its
 * half-widths), all joined by a smooth maximum; then the gullies cut.
 */
export function rangeHeight(peaks: Peak[], x: number, z: number, noise: Noise2D, R: RangeParams, centre: [number, number]): number {
  let sum = 0;
  for (const p of peaks) {
    const dx = x - p.x, dz = z - p.z;
    const reach = Math.max(p.along, p.across);
    if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const along = -dx * sa + dz * ca, across = dx * ca + dz * sa;
    const t = Math.hypot(along / p.along, across / p.across);
    if (t >= 1) continue;
    // A main peak round-headed and steep to its foot; a spur a shoulder flaring out at its foot
    // (as narrow as it is, steep to the foot it was a fin). exp - 1, so a peak adds nothing at its
    // edge (no seam where its footprint ends).
    const rise = p.main ? 1 - t ** 2.4 : (1 - t * t) ** 1.5;
    sum += Math.exp(UNION * p.height * rise) - 1;
  }
  const h = Math.log(1 + sum) / UNION;
  if (h <= 0) return 0;
  // The gullies: running down the range (their phase follows the angle around its centre), each
  // wandering and breaking off; a smooth bump of a sine, so their edges are soft. Only on the lower
  // flanks, and only where a broad noise lets them: most slopes stay smooth.
  const ang = Math.atan2(z - centre[1], x - centre[0]);
  const rad = Math.hypot(x - centre[0], z - centre[1]);
  const phase = (ang * 170) / R.gullySpacing + 1.35 * noise(x / 60, z / 60) + 0.18 * noise(rad / 18, ang * 4);
  const gully = Math.max(0, Math.sin(phase * 2 * Math.PI)) ** 3;
  const down = smoothstep(0.15, 0.55, 1 - h / R.top) * smoothstep(4, 20, h);
  const here = smoothstep(0.05, 0.25, 0.5 * noise(x / 70 + 7, z / 70));
  return Math.max(h - R.gullyDepth * gully * down * here * (0.6 + 0.4 * Math.abs(noise(x / 30, z / 30))), 0);
}
