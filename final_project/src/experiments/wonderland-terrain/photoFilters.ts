import { Color, ShaderMaterial, Vector2, type Texture } from 'three';
import { PHOTO } from '../../core/palette';

/**
 * The camera's paintings: one full-screen pass over the rendered island (its colour and depth),
 * each a rule after a painting, not a picture of one:
 *
 * - blue-green (青绿), after Wang Ximeng's A Thousand Li of Rivers and Mountains: each colour is
 *   replaced by a mineral pigment by its hue (water and shadow: azurite; green: malachite; warm:
 *   ochre), laid in flat layers on aged silk with a fine weave, outlined in thin brown ink.
 * - watercolour (水彩), after Turner's and Sargent's sheets: colours smoothed into washes (a
 *   Kuwahara filter: each pixel takes the calmest of the four squares round it), pigment pooling
 *   darker at the edges of each wash, granulation, cold-pressed paper.
 * - ink (水墨), after Mi Youren's cloudy mountains: light becomes paper, dark becomes ink in a few
 *   soft washes that bleed a little; outlines are dry, broken strokes; what is far away dissolves
 *   into the paper (留白), so the sky and the distance are left empty.
 * - oil (油画), after Van Gogh: colour smeared along strokes (a line integral along a direction
 *   field: across the light's gradient on the land, a swirl in the sky), each stroke ridged and lit
 *   like impasto; shadows pushed to ultramarine, lights to chrome yellow, dark contours.
 *
 * The scene is rendered linear into a target; the pass encodes it to sRGB, paints, and writes sRGB.
 */
// Owner, 2026-11-21: the island's own colours first, then blue-green, watercolour, ink, Van Gogh.
export const PHOTO_FILTERS = ['none', 'blueGreen', 'watercolour', 'ink', 'oil'] as const;
export type PhotoFilter = (typeof PHOTO_FILTERS)[number];
/** The shader's branch for each (uMode). */
export const PHOTO_MODE: Record<PhotoFilter, number> = { none: 0, ink: 1, blueGreen: 2, watercolour: 3, oil: 4 };

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear, uFar;
uniform int uMode;
uniform vec3 cInkPaper, cInk, cSilk, cSilkDark, cAzurite, cMalachite, cOchre, cOutline, cWcPaper, cUltra, cChrome;
varying vec2 vUv;

vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 col(vec2 uv) { return toSRGB(texture2D(tColor, clamp(uv, 0.0, 1.0)).rgb); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float metres(vec2 uv) {
  float d = texture2D(tDepth, clamp(uv, 0.0, 1.0)).x;
  return -perspectiveDepthToViewZ(d, uNear, uFar);
}
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
// Edges: the light's and the depth's (Sobel), so a ridge in front of a ridge of the same tone still shows.
float edges(vec2 uv, float w) {
  vec2 px = w / uRes;
  float l[9], z[9];
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 o = vec2(float(i - 1), float(j - 1)) * px;
    l[j * 3 + i] = luma(col(uv + o));
    z[j * 3 + i] = log(max(metres(uv + o), 0.1));
  }
  float lx = l[2] + 2.0 * l[5] + l[8] - l[0] - 2.0 * l[3] - l[6], ly = l[6] + 2.0 * l[7] + l[8] - l[0] - 2.0 * l[1] - l[2];
  float zx = z[2] + 2.0 * z[5] + z[8] - z[0] - 2.0 * z[3] - z[6], zy = z[6] + 2.0 * z[7] + z[8] - z[0] - 2.0 * z[1] - z[2];
  return clamp(length(vec2(lx, ly)) * 1.6 + length(vec2(zx, zy)) * 0.9, 0.0, 1.0);
}
vec2 aspect() { return vec2(uRes.x / uRes.y, 1.0); }

