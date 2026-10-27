/**
 * Shared island-rim join rules used by the CDLOD top skin and `rimWall` flange.
 *
 * Top discards when outline > `outlineKeep` (slightly past geometric edge so the skin
 * overlaps the wall). Flange walks inward until outline < `flangeSolid` and samples the
 * same height/outline channels the top reads. Morph can shift the silhouette by ~½ fine
 * quad; `flangeInsetMax` must cover mean inward (~0.6 m) plus that slack — not a magic lift.
 */
export const RIM_JOIN = {
  /** CDLOD: keep drawing while outline ≤ this (metres SDF). Overlaps wall/flange. */
  outlineKeep: 0.28,
  /** Flange inner stop: clearly solid top (same sign convention as height ch3). */
  flangeSolid: -0.55,
  /** Max inward walk from discrete rim polygon (metres). */
  flangeInsetMax: 2.05,
  /** Walk step along inward normal. */
  flangeStep: 0.12,
  /** Z-fight bias only; height still follows the top field. */
  flangeLift: 0.012,
  wallLift: 0.008,
} as const;
