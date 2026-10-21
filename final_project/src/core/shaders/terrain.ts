import { Color, ShaderMaterial, type Texture } from 'three';
import { GROUND, SCALE_VIEW, SEASON } from '../palette';
import { ATMOSPHERE_GLSL } from './atmosphere';
import { SURFACE_RULES } from '../params/island';
import type { WorldUniforms } from './uniforms';

const vertexShader = /* glsl */ `
attribute float aRim;
attribute vec2 aPeak;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vRim;
varying vec2 vPeak;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vRim = aRim;
  vPeak = aPeak;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform float uDepth;
uniform float uGrassLine;
uniform float uRimY;
uniform float uSeamBand;
uniform float uSnow;
uniform vec3 uSnowColor;
// Scale view: a survey drawn on the ground. uSurvey 0 off, 1 on; grid steps and the contour
// interval in metres; ink colors from the palette (SCALE_VIEW).
uniform float uSurvey;
uniform float uGridMinor;
uniform float uGridMajor;
uniform float uContour;
uniform vec3 uGridColor;
uniform vec3 uContourColor;
// Land cover (generators/cover.ts): R running water, G forest, B wetness, over a square of
// half-width uCoverHalf; uForestFloor is the ground colour under the stands.
uniform sampler2D uCover;
uniform float uCoverHalf;
uniform vec3 uForestFloor;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vRim;
varying vec2 vPeak; // rise on its own peak (0 foot, 1 summit), that peak's prominence (1 = main)
${ATMOSPHERE_GLSL}

const float LINE_BLEND = ${SURFACE_RULES.lineBlend.toFixed(3)}; // world units over which meadow fades out at the meadow line
const float FACE_SLOPE = ${SURFACE_RULES.faceSlope.toFixed(3)};
const float GRASS_SLOPE = ${SURFACE_RULES.grassSlope.toFixed(3)};
const float SLOPE_BLEND = 0.06;
const float MINERAL_MIX = 0.35; // mineral pigment along the plateau rim
const float SHADOW_MINERAL = 0.12; // and, fainter, in rock turned away from the sun
const float FILL_TINT = 0.25; // how much of the shadowCool hue the fill keeps; more turns warm stone grey
// Light levels, as multiples of the palette color: shadowed faces keep AMBIENT of it, a flat top
// in the sun comes out close to the palette color, and a face turned fully to the sun a little
// above it. Each light keeps only its palette tint, at unit brightness: the palette already
// makes dusk and night object colors darker, so dimming the light as well would darken twice.
const float AMBIENT = 0.65;
const float KEY = 0.55;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

/** A light's tint at unit brightness. */
vec3 tint(vec3 c) {
  return c / max(luma(c), 0.001);
}

/**
 * 0..1 coverage of lines every \`spacing\` along \`coord\`, \`px\` pixels wide at any distance (screen
 * derivatives). Lines that would crowd closer than a few pixels fade out instead of turning to mush.
 */
float surveyLine(float coord, float spacing, float px) {
  float c = coord / spacing;
  float w = fwidth(c);
  float d = abs(fract(c - 0.5) - 0.5) / max(w, 1e-5);
  return (1.0 - clamp(d / px, 0.0, 1.0)) * (1.0 - smoothstep(0.08, 0.25, w));
}

void main() {
  // Faceted normal for lighting keeps the low-poly read.
  vec3 n = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  vec3 v = normalize(cameraPosition - vWorldPos);

  // Class 05 slope mask from the smooth vertex normal: 0 = flat, 1 = vertical or overhanging.
  float slope = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
  // Meadow needs flat ground below the meadow line (a world height, see grassLineHeight).
  float level = 1.0 - smoothstep(GRASS_SLOPE * 0.5, GRASS_SLOPE * 1.5, slope);
  float below = 1.0 - smoothstep(uGrassLine - LINE_BLEND, uGrassLine + LINE_BLEND, vWorldPos.y);
  float bare = 1.0 - level * below;
  float face = smoothstep(FACE_SLOPE - SLOPE_BLEND, FACE_SLOPE + SLOPE_BLEND, slope);
  vec3 albedo = mix(mix(uMeadow, uRock, bare), uRockFace, face);

  // Peaks painted the blue-green way: ochre at the foot, malachite coming through on the flanks,
  // azurite on the summit, and a touch of jade white at the very tip ("its terraces are gold and
  // jade", Liezi). Each peak is painted by how far up its own slope a point is, so every peak gets
  // the full sequence; the azurite is richest on the main peak and paler on lower spires, and the
  // jade tip only crowns peaks close to the main one's height. Noise breaks the bands so they do
  // not read as contour rings. Bare rock only: meadow keeps its green.
  float jitter = windNoise(vWorldPos.xz * 0.35) - 0.5;
  float rise = vPeak.x + 0.12 * jitter;
  float prominence = vPeak.y;
  vec3 painted = mix(albedo, uMineral, smoothstep(0.3, 0.6, rise) * 0.5);
  painted = mix(painted, uPeakTop, smoothstep(0.5, 0.88, rise) * 0.75 * mix(0.35, 1.0, prominence));
  painted = mix(painted, uRimColor, smoothstep(0.9, 1.0, rise) * 0.35 * smoothstep(0.75, 0.95, prominence));
  albedo = mix(albedo, painted, bare);

  // The plateau edge and the cliff are separate meshes that meet at the rim, where the slope
  // class jumps from rock to rock face. Within a band around the rim height, both sides blend
  // toward one stone color, so the seam reads as a gradient instead of a line.
  float seam = smoothstep(0.3, 1.0, vRim) * (1.0 - smoothstep(0.0, uSeamBand, abs(vWorldPos.y - uRimY)));
  albedo = mix(albedo, mix(uRock, uRockFace, 0.5), seam);

  // Mineral pigment only along the plateau rim and in rock turned away from the sun.
  // Grazing light on flat ground is still light, so low dawn and dusk suns do not count as shadow.
  float facing = dot(n, uSunDir);
  float sun = max(facing, 0.0);
  float shadow = 1.0 - smoothstep(-0.2, 0.05, facing);
  albedo = mix(albedo, uMineral, max(vRim * MINERAL_MIX, shadow * bare * SHADOW_MINERAL));

  // Land cover on the top: forest floor under the stands, greener ground where it is wet. From
  // afar, where single trees blur together, the floor is what makes a stand read as forest.
  vec2 coverUv = vWorldPos.xz / (2.0 * max(uCoverHalf, 0.001)) + 0.5;
  vec4 cover = uCoverHalf > 0.0 ? texture2D(uCover, coverUv) : vec4(0.0);
  float onTop = step(uRimY - 0.5, vWorldPos.y) * (1.0 - face);
  // The floor takes over quickly: a half-dense stand already shades the ground (no olive half-mix).
  albedo = mix(albedo, uForestFloor, smoothstep(0.1, 0.45, cover.g) * onTop);
  albedo = mix(albedo, albedo * vec3(0.85, 1.0, 0.85), cover.b * 0.35 * onTop * (1.0 - bare));

  // The hanging root darkens with depth.
  albedo *= mix(1.0, 0.6, smoothstep(0.0, uDepth, -vWorldPos.y));

  // Snow in the cold terms: first on the summits, then further down each peak as uSnow grows;
  // it settles on faces turned up and slides off steep ones.
  float snowLine = 1.0 - 0.75 * uSnow;
  float snow = uSnow * smoothstep(snowLine - 0.05, snowLine + 0.1, rise) * (0.35 + 0.65 * smoothstep(0.15, 0.7, n.y));
  albedo = mix(albedo, uSnowColor, snow * (vWorldPos.y > uRimY ? 1.0 : 0.0));

  // Warm key on sunlit faces, cool fill everywhere else. The fill is half-desaturated so it
  // cools the shadows without turning ochre rock and green meadow into the same grey-green.
  vec3 fill = mix(vec3(1.0), tint(uShadowCool), FILL_TINT);
  vec3 key = tint(uLightWarm);
  vec3 light = fill * AMBIENT * (0.85 + 0.25 * n.y) + key * KEY * sun;
  // Rim light belongs on the silhouette: cliffs, peak flanks, hanging rocks. From a low camera
  // flat ground is also seen edge-on, and there it would wash the meadow and rock toward white.
  float upright = 1.0 - smoothstep(0.5, 0.9, n.y);
  vec3 color = albedo * light + rimLight(n, v) * upright;

  // Running water: the streams are painted into the ground, a mirror of the sky like the pools
  // (Fresnel), darker where seen from above, with a ripple drifting downstream.
  float stream = cover.r * step(uRimY - 0.5, vWorldPos.y);
  if (stream > 0.0) {
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0));
    vec3 sky = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.3, max(r.y, 0.0)));
    float fresnel = 0.45 + 0.55 * pow(1.0 - max(v.y, 0.0), 3.0);
    vec3 water = mix(uMineral * 0.45, sky, fresnel);
    water += uRimColor * 0.25 * smoothstep(0.6, 0.9, windNoise(vWorldPos.xz * 0.6 + uTime * 0.8));
    color = mix(color, water, stream);
  }

  // Scale view: a metre grid on the top (minor and major lines) and contour lines everywhere,
  // every fifth one heavier, so heights and distances can be read off the ground.
  if (uSurvey > 0.5) {
    float onTop = step(uRimY - 0.5, vWorldPos.y);
    float minor = max(surveyLine(vWorldPos.x, uGridMinor, 0.8), surveyLine(vWorldPos.z, uGridMinor, 0.8));
    float major = max(surveyLine(vWorldPos.x, uGridMajor, 1.6), surveyLine(vWorldPos.z, uGridMajor, 1.6));
    float grid = onTop * max(minor * 0.35, major * 0.7);
    float contour = max(surveyLine(vWorldPos.y, uContour, 0.9) * 0.45, surveyLine(vWorldPos.y, uContour * 5.0, 1.4) * 0.75);
    color = mix(color, uContourColor, contour);
    color = mix(color, uGridColor, grid);
  }
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * Terrain colored by height and slope together. Set `uDepth` (underside depth), `uGrassLine`
 * (world height of the meadow line, from meadowLineHeight), `uRimY` (the field's rimY) and
 * `uSeamBand` (SEAM_BAND times the radius) from the params.
 */
export function createTerrainMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...uniforms,
      uDepth: { value: 1 },
      uGrassLine: { value: 0 },
      uRimY: { value: 0 },
      uSeamBand: { value: 1 },
      uSnow: { value: 0 },
      uSnowColor: { value: new Color(SEASON.snow) },
      uSurvey: { value: 0 },
      uGridMinor: { value: 10 },
      uGridMajor: { value: 100 },
      uContour: { value: 1 },
      uGridColor: { value: new Color(SCALE_VIEW.grid) },
      uContourColor: { value: new Color(SCALE_VIEW.contour) },
      uCover: { value: null as Texture | null },
      uCoverHalf: { value: 0 },
      uForestFloor: { value: new Color(GROUND.forestFloor) },
    },
    vertexShader,
    fragmentShader,
  });
}