vec3 ink(vec2 uv) {
  vec2 p = uv * aspect();
  // Wet ink bleeds: read the picture a little displaced by a slow noise.
  vec2 bleed = (vec2(fbm(p * 18.0), fbm(p * 18.0 + 7.3)) - 0.5) * 6.0 / uRes;
  float L = luma(col(uv + bleed));
  float far = smoothstep(180.0, 1400.0, metres(uv));
  // A wash pools in the folds: how much darker it is than the ground round it.
  vec2 px = 1.0 / uRes;
  float around = 0.0;
  for (int k = 0; k < 8; k++) { float a = float(k) * 0.785; around += luma(col(uv + vec2(cos(a), sin(a)) * px * (k < 4 ? 7.0 : 16.0))); }
  around /= 8.0;
  float tone = clamp(pow(clamp(1.0 - L, 0.0, 1.0), 1.0) * 1.3 + max(around - L, 0.0) * 5.0, 0.0, 1.0);
  // A few washes, their borders wandering.
  float wash = floor(tone * 4.0 + (fbm(p * 5.0) - 0.5) * 0.9) / 4.0;
  tone = mix(tone, wash, 0.55);
  // Dry brush: the outline broken where the brush ran dry (streaky noise).
  float e = edges(uv, 1.2) * smoothstep(0.25, 0.65, fbm(p * vec2(140.0, 26.0)) + 0.15);
  tone = max(tone * 0.85, e * 0.95);
  // Mi dots (米点): flat dabs of wet ink laid side by side where there is already some ink.
  vec2 mc = gl_FragCoord.xy / vec2(9.0, 6.0);
  vec2 cell = floor(mc), f = fract(mc) - 0.5 + (vec2(hash(cell), hash(cell + 3.7)) - 0.5) * 0.4;
  float dab = smoothstep(0.42, 0.22, length(f * vec2(1.0, 1.6))) * step(hash(cell + 9.1), tone * 1.4 - 0.15);
  tone = max(tone, dab * (0.35 + 0.4 * tone) * step(0.2, tone));
  tone *= 1.0 - far * 0.92; // the distance left as paper
  vec3 paper = cInkPaper * (0.95 + 0.06 * fbm(p * 260.0)) - 0.03 * smoothstep(0.55, 0.9, fbm(p * 3.0));
  vec3 c = mix(paper, cInk, clamp(tone, 0.0, 1.0));
  // The faintest trace of colour (淡彩), as a light wash would leave.
  return mix(c, c * (0.75 + 0.5 * col(uv)), 0.14 * (1.0 - far));
}

vec3 blueGreen(vec2 uv) {
  vec2 p = uv * aspect();
  vec3 c = col(uv);
  float L = luma(c), mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-3);
  float far = smoothstep(260.0, 1600.0, metres(uv));
  // Which mineral: by hue. Cool (water, shade) azurite; green malachite; warm ochre.
  float cool = clamp((c.b - c.r) * 3.0 + 0.3, 0.0, 1.0), green = clamp((c.g - max(c.r, c.b)) * 6.0 + 0.2, 0.0, 1.0), warm = clamp((c.r - c.b) * 3.0, 0.0, 1.0);
  vec3 mineral = (cAzurite * cool + cMalachite * green + cOchre * warm) / max(cool + green + warm, 1e-3);
  // Laid in flat layers: the amount of pigment in three steps.
  float amount = clamp(sat * 3.4 + (1.0 - L) * 1.3, 0.0, 1.0);
  amount = mix(amount, floor(amount * 3.0 + 0.5) / 3.0, 0.6);
  // Dark places take the deep azurite underneath; the colour lies thick (darker than the light was).
  mineral = mix(mineral, cAzurite * 0.7, smoothstep(0.55, 0.15, L) * 0.6) * (0.78 + 0.25 * L);
  // The silk: weave, age, darker toward the edges of the scroll.
  float weave = 0.5 + 0.5 * sin(gl_FragCoord.x * 2.2) * sin(gl_FragCoord.y * 2.2);
  vec3 silk = mix(cSilk, cSilkDark, 0.35 * fbm(p * 4.0) + 0.06 * weave);
  silk = mix(silk, cSilkDark, smoothstep(0.35, 0.75, length(uv - 0.5)) * 0.5);
  vec3 outc = mix(silk, mineral, amount * (1.0 - far * 0.85));
  // Distant mountains go blue, as in the scroll.
  outc = mix(outc, mix(silk, cAzurite, 0.35), far * 0.4 * (1.0 - step(0.999, texture2D(tDepth, uv).x)));
  outc = mix(outc, cOutline, edges(uv, 1.0) * 0.55 * (1.0 - far));
  return outc * (0.96 + 0.05 * weave);
}

