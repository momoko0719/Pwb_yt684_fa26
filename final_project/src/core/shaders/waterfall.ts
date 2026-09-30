import { DoubleSide, ShaderMaterial } from 'three';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const vertexShader = /* glsl */ `
attribute float aSeed;
attribute float aLength;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vSeed;
varying float vLength;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vUv = uv;
  vSeed = aSeed;
  vLength = aLength;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vSeed;
varying float vLength;
${ATMOSPHERE_GLSL}

const float FLOW_SPEED = 6.0; // world units per second
const float STREAK_SCALE = 0.15; // streak length along the fall, per world unit

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), w.x);
  float b = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), w.x);
  return mix(a, b, w.y);
}

void main() {
  float along = vUv.y;
  float across = abs(vUv.x * 2.0 - 1.0);

  // Streaks: noise stretched along the fall and scrolled downward with time (Class 05 uniforms + noise).
  vec2 q = vec2(vUv.x * 5.0 + vSeed * 17.0, (along * vLength - uTime * FLOW_SPEED) * STREAK_SCALE);
  float streak = 0.65 * valueNoise(q) + 0.35 * valueNoise(q * vec2(2.3, 3.1) + 5.0);

  // Lower down the threshold rises, so the thread frays into strands and then into vapour.
  float fray = mix(0.25, 0.75, smoothstep(0.1, 0.9, along));
  float strands = smoothstep(fray - 0.15, fray + 0.15, streak);
  float body = 1.0 - smoothstep(0.35, 1.0, across);
  float lip = smoothstep(0.0, 0.03, along);
  float vapour = 1.0 - smoothstep(0.45, 1.0, along);
  float haze = (1.0 - across) * smoothstep(0.3, 0.8, along) * (1.0 - smoothstep(0.8, 1.0, along)) * 0.25;
  float alpha = lip * (body * strands * vapour * 0.9 + haze);

  // Colors from the palette: the rim highlight for the water, the fog color for its vapour.
  vec3 color = mix(uFogColor, uRimColor, 0.35 + 0.65 * strands * vapour);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

/** Thin falls: white streaks flowing down a ribbon, fraying into vapour. Reads uTime from the world uniforms. */
export function createWaterfallMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}
