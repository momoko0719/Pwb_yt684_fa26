/**
 * A ground as a height map: one height per texel on a square grid centred on the origin, with what
 * the shader needs beside it. The right representation for ground that rolls and rises but never
 * overhangs (the meadow, the range of peaks): read once per vertex, drawn on a grid whose detail
 * falls off with distance (cdlod.ts). Sharp, built things (plates, pools, walls) are not baked in
 * here; they are meshes of their own, generated from the same rules.
 */
export interface HeightGrid {
  /** Texels per side. */
  size: number;
  /** Metres between texels. */
  texel: number;
  /** Per texel: height, gradient x, gradient z, the island outline's signed distance (negative inside). */
  data: Float32Array;
  /** Highest and lowest height on the island. */
  top: number;
  bottom: number;
}

/** The grid's coordinate of x (or z), in texels from its first. */
const gridCoord = (g: HeightGrid, x: number) => x / g.texel + (g.size - 1) / 2;

/**
 * Bilinear read of channel `c` at (x, z), held at the grid's edge; exactly as the shader reads it
 * (heightAt in cdlod.ts: four fetches, mixed in full precision).
 */
export function sampleGrid(g: HeightGrid, x: number, z: number, c = 0) {
  const max = g.size - 1;
  const fx = Math.min(Math.max(gridCoord(g, x), 0), max), fz = Math.min(Math.max(gridCoord(g, z), 0), max);
  const i = Math.min(Math.floor(fx), max - 1), j = Math.min(Math.floor(fz), max - 1);
  const u = fx - i, v = fz - j;
  const n = (j * g.size + i) * 4 + c, d = g.data;
  return (d[n] * (1 - u) + d[n + 4] * u) * (1 - v) + (d[n + g.size * 4] * (1 - u) + d[n + g.size * 4 + 4] * u) * v;
}

/** Fill each texel's gradient (channels 1, 2) from its height, by central differences. */
export function fillGradients(g: HeightGrid) {
  const { size, data, texel } = g;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const l = (j * size + Math.max(i - 1, 0)) * 4, r = (j * size + Math.min(i + 1, size - 1)) * 4;
      const d = (Math.max(j - 1, 0) * size + i) * 4, u = (Math.min(j + 1, size - 1) * size + i) * 4;
      const t = (j * size + i) * 4;
      data[t + 1] = (data[r] - data[l]) / (2 * texel);
      data[t + 2] = (data[u] - data[d]) / (2 * texel);
    }
  }
}

const AO_DIRECTIONS = 8;
const AO_RADII = [1.5, 4, 10, 25]; // metres out at which the horizon is looked for
const SHADOW_REACH = 400; // metres toward the sun a shadow is looked for
const SHADOW_SOFT = 10; // larger: sharper shadow edges

/**
 * The light on the ground, baked per texel (RGBA bytes, read with filtering): R, how open the sky
 * is above it (ambient occlusion: the horizon's rise in eight directions, near and far); G, how
 * much of the sun reaches it (a soft shadow: the ray toward the sun, the closest the ground comes
 * under it for its length); B, the water standing on it (`water`, if given: see cdlod.ts). Both from the height alone, so the shader pays one read for them.
 * Re-baked when the sun moves (a tenth of a second); the shape's own changes re-bake everything.
 */
export function bakeLight(g: HeightGrid, sun: [number, number, number], water?: Uint8Array): Uint8Array {
  const { size, data, texel } = g;
  const out = new Uint8Array(size * size * 4);
  const flat = Math.hypot(sun[0], sun[2]) || 1e-6;
  const sx = sun[0] / flat, sz = sun[2] / flat, rise = sun[1] / flat;
  const at = (i: number) => (i - (size - 1) / 2) * texel;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const t = (j * size + i) * 4;
      out[t + 3] = 255;
      out[t + 2] = water ? water[j * size + i] : 0;
      if (data[t + 3] > 4) { out[t] = out[t + 1] = 255; continue; } // off the island
      const x = at(i), z = at(j), h = data[t];
      // Ambient occlusion: the mean openness over the directions (1 - horizon angle / 90°).
      let open = 0;
      for (let k = 0; k < AO_DIRECTIONS; k++) {
        const a = (k / AO_DIRECTIONS) * 2 * Math.PI, dx = Math.cos(a), dz = Math.sin(a);
        let horizon = 0;
        for (const r of AO_RADII) horizon = Math.max(horizon, (sampleGrid(g, x + dx * r, z + dz * r) - h) / r);
        open += 1 - Math.atan(horizon) / (Math.PI / 2);
      }
      out[t] = Math.round(255 * Math.min(Math.max(open / AO_DIRECTIONS, 0), 1) ** 1.5);
      // The sun: march toward it in growing steps; the nearest pass over the ground, over the
      // distance gone, sets how much of the sun's disc is hidden (after Inigo Quilez).
      let lit = 1;
      for (let s = 0.75; s < SHADOW_REACH; s = s * 1.12 + 0.5) {
        const above = h + 0.1 + s * rise - sampleGrid(g, x + sx * s, z + sz * s);
        lit = Math.min(lit, (SHADOW_SOFT * above) / s);
        if (lit <= 0) break;
      }
      out[t + 1] = Math.round(255 * Math.min(Math.max(lit, 0), 1));
    }
  }
  return out;
}
