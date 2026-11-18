import { ShaderMaterial } from 'three';
import { ATMOSPHERE_GLSL, WORLD_POSITION_VERT } from '../../core/shaders/atmosphere';
import type { WorldUniforms } from '../../core/shaders/uniforms';

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
// Cloud masses are landscape-sized: their pattern and the distance where the sea fades into the
// horizon grow with the island (1 on a 31 m island, about 16 on a 500 m one).
uniform float uCloudScale;
uniform float uFadeIntoSky;
${ATMOSPHERE_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float clouds(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) { sum += amp * valueNoise(p); p *= 2.03; amp *= 0.5; }
  return sum;
}
// Gradient noise has no flat cell interiors, so the closer White Jade cloud sea is less quilted.
vec2 gradient(vec2 p) { float a = hash(p) * 6.2831853; return vec2(cos(a), sin(a)); }
float gradientNoise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradient(cell), f);
  float b = dot(gradient(cell + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(gradient(cell + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(gradient(cell + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

void main() {
  vec2 xz = vWorldPos.xz / uCloudScale;
  vec2 p = xz * 0.025 + vec2(uTime * 0.02, uTime * 0.008);
  float c = clouds(p);
  // Large, slow swells decide which parts of the sea catch the light.
  float swell = clouds(xz * 0.006 - vec2(uTime * 0.004, 0.0));
  if (uFadeIntoSky > 0.5) {
    // Broad, low-contrast swells. The closer octaves stay quiet so the sea is not a quilt of cells.
    float broad = gradientNoise(xz * 0.0035 - vec2(uTime * 0.003, uTime * 0.001));
    float slow = gradientNoise(xz * 0.008 + vec2(4.0, uTime * 0.002));
    c = 0.52 + 0.28 * broad + 0.08 * slow;
    swell = 0.55 + 0.2 * broad;
  }

  // Cloud tops that catch the light are warm gold, the troughs lavender (palette cloud colors).
  float lit = smoothstep(0.3, 0.75, 0.6 * c + 0.4 * swell);
  vec3 color = mix(uCloudShade, uCloudLight, lit);
  if (uFadeIntoSky > 0.5) lit = smoothstep(0.42, 0.78, c);
  if (uFadeIntoSky > 0.5) color = mix(uCloudShade, uCloudLight, 0.35 + 0.28 * lit);

  // Looking toward the sun, the whole sea glows warmer, and the lit crests shine.
  vec3 v = normalize(cameraPosition - vWorldPos);
  float backlit = max(dot(-v, uSunDir), 0.0);
  color = mix(color, uCloudLight, pow(backlit, 3.0) * (uFadeIntoSky > 0.5 ? 0.18 : 0.5));
  color += uLightWarm * pow(backlit, 12.0) * (uFadeIntoSky > 0.5 ? 0.08 : 0.3);
  if (uFadeIntoSky < 0.5) color += uRimColor * smoothstep(0.55, 0.8, c) * backlit * 0.25;
  if (uFadeIntoSky > 0.5) color = mix(color, uSkyHorizon, 0.22);

  // Far out the clouds flatten into the sky's horizon color, so the plane has no visible edge.
  float far = smoothstep(300.0, 750.0, length(vWorldPos.xz - cameraPosition.xz) / uCloudScale);
  // Wonderland fades to the actual sky behind the plane. Other islands keep the original opaque
  // gold horizon; this avoids changing their established appearance.
  gl_FragColor = vec4(mix(color, uSkyHorizon, far * (1.0 - uFadeIntoSky)), 1.0 - far * uFadeIntoSky);
  #include <colorspace_fragment>
}
`;

/**
 * A flat, slowly drifting sea of cloud: gold where it catches the light and toward the sun,
 * lavender in its troughs, flattening into the sky's horizon color far out. Set `uCloudScale` to
 * the island's radius / 31.
 */
export function createCloudSeaMaterial(uniforms: WorldUniforms, fadeIntoSky = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms, uCloudScale: { value: 1 }, uFadeIntoSky: { value: fadeIntoSky ? 1 : 0 } },
    vertexShader: WORLD_POSITION_VERT,
    fragmentShader,
    transparent: fadeIntoSky,
    depthWrite: !fadeIntoSky,
  });
}
