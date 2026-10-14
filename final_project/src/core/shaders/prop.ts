import { Color, ShaderMaterial } from 'three';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vTint;
void main() {
  mat4 m = modelMatrix;
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #endif
  vec4 world = m * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vTint;
${ATMOSPHERE_GLSL}

// Same light levels as the terrain, so built things sit in the island's light.
const float AMBIENT = 0.65;
const float KEY = 0.55;
const float FILL_TINT = 0.25;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 tint(vec3 c) { return c / max(luma(c), 0.001); }

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec3 albedo = uColor * vTint;
  vec3 fill = mix(vec3(1.0), tint(uShadowCool), FILL_TINT);
  vec3 key = tint(uLightWarm);
  vec3 light = fill * AMBIENT * (0.85 + 0.25 * n.y) + key * KEY * max(dot(n, uSunDir), 0.0);
  gl_FragColor = vec4(albedo * light + rimLight(n, v) * 0.4, uOpacity);
  #include <colorspace_fragment>
}
`;

/** A flat-coloured material for built things (stones, steps, pavilion parts), lit like the terrain. */
export function createPropMaterial(uniforms: WorldUniforms, color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new Color(color) }, uOpacity: { value: 1 } },
    vertexShader,
    fragmentShader,
  });
}
