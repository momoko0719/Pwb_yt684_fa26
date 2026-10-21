/**
 * The world's scale: 1 world unit = 1 metre. Two tables:
 *
 * - SIZES: the fixed real-world sizes the generators use for things that stand on the island
 *   (people, plants, buildings, paths, water). They do not scale with the island.
 * - SCALE_TARGET: the size each kind of thing should come out at, with where the number comes
 *   from, for checking what is built (the scale view, docs/scale.md).
 *
 * Landforms (plateau, peaks, cliff, hanging rocks) are still generated as fractions of the
 * island's radius; the island parameters are chosen so they meet SCALE_TARGET.
 */

/** Sizes in metres used by the generators. Ranges are [low, high]. */
export const SIZES = {
  person: {
    height: 1.7,
    /** Eye height, about 0.93 of stature. */
    eye: 1.6,
    /** Usual outdoor walking speed, m/s (meta-analysis of 14k adults: 1.31). */
    walk: 1.3,
    /** Running is this many times the walking speed (about 3.3 m/s). */
    runFactor: 2.5,
  },
  pine: {
    /** Height by site: wind-stunted on the cliff edge, taller on the plateau, tallest in shelter. */
    edge: [4, 8] as [number, number],
    plateau: [8, 15] as [number, number],
    sheltered: [15, 20] as [number, number],
    /** Trunks at least this far apart. */
    minGap: 15,
    /** Level-of-detail switch distances (every needle within the first, flat sprays past the second). */
    lod: [80, 300] as [number, number],
  },
  pavilion: {
    plinth: 0.45,
    /** Column height: the eave ends up about 3 m above the ground. */
    column: [2.6, 3.2] as [number, number],
    /** Radius of the ring of columns: 3.2–4.8 m across. */
    ring: [1.6, 2.4] as [number, number],
    roof: [1.4, 2.2] as [number, number],
    eaveLift: [0.3, 0.7] as [number, number],
    /** Pavilions stand at least this far apart, at most this many on an island. */
    gap: 40,
    max: 6,
    /** How far from a click to look for a spot worth a pavilion. */
    search: 8,
  },
  path: {
    width: 1.5,
    /** Distance between path samples. */
    sample: 0.6,
    /** Longest stone arch, and how far below the deck the ground must be to count as a gully. */
    spanMax: 20,
    gullyDepth: 4,
  },
  pool: { radius: [5, 12] as [number, number] },
  /**
   * Streams: a stream begins where this much ground drains into it, and widens with the square
   * root of the area drained (design judgement: headwater streams are often only ~0.3 m wide).
   */
  stream: { sourceArea: 6000, width: [0.6, 6] as [number, number] },
  /**
   * Forest pines: shorter and denser than lone pines. Natural Huangshan pine stands measured
   * 750 trees/ha at 10.2 m mean height (1300 m altitude) and 1514/ha at 3.7 m (1600 m).
   * `spacing` is the grid one tree may grow in: 3 m gives at most 1111 trees/ha.
   */
  forest: { height: [4, 11] as [number, number], spacing: 3, lod: [40, 220] as [number, number] },
  /** Rhododendron thickets at forest edges and on cliffs (design judgement; the related R. fortunei reaches 4–5 m when old). */
  shrub: { height: [1, 3] as [number, number] },
  /** Granite boulders; Flying-Over Rock on Huangshan is about 12 m tall. */
  boulder: { size: [2, 12] as [number, number] },
  /** The island's one lake: design judgement (Huangshan has no lake this size); depth after the Emerald Pool, about 10 m. */
  lake: { radius: [60, 100] as [number, number], depth: 8 },
  /** A thin fall's width where it leaves the lip; it spreads three times wider as it frays. */
  fall: { width: 3 },
  grass: {
    /** Blade height at the grass-height slider's 0 and 1 (each blade varies 0.6–1.4 of it). */
    height: [0.05, 0.3] as [number, number],
  },
  flower: { stem: 0.3, head: 0.06 },
  /** The orbit camera keeps at least this far from the rock. */
  camera: { clearance: 2 },
};

export type ScaleId =
  | 'island' | 'mainPeak' | 'spire' | 'cliff' | 'lake' | 'pool' | 'stream' | 'fall'
  | 'pine' | 'forest' | 'shrub' | 'boulder' | 'pavilion' | 'path' | 'grass' | 'flower' | 'person';

