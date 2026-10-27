import {
  Box3, Color, DataTexture, FloatType, Frustum, Group, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, Matrix4, Mesh, NearestFilter,
  PlaneGeometry, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector3, Vector4, type Camera, type Texture,
} from 'three';
import { PORCELAIN, WEAR_DEBUG, ZONE_DEBUG } from '../palette';
import { PORCELAIN_GLSL, porcelainUniforms } from '../shaders/porcelain';
import type { WorldUniforms } from '../shaders/uniforms';
import type { HeightGrid } from './heightGrid';
import { RIM_JOIN } from './rimJoin';

/**
 * A height map drawn by continuous distance-dependent level of detail (CDLOD; Strugar 2009).
 *
 * One square grid of GRID x GRID quads is drawn many times (instanced), once per patch of a
 * quadtree over the ground: near the camera, small patches (so their quads are small); further
 * off, patches twice, four, eight times the size with the same count of quads. Level l is used
 * within RANGE x 2^(finest - l) metres of the camera. That is the level of detail; what makes it
 * continuous is the morph: across the outer part of each level's range, every vertex that the next
 * coarser level does not have slides, by distance, onto the line between its neighbours that it
 * has, so where a patch meets the coarser one beyond, both are already the same shape. Nothing
 * pops when the camera moves: shapes change only by sliding, and only far from the eye.
 *
 * Each vertex reads its height from the grid in the vertex shader (four fetches, bilinear in full
 * precision); each pixel reads the gradient for its normal and the baked light (heightGrid.ts):
 * no marching, no search. Off the island (the outline's distance above zero) pixels are dropped;
 * the island's side is a mesh of its own.
 */
export interface LodSettings {
  /** Metres: the quadtree's root patch (it must cover the grid). */
  root: number;
  /** Levels below the root; the finest patch is root / 2^levels. */
  levels: number;
  /** Metres: the finest level is used within this distance; each coarser one within twice the last. */
  range: number;
  /** Quads per side of a patch (even). */
  grid: number;
}
export const LOD_DEFAULTS: LodSettings = { root: 640, levels: 4, range: 90, grid: 64 };
const MORPH_START = 0.66; // the morph starts this share of the way from a level's inner to its outer range
const MAX_PATCHES = 2048;

const vertexShader = /* glsl */ `
uniform sampler2D uHeight;
uniform float uSize;
uniform float uTexel;
attribute vec4 aPatch; // origin x, z, side (metres), quads per side
attribute vec2 aMorph; // distance where the morph starts, ends
varying vec3 vWorld;
varying float vOutline;

vec4 heightAt(vec2 p) {
  vec2 g = clamp(p / uTexel + 0.5 * (uSize - 1.0), 0.0, uSize - 1.0);
  vec2 i = min(floor(g), uSize - 2.0), f = g - i;
  ivec2 c = ivec2(i);
  vec4 a = texelFetch(uHeight, c, 0), b = texelFetch(uHeight, c + ivec2(1, 0), 0);
  vec4 d = texelFetch(uHeight, c + ivec2(0, 1), 0), e = texelFetch(uHeight, c + ivec2(1, 1), 0);
  return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
}

void main() {
  vec2 grid = position.xz; // 0 to 1 across the patch
  vec2 xz = aPatch.xy + grid * aPatch.z;
  float h = heightAt(xz).x;
  float k = clamp((distance(cameraPosition, vec3(xz.x, h, xz.y)) - aMorph.x) / (aMorph.y - aMorph.x), 0.0, 1.0);
  // The odd vertices slide onto their even neighbours' line (the coarser level's vertices).
  vec2 odd = fract(grid * aPatch.w * 0.5) * 2.0 / aPatch.w;
  xz -= odd * aPatch.z * k;
  vec4 f = heightAt(xz);
  vWorld = vec3(xz.x, f.x, xz.y);
  vOutline = f.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const fragmentShader = /* glsl */ `
${PORCELAIN_GLSL}
uniform sampler2D uHeight;
uniform sampler2D uLight;
uniform sampler2D uFolds; // R mountain, G fold 6/18 m, B fine, A cross-slope wide hollow
uniform float uFoldMix; // strength of the olive tint (0: off)
uniform float uFoldView; // 0 off, 1 mountain, 2 folds, 3 wide, 4 gate, 5 final weight
uniform vec3 uFoldStone; // grey-olive for folds and wide hollows
uniform float uOutlineKeep; // rim join: discard when outline > this (shared with rimWall)
uniform sampler2D uShrubGround; // shrubs.ts: how much each zone cell lies in a shrub patch (LinearFilter)
uniform float uShrubOn;
uniform vec3 uShrubSoil;
uniform vec3 uWater;
// The sheet draws the shore up close. This paint is only for far cameras, where coarse terrain
// can hide a narrow stream. Starting it at 60 m laid a second, blocky shore on top of the sheet.
const float WATER_NEAR = 200.0;
const float WATER_FAR = 340.0;
uniform float uSize;
uniform float uTexel;
uniform sampler2D uWear;
uniform vec4 uWearRect; // the contact map's square: x0, z0, size; on (1) or not
uniform float uWearShow;
uniform vec3 uJadeWalk, uJadeDrink, uJadeRest, uWearWalk, uWearDrink, uWearRest;
uniform sampler2D uZones;
uniform vec4 uZoneRect; // zone map square: x0, z0, size; bound (1) or not
uniform float uZoneShow; // 1 = debug swatches; 0 = live habitat surfaces
uniform vec3 uZoneColours[10];
uniform sampler2D uMoisture; // 0..1 wetness proxy (same square as zones)
uniform sampler2D uGrove; // woodland grove 0..1 (LinearFilter)
uniform sampler2D uBank; // the zones' water cells, blurred (LinearFilter): the strip up the banks
uniform float uBankOn;
uniform sampler2D uSurface; // RGBA soft weights: wet, litter, terrace, rock (LinearFilter)
uniform float uSurfaceOn; // 1 when uSurface is bound
uniform vec3 uWetStone, uLitter, uTerraceSeat, uCliffFace, uRockFace;
uniform sampler2D uCover;
uniform vec4 uCoverRect; // cover density map: x0, z0, size; on (1) or not
uniform vec3 uCoverTint;
uniform vec3 uCoverSoil;
uniform float uCoverDebug; // 1 = grass density heatmap from the same uCover soft-density data
uniform vec4 uShadow; // x, z, radius, strength (0: none)
uniform vec3 uShadowColour;
uniform vec3 uSkyTop, uSkyMid, uSkyHorizon;
varying vec3 vWorld;
varying float vOutline;
const float PATH_MOST = 0.8; // how far a path (walked in passing) may turn, at most
const float EDGE = 0.06; // the wear at which the stone has begun to turn (its edge)
const float EARLY = 0.3; // how far a place has turned just past its edge

