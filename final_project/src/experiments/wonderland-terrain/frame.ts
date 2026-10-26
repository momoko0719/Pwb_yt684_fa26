import { createRng } from '../../core/rng';

/**
 * The island's frame: where its parts stand relative to each other, from the seed and a few design
 * relations, instead of coordinates set by hand (docs/wonderland-world-plan.md, R1.1).
 *
 * The structure is fixed by design (docs/wonderland.md): a raised terrace in a basin, the range of
 * peaks round it on three sides, highest at the back, open toward the front, where the water leaves
 * through the pass. The seed sets how it lies: the back's direction (nominally east, so the pass
 * faces west, toward the sunset; turned by the seed within `spread`), the basin a little off the
 * island's centre toward the back, the three plates' proportions and offsets (each level a little
 * off the one below, so the outlines do not nest like contour lines).
 *
 * Everything is measured in the frame's own axes: u toward the back, v across. Sizes and offsets
 * are given for the reference island (ISLAND, 560 x 440 m) and scaled by the island's radius along
 * each axis. With `variation` 0 the frame is the agreed blockout exactly.
 */
export interface FrameParams {
  /** Radians from east the back of the range faces (the pass faces the opposite way). */
  back: number;
  /** Radians the seed may turn it either way. */
  spread: number;
  /** How much the seed varies the basin and the plates (0: the agreed layout, 1: full). */
  variation: number;
}
export const FRAME_DEFAULTS: FrameParams = { back: 0, spread: (17 * Math.PI) / 180, variation: 1 }; // (17°: whole degrees, as the panel sets it)

/** The reference layout, in metres on the reference island, in the frame's axes (u toward the back, v across). */
const REFERENCE = {
  /** The basin (the lowest plate's centre): this far from the island's centre toward the back. */
  basin: 70,
  /** The range's centre: this far from the island's centre toward the back. */
  range: 80,
  /** The underside's deepest point (its keel): this far toward the back, under the range's weight. */
  keel: 30,
  /** The plates, lowest first: centre offset from the lowest's (u, v), footprint (u, v). */
  plates: [
    { offset: [0, 0], size: [200, 160] },
    { offset: [20, -12], size: [138, 108] },
    { offset: [36, 0], size: [86, 72] },
  ] as { offset: [number, number]; size: [number, number] }[],
};
/** How far the seed may move things, at full variation (metres on the reference island, or shares). */
const VARY = {
  drift: 14, // the basin, across
  slide: 10, // the basin, toward or away from the back
  size: 0.07, // each plate's footprint, a share either way
  offset: 10, // each upper plate's offset, either way on each axis
};

export interface Plate {
  centre: [number, number];
  /** Footprint along u and v, metres. */
  size: [number, number];
}
export interface Frame {
  /** Unit vectors: toward the back of the range (u) and across (v). */
  u: [number, number];
  v: [number, number];
  /** The back's angle from east, radians; the opening's is this plus pi. */
  back: number;
  basin: [number, number];
  rangeCentre: [number, number];
  keel: [number, number];
  plates: Plate[];
}

/** The island's radius along a direction (its oval of half-axes rx, rz). */
export function ovalRadius(rx: number, rz: number, angle: number) {
  return (rx * rz) / Math.hypot(rz * Math.cos(angle), rx * Math.sin(angle));
}

export function islandFrame(seed: number, rx: number, rz: number, refRx: number, refRz: number, p: FrameParams = FRAME_DEFAULTS): Frame {
  const rng = createRng(seed + 977);
  const signed = () => 2 * rng() - 1;
  const back = p.back + p.spread * p.variation * signed();
  const u: [number, number] = [Math.cos(back), Math.sin(back)];
  const v: [number, number] = [-Math.sin(back), Math.cos(back)];
  // Scales from the reference island to this one, along each axis.
  const su = ovalRadius(rx, rz, back) / refRx, sv = ovalRadius(rx, rz, back + Math.PI / 2) / refRz;
  const at = (a: number, b: number): [number, number] => [u[0] * a * su + v[0] * b * sv, u[1] * a * su + v[1] * b * sv];
  const slide = VARY.slide * p.variation * signed(), drift = VARY.drift * p.variation * signed();
  const basinUV: [number, number] = [REFERENCE.basin + slide, drift];
  const plates = REFERENCE.plates.map((pl, k) => {
    const grow = 1 + VARY.size * p.variation * signed(), stretch = 1 + VARY.size * p.variation * signed();
    const off: [number, number] = k ? [pl.offset[0] + VARY.offset * p.variation * signed(), pl.offset[1] + VARY.offset * p.variation * signed()] : [0, 0];
    const centre = at(basinUV[0] + off[0], basinUV[1] + off[1]);
    return { centre, size: [pl.size[0] * su * grow, pl.size[1] * sv * stretch] as [number, number] };
  });
  return { u, v, back, basin: plates[0].centre, rangeCentre: at(REFERENCE.range + slide, drift), keel: at(REFERENCE.keel, 0), plates };
}