vec3 watercolour(vec2 uv) {
  vec2 p = uv * aspect();
  vec2 px = 1.0 / uRes;
  // The washes bleed: the reading point wanders a few pixels.
  vec2 bleed = (vec2(fbm(p * 9.0), fbm(p * 9.0 + 3.1)) - 0.5) * 7.0 * px;
  // Kuwahara: the mean of the calmest of the four squares round the pixel.
  vec3 best = vec3(0.0); float bestVar = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 dir = vec2(q == 0 || q == 2 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
    vec3 m = vec3(0.0), m2 = vec3(0.0);
    for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
      vec3 s = col(uv + bleed + dir * vec2(float(i), float(j)) * px * 1.6);
      m += s; m2 += s * s;
    }
    m /= 16.0; m2 /= 16.0;
    float v = dot(m2 - m * m, vec3(1.0));
    if (v < bestVar) { bestVar = v; best = m; }
  }
  vec3 c = best;
  // Pigment pools at the wash's edge.
  float e = edges(uv + bleed, 1.5);
  c *= 1.0 - 0.32 * smoothstep(0.08, 0.5, e);
  // Lifted toward the paper, a touch more saturated (transparent pigment over white).
  float L = luma(c);
  c = mix(vec3(L), c, 1.18);
  c = mix(c, cWcPaper, 0.16 + 0.25 * smoothstep(300.0, 1600.0, metres(uv)));
  // Granulation (pigment settling in the paper's hollows, more where the wash is dark) and the paper's grain.
  vec2 r = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float g = fbm(r * 170.0 + 3.0);
  c *= 1.0 - (g - 0.5) * 0.22 * (1.0 - luma(c));
  c *= 0.975 + 0.05 * fbm(r * 60.0);
  // Unpainted paper where the wash thins at the sheet's edge.
  float edge = smoothstep(0.42, 0.52, max(abs(uv.x - 0.5), abs(uv.y - 0.5)) + (fbm(p * 7.0) - 0.5) * 0.08);
  return mix(c, cWcPaper, edge);
}

// The stroke direction at a point: along the contours of the light on the land; a long swirl in the sky.
vec2 strokeDir(vec2 uv, float sky) {
  vec2 px = 1.0 / uRes;
  vec2 g = vec2(luma(col(uv + vec2(5.0, 0.0) * px)) - luma(col(uv - vec2(5.0, 0.0) * px)),
                luma(col(uv + vec2(0.0, 5.0) * px)) - luma(col(uv - vec2(0.0, 5.0) * px)));
  vec2 along = length(g) > 2e-3 ? normalize(vec2(-g.y, g.x)) : vec2(1.0, 0.12);
  // The sky's swirl: the curl of a slow, smooth noise (it flows round, never converging).
  vec2 q = uv * aspect() * 1.3, e = vec2(0.02, 0.0);
  float n0 = noise(q) + 0.5 * noise(q * 2.1 + 4.0);
  float nx = noise(q + e) + 0.5 * noise((q + e) * 2.1 + 4.0), nz = noise(q + e.yx) + 0.5 * noise((q + e.yx) * 2.1 + 4.0);
  vec2 curl = vec2(nz - n0, -(nx - n0));
  vec2 swirl = length(curl) > 1e-6 ? normalize(curl) : vec2(1.0, 0.0);
  return normalize(mix(along, swirl, clamp(sky * 0.85 + 0.1, 0.0, 1.0)));
}

