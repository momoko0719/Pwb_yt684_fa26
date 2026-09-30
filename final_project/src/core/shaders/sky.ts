import { BackSide, ShaderMaterial } from 'three';
import { ATMOSPHERE_GLSL, WORLD_POSITION_VERT } from './atmosphere';
import type { WorldUniforms } from './uniforms';

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
${ATMOSPHERE_GLSL}
void main() {
  vec3 dir = normalize(vWorldPos - cameraPosition);
  // The camera usually looks a little down, so the blue starts low: mid sky by 0.12 above the horizon.
  vec3 color = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.12, dir.y));
  color = mix(color, uSkyTop, smoothstep(0.12, 0.6, dir.y));
  color = mix(color, uCloudShade, 1.0 - smoothstep(-0.15, 0.04, dir.y));

  // Soft glow instead of a sun disc: a broad warm band along the horizon under the sun,
  // a tighter warm wash, and a small accent-tinted core.
  float toSun = max(dot(dir, uSunDir), 0.0);
  float horizon = 1.0 - smoothstep(0.0, 0.25, abs(dir.y));
  color = mix(color, uCloudLight, pow(toSun, 3.0) * horizon * 0.45);
  color += uLightWarm * pow(toSun, 8.0) * 0.25;
  color = mix(color, uAccent, pow(toSun, 96.0) * 0.35);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** Three-stop vertical sky (horizon, mid, zenith) for the inside of a large sphere, with a soft sun glow. */
export function createSkyMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms },
    vertexShader: WORLD_POSITION_VERT,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
  });
}