vec4 heightAt(vec2 p) {
  vec2 g = clamp(p / uTexel + 0.5 * (uSize - 1.0), 0.0, uSize - 1.0);
  vec2 i = min(floor(g), uSize - 2.0), f = g - i;
  ivec2 c = ivec2(i);
  vec4 a = texelFetch(uHeight, c, 0), b = texelFetch(uHeight, c + ivec2(1, 0), 0);
  vec4 d = texelFetch(uHeight, c + ivec2(0, 1), 0), e = texelFetch(uHeight, c + ivec2(1, 1), 0);
  return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
}

// An integer hash and gradient noise (exact at each lattice point: no seams).
float hash(vec2 c) {
  uvec2 q = uvec2(ivec2(c)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}
vec2 gradAt(vec2 c) { float a = 6.2832 * hash(c); return vec2(cos(a), sin(a)); }
float gnoise(vec2 p) {
  vec2 c = floor(p), f = fract(p), w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradAt(c), f), b = dot(gradAt(c + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float d = dot(gradAt(c + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), e = dot(gradAt(c + vec2(1.0)), f - vec2(1.0));
  return mix(mix(a, b, w.x), mix(d, e, w.x), w.y);
}
vec2 grainSlope(vec2 p) {
  const float e = 0.08;
  float c = gnoise(p);
  return vec2(gnoise(p + vec2(e, 0.0)) - c, gnoise(p + vec2(0.0, e)) - c) / e;
}

void main() {
  // Slightly past geometric edge so top overlaps wall/flange (RIM_JOIN.outlineKeep).
  if (vOutline > uOutlineKeep) discard;
  vec4 f = heightAt(vWorld.xz);
  vec3 n = normalize(vec3(-f.y, 1.0, -f.z));
  vec2 uv = (vWorld.xz / uTexel + 0.5 * (uSize - 1.0) + 0.5) / uSize;
  vec4 light = texture(uLight, uv);
  vec3 v = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  // Worn by dwelling (dwelling.ts): walk, drink, rest, 0 to 1 each, over the contact map's square.
  vec3 wear = vec3(0.0);
  vec2 wuv = (vWorld.xz - uWearRect.xy) / uWearRect.z;
  if (uWearRect.w > 0.5 && wuv.x > 0.0 && wuv.y > 0.0 && wuv.x < 1.0 && wuv.y < 1.0) wear = texture(uWear, wuv).rgb;
  // How far each place has turned (its maturity, 0 stone to 1 jade): from the wear, over a long
  // ramp (a first touch only smooths the stone a little and cools it a shade; a habit turns it),
  // its edge broken by a grain of its own. Where it rests and drinks, it can turn all the way; a
  // path, walked over in passing, only so far.
  // Two things from it: whether the stone has turned here at all (a crisp edge, where the wear
  // passes a low mark, the mark shifted by a fine grain: an irregular edge, sharp even close up,
  // where the map's own cells would only blur), and how far (a long, smooth ramp: early touches
  // faint, a habit whole).
  float grain = gnoise(vWorld.xz * 1.7) + 0.5 * gnoise(vWorld.xz * 4.1 + 7.0) + 0.35 * gnoise(vWorld.xz * 11.0 - 3.0);
  // (The grain scales the wear, never adds to it: untouched stone stays untouched.)
  vec3 turned = smoothstep(vec3(EDGE - 0.02), vec3(EDGE + 0.02), wear * (1.0 + grain * vec3(1.2, 1.0, 1.0)));
  vec3 ripe = max(smoothstep(vec3(EDGE), vec3(0.75, 0.65, 0.75), wear), vec3(EARLY));
  float walked = turned.r * ripe.r * PATH_MOST;
  float drunk = turned.g * ripe.g;
  float rested = turned.b * ripe.b;
  float jade = 1.0 - (1.0 - walked) * (1.0 - drunk) * (1.0 - rested);
  // Its surface polished: the stone's grain gone where it has turned at all, even early (a crisp
  // change of surface at the edge, rough to smooth, while its colour comes on slowly).
  float smooth_ = max(max(turned.r * PATH_MOST, turned.g), turned.b) * mix(0.6, 1.0, jade);
  // The stone: matte, a fine grain in its surface and a fleck in its colour (near only: finer
  // than a pixel beyond), both worn away as it turns; and a broad weathering, a few metres across,
  // that keeps open ground from one flat value (lighter and darker by a few per cent, the lighter
  // a shade warmer).
  float near = 1.0 - smoothstep(15.0, 60.0, dist);
  vec3 ns = n;
  float fleck = 0.0;
  if (near > 0.0) {
    vec2 g = grainSlope(vWorld.xz * 3.0) * 0.07 + grainSlope(vWorld.xz * 9.0) * 0.03;
    ns = normalize(n + vec3(-g.x, 0.0, -g.y) * near * (1.0 - smooth_));
    fleck = gnoise(vWorld.xz * 14.0) * 0.07 * near * (1.0 - smooth_);
  }
  // Large-scale, low-contrast weathering on open stone.
  // Near: fine weathering; far: coarse (morph shift up to ~1.25 m at mid LOD).
  // Wider handoff (40–110 m) so colour bands do not read as a horizontal “crack” at eye height.
  float weatherN = gnoise(vWorld.xz * 0.22 + 3.0) + 0.55 * gnoise(vWorld.xz * 0.7 - 5.0) + 0.25 * gnoise(vWorld.xz * 1.6 + 1.0);
  float weatherF = gnoise(vWorld.xz * 0.02 + 3.0) + 0.55 * gnoise(vWorld.xz * 0.06 - 5.0) + 0.25 * gnoise(vWorld.xz * 0.14 + 1.0);
  float weather = mix(weatherN, weatherF, smoothstep(40.0, 110.0, dist));
  vec3 color = porcelain(ns, v, light.r, light.g) * (1.0 + fleck);
  color *= (1.0 + 0.06 * weather * (1.0 - jade)) * mix(vec3(1.0), uWarmShadow / dot(uWarmShadow, vec3(0.299, 0.587, 0.114)), 0.14 * max(weather, 0.0) * (1.0 - jade));
  // Tint uses only the continuous 6 m / 18 m fold. Cross-slope hollow (A) and the gate are
  // still stored for the debug views; they do not enter tintW.
  // tintW = mountain * fold * strength, the same value the final-weight debug draws (0–1, not stretched).
  float dbgMountain = 0.0, dbgFold = 0.0, dbgWide = 0.0, dbgGate = 0.0;
  if (uFoldMix > 0.0 || uFoldView > 0.5) {
    vec4 fd = texture(uFolds, uv);
    dbgMountain = fd.r;
    dbgFold = fd.g;
    dbgWide = fd.a;
    dbgGate = smoothstep(0.2, 0.8, 0.5 + 0.5 * gnoise(vWorld.xz * 0.004 + 41.0));
  }
  float tintW = dbgMountain * dbgFold * uFoldMix;
  // Live habitat surfaces. Zone *labels* stay discrete (Nearest, debug / hard exclude). Visible
  // mixes use soft RGBA weights (LinearFilter, ~10 m edges + low-freq warp) — never lerp zone IDs.
  int zk = 0;
  float moist = 0.0;
  vec2 zuv = vec2(0.0);
  if (uZoneRect.w > 0.5) {
    zuv = (vWorld.xz - uZoneRect.xy) / uZoneRect.z;
    zk = int(texture(uZones, zuv).r * 255.0 + 0.5);
    moist = texture(uMoisture, zuv).r;
  }
  // The bank strip: the zones' water reaches a few metres up from the stream (wherever its level
  // stands above the ground); there the stone stays bare and light, and just outside it a faint
  // damp rim, then the shore's tints. From the water cells blurred, read a little off by a broad
  // noise, so the strip's edge is soft and wanders (not the cells' staircase).
  float bare = 0.0, rim = 0.0;
  // How much of the wet shore this is (soft): the green tint under grass belongs only there.
  float shoreW = 0.0;
  if (uZoneRect.w > 0.5 && uBankOn > 0.5) {
    vec2 wob = 2.5 * vec2(gnoise(vWorld.xz * 0.06 + 11.0), gnoise(vWorld.xz * 0.06 - 8.0));
    float bank = texture(uBank, (vWorld.xz + wob - uZoneRect.xy) / uZoneRect.z).r;
    bare = smoothstep(0.36, 0.62, bank);
    rim = smoothstep(0.1, 0.34, bank) * (1.0 - bare);
  }
  // (Not cut off on water cells: the zones' water reaches a few metres up the banks, wherever the
  // level stands above the ground at all, and a hard cut drew its 2 m cells as a staircase. The
  // stream itself is drawn over this by its water sheet.)
  if (uZoneRect.w > 0.5 && uZoneShow < 0.5 && uCoverDebug < 0.5 && zk != 0) {
    float band = 0.5 + 0.5 * gnoise(vWorld.xz * 0.55 + 2.0);
    float damp = smoothstep(0.22, 0.82, moist);
    float grove = texture(uGrove, zuv).r;
    float wetW = 0.0, litW = 0.0, terW = 0.0, rockW = 0.0;
    if (uSurfaceOn > 0.5) {
      vec4 sw = texture(uSurface, zuv);
      // Soft zone weights + continuous moisture/grove (breaks stair-shaped zone blobs).
      float landOk = (zk == 3 || zk == 4) ? 0.0 : 1.0; // cliff/ridge hard; rockSlope may damp
      // Wet stone only on the wet shore (its soft weight), not wherever moisture runs high: the
      // moisture field is high within ~70 m of any stream, which tinted 40% of the land.
      wetW = sw.r * landOk;
      shoreW = sw.r;
      if (zk == 2) wetW *= 0.4; // terrace seat: rim damp, not full wet-shore
      if (zk == 5) wetW *= 0.55; // rockSlope: damp only in soft weight
      litW = max(sw.g, smoothstep(0.03, 0.38, grove));
      // Woodland heart: stronger litter; edge keeps more stone.
      litW *= mix(1.15, 0.75, smoothstep(0.08, 0.35, grove) * (1.0 - smoothstep(0.35, 0.75, grove)));
      terW = sw.b;
      rockW = sw.a;
    } else {
      wetW = (zk == 6) ? 1.0 : 0.0;
      shoreW = wetW;
      litW = max(grove, (zk == 7) ? 0.6 : 0.0);
      terW = (zk == 2) ? 1.0 : 0.0;
      rockW = (zk == 3 || zk == 4 || zk == 5) ? 1.0 : 0.0;
    }
    wetW *= 1.0 - bare;
    litW *= 1.0 - bare;
    float break_ = 0.8 + 0.2 * gnoise(vWorld.xz * 0.06);
    wetW = clamp(wetW * break_, 0.0, 1.0);
    litW = clamp(litW * break_, 0.0, 1.0);
    float jn = 1.0 - jade;
    // Wet structure: bare damp stone vs local soil — break_ + mid-freq noise (not equal-width wash).
    float wetVar = 0.55 + 0.45 * gnoise(vWorld.xz * 0.14 + 5.0);
    float wetBare = wetW * damp * wetVar;
    float wetSoil = wetW * damp * (1.0 - wetVar) * 0.65;
    color = mix(color, uWetStone, (0.28 + 0.34 * damp) * wetBare * jn);
    color *= 1.0 - 0.08 * wetBare * jn;
    color = mix(color, uCoverSoil, 0.22 * wetSoil * jn);
    // Needle litter under canopy — low contrast grey-brown.
    color = mix(color, uLitter, (0.3 + 0.12 * grove) * litW * jn);
    color = mix(color, uTerraceSeat, 0.28 * terW * jn);
    color *= 1.0 + 0.04 * band * terW * jn;
    color = mix(color, uWetStone, 0.1 * damp * terW * jn);
    float cliffBias = (zk == 3) ? 1.0 : 0.7;
    color = mix(color, mix(uRockFace, uCliffFace, cliffBias), 0.3 * rockW * jn);
    // The damp rim just outside the bank strip.
    color = mix(color, uWetStone, 0.3 * rim * jn);
    color *= 1.0 - 0.07 * rim * jn;
    // The strip itself a shade lighter than open stone: dry, washed.
    color *= 1.0 + 0.035 * bare * jn;
  }
  // Cover soil/moss only where density is real — never paint bare open as meadow.
  if (uCoverRect.w > 0.5) {
    // Read a few metres off, by a broad noise: the tint's edges wander instead of following the
    // 2 m cell grid it was baked on.
    vec2 bend = 3.0 * vec2(gnoise(vWorld.xz * 0.045 + 7.0), gnoise(vWorld.xz * 0.045 - 3.0));
    vec2 cuv = (vWorld.xz + bend - uCoverRect.xy) / uCoverRect.z;
    float cover = texture(uCover, cuv).r;
    float trample = wear.r; // walk channel alone
    // Only on the wet shore (the owner: elsewhere the stone stays white under its few blades).
    float grass = cover * (1.0 - smoothstep(0.08, 0.55, trample)) * (1.0 - bare) * shoreW;
    if (uCoverDebug > 0.5) {
      vec3 heat = mix(vec3(0.12, 0.1, 0.1), vec3(0.25, 0.75, 0.35), cover);
      heat = mix(heat, vec3(0.55, 0.35, 0.2), trample * 0.7);
      color = mix(color, heat, 0.82);
    } else {
      // Far/mid cover is ALBEDO ONLY. dist is per-fragment (camera to this ground point),
      // not one shared focus distance: near patches fade handoff first, far ones later.
      // Split: soil/moss = real ground (keep when close); canopy-proxy tint eases ~30% when near.
      float warp = 0.04 * gnoise(vWorld.xz * 0.09 + 1.7) + 0.02 * gnoise(vWorld.xz * 0.22);
      float g = smoothstep(0.07, 0.5, grass + warp);
      float edgeN = 0.55 + 0.45 * gnoise(vWorld.xz * 0.07 - 2.0);
      float soilMix = g * edgeN * (0.48 + 0.2 * gnoise(vWorld.xz * 1.4));
      float dampSoil = smoothstep(0.2, 0.75, moist);
      float wetBoost = mix(1.0, 1.12, dampSoil);
      // Ground body: no blade handoff - soil stays under near blades.
      vec3 soiled = mix(color, uCoverSoil, 0.42 * soilMix * wetBoost * (1.0 - jade * 0.45));
      float mid = smoothstep(12.0, 28.0, dist) * (1.0 - smoothstep(70.0, 120.0, dist));
      float farOnly = smoothstep(55.0, 110.0, dist);
      // Soft per-point handoff for canopy-proxy only (trial ~30% max reduction).
      float nearPt = 1.0 - smoothstep(22.0, 55.0, dist);
      float canopyKeep = 1.0 - 0.30 * nearPt;
      float groundKeep = 1.0 - 0.08 * nearPt;
      // Mid carpet a step stronger so open/wood patches read volume before near blades load.
      float carpet = g * (0.36 * mid + 0.2 * farOnly + 0.24) * groundKeep;
      float fleck = g * (0.18 + 0.22 * gnoise(vWorld.xz * 2.1)) * mid * canopyKeep;
      float canopy = g * (0.24 + 0.16 * mid) * canopyKeep;
      color = mix(soiled, mix(soiled, uCoverTint, 0.55), (carpet + fleck + canopy * 0.35) * (1.0 - jade * 0.35));
    }
  }
  // The ground under a shrub patch (shrubs.ts): a restrained moss-and-soil tint over the patch as a
  // whole (its edge frayed and blurred at generation, read a little off by a broad noise), under the
  // jade, world fixed.
  if (uShrubOn > 0.5 && uZoneRect.w > 0.5) {
    vec2 sb = 1.5 * vec2(gnoise(vWorld.xz * 0.08 + 13.0), gnoise(vWorld.xz * 0.08 - 6.0));
    float sw = texture(uShrubGround, (vWorld.xz + sb - uZoneRect.xy) / uZoneRect.z).r;
    // (As an albedo: the light on it stays as it was.)
    color = mix(color, color * uShrubSoil / uBody, 0.6 * smoothstep(0.05, 0.85, sw) * (1.0 - jade));
  }
  if (jade > 0.001) {
    // Jade, as solid stone grown fine: what makes it read is that it is smooth and holds light
    // softly, and takes a little of the sky; its colour helps, restrained.
    // - Its light softened: the stone's light and shade, their contrast lowered by a third (light
    //   seems to pass a little way in and spread).
    // - Its colour: each kind's jade (resting a bluish white 青白, drinking a grey-green 灰青, a
    //   path between), at its own lightness; faint whiter clouds within it (棉絮), low in contrast.
    // - The sky in it: polished, it reflects a little (Fresnel, from a few per cent seen from above
    //   to more toward grazing) and takes a faint cool light from the sky at any angle, which the
    //   matte stone does not: so it reads at any angle, not only where the sun's highlight falls.
    // - A broad soft highlight. Not wet (no sharp reflection), not glazed, not glowing.
    const vec3 LUMA = vec3(0.299, 0.587, 0.114);
    float lit = dot(color, LUMA) / max(dot(uBody, LUMA), 1e-3);
    float soft = mix(lit, 0.92, 0.25 * jade);
    vec3 tint = (uJadeWalk * walked + uJadeDrink * drunk + uJadeRest * rested) / max(walked + drunk + rested, 1e-3);
    // A little below the stone's lightness, as polished stone is (less light scattered back from its
    // surface, more of its own colour): deeper by a step, not a damp stain.
    tint = mix(vec3(dot(tint, LUMA)), tint, 1.15);
    tint *= 0.88 * dot(uBody, LUMA) / max(dot(tint, LUMA), 1e-3);
    float cloud = smoothstep(-0.2, 0.6, gnoise(vWorld.xz * 3.1 + 11.0) + 0.6 * gnoise(vWorld.xz * 7.3 - 4.0));
    // A fine felted texture within (its fibres), fainter still, near only.
    float felt = gnoise(vWorld.xz * vec2(23.0, 31.0) + 5.0) * near;
    // (The clouds whiter and a little lighter than the jade between them, which is a shade deeper.)
    vec3 body = mix(tint * 0.97, mix(tint, uBody, 0.75) * 1.04, cloud * 0.6) * soft * (1.0 + 0.025 * felt);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.25, max(r.y, 0.0))), uSkyTop, smoothstep(0.25, 1.0, max(r.y, 0.0)));
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    // (The sky's colour taken soft and greyed: a pure sky blue, strongly, turned the path a cyan band.)
    sky = mix(vec3(dot(sky, LUMA)), sky, 0.45);
    body = mix(body, sky, fresnel * 0.3) + sky * 0.025 * light.r;
    vec3 h = normalize(normalize(uSunDir) + v);
    float sheen = pow(max(dot(n, h), 0.0), 16.0) * 0.14 * light.g;
    color = mix(color, body + uSheen * sheen, jade);
  }
  // A creature's soft shadow under it.
  if (uShadow.w > 0.0) {
    float d = length(vWorld.xz - uShadow.xy) / uShadow.z;
    color = mix(color, uShadowColour, uShadow.w * (1.0 - smoothstep(0.3, 1.0, d)));
  }
  if (uWearShow > 0.5) {
    // Debug: each channel in its colour, its strength as opacity, a contour every tenth.
    vec3 mark = (uWearWalk * wear.r + uWearDrink * wear.g + uWearRest * wear.b) / max(wear.r + wear.g + wear.b, 1e-3);
    float strength = clamp(max(max(wear.r, wear.g), wear.b) * 1.6, 0.0, 0.85);
    float contour = 1.0 - smoothstep(0.0, 0.08, abs(fract(max(max(wear.r, wear.g), wear.b) * 10.0) - 0.5) * 2.0 - 0.9);
    color = mix(color, mark, strength);
    color = mix(color, mark * 0.5, contour * step(0.02, strength) * 0.4);
  }
  if (uZoneRect.w > 0.5 && uZoneShow > 0.5) {
    // Debug swatches only (View → Zones). Live browse uses the habitat mixes above.
    float shade = dot(color, vec3(0.299, 0.587, 0.114)) / max(dot(uBody, vec3(0.299, 0.587, 0.114)), 1e-3);
    if (zk > 0) color = mix(color, uZoneColours[clamp(zk, 0, 9)] * mix(0.75, 1.05, shade), 0.7);
  }
  // Far off, the water is painted on the ground from the baked map (light.b). Soft-step the
  // channel weight so mid-distance shore colour follows the blurred mask, not a binary edge.
  float far = smoothstep(WATER_NEAR, WATER_FAR, length(cameraPosition - vWorld));
  float wetPaint = smoothstep(0.08, 0.55, light.b);
  color = mix(color, uWater * mix(0.8, 1.0, light.g), wetPaint * far);
  // Albedo multiply: the porcelain light stays, the stone only shifts toward a light grey-olive.
  // No smoothstep, no 0.7 floor, no extra darken. Wide hollow and gate are not in tintW.
  if (uFoldMix > 0.0 && uFoldView < 0.5) {
    vec3 k = uFoldStone / max(uBody, vec3(1e-3));
    color = mix(color, color * k, clamp(tintW, 0.0, 1.0));
  }
  if (uFoldView > 0.5) {
    // Fixed 0–1 grey of the selected field. Final is tintW itself, not a renormalised copy.
    float shown = dbgMountain;
    if (uFoldView > 4.5) shown = tintW;
    else if (uFoldView > 3.5) shown = dbgGate;
    else if (uFoldView > 2.5) shown = dbgWide;
    else if (uFoldView > 1.5) shown = dbgFold;
    color = vec3(clamp(shown, 0.0, 1.0));
  }
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** The material for a grid's patches; point it at a grid with setTerrainGrid. */
export function createTerrainMaterial(uniforms: WorldUniforms, wireframe = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...porcelainUniforms(uniforms),
      uSkyTop: uniforms.uSkyTop, uSkyMid: uniforms.uSkyMid, uSkyHorizon: uniforms.uSkyHorizon,
      uHeight: { value: null },
      uLight: { value: null },
      uWater: { value: new Color(PORCELAIN.water) },
      uSize: { value: 2 },
      uTexel: { value: 1 },
      uWear: { value: null as Texture | null },
      uWearRect: { value: new Vector4(0, 0, 1, 0) },
      uWearShow: { value: 0 },
      uJadeWalk: { value: new Color(PORCELAIN.jadeWalk) },
      uJadeDrink: { value: new Color(PORCELAIN.jadeDrink) },
      uJadeRest: { value: new Color(PORCELAIN.jadeRest) },
      uWearWalk: { value: new Color(WEAR_DEBUG.walk) },
      uWearDrink: { value: new Color(WEAR_DEBUG.drink) },
      uWearRest: { value: new Color(WEAR_DEBUG.rest) },
      uZones: { value: null as Texture | null },
      uZoneRect: { value: new Vector4(0, 0, 1, 0) },
      uZoneShow: { value: 0 },
      uZoneColours: { value: ZONE_DEBUG.map((c) => new Color(c)) },
      uMoisture: { value: null as Texture | null },
      uGrove: { value: null as Texture | null },
      uBank: { value: null as Texture | null },
      uBankOn: { value: 0 },
      uSurface: { value: null as Texture | null },
      uSurfaceOn: { value: 0 },
      uWetStone: { value: new Color(PORCELAIN.wetStone) },
      uFolds: { value: null as Texture | null },
      uFoldMix: { value: 0 },
      uFoldView: { value: 0 },
      uFoldStone: { value: new Color(PORCELAIN.foldStone) },
      uOutlineKeep: { value: RIM_JOIN.outlineKeep },
      uShrubGround: { value: null as Texture | null },
      uShrubOn: { value: 0 },
      uShrubSoil: { value: new Color(PORCELAIN.shrubGround) },
      uLitter: { value: new Color(PORCELAIN.litter) },
      uTerraceSeat: { value: new Color(PORCELAIN.terraceSeat) },
      uCliffFace: { value: new Color(PORCELAIN.cliffFace) },
      uRockFace: { value: new Color(PORCELAIN.rockFace) },
      uCover: { value: null as Texture | null },
      uCoverRect: { value: new Vector4(0, 0, 1, 0) },
      uCoverTint: { value: new Color(PORCELAIN.cover) },
      uCoverSoil: { value: new Color(PORCELAIN.coverSoil) },
      uCoverDebug: { value: 0 },
      uShadow: { value: new Vector4(0, 0, 1, 0) },
      uShadowColour: { value: new Color(PORCELAIN.contactShadow) },
    },
    vertexShader,
    fragmentShader,
    wireframe,
  });
}