// One layer of strokes: each cell of the grid lays one stroke from a jittered point, along the field,
// in the colour under its middle. A pixel shows the topmost stroke (by a seeded order) of the cells
// round it that covers it, so strokes run over cell borders and no grid shows. rgb, and whether any.
vec4 strokes(vec2 frag, float cell, float salt, float sky) {
  vec2 home = floor(frag / cell);
  vec4 best = vec4(0.0); float top = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = home + vec2(float(i), float(j));
    vec2 centre = (id + 0.5 + (vec2(hash(id + salt), hash(id + salt + 7.7)) - 0.5) * 0.8) * cell;
    vec2 dir = strokeDir(centre / uRes, sky), across = vec2(-dir.y, dir.x);
    float len = cell * (0.75 + 0.35 * hash(id + salt + 2.3)), wid = cell * 0.32;
    vec2 d = frag - centre;
    float u = dot(d, dir) / len, v = dot(d, across) / wid;
    // A stroke: a long rounded shape, a little curved.
    v -= u * u * (hash(id + salt + 5.1) - 0.5) * 0.8;
    float inside = step(abs(u), 1.0) * step(abs(v), 1.0 - 0.35 * u * u);
    float order = hash(id * 1.3 + salt + 11.0);
    if (inside > 0.5 && order > top) {
      top = order;
      vec3 c = (col(centre / uRes) * 2.0 + col((centre + dir * len * 0.5) / uRes) + col((centre - dir * len * 0.5) / uRes)) / 4.0;
      c *= 0.94 + 0.12 * hash(id + salt + 3.3);
      // Impasto: round across the stroke, the paint thicker where the brush landed, a few bristle grooves.
      float ridge = sqrt(max(1.0 - v * v, 0.0));
      float load = 0.92 + 0.08 * smoothstep(1.0, -0.6, u);
      float groove = 0.96 + 0.04 * sin(v * 9.0 + hash(id + salt) * 6.0);
      best = vec4(c * (0.86 + 0.16 * ridge) * load * groove, 1.0);
    }
  }
  return best;
}

vec3 oil(vec2 uv) {
  float sky = step(0.999, texture2D(tDepth, uv).x) + smoothstep(1500.0, 3000.0, metres(uv));
  float scale = uRes.y / 800.0;
  vec2 f = gl_FragCoord.xy;
  // An underpainting (the picture, darker), then two layers of strokes, small over large.
  vec3 c = col(uv) * 0.8;
  vec4 big = strokes(f, 30.0 * scale, 0.0, sky);
  c = mix(c, big.rgb, big.a);
  vec4 small = strokes(f, 19.0 * scale, 31.0, sky);
  c = mix(c, small.rgb, small.a * 0.85);
  // Van Gogh's colour: more of it; shadow toward ultramarine, light toward chrome yellow.
  float L = luma(c);
  c = mix(vec3(L), c, 1.9);
  c = (c - 0.5) * 1.1 + 0.5;
  c = mix(c, cUltra, smoothstep(0.62, 0.1, L) * 0.6);
  c = mix(c, cChrome, smoothstep(0.62, 0.95, L) * 0.28);
  // Dark contours, broken.
  c = mix(c, cUltra * 0.55, smoothstep(0.3, 0.65, edges(uv, 1.6)) * 0.6 * step(0.35, fbm(f / 6.0)));
  return c;
}

void main() {
  vec3 c;
  if (uMode == 1) c = ink(vUv);
  else if (uMode == 2) c = blueGreen(vUv);
  else if (uMode == 3) c = watercolour(vUv);
  else if (uMode == 4) c = oil(vUv);
  else c = col(vUv);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export function createPhotoMaterial(color: Texture, depth: Texture) {
  // The pass works in sRGB (the pigments as written), not the linear working space Color keeps.
  const c = (hex: string) => ({ value: new Color(hex).convertLinearToSRGB() });
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      tColor: { value: color }, tDepth: { value: depth }, uRes: { value: new Vector2(1, 1) },
      uNear: { value: 0.5 }, uFar: { value: 5000 }, uMode: { value: 0 },
      cInkPaper: c(PHOTO.inkPaper), cInk: c(PHOTO.ink), cSilk: c(PHOTO.silk), cSilkDark: c(PHOTO.silkDark),
      cAzurite: c(PHOTO.azurite), cMalachite: c(PHOTO.malachite), cOchre: c(PHOTO.ochre), cOutline: c(PHOTO.outline),
      cWcPaper: c(PHOTO.wcPaper), cUltra: c(PHOTO.ultramarine), cChrome: c(PHOTO.chrome),
    },
  });
}