export interface ScaleTarget {
  /** Metres, low and high end of the range. */
  range: [number, number];
  /** What is measured. */
  measure: 'height' | 'across' | 'width';
  /** Where the number comes from, or "judgement" when no source was found. */
  source: string;
}

export const PERSON_HEIGHT = SIZES.person.height;
export const EYE_HEIGHT = SIZES.person.eye;

/** Target sizes, with sources (docs/scale.md lists the links). */
export const SCALE_TARGET: Record<ScaleId, ScaleTarget> = {
  island: { range: [800, 1200], measure: 'across', source: 'Design judgement: one peak group cut from Huangshan (the scenic area is 154 km²).' },
  mainPeak: { range: [100, 150], measure: 'height', source: 'Huangshan: domical peaks around a remnant planation surface, local relief of hundreds of metres; Lotus Peak summit path climbs about 110 m.' },
  spire: { range: [40, 105], measure: 'height', source: '0.4–0.7 of the main peak, as the generator sets them.' },
  cliff: { range: [200, 400], measure: 'height', source: 'Huangshan peaks rise about 1000 m above the surrounding ground (UNESCO Global Geopark).' },
  lake: { range: [100, 200], measure: 'across', source: 'Design judgement: Huangshan has no lake this size; one tarn as the island\'s main water.' },
  pool: { range: [10, 24], measure: 'across', source: 'Emerald Pool on Huangshan: about 15 x 8 m, 10 m deep (travel listing, unsourced).' },
  stream: { range: [0.3, 6], measure: 'width', source: 'Headwater streams are often about 0.3 m wide; width grows with drainage area (design judgement for the rate).' },
  fall: { range: [3, 9], measure: 'width', source: 'Nine Dragon Falls: upper falls about 5 m wide, the last over 20 m; Ren Zi Falls drops 80 m.' },
  pine: { range: [4, 20], measure: 'height', source: 'Pinus hwangshanensis 15–25 m in forest; Welcoming Pine 10–13 m; cliff pines are wind-stunted (judgement).' },
  forest: { range: [3.5, 11], measure: 'height', source: 'Natural Huangshan pine stands: 10.2 m mean at 1300 m altitude, 3.7 m at 1600 m (750 and 1514 trees/ha).' },
  shrub: { range: [1, 3], measure: 'height', source: 'Design judgement; the related R. fortunei reaches 4–5 m when old.' },
  boulder: { range: [2, 12], measure: 'height', source: 'Flying-Over Rock on Huangshan: about 12 m tall, 7.5 m long.' },
  pavilion: { range: [4.5, 6.5], measure: 'height', source: 'Eave usually 3–4 m; a Suzhou half-pavilion eave 2.54 m; the Ngong Ping pavilion 5.4 m tall.' },
  path: { range: [1.2, 1.5], measure: 'width', source: 'GB 51192-2016: paths at least 0.9 m, 1.2 m for wheelchairs, stair paths at least 1.5 m clear.' },
  grass: { range: [0.05, 0.3], measure: 'height', source: 'Alpine meadow-grass up to about 20 cm.' },
  flower: { range: [0.2, 0.5], measure: 'height', source: 'Subalpine meadow flower stems 20–70 cm, above the grass.' },
  person: { range: [PERSON_HEIGHT, PERSON_HEIGHT], measure: 'height', source: 'Standing adult; eye about 0.93 of stature.' },
};

export const SCALE_ORDER: ScaleId[] = ['island', 'mainPeak', 'spire', 'cliff', 'lake', 'pool', 'stream', 'fall', 'pine', 'forest', 'shrub', 'boulder', 'pavilion', 'path', 'grass', 'flower', 'person'];

/** A value between the two ends of a range, t in 0..1. */
export const within = ([a, b]: [number, number], t: number) => a + (b - a) * t;

/** The nearest 1, 2 or 5 times a power of ten at or above `x`: grid steps and scale-bar lengths. */
export function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(x, 1e-6)));
  for (const m of [1, 2, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

/** Whether a measured size [lo, hi] sits inside its target range. */
export function withinTarget(id: ScaleId, [lo, hi]: [number, number]): 'small' | 'ok' | 'large' {
  const [a, b] = SCALE_TARGET[id].range;
  if (hi < a * 0.9) return 'small';
  if (lo > b * 1.1) return 'large';
  return 'ok';
}
