/**
 * Wonderland's fixed design numbers (docs/wonderland.md). Metres; x is east, z is south, y is up.
 * Where the parts stand is not here: it comes from the seed and the frame's relations (frame.ts).
 *
 * The blockout's placeholder volumes, which stood here until the parts were built, are retired
 * (docs/wonderland-world-plan.md, R1.2): the groves give way to woodland grown by rule; the hall
 * is removed (no use for it yet in the world's structure); pavilions, the bridge, the landing and
 * the lookout wait for the sites-and-routes phase, which places each by its use.
 */
export const SEED = 684; // the demonstration seed (all chance goes through core/rng.ts)
export const ISLAND = { across: 560, deep: 440 }; // the outline's two axes (judgement within 500–600 m)
export const TERRACE_LEVELS = [14, 21, 25.5]; // top of each level of the terrace: drops of 7 and 4.5 m, not even (judgement)