/**
 * Where the ground is worn, and how (stone turned jade by dwelling): a texture whose red, green
 * and blue are how worn by walking, drinking, resting, over the square at (x0, z0) of `size`
 * metres; null for none. `show`: the debug view (each channel in its colour, with contours).
 */
export function setTerrainWear(material: ShaderMaterial, wear: { texture: Texture; x0: number; z0: number; size: number } | null, show = false) {
  const u = material.uniforms;
  u.uWear.value = wear?.texture ?? null;
  (u.uWearRect.value as Vector4).set(wear?.x0 ?? 0, wear?.z0 ?? 0, wear?.size ?? 1, wear ? 1 : 0);
  u.uWearShow.value = show ? 1 : 0;
}

/**
 * Zone + moisture maps for live habitat surfaces and optional debug swatches.
 * Always bind when available; `show` only toggles the flat colour legend overlay.
 */
export function setTerrainZones(
  material: ShaderMaterial,
  zones: { texture: Texture; moisture?: Texture | null; grove?: Texture | null; bank?: Texture | null; surface?: Texture | null; x0: number; z0: number; size: number } | null,
  show = false,
) {
  const u = material.uniforms;
  u.uZones.value = zones?.texture ?? null;
  u.uMoisture.value = zones?.moisture ?? null;
  u.uGrove.value = zones?.grove ?? null;
  u.uBank.value = zones?.bank ?? null;
  u.uBankOn.value = zones?.bank ? 1 : 0;
  u.uSurface.value = zones?.surface ?? null;
  u.uSurfaceOn.value = zones?.surface ? 1 : 0;
  (u.uZoneRect.value as Vector4).set(zones?.x0 ?? 0, zones?.z0 ?? 0, zones?.size ?? 1, zones ? 1 : 0);
  u.uZoneShow.value = show ? 1 : 0;
}

