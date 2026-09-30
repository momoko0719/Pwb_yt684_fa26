export interface IslandParams {
  seed: number;
  /** Base radius of the island outline, in world units. */
  radius: number;
  /** 0..1, shape of the hanging rocks: 0 blunt blocks with upright sides, 1 tapered toward their tips. */
  taper: number;
  /** Height of the main peak above the plateau. Secondary spires derive from it. */
  peakHeight: number;
  /** Number of secondary spires around the main peak. */
  peakCount: number;
  /** 0..1, from a tight off-center cluster (open plain beside it) to peaks spread over the plateau. */
  peakSpread: number;
  /** Noise frequency relative to the radius (undulations across the plateau). */
  frequency: number;
  /** 0..1, blends rounded fbm toward ridged fbm (sharp crests). */
  ridgeSharpness: number;
  /** How far the main hanging rock reaches below the rim. */
  undersideDepth: number;
  /** Number of hanging rocks under the plateau, the main one included. */
  rockCount: number;
  /** Number of small rock pools carved into hollows of the plateau. */
  poolCount: number;
  /** Number of rings from center to rim (angular segments = 3x this). */
  resolution: number;
}

/** Surface shading and water; the island generator does not read these. */
export interface SurfaceParams {
  /** 0..1 share of the flat ground that is meadow, lowest first: 0 none, 0.5 the lower half, 1 all of it. */
  meadowLine: number;
  /** Number of thin falls dropping from the rim. */
  fallCount: number;
  /** 0..1, how many blades of grass grow on the meadow: 0 none. */
  grassDensity: number;
  /** 0..1, blade height, scaled with the island's radius. */
  grassHeight: number;
  /** 0..1, how many Zhuyu flowers grow among the grass: 0 none. */
  flowerDensity: number;
}

/**
 * Surface classification shared by the terrain shader and the 2D technique maps. Slopes are
 * 1 - normal.y; ground flatter than grassSlope can hold meadow. The meadow line becomes a world
 * height through `meadowLineHeight` in generators/island.ts.
 */
export const SURFACE_RULES = {
  faceSlope: 0.65,
  grassSlope: 0.05,
  /** World units over which meadow fades out at the meadow line. */
  lineBlend: 0.3,
};

export const DEFAULT_ISLAND: IslandParams = {
  seed: 1,
  radius: 20,
  taper: 0.6,
  peakHeight: 8,
  peakCount: 5,
  peakSpread: 0.4,
  frequency: 1.0,
  ridgeSharpness: 0.6,
  undersideDepth: 45,
  rockCount: 3,
  poolCount: 4,
  resolution: 128,
};

export const DEFAULT_SURFACE: SurfaceParams = {
  meadowLine: 0.9,
  fallCount: 3,
  grassDensity: 0.6,
  grassHeight: 0.5,
  flowerDensity: 0.5,
};
