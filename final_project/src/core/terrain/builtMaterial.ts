import { ShaderMaterial, Vector2 } from 'three';
import { PORCELAIN_GLSL, porcelainUniforms } from '../shaders/porcelain';
import { JADE_REVEAL_GLSL } from '../shaders/jadeReveal';
import type { WorldUniforms } from '../shaders/uniforms';

/**
 * Porcelain for the meshes built on the ground (plates, pools, walls): their own normals and
 * occlusion per vertex, and the sun's shadow from the ground's baked light map at their place, so
 * they sit in the same light as the ground around them. Set uLight, uSize, uTexel as for the
 * ground (cdlod.ts).
 */
export function createBuiltMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...porcelainUniforms(uniforms), uTime: uniforms.uTime, uJadePool: { value: new Vector2() }, uJadePoolY: { value: 0 }, uJadeTangent: { value: new Vector2(1, 0) }, uJadeBend: { value: new Vector2() }, uJadeReveal: { value: 0 }, uLight: { value: null }, uSize: { value: 2 }, uTexel: { value: 1 } },
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
      void main() {
        vec3 n = normalize(vNormal);
        // A wall stands on the light map's edge, where each texel is either the top behind it or
        // the ground in front (its light jumped texel by texel: stripes down the wall). It takes
        // the light a little out in front of it instead, where it falls on the wall; a top, its own.
        vec2 at = vWorld.xz + n.xz * WALL_LIGHT;
        vec2 uv = (at / uTexel + 0.5 * (uSize - 1.0) + 0.5) / uSize;
        vec4 light = texture(uLight, uv);
        vec3 color = porcelain(n, normalize(cameraPosition - vWorld), vOcclusion, light.g);
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
