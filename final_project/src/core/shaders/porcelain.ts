import { Color, DoubleSide, ShaderMaterial, Vector2 } from 'three';
import { FAR_STYLE, PORCELAIN } from '../palette';
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
uniform float uFarStyle; // far-view detail: 0 off, 1 on (docs/plan-2026-11-19-far-view.md)
uniform vec2 uFarRange; // where it begins and where it is full, metres (as seen at the reference screen)
uniform float uFarScale; // distance to "screen metres": the same footprint on any screen and lens
uniform vec2 uSideRange; // the island's lowest point and its rim, metres
uniform vec3 uFarLichen, uFarCrack, uFarCool;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vOcclusion;

float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
// Noise on a wall: two projections blended by which way the face turns (no seam round the island).
float wallNoise(vec3 p, vec3 n, vec2 scale) {
  float wx = abs(n.x), wz = abs(n.z);
  return (fn(vec2(p.z, p.y) * scale) * wx + fn(vec2(p.x, p.y) * scale + 17.0) * wz) / max(wx + wz, 1e-3);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 color = porcelain(n, normalize(cameraPosition - vWorldPos), vOcclusion, 1.0);
  if (uFarStyle > 0.5) {
    // The island's sides and underside from afar: one mass, light at the rim and heavier, cooler
    // toward the keel; turned to the sun or away from it; the grooves between its ribs deeper;
    // broad soft beds of colour (long sideways patches, not lines: sediment, laid down), and
    // weathering streaks running down. Nothing here changes the shape; close up it fades out.
    float k = smoothstep(uFarRange.x, uFarRange.y, length(cameraPosition - vWorldPos) * uFarScale);
    float t = clamp((vWorldPos.y - uSideRange.x) / max(uSideRange.y - uSideRange.x, 1.0), 0.0, 1.0);
    float macro = wallNoise(vWorldPos, n, vec2(0.008, 0.012));
    float beds = wallNoise(vWorldPos + 23.0, n, vec2(0.012, 0.06)) * 0.65 + wallNoise(vWorldPos - 9.0, n, vec2(0.03, 0.12)) * 0.35;
    float streak = smoothstep(0.5, 0.8, wallNoise(vWorldPos, n, vec2(0.05, 0.004)));
    float facing = clamp(dot(n, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = color * mix(0.6, 1.04, smoothstep(0.0, 0.9, t)) * (1.0 + (macro - 0.5) * 0.24);
    c *= mix(0.74, 1.06, facing);
    c *= mix(0.72, 1.0, vOcclusion);
    c = mix(c, c * uFarCool * 1.12, clamp((1.0 - t) * 0.6 + max(-n.y, 0.0) * 0.3, 0.0, 1.0));
    c = mix(c, uFarLichen * 0.95, smoothstep(0.55, 0.85, beds) * 0.32);
    c = mix(c, c * vec3(1.06, 1.0, 0.9), smoothstep(0.45, 0.15, beds) * 0.5);
    c = mix(c, uFarCrack, streak * 0.2 * (1.0 - 0.5 * t));
    // Plain at the rim, where the wall meets the top (whose own far colour fades there too).
    color = mix(color, c, k * (1.0 - smoothstep(0.8, 0.97, t)));
  }
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** White porcelain for shapes meshed from an SDF, shaded per vertex (reads `aOcclusion`). */
export function createPorcelainMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...porcelainUniforms(uniforms),
      uFarStyle: { value: 0 },
      uFarRange: { value: new Vector2(90, 320) },
      uFarScale: { value: 1 },
      uSideRange: { value: new Vector2(-200, 0) },
      uFarLichen: { value: new Color(FAR_STYLE.lichen) },
      uFarCrack: { value: new Color(FAR_STYLE.crack) },
      uFarCool: { value: new Color(FAR_STYLE.hollowCool) },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
  });
}

/** Far-view detail on the island's sides and underside (docs/plan-2026-11-19-far-view.md). */
export function setPorcelainFar(material: ShaderMaterial, style: number, near: number, far: number, bottom: number, top: number) {
  material.uniforms.uFarStyle.value = style;
  (material.uniforms.uFarRange.value as Vector2).set(near, far);
  (material.uniforms.uSideRange.value as Vector2).set(bottom, top);
}