/** Sparse cover density (0..1 in R) over the same square language as zones; null to hide. */
/** The mountains' folds. `view`: 0 off, 1 mountain, 2 folds 6/18, 3 wide hollow, 4 gate, 5 final weight. */
export function setTerrainFolds(material: ShaderMaterial, folds: Texture | null, strength: number, view = 0) {
  const u = material.uniforms;
  u.uFolds.value = folds;
  u.uFoldMix.value = folds ? strength : 0;
  u.uFoldView.value = folds ? view : 0;
}

/** The ground under shrub patches (shrubs.ts; bytes on the zone grid, bound with the zones' square); null for none. */
export function setTerrainShrubGround(material: ShaderMaterial, ground: Texture | null) {
  material.uniforms.uShrubGround.value = ground;
  material.uniforms.uShrubOn.value = ground ? 1 : 0;
}

export function setTerrainCover(material: ShaderMaterial, cover: { texture: Texture; x0: number; z0: number; size: number } | null, debug = false) {
  const u = material.uniforms;
  u.uCover.value = cover?.texture ?? null;
  (u.uCoverRect.value as Vector4).set(cover?.x0 ?? 0, cover?.z0 ?? 0, cover?.size ?? 1, cover ? 1 : 0);
  u.uCoverDebug.value = debug ? 1 : 0;
}

