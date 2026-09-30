import { ShaderMaterial } from 'three';
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

  // The hanging root darkens with depth.
  albedo *= mix(1.0, 0.6, smoothstep(0.0, uDepth, -vWorldPos.y));

  // Warm key on sunlit faces, cool fill everywhere else. The fill is half-desaturated so it
  // cools the shadows without turning ochre rock and green meadow into the same grey-green.
  vec3 fill = mix(vec3(1.0), tint(uShadowCool), FILL_TINT);
  vec3 key = tint(uLightWarm);
  vec3 light = fill * AMBIENT * (0.85 + 0.25 * n.y) + key * KEY * sun;
  // Rim light belongs on the silhouette: cliffs, peak flanks, hanging rocks. From a low camera
  // flat ground is also seen edge-on, and there it would wash the meadow and rock toward white.
  float upright = 1.0 - smoothstep(0.5, 0.9, n.y);
  gl_FragColor = vec4(albedo * light + rimLight(n, v) * upright, 1.0);
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
    uniforms: { ...uniforms, uDepth: { value: 1 }, uGrassLine: { value: 0 }, uRimY: { value: 0 }, uSeamBand: { value: 1 } },
    vertexShader,
    fragmentShader,
  });
}
