import { DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, ShaderMaterial } from 'three';
import type { GrassBlades } from '../generators/grass';
import { ATMOSPHERE_GLSL } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const SEGMENTS = 4; // rows along a blade, root to tip
const BLADE_WIDTH = 0.1; // blade width at the root, as a share of its height
const LEAN: [number, number] = [0.15, 0.5]; // how far a blade curves over at rest, as a share of its height

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

  // Class 05 vertex displacement: a resting lean plus the shared wind, both growing with t
  // squared, so the root stays put and the tip moves most.
  vec2 push = windAt(aOffset.xz);
  float lean = ${LEAN[0].toFixed(3)} + ${(LEAN[1] - LEAN[0]).toFixed(3)} * aShape.z;
  vec3 bend = (facing * lean + vec3(push.x, 0.0, push.y)) * h * t * t;
  vec3 p = aOffset + side * position.x * ${BLADE_WIDTH.toFixed(3)} * h + bend;
  // A bent blade is shorter, so the tip does not stretch away from the root.
  p.y += h * t * (1.0 - 0.35 * min(dot(bend, bend) / (h * h), 1.0)) - 0.08 * h;

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
  // Darker at the root, lighter at the tip, each blade a little different (palette meadow only).
  vec3 albedo = uMeadow * mix(0.65, 1.2, vT) * mix(0.85, 1.15, vShade);
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
    uniforms: { ...uniforms, uBladeHeight: { value: 0.7 } },
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
  for (let k = 0; k < SEGMENTS; k++) {
    const t = k / SEGMENTS;
    const half = 0.5 * (1 - t) ** 0.7;
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
