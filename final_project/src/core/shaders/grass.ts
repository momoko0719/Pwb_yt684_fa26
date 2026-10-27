import { DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, ShaderMaterial, Vector4 } from 'three';
import type { GrassBlades } from '../generators/grass';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const SEGMENTS = 5; // rows along a blade, root to tip
const BLADE_WIDTH = 0.16; // mid-blade width as a share of height (narrower root/tip kill the cardboard slab)
const LEAN: [number, number] = [0.18, 0.55]; // resting lean as a share of height

const vertexShader = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aShape; // yaw, height scale, bend, shade
uniform float uBladeHeight;
varying float vT;
varying float vShade;
varying vec3 vWorldPos;
${ATMOSPHERE_GLSL}

void main() {
  float t = position.y; // 0 at the root, 1 at the tip
  float h = uBladeHeight * aShape.y;
  vec3 side = vec3(cos(aShape.x), 0.0, sin(aShape.x));
  vec3 facing = vec3(-side.z, 0.0, side.x);

  // Rest lean + shared wind, both × t² so the root stays planted (no root slide).
  // Per-blade shade nudges wind phase so a clump does not lock-step.
  vec2 push = windAt(aOffset.xz + vec2(aShape.w * 1.7, aShape.z * 2.3));
  float lean = ${LEAN[0].toFixed(3)} + ${(LEAN[1] - LEAN[0]).toFixed(3)} * aShape.z;
  vec3 bend = (facing * lean + vec3(push.x, 0.0, push.y)) * h * t * t;
  // position.x already encodes a tapered / mid-bulge width profile from the mesh.
  vec3 p = aOffset + side * position.x * ${BLADE_WIDTH.toFixed(3)} * h + bend;
  // A bent blade is shorter; slight sink so roots meet the height-map / LOD terrain.
  p.y += h * t * (1.0 - 0.35 * min(dot(bend, bend) / (h * h), 1.0)) - 0.04 * h;

  vT = t;
  vShade = aShape.w;
  vWorldPos = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying float vT;
varying float vShade;
varying vec3 vWorldPos;
uniform sampler2D uWear;
uniform vec4 uWearRect; // x0, z0, size, on
uniform float uVisibility; // 0..1 global load fade (Orbit camera–hit band)
uniform float uFadeNear;   // camera–blade: full keep closer than this
uniform float uFadeFar;    // camera–blade: gone by this
${ATMOSPHERE_GLSL}

// Same light levels as the terrain shader, so a blade and the meadow under it match.
const float AMBIENT = 0.65;
const float KEY = 0.55;
const float FILL_TINT = 0.25;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 tint(vec3 c) {
  return c / max(luma(c), 0.001);
}

void main() {
  // Distance fade: dither discard (no alpha sort). Separates "instances loaded" from "visible".
  float camDist = length(cameraPosition - vWorldPos);
  float distKeep = 1.0 - smoothstep(uFadeNear, uFadeFar, camDist);
  float keep = clamp(uVisibility, 0.0, 1.0) * distKeep;
  if (keep < 0.02) discard;
  float dither = fract(sin(dot(vWorldPos.xz, vec2(12.9898, 78.233)) + vShade * 19.0) * 43758.5453);
  if (dither > keep) discard;

  // Trample: fade/discard blades from contact walk channel without rebuilding instances.
  if (uWearRect.w > 0.5) {
    vec2 wuv = (vWorldPos.xz - uWearRect.xy) / uWearRect.z;
    if (wuv.x > 0.0 && wuv.y > 0.0 && wuv.x < 1.0 && wuv.y < 1.0) {
      float walk = texture(uWear, wuv).r;
      if (walk > 0.55) discard;
      if (walk > 0.18) {
        float tKeep = 1.0 - smoothstep(0.18, 0.55, walk);
        if (fract(vShade * 17.0 + vWorldPos.x * 3.1) > tKeep) discard;
      }
    }
  }
  // Tip cooler-green, root warmer toward soil/moss — mild, never a black slab.
  float rootW = 1.0 - smoothstep(0.0, 0.28, vT);
  vec3 tipAlbedo = uMeadow * mix(0.96, 1.14, vT) * mix(0.92, 1.08, vShade);
  vec3 rootAlbedo = mix(uMeadow * 0.9, uMeadow * vec3(1.05, 0.95, 0.82), 0.35);
  vec3 albedo = mix(tipAlbedo, rootAlbedo, rootW * 0.55);
  // Soft contact darkening at the planted base (not a hard rectangle cut).
  albedo *= 1.0 - 0.18 * rootW * rootW;
  vec3 fill = mix(vec3(1.0), tint(uShadowCool), FILL_TINT);
  vec3 key = tint(uLightWarm);
  vec3 color = albedo * (fill * AMBIENT * 1.1 + key * KEY * max(uSunDir.y, 0.0));

  // Backlit tips let the sun through.
  vec3 v = normalize(cameraPosition - vWorldPos);
  float backlit = max(dot(-v, uSunDir), 0.0);
  color += key * albedo * pow(backlit, 3.0) * vT * vT * 0.6;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** Grass blades that sway in the shared wind. Set `uBladeHeight` (world units) from the params. */
export function createGrassMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...uniforms,
      uBladeHeight: { value: 0.7 },
      uWear: { value: null },
      uWearRect: { value: new Vector4(0, 0, 1, 0) },
      uVisibility: { value: 1 },
      uFadeNear: { value: 36 },
      uFadeFar: { value: 56 },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
  });
}

/**
 * One tapered blade, drawn once per entry in `blades` (instancing): the blade's shape is stored
 * once, and each copy only adds its root position and a few numbers.
 */
export function createGrassGeometry(blades: GrassBlades): InstancedBufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  // Width profile: narrow at the planted root (no rectangular stub), slight mid bulge, fine tip.
  for (let k = 0; k < SEGMENTS; k++) {
    const t = k / SEGMENTS;
    const envelope = Math.sin(Math.PI * Math.min(t * 1.15, 1)) ** 0.85; // mid-bulge
    const taper = (1 - t) ** 1.15;
    const half = 0.5 * (0.22 + 0.78 * envelope) * taper;
    positions.push(-half, t, 0, half, t, 0);
  }
  positions.push(0, 1, 0); // the tip
  for (let k = 0; k < SEGMENTS - 1; k++) {
    const a = k * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (SEGMENTS - 1) * 2;
  indices.push(last, last + 1, last + 2);

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.setAttribute('aOffset', new InstancedBufferAttribute(blades.offset, 3));
  geometry.setAttribute('aShape', new InstancedBufferAttribute(blades.shape, 4));
  geometry.instanceCount = blades.count;
  return geometry;
}
