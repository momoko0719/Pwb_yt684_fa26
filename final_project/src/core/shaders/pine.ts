import { Color, DoubleSide, ShaderMaterial } from 'three';
import { TREE } from '../palette';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const vertexShader = /* glsl */ `
attribute vec2 aTone; // x: 0 bark, 1 needles; y: 0..1 from the underside of a pad to its top
varying vec2 vTone;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix; // the forest: one tree shape drawn many times
  #endif
  vec4 world = m * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(m) * normal);
  vTone = aTone;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uBark;
uniform vec3 uNeedle;
uniform vec3 uNeedleShade;
uniform vec3 uSnowColor;
uniform float uSnow;
varying vec2 vTone;
varying vec3 vNormal;
varying vec3 vWorldPos;
${ATMOSPHERE_GLSL}

// Same light levels as the terrain and grass, so the pines sit in the same light.
const float AMBIENT = 0.65;
const float KEY = 0.55;
const float FILL_TINT = 0.25;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 tint(vec3 c) { return c / max(luma(c), 0.001); }

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  // Ink-dark under each pad, lighter on top, like layered strokes of a pine in a painting.
  vec3 needles = mix(uNeedleShade, uNeedle, smoothstep(0.2, 0.9, vTone.y));
  vec3 albedo = mix(uBark, needles, vTone.x);
  // Snow settles on the upper faces of the pads in the cold terms.
  float snow = uSnow * vTone.x * smoothstep(0.55, 0.9, vTone.y) * smoothstep(0.2, 0.7, n.y);
  albedo = mix(albedo, uSnowColor, snow);
  vec3 fill = mix(vec3(1.0), tint(uShadowCool), FILL_TINT);
  vec3 key = tint(uLightWarm);
  vec3 light = fill * AMBIENT * (0.85 + 0.25 * n.y) + key * KEY * max(dot(n, uSunDir), 0.0);
  gl_FragColor = vec4(albedo * light + rimLight(n, v) * 0.5, 1.0);
  #include <colorspace_fragment>
}
`;

/** Pines in the world's light. Set `uSnow` (0..1) from the solar term. */
export function createPineMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...uniforms,
      uBark: { value: new Color(TREE.bark) },
      uNeedle: { value: new Color(TREE.needle) },
      uNeedleShade: { value: new Color(TREE.needleShade) },
      uSnowColor: { value: new Color(TREE.snow) },
      uSnow: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    // Needles are single blades: seen from either side.
    side: DoubleSide,
  });
}
