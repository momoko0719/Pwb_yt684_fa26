import { DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, ShaderMaterial } from 'three';
import type { GrassBlades } from '../generators/grass';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const PETALS = 5;
const PETAL_SPREAD = 0.45; // half-width of a petal at its base, in radians around the head

const vertexShader = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aShape; // yaw, height scale, bend, shade
attribute float aPart; // 0 stem, 1 head
uniform float uStemHeight;
uniform float uHeadSize;
uniform float uBloom;
varying float vPart;
varying float vRadial;
varying float vShade;
varying vec3 vWorldPos;
${ATMOSPHERE_GLSL}

vec2 turn(vec2 v, float a) {
  return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a));
}

void main() {
  float h = uStemHeight * aShape.y;
  vec2 push = windAt(aOffset.xz);
  vec2 facing = turn(vec2(0.0, 1.0), aShape.x);
  vec2 lean = facing * (0.08 + 0.15 * aShape.z) + push;
  vec3 p;
  float radial = 0.0;
  if (aPart < 0.5) {
    // Stem: a thin strip that bends like a grass blade (Class 05 vertex displacement by the shared wind).
    float t = position.y;
    vec2 side = turn(vec2(1.0, 0.0), aShape.x) * position.x * 0.04 * h;
    vec2 bend = lean * h * t * t;
    p = aOffset + vec3(side.x + bend.x, h * t, side.y + bend.y);
  } else {
    // Head: petals hinge up from the center. uBloom 1 lays them open, 0 folds them into a bud.
    radial = length(position.xz);
    vec2 dir = radial > 0.0 ? turn(position.xz / radial, aShape.x) : vec2(0.0);
    float hinge = mix(1.35, 0.2, uBloom);
    float size = uHeadSize * (0.8 + 0.4 * aShape.y);
    vec3 petal = vec3(dir.x * cos(hinge), sin(hinge), dir.y * cos(hinge)) * radial * size;
    p = aOffset + vec3(lean.x * h, h, lean.y * h) + petal;
  }
  vPart = aPart;
  vRadial = radial;
  vShade = aShape.w;
  vWorldPos = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uGlow;
varying float vPart;
varying float vRadial;
varying float vShade;
varying vec3 vWorldPos;
${ATMOSPHERE_GLSL}

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
  // Palette colors only: accent petals paling toward the rim color at their tips, a meadow stem.
  vec3 petal = mix(uAccent, uRimColor, 0.2 + 0.4 * vRadial) * mix(0.9, 1.1, vShade);
  vec3 albedo = vPart < 0.5 ? uMeadow * 0.8 : petal;
  vec3 fill = mix(vec3(1.0), tint(uShadowCool), FILL_TINT);
  vec3 key = tint(uLightWarm);
  vec3 color = albedo * (fill * AMBIENT * 1.1 + key * KEY * max(uSunDir.y, 0.0));

  // After dusk the folded heads give off a cold light of their own (the palette rim color, which
  // is pale cyan at night); the stems only catch a little of it.
  float glow = uGlow * (vPart < 0.5 ? 0.15 : 1.0 - 0.4 * vRadial);
  color = mix(color, color * 0.5, uGlow * 0.5) + uRimColor * glow * 1.2;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * Zhuyu flowers. Set `uStemHeight`, `uHeadSize` (world units), and `uBloom` / `uGlow` (0..1)
 * from the hour, see `flowerPhase`.
 */
export function createFlowerMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms, uStemHeight: { value: 1 }, uHeadSize: { value: 0.2 }, uBloom: { value: 1 }, uGlow: { value: 0 } },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
  });
}

/** One flower (a stem strip and a head of petals), drawn once per entry in `flowers`. */
export function createFlowerGeometry(flowers: GrassBlades): InstancedBufferGeometry {
  const positions: number[] = [];
  const parts: number[] = [];
  const indices: number[] = [];
  const vertex = (x: number, y: number, z: number, part: number) => {
    positions.push(x, y, z);
    parts.push(part);
    return parts.length - 1;
  };
  // Stem: two rows, a thin strip.
  const [a, b, c, d] = [vertex(-0.5, 0, 0, 0), vertex(0.5, 0, 0, 0), vertex(-0.5, 1, 0, 0), vertex(0.5, 1, 0, 0)];
  indices.push(a, b, c, b, d, c);
  // Head: each petal is a triangle from two points near the center to a tip. Positions store the
  // petal's direction scaled by how far out the vertex is; the shader hinges them up.
  const center = vertex(0, 1, 0, 1);
  for (let k = 0; k < PETALS; k++) {
    const angle = (k / PETALS) * Math.PI * 2;
    const at = (theta: number, radial: number) => vertex(Math.cos(theta) * radial, 1, Math.sin(theta) * radial, 1);
    const left = at(angle - PETAL_SPREAD, 0.35);
    const right = at(angle + PETAL_SPREAD, 0.35);
    const tip = at(angle, 1);
    indices.push(center, left, right, left, tip, right);
  }

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aPart', new Float32BufferAttribute(parts, 1));
  geometry.setIndex(indices);
  geometry.setAttribute('aOffset', new InstancedBufferAttribute(flowers.offset, 3));
  geometry.setAttribute('aShape', new InstancedBufferAttribute(flowers.shape, 4));
  geometry.instanceCount = flowers.count;
  return geometry;
}
