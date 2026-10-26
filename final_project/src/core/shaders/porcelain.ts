import { Color, DoubleSide, ShaderMaterial } from 'three';
import { PORCELAIN } from '../palette';
import type { WorldUniforms } from './uniforms';

/**
 * The porcelain look, as a GLSL function any shader can call: `porcelain(n, v, occlusion, sun)`,
 * with n the surface normal, v the direction to the eye, occlusion 0 (in a crease) to 1 (open),
 * and sun 0 (in shadow) to 1 (lit).
 */
export const PORCELAIN_GLSL = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uWarmShadow;
uniform vec3 uCoolShadow;
uniform vec3 uCrease;
uniform vec3 uSheen;
uniform vec3 uSunDir;

vec3 porcelain(vec3 n, vec3 v, float occlusion, float sun) {
  // Sky from above (cooler), a warm bounce from below: the ambient; the sun a soft key, wrapped a
  // little round the form. Mixed by the key's own strength: flat ground in the sun sits a step
  // below the faces turned to it and a step above the shade, leaving room above for a sheen.
  // (It was mixed by smoothstep(0, 0.85, key + sky): every face turned up reached the full body
  // colour, and the ground, flat or sloping, sun or not, was one white.)
  // The ambient is the body's own colour a little cooled (more from the sky above, warmer from the
  // bounce below), about 0.6 of it; the key adds the rest. In the sun flat ground stands at about
  // 0.9 of the body colour, faces turned to the sun at all of it, shade at 0.57-0.62, cool.
  float sky = 0.5 + 0.5 * n.y;
  const vec3 LUMA = vec3(0.299, 0.587, 0.114);
  vec3 cool = uCoolShadow / dot(uCoolShadow, LUMA), warm = uWarmShadow / dot(uWarmShadow, LUMA);
  vec3 ambient = uBody * mix(warm, cool, 0.25 + 0.3 * sky) * (0.52 + 0.1 * sky);
  float key = clamp((dot(n, normalize(uSunDir)) + 0.25) / 1.25, 0.0, 1.0) * sun;
  vec3 color = mix(ambient, uBody, key);
  // Creases: the field's own occlusion darkens them, toward a cool grey.
  color = mix(uCrease, color, mix(0.35, 1.0, occlusion));
  // A glaze: soft sheen where the surface turns away from the eye.
  float edge = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  return mix(color, uSheen, edge * 0.25);
}
`;

/** The uniforms PORCELAIN_GLSL reads. Shares the world's sun direction. */
export function porcelainUniforms(uniforms: WorldUniforms) {
  return {
    uSunDir: uniforms.uSunDir,
    uBody: { value: new Color(PORCELAIN.body) },
    uWarmShadow: { value: new Color(PORCELAIN.warmShadow) },
    uCoolShadow: { value: new Color(PORCELAIN.coolShadow) },
    uCrease: { value: new Color(PORCELAIN.crease) },
    uSheen: { value: new Color(PORCELAIN.sheen) },
  };
}

const vertexShader = /* glsl */ `
attribute float aOcclusion;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vOcclusion;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vOcclusion = aOcclusion;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
${PORCELAIN_GLSL}
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vOcclusion;

void main() {
  gl_FragColor = vec4(porcelain(normalize(vNormal), normalize(cameraPosition - vWorldPos), vOcclusion, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;

/** White porcelain for shapes meshed from an SDF, shaded per vertex (reads `aOcclusion`). */
export function createPorcelainMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: porcelainUniforms(uniforms),
    vertexShader,
    fragmentShader,
    side: DoubleSide,
  });
}
