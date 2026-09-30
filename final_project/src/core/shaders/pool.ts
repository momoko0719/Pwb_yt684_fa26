import { ShaderMaterial } from 'three';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const vertexShader = /* glsl */ `
attribute float aDepth;
varying vec3 vWorldPos;
varying float vDepth;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vDepth = aDepth;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
varying float vDepth;
${ATMOSPHERE_GLSL}

const float SHALLOW = 0.35; // water shallower than this (world units) shows the stone below
const float EDGE = 0.06; // the last few centimetres of water fade out, so the shore has no hard line
const float RIPPLE = 0.12; // how far the ripples tilt the water normal
const float GLINT = 60.0; // sharpness of the sun's reflection
const float SPARKLE = 0.965; // noise above this twinkles: small glints that come and go

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
  // Ripples: two drifting noise layers tilt the normal (Class 05 uniforms + noise).
  vec2 q = vWorldPos.xz * 3.0;
  float rx = valueNoise(q + vec2(uTime * 0.3, 0.0)) - valueNoise(q * 1.7 - vec2(0.0, uTime * 0.25));
  float rz = valueNoise(q.yx + vec2(0.0, uTime * 0.3)) - valueNoise(q.yx * 1.7 + vec2(uTime * 0.2, 0.0));
  vec3 n = normalize(vec3(rx * RIPPLE, 1.0, rz * RIPPLE));
  vec3 v = normalize(cameraPosition - vWorldPos);

  // The mirror: the sky gradient in the reflected direction.
  vec3 r = reflect(-v, n);
  float up = max(r.y, 0.0);
  vec3 sky = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.3, up));
  sky = mix(sky, uSkyTop, smoothstep(0.3, 1.0, up));

  // Depth: dark mineral water where it is deep; where it is shallow the stone shows through.
  float shallow = 1.0 - smoothstep(0.0, SHALLOW, vDepth);
  vec3 below = mix(uMineral * 0.5, uRock * 0.75, shallow);

  // Class 05 Fresnel: seen from above more of the depth shows, seen edge-on more of the sky.
  // The floor of 0.45 keeps a clear sky reflection even from a high camera.
  float fresnel = 0.45 + 0.55 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 color = mix(below, sky, fresnel * (1.0 - 0.4 * shallow));

  // A wet, bright band where the water is only just covering the stone.
  color += uRimColor * 0.3 * (1.0 - smoothstep(EDGE, EDGE * 3.0, vDepth));

  // The sun's reflection, plus small twinkles that drift with the ripples.
  color += uRimColor * 1.5 * pow(max(dot(r, uSunDir), 0.0), GLINT);
  color += uRimColor * 0.8 * step(SPARKLE, valueNoise(q * 4.0 + vec2(uTime * 0.7, -uTime * 0.5)));

  // Fade by depth: exactly transparent where the ground meets the water, so the shore is soft.
  float alpha = smoothstep(0.0, EDGE, vDepth);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

/** Rock pools: small mirrors of the sky, dark when seen from above, bright when seen edge-on. */
export function createPoolMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms },
    vertexShader,
    fragmentShader,
    transparent: true,
  });
}
