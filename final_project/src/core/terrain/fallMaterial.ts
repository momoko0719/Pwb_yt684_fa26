import { Color, DoubleSide, ShaderMaterial } from 'three';
import { PORCELAIN } from '../palette';
import type { WorldUniforms } from '../shaders/uniforms';

const NOISE = /* glsl */ `
// An integer hash of a lattice point: exact (a sine hash can give one corner two values, in two
// neighbouring cells, by the compiler's rounding: a seam at each cell's edge).
float hash(vec2 c) {
  uvec2 q = uvec2(ivec2(c)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}
// Gradient noise (Perlin's), 0 to 1 about: value noise's cells, cut by a threshold into strands,
// showed as rectangles in the sheet.
vec2 gradAt(vec2 c) { float a = 6.2832 * hash(c); return vec2(cos(a), sin(a)); }
float valueNoise(vec2 p) {
  vec2 c = floor(p), f = fract(p), w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradAt(c), f), b = dot(gradAt(c + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float d = dot(gradAt(c + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), e = dot(gradAt(c + vec2(1.0)), f - vec2(1.0));
  return clamp(0.5 + 0.9 * mix(mix(a, b, w.x), mix(d, e, w.x), w.y), 0.0, 1.0);
}
`;

/**
 * A falling sheet of water (fallMesh.ts). Its detail is laid out by τ − time, τ being the seconds
 * since the water at that point left the lip: a parcel of water keeps its phase, so the detail
 * moves down the sheet at the water's own speed, stretching as it speeds up, and can never run
 * upward. (It was laid out by metres fallen less time × speed; the speed grows down the fall, so
 * as time went on the pattern slowed, stopped and ran up the sheet.)
 *
 * Streaks: across, by metres along the lip (finer on a thin film, broader on a full fall); along, by
 * τ (long, vertical). The sheet is whole over its spilling stretch: the streaks only shade it; it
 * opens into gaps only toward the lip's ends, where the flow thins out, low on a tall free fall
 * (it breaks into strands as it falls), and in the spray above where it lands, a band as high as
 * the fall is tall and full. It whitens with the metres fallen (air taken in), the more the more
 * water it carries; at the lip it is the pool's own clear water. A fall over the island's rim,
 * followed into the cloud, thins to mist.
 *
 * One material for every fall: each differs by its own numbers (per vertex: flow per metre, metres
 * fallen and still to fall, speed), not by settings.
 *
 * `uMarker` (the debug view) draws red bands that ride with the water: they must run down.
 */
export function createFallMaterial(uniforms: WorldUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uWater: { value: new Color(PORCELAIN.water) }, uFoam: { value: new Color(PORCELAIN.body) }, uMarker: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aFlow;
      attribute vec3 aExtra;
      varying vec4 vFlow;
      varying vec3 vExtra;
      varying vec3 vWorld;
      void main() {
        vFlow = aFlow;
        vExtra = aExtra;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uWater;
      uniform vec3 uFoam;
      uniform float uMarker;
      varying vec4 vFlow;
      varying vec3 vExtra;
      varying vec3 vWorld;
      ${NOISE}
      void main() {
        float along = vFlow.x, tau = vFlow.y, fallen = vFlow.z, q = vExtra.y, toLand = vExtra.z;
        bool lost = toLand > 500.0; // over the rim, into the cloud
        float near = 1.0 - smoothstep(40.0, 160.0, length(cameraPosition - vWorld));
        float full = smoothstep(0.02, 0.35, q); // a film (0) to a full fall (1)
        float across = mix(2.0, 0.9, full); // streaks per metre of lip
        float phase = tau - uTime; // constant on a parcel of water
        float a = valueNoise(vec2(along * across, phase * 1.6));
        float b = valueNoise(vec2(along * across * 2.4 + 7.0, phase * 3.2 + 3.0));
        float streak = mix(0.5, 0.65 * a + 0.35 * b, near);
        // Whole over the spill; gaps only where it thins at the lip's ends, low on a tall free fall,
        // and in the spray above the landing (a band growing with the fall's height and fullness).
        float thin = 1.0 - smoothstep(0.004, 0.05, q);
        float drop = fallen + (lost ? 0.0 : toLand);
        float spray = lost ? 0.0 : (1.0 - smoothstep(0.0, 0.5 + 0.08 * drop * full, toLand)) * 0.6;
        float strands = smoothstep(8.0, 30.0, fallen) * 0.6 * full;
        float cover = mix(1.0, smoothstep(0.35, 0.65, streak), max(max(thin, spray), strands));
        float alpha = cover * mix(0.45, 0.82, full);
        if (lost) alpha *= 1.0 - smoothstep(15.0, 60.0, fallen); // thinning to mist in the cloud
        // Clear like the pool at the lip; whiter as it falls, the more the fuller it is.
        float air = smoothstep(0.0, 5.0, fallen) * mix(0.3, 0.8, full);
        vec3 colour = mix(uWater * 0.92, uFoam, air * (0.6 + 0.4 * streak)) + 0.06 * (streak - 0.5) * near;
        if (uMarker > 0.5) {
          float band = 1.0 - step(0.15, fract(phase / 0.6));
          colour = mix(colour, vec3(0.85, 0.1, 0.1), band);
          alpha = max(alpha, band);
        }
        gl_FragColor = vec4(colour, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}
