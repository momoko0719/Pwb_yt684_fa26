import { ShaderMaterial } from 'three';
import { PORCELAIN_GLSL, porcelainUniforms } from '../shaders/porcelain';
import type { WorldUniforms } from '../shaders/uniforms';

/**
 * Porcelain for the meshes built on the ground (plates, pools, walls): their own normals and
 * occlusion per vertex, and the sun's shadow from the ground's baked light map at their place, so
 * they sit in the same light as the ground around them. Set uLight, uSize, uTexel as for the
 * ground (cdlod.ts).
 */
export function createBuiltMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...porcelainUniforms(uniforms), uLight: { value: null }, uSize: { value: 2 }, uTexel: { value: 1 } },
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
        gl_FragColor = vec4(porcelain(n, normalize(cameraPosition - vWorld), vOcclusion, light.g), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