/** A soft shadow on the ground under a creature at (x, z), `radius` metres; strength 0 for none. */
export function setTerrainShadow(material: ShaderMaterial, x: number, z: number, radius: number, strength: number) {
  (material.uniforms.uShadow.value as Vector4).set(x, z, radius, strength);
}

/** The grid's heights as a float texture (read exactly, by texelFetch). */
export function heightTexture(g: HeightGrid) {
  const t = new DataTexture(g.data, g.size, g.size, RGBAFormat, FloatType);
  t.magFilter = t.minFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** The baked light as a texture (bytes, filtered). */
export function lightTexture(light: Uint8Array, size: number) {
  const t = new DataTexture(light, size, size, RGBAFormat, UnsignedByteType);
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** One grid of `quads` per side, 0 to 1 in x and z, facing up, drawn once per patch. */
class PatchSet {
  readonly geometry = new InstancedBufferGeometry();
  readonly patch = new InstancedBufferAttribute(new Float32Array(MAX_PATCHES * 4), 4);
  readonly morph = new InstancedBufferAttribute(new Float32Array(MAX_PATCHES * 2), 2);
  readonly mesh: Mesh;
  count = 0;
  constructor(quads: number, material: ShaderMaterial) {
    const plane = new PlaneGeometry(1, 1, quads, quads);
    plane.rotateX(-Math.PI / 2);
    plane.translate(0.5, 0, 0.5);
    this.geometry.index = plane.index;
    this.geometry.setAttribute('position', plane.getAttribute('position'));
    this.geometry.setAttribute('aPatch', this.patch);
    this.geometry.setAttribute('aMorph', this.morph);
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false; // culled patch by patch instead
  }
  add(x: number, z: number, side: number, quads: number, start: number, end: number) {
    if (this.count >= MAX_PATCHES) return;
    this.patch.setXYZW(this.count, x, z, side, quads);
    this.morph.setXY(this.count, start, end);
    this.count++;
  }
  finish() {
    this.geometry.instanceCount = this.count;
    this.patch.needsUpdate = true;
    this.morph.needsUpdate = true;
  }
}

/**
 * The quadtree, its patches chosen for a camera each frame (a few hundred boxes tested: well under
 * a millisecond), drawn as two instanced meshes: whole patches, and quarter patches (where a patch
 * is drawn partly by its finer children) at half the quads, so a quarter's vertices fall where its
 * level's do.
 */
export class TerrainLod {
  readonly group = new Group();
  private whole: PatchSet;
  private quarter: PatchSet;
  private ranges: number[];
  /** Per level, per patch: lowest and highest ground (for the boxes the camera is tested against). */
  private bounds: Float32Array[] = [];
  private frustum = new Frustum();
  private box = new Box3();
  /** Per level, 1 if that patch overlaps the stream/pool mask (same grid as heights). */
  private wet: Uint8Array[] = [];

  constructor(material: ShaderMaterial, readonly grid: HeightGrid, readonly settings: LodSettings = LOD_DEFAULTS, waterMask?: Uint8Array) {
    this.whole = new PatchSet(settings.grid, material);
    this.quarter = new PatchSet(settings.grid / 2, material);
    this.group.add(this.whole.mesh, this.quarter.mesh);
    // Level l (0 the root) is used within ranges[l].
    this.ranges = Array.from({ length: settings.levels + 1 }, (_, l) => settings.range * 2 ** (settings.levels - l));
    this.measure(waterMask);
  }

  /** Each patch's lowest and highest ground, per level (finest first measured from the grid). */
  private measure(waterMask?: Uint8Array) {
    const { root, levels } = this.settings;
    const { size, texel, data } = this.grid;
    const half = root / 2;
    for (let l = 0; l <= levels; l++) {
      const n = 2 ** l, side = root / n;
      const b = new Float32Array(n * n * 2);
      const wet = new Uint8Array(n * n);
      for (let p = 0; p < n * n; p++) { b[p * 2] = Infinity; b[p * 2 + 1] = -Infinity; }
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          const t = (j * size + i) * 4;
          const x = (i - (size - 1) / 2) * texel, z = (j - (size - 1) / 2) * texel;
          const px = Math.min(Math.max(Math.floor((x + half) / side), 0), n - 1), pz = Math.min(Math.max(Math.floor((z + half) / side), 0), n - 1);
          const p = (pz * n + px) * 2;
          b[p] = Math.min(b[p], data[t]);
          b[p + 1] = Math.max(b[p + 1], data[t]);
          if (waterMask && waterMask[j * size + i] > 12) wet[pz * n + px] = 1;
        }
      }
      this.bounds.push(b);
      this.wet.push(wet);
    }
  }

  /** Choose the patches for this camera; returns how many are drawn. */
  update(camera: Camera) {
    this.frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    this.whole.count = this.quarter.count = 0;
    this.select(0, 0, 0, camera.position);
    this.whole.finish();
    this.quarter.finish();
    return this.whole.count + this.quarter.count;
  }

  /** Triangles drawn, as last chosen. */
  get triangles() {
    const q = this.settings.grid;
    return 2 * (this.whole.count * q * q + (this.quarter.count * q * q) / 4);
  }

  private boxOf(l: number, px: number, pz: number) {
    const n = 2 ** l, side = this.settings.root / n, half = this.settings.root / 2;
    const b = this.bounds[l], p = (pz * n + px) * 2;
    this.box.min.set(px * side - half, b[p] - 1, pz * side - half);
    this.box.max.set((px + 1) * side - half, b[p + 1] + 1, (pz + 1) * side - half);
    return this.box;
  }

  /** CDLOD's selection: true if this patch's area is drawn (by it, or its children). */
  private select(l: number, px: number, pz: number, eye: Vector3): boolean {
    const box = this.boxOf(l, px, pz);
    if (!Number.isFinite(box.min.y)) return true; // no ground here
    if (box.distanceToPoint(eye) > this.ranges[l]) return false;
    if (!this.frustum.intersectsBox(box)) return true;
    const finest = l === this.settings.levels;
    const side = this.settings.root / 2 ** l;
    const relief = box.max.y - box.min.y;
    const n = 2 ** l;
    const wet = this.wet[l]?.[pz * n + px] === 1;
    // Stream banks / carved channels: high relief in a coarse patch reads as big white triangles.
    // A narrow stream in a wide patch has little relief, so also keep any wet patch at the finest
    // quad out to ~2.6× the near range (about 230 m at the default 90 m). Beyond that, far paint.
    const steepBank = !finest && relief > side * 0.26 && box.distanceToPoint(eye) < this.ranges[Math.min(l + 1, this.settings.levels)] * 1.45;
    const shoreDetail = wet && !finest && box.distanceToPoint(eye) < this.ranges[this.settings.levels] * 2.6;
    if (finest || (!steepBank && !shoreDetail && box.distanceToPoint(eye) > this.ranges[l + 1])) {
      this.add(l, px, pz, 1);
      return true;
    }
    for (let c = 0; c < 4; c++) {
      const cx = px * 2 + (c & 1), cz = pz * 2 + (c >> 1);
      // A child out of the finer range is drawn at this level, as a quarter (half the quads).
      if (!this.select(l + 1, cx, cz, eye)) this.add(l, cx, cz, 0.5);
    }
    return true;
  }

  /** Draw a patch of level l (or a quarter of one: then px, pz count quarters, at half the quads). */
  private add(l: number, px: number, pz: number, share: 1 | 0.5) {
    const { root, grid } = this.settings;
    const side = (root / 2 ** l) * share;
    const outer = this.ranges[l], inner = l === this.settings.levels ? 0 : this.ranges[l + 1];
    (share === 1 ? this.whole : this.quarter).add(px * side - root / 2, pz * side - root / 2, side, grid * share, inner + (outer - inner) * MORPH_START, outer * 0.98);
  }

  dispose() {
    this.whole.geometry.dispose();
    this.quarter.geometry.dispose();
  }
}
