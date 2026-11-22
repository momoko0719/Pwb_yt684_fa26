import { Color, ShaderMaterial, Vector2, Vector4 } from 'three';
import { PORCELAIN } from '../palette';
import { PORCELAIN_GLSL, porcelainUniforms } from '../shaders/porcelain';
import { JADE_REVEAL_GLSL } from '../shaders/jadeReveal';
import type { WorldUniforms } from '../shaders/uniforms';

/**
 * Porcelain for the meshes built on the ground (plates, pools, walls): their own normals and
 * occlusion per vertex, and the sun's shadow from the ground's baked light map at their place, so
 * they sit in the same light as the ground around them. Set uLight, uSize, uTexel as for the
 * ground (cdlod.ts).
 */
/** How many falls stain the walls they run down (setBuiltFalls). */
export const MAX_SPILLS = 12;

export function createBuiltMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...porcelainUniforms(uniforms), uTime: uniforms.uTime, uJadePool: { value: new Vector2() }, uJadePoolY: { value: 0 }, uJadeTangent: { value: new Vector2(1, 0) }, uJadeBend: { value: new Vector2() }, uJadeReveal: { value: 0 }, uLight: { value: null }, uSize: { value: 2 }, uTexel: { value: 1 },
      uFalls: { value: Array.from({ length: MAX_SPILLS }, () => new Vector4()) }, uFallInfo: { value: Array.from({ length: MAX_SPILLS }, () => new Vector4()) }, uFallCount: { value: 0 },
      uTravertine: { value: new Color(PORCELAIN.travertine) }, uAmber: { value: new Color(PORCELAIN.travertineAmber) }, uWet: { value: new Color(PORCELAIN.travertineWet) } },
    vertexShader: /* glsl */ `
      attribute float aOcclusion;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying float vOcclusion;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vOcclusion = aOcclusion;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${PORCELAIN_GLSL}
      uniform float uTime;
      uniform float uJadePoolY;
      uniform vec2 uJadeTangent;
      ${JADE_REVEAL_GLSL}
      uniform sampler2D uLight;
      const float WALL_LIGHT = 1.5; // metres out from a wall its light is read
      uniform float uSize;
      uniform float uTexel;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying float vOcclusion;
      uniform vec4 uFalls[${MAX_SPILLS}]; // where each fall lands: x0, z0, x1, z1
      uniform vec4 uFallInfo[${MAX_SPILLS}]; // its landing height, its drop, its spread
      uniform int uFallCount;
      uniform vec3 uTravertine, uAmber, uWet;
      float bh(vec2 p) { uvec2 q = uvec2(ivec2(floor(p))) * uvec2(1597334673u, 3812015801u); uint k = (q.x ^ q.y) * 1597334673u; return float(k) * (1.0 / 4294967295.0); }
      float bn(vec2 p) { vec2 c = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(bh(c), bh(c + vec2(1, 0)), f.x), mix(bh(c + vec2(0, 1)), bh(c + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 n = normalize(vNormal);
        // A wall stands on the light map's edge, where each texel is either the top behind it or
        // the ground in front (its light jumped texel by texel: stripes down the wall). It takes
        // the light a little out in front of it instead, where it falls on the wall; a top, its own.
        vec2 at = vWorld.xz + n.xz * WALL_LIGHT;
        vec2 uv = (at / uTexel + 0.5 * (uSize - 1.0) + 0.5) / uSize;
        vec4 light = texture(uLight, uv);
        vec3 color = porcelain(n, normalize(cameraPosition - vWorld), vOcclusion, light.g);
        // What the water lays down (沉积). On the walls, curtains of travertine hanging down,
        // uneven: thick in some stretches, bare in others, each drape its own width (no two lines
        // alike, nothing in rows). On the tops, a cream crust in patches. Where a fall runs down
        // a wall, amber, and a faint green at its wet foot.
        float wall = 1.0 - smoothstep(0.35, 0.7, abs(n.y));
        vec2 wc = vec2(dot(vWorld.xz, vec2(-n.z, n.x)), vWorld.y);
        float drape = bn(vec2(wc.x * 0.55, wc.y * 0.09)) * 0.65 + bn(vec2(wc.x * 1.7, wc.y * 0.22) + 7.3) * 0.35;
        float stretch = smoothstep(0.3, 0.7, bn(wc * vec2(0.05, 0.03) + 3.1));
        float curtain = smoothstep(0.5, 0.78, drape) * stretch * wall;
        color = mix(color, color * uTravertine * 1.06, curtain * 0.75);
        color *= 1.0 - (1.0 - smoothstep(0.3, 0.55, drape)) * stretch * wall * 0.07;
        float crust = smoothstep(0.45, 0.75, bn(vWorld.xz * 0.12) * 0.7 + bn(vWorld.xz * 0.45) * 0.3) * (1.0 - wall);
        color = mix(color, color * uTravertine * 1.05, crust * 0.5);
        for (int i = 0; i < ${MAX_SPILLS}; i++) {
          if (i >= uFallCount) break;
          vec2 a = uFalls[i].xy, ab = uFalls[i].zw - uFalls[i].xy;
          float hseg = clamp(dot(vWorld.xz - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          float across = length(vWorld.xz - a - ab * hseg);
          float up = vWorld.y - uFallInfo[i].x, drop = uFallInfo[i].y, spread = uFallInfo[i].z;
          float beside = 1.0 - smoothstep(spread * 0.15 + 1.0, spread * 0.15 + 4.5 + drape * 2.0, across);
          float onWall = smoothstep(-0.6, 0.2, up) * (1.0 - smoothstep(drop, drop + 0.8, up));
          float stain = beside * onWall * wall;
          color = mix(color, color * uAmber * 1.12, stain * (0.4 + 0.3 * drape));
          color = mix(color, color * uWet * 1.08, stain * (1.0 - smoothstep(0.0, 1.8, up)) * 0.5);
        }
        // The pool top is water-covered. Let the exposed stone at the spill lip
        // and its carved outer wall carry the visible vein as well.
        vec2 delta = vWorld.xz - uJadePool;
        float acrossLip = dot(delta, normalize(uJadeTangent));
        float drop = vWorld.y - uJadePoolY;
        // A pair of sparse veins that lean down the exposed wall. Repeating a
        // sine over the horizontal coordinate made the spill look striped.
        float bend = 0.36 * drop + 0.18 * sin(drop * 1.45);
        // Place the vein beside the falling water, where exposed dry wall is visible.
        float mainVein = 1.0 - smoothstep(0.22, 0.48, abs(acrossLip - bend - 7.0));
        float branch = 1.0 - smoothstep(0.13, 0.34, abs(acrossLip - 0.2 * drop + 5.7));
        float strand = max(mainVein, branch * 0.52);
        float local = (1.0 - smoothstep(11.0, 17.0, length(delta)))
          * (1.0 - smoothstep(2.0, 5.0, abs(drop)));
        float timeFront = smoothstep(5.0, 32.0, uTime - abs(acrossLip));
        float exposed = strand * local * timeFront * uJadeReveal;
        color = mix(color, vec3(0.34, 0.59, 0.51), clamp(exposed * 0.8, 0.0, 0.67));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The falls that run down the built walls (water.ts falls): where each lands, its height, drop and spread. */
export function setBuiltFalls(material: ShaderMaterial, falls: { landing: [number, number, number]; ends: [number, number, number, number]; drop: number; spread: number }[], floor: number) {
  const lines = material.uniforms.uFalls.value as Vector4[], infos = material.uniforms.uFallInfo.value as Vector4[];
  const kept = falls.filter((f) => f.drop > 0.5 && f.landing[1] > floor - 2).sort((a, b) => b.drop - a.drop).slice(0, MAX_SPILLS);
  kept.forEach((f, i) => { lines[i].set(...f.ends); infos[i].set(f.landing[1], f.drop, f.spread, 0); });
  material.uniforms.uFallCount.value = kept.length;
}
