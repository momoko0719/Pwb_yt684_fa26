import { ShaderMaterial } from 'three';
import { ATMOSPHERE_GLSL, WORLD_POSITION_VERT } from '../../core/shaders/atmosphere';
import type { WorldUniforms } from '../../core/shaders/uniforms';

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
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

void main() {
  vec2 p = vWorldPos.xz * 0.025 + vec2(uTime * 0.02, uTime * 0.008);
  float c = clouds(p);
  // Large, slow swells decide which parts of the sea catch the light.
  float swell = clouds(vWorldPos.xz * 0.006 - vec2(uTime * 0.004, 0.0));

  // Cloud tops that catch the light are warm gold, the troughs lavender (palette cloud colors).
  float lit = smoothstep(0.3, 0.75, 0.6 * c + 0.4 * swell);
  vec3 color = mix(uCloudShade, uCloudLight, lit);

  // Looking toward the sun, the whole sea glows warmer, and the lit crests shine.
  vec3 v = normalize(cameraPosition - vWorldPos);
  float backlit = max(dot(-v, uSunDir), 0.0);
  color = mix(color, uCloudLight, pow(backlit, 3.0) * 0.5);
  color += uLightWarm * pow(backlit, 12.0) * 0.3;
  color += uRimColor * smoothstep(0.55, 0.8, c) * backlit * 0.25;

  // Far out the clouds flatten into the sky's horizon color, so the plane has no visible edge.
  float far = smoothstep(300.0, 750.0, length(vWorldPos.xz - cameraPosition.xz));
  gl_FragColor = vec4(mix(color, uSkyHorizon, far), 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * A flat, slowly drifting sea of cloud: gold where it catches the light and toward the sun,
 * lavender in its troughs, flattening into the sky's horizon color far out.
 */
export function createCloudSeaMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms },
    vertexShader: WORLD_POSITION_VERT,
    fragmentShader,
  });
}
