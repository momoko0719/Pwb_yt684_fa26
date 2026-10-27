import { Color, ShaderMaterial, Vector4, type Texture } from 'three';
import { PORCELAIN } from '../palette';
import type { WorldUniforms } from '../shaders/uniforms';

/**
 * Water: calm where it is still, stirred where something moves it. Every vertex carries the water's
 * velocity there (aFlow, m/s: slow over a pool's deep middle, quickening toward its outlets and over
 * the lip; down a stream along it) and its depth (aDepth); every place where water lands is an
 * impact (setImpacts: the line it lands along, how far it stirs, how hard).
 *
 * In three layers by distance, so that water reads as water at any distance:
 * - Everywhere: its colour from its depth (light absorbed on its way down and back up, red first:
 *   over the cream floor, shallow water is cream turned cyan, deep water its own teal blue); the sky
 *   by Schlick's Fresnel (barely from above, more toward grazing); and broad patches, tens of metres
 *   across, drifting with the wind, where the surface is ruffled and reflects a softer sky. These
 *   last at any distance: far off a pool is not one flat colour. (It was: the only variation was
 *   the ripples, faded out past 120 m, and the depth, taken by one number for all colours, left the
 *   whole pool one pale jade.)
 * - Middle distance: soft ripples carried along the flow (a flow map: two layers half a cycle
 *   apart, each faded as it resets, carried no faster than CARRY), their height from the speed
 *   (near still over the deep middle, livelier toward the outlets); waves from where water lands;
 *   each ripple's face a little lighter turned toward the sun; one soft sun highlight.
 * - Near: finer ripples, and the floor's caustics through shallow water, shifted by the refraction.
 *
 * Where water lands: rings spread out from the line it lands along (not from a point: a wide fall
 * made arcs), two wavelengths at deep water's own speeds, their phase and spacing jittered along
 * the line, dying out over a few metres (the first ones ran on, evenly spaced, over the whole pool);
 * a froth along the landing, its edge frayed.
 *
 * The water below the terrace (water.ts) is one sheet at the water's level, running on under the
 * banks: with GROUND, its depth is found per pixel from the ground's own height map (set uHeight,
 * uSize, uTexel), and its shore is where that depth comes to nothing: smooth whatever the mesh.
 */
export const MAX_IMPACTS = 16;

export function createFlowWaterMaterial(uniforms: WorldUniforms, opts: { ground?: boolean } = {}): ShaderMaterial {
  return new ShaderMaterial({
    defines: opts.ground ? { GROUND: '' } : {},
    uniforms: {
      uTime: uniforms.uTime, uSunDir: uniforms.uSunDir, uSkyTop: uniforms.uSkyTop, uSkyMid: uniforms.uSkyMid, uSkyHorizon: uniforms.uSkyHorizon,
      uDeep: { value: new Color(PORCELAIN.waterDeep) }, uTint: { value: new Color(PORCELAIN.waterTint) }, uFloor: { value: new Color(PORCELAIN.body) }, uFoam: { value: new Color(PORCELAIN.sheen) },
      uImpactLine: { value: Array.from({ length: MAX_IMPACTS }, () => new Vector4()) },
      uImpactInfo: { value: Array.from({ length: MAX_IMPACTS }, () => new Vector4()) },
      uImpactCount: { value: 0 },
      uHeight: { value: null as Texture | null }, uSize: { value: 2 }, uTexel: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aDepth;
      attribute vec2 aFlow;
      varying float vDepth;
      varying vec2 vFlow;
      varying vec3 vWorld;
      void main() {
        vDepth = aDepth;
        vFlow = aFlow;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir, uSkyTop, uSkyMid, uSkyHorizon, uDeep, uTint, uFloor, uFoam;
      uniform vec4 uImpactLine[${MAX_IMPACTS}]; // the line it lands along: x0, z0, x1, z1
      uniform vec4 uImpactInfo[${MAX_IMPACTS}]; // metres it stirs over, strength (0 to 1), wavelength, seed
      uniform int uImpactCount;
      varying float vDepth;
      varying vec2 vFlow;
      varying vec3 vWorld;
      #ifdef GROUND
      uniform sampler2D uHeight;
      uniform float uSize, uTexel;
      // The ground's height, bilinear by hand (as the ground's own shader: cdlod.ts).
      float groundAt(vec2 p) {
        vec2 g = clamp(p / uTexel + 0.5 * (uSize - 1.0), 0.0, uSize - 1.0);
        vec2 i = min(floor(g), uSize - 2.0), f = g - i;
        ivec2 c = ivec2(i);
        float a = texelFetch(uHeight, c, 0).x, b = texelFetch(uHeight, c + ivec2(1, 0), 0).x;
        float d = texelFetch(uHeight, c + ivec2(0, 1), 0).x, e = texelFetch(uHeight, c + ivec2(1, 1), 0).x;
        return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
      }
      // Shore silhouette only. A 1 m height texel makes the raw waterline a staircase; averaging
      // the bank over ~2 m rounds that contour. Opacity stays a pixel wide (fwidth below) — this
      // is not a coloured halo.
      float groundShore(vec2 p) {
        float s = uTexel * 2.0;
        float h = groundAt(p) * 1.6;
        h += groundAt(p + vec2(s, 0.0)) + groundAt(p - vec2(s, 0.0));
        h += groundAt(p + vec2(0.0, s)) + groundAt(p - vec2(0.0, s));
        h += 0.65 * (groundAt(p + vec2(s, s)) + groundAt(p + vec2(-s, s)) + groundAt(p + vec2(s, -s)) + groundAt(p + vec2(-s, -s)));
        return h / (1.6 + 4.0 + 2.6);
      }
      #endif
      const float CYCLE = 2.0; // seconds a layer of ripples is carried before it resets
      const float SCALE = 0.45; // ripples per metre, about
      const float CARRY = 0.7; // m/s: the fastest the ripples are carried
      const vec2 WIND = vec2(0.8, 0.6); // the way the broad patches drift
      // An integer hash of a lattice point: exact. (fract(sin(x) × 43758) gave a corner two values,
      // computed in two neighbouring cells with the rounding the compiler chose at each: every
      // cell's edge a seam, the ripples a grid of squares.)
      float hash(vec2 c) {
        uvec2 q = uvec2(ivec2(c)) * uvec2(1597334673u, 3812015801u);
        uint n = (q.x ^ q.y) * 1597334673u;
        return float(n) * (1.0 / 4294967295.0);
      }
      // Value noise with a quintic fade: its slope runs on smoothly across the cells' edges.
      float noise(vec2 p) {
        vec2 c = floor(p), f = fract(p), w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        return mix(mix(hash(c), hash(c + vec2(1.0, 0.0)), w.x), mix(hash(c + vec2(0.0, 1.0)), hash(c + vec2(1.0, 1.0)), w.x), w.y);
      }
      // Gradient noise (Perlin's), for the surface's slopes: value noise's slope lines up with its
      // lattice, and the lit ripples showed it as a grid of squares.
      vec2 gradAt(vec2 c) { float a = 6.2832 * hash(c); return vec2(cos(a), sin(a)); }
      float gnoise(vec2 p) {
        vec2 c = floor(p), f = fract(p), w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        float a = dot(gradAt(c), f), b = dot(gradAt(c + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
        float d = dot(gradAt(c + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), e = dot(gradAt(c + vec2(1.0)), f - vec2(1.0));
        return mix(mix(a, b, w.x), mix(d, e, w.x), w.y);
      }
      vec2 slopeOf(vec2 p) {
        const float e = 0.1;
        float c = gnoise(p);
        return vec2(gnoise(p + vec2(e, 0.0)) - c, gnoise(p + vec2(0.0, e)) - c) / e;
      }
      // The flow's ripples: carried along it, broad (and, near, a finer octave turned off the axes).
      vec2 ripples(vec2 p, float fine) {
        return slopeOf(p) + fine * 0.45 * slopeOf(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.3 + 5.2);
      }
      vec3 skyAt(float up) {
        return mix(mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.25, up)), uSkyTop, smoothstep(0.25, 1.0, up));
      }
      void main() {
        vec3 toEye = cameraPosition - vWorld;
        float dist = length(toEye);
        vec3 v = toEye / dist;
        #ifdef GROUND
        // Colour/depth follow the true bed. The silhouette follows a rounded bank so the 1 m
        // mesh stair is not the visible outline. Pull the cut *inside* that shore (not past −aa):
        // edge cells whose level sits a few cm above groundShore otherwise draw as pale jagged
        // fragments on the dry bank (probe-shore-band: up to ~20 cm overhang, stairShare ~0.6).
        float depth = vWorld.y - groundAt(vWorld.xz);
        float edgeD = vWorld.y - groundShore(vWorld.xz);
        float aa = max(fwidth(edgeD) * 1.6, 0.012);
        float pull = max(aa * 2.5, 0.08);
        if (edgeD < pull) discard;
        #else
        float depth = vDepth;
        float edgeD = depth;
        float aa = 0.02;
        float pull = 0.0;
        #endif
        float nearW = 1.0 - smoothstep(12.0, 45.0, dist);
        float midW = 1.0 - smoothstep(50.0, 220.0, dist);
        float speed = length(vFlow);
        vec2 p = vWorld.xz;

        // Where water lands: rings out from the line, jittered, dying out; a stir settling with distance.
        float stir = 0.0;
        vec2 rings = vec2(0.0);
        for (int i = 0; i < ${MAX_IMPACTS}; i++) {
          if (i >= uImpactCount) break;
          vec4 line = uImpactLine[i], info = uImpactInfo[i];
          vec2 a = line.xy, ab = line.zw - line.xy;
          float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          vec2 d = p - (a + ab * h);
          float r = length(d);
          if (r > info.x * 5.0) continue;
          vec2 out_ = d / max(r, 1e-3);
          stir = max(stir, info.y * exp(-r / info.x));
          // Jittered: the distance bent by noise over the water (so the rings are not even), and their
          // strength in patches along the line and drifting.
          float rr = r + 2.2 * gnoise(p * 0.3 + info.w) + 0.8 * gnoise(p * 0.9 - info.w);
          float k1 = 6.2832 / info.z, k2 = k1 * 1.6;
          float w1 = sqrt(9.81 * k1), w2 = sqrt(9.81 * k2);
          float env = info.y * exp(-r / info.x) * smoothstep(0.0, 1.0, r) * (0.35 + 0.9 * noise(vec2(h * length(ab) * 0.25 + info.w, uTime * 0.3)));
          float s1 = k1 * rr - w1 * uTime, s2 = k2 * rr - w2 * uTime + info.w;
          rings += out_ * env * (0.6 * k1 * sin(s1) + 0.4 * k2 * sin(s2)) * 0.02;
        }
        rings *= midW;

        // The flow's ripples (a flow map); near an outlet, drawn out along the flow.
        // (Carried at most CARRY m/s: where the speed changes over a few metres, as below a fall, a
        // faster carry smeared the ripples into threads within a cycle.)
        vec2 dir = speed > 1e-3 ? vFlow / speed : vec2(1.0, 0.0);
        vec2 carry = dir * min(speed, CARRY);
        float p0 = fract(uTime / CYCLE), p1 = fract(uTime / CYCLE + 0.5), w0 = 1.0 - abs(1.0 - 2.0 * p0);
        vec2 q0 = (p - carry * p0 * CYCLE) * SCALE, q1 = (p - carry * p1 * CYCLE) * SCALE + vec2(3.7, 1.9);
        // The same in every direction. (Drawn out along the flow, the noise's coordinates were turned
        // by each pixel's own direction: a small turn of the flow sheared them by metres, and the
        // ripples tore into creases and threads, the oily film again.)
        vec2 g = ripples(q0, nearW) * w0 + ripples(q1, nearW) * (1.0 - w0);
        float height = (0.02 + 0.08 * smoothstep(0.15, 1.4, speed) + 0.2 * stir) * midW;
        // The broad patches, at any distance: their own gentle tilt, and how ruffled each is.
        vec2 b = p / 38.0 + WIND * uTime * 0.012;
        float ruffle = smoothstep(0.35, 0.75, noise(b) * 0.7 + noise(b * 2.7 + 3.1) * 0.3);
        vec2 tilt = g * height + rings + slopeOf(b) * 0.05;
        vec3 n = normalize(vec3(-tilt.x, 1.0, -tilt.y));

        // Colour: the floor through the water, red absorbed first, over a path down and back up
        // (longer seen low); deep water's own colour where little of the floor comes back. Near, the
        // floor's caustics, shifted by the refraction.
        float path = depth * (1.0 + 1.0 / max(v.y, 0.5));
        vec3 through = pow(uTint, vec3(path));
        vec2 bent = p + n.xz * depth * 1.5;
        float caustic = pow(1.0 - min(abs(2.5 * gnoise(bent * 0.9 + uTime * 0.15)), 1.0), 5.0) * pow(1.0 - min(abs(2.5 * gnoise(bent * 1.3 - uTime * 0.1 + 4.0)), 1.0), 3.0);
        float floorLight = 0.95 + 0.6 * caustic * nearW * (1.0 - smoothstep(0.2, 1.4, depth));
        vec3 body = uFloor * floorLight * through + uDeep * (vec3(1.0) - through);
        // The sky: its colour mostly from the flat surface (seen low, each ripple's own reflection
        // dipped to the warm horizon: flecks of gold), softer where ruffled.
        vec3 r = reflect(-v, n);
        float up = max(mix(reflect(-v, vec3(0.0, 1.0, 0.0)).y, r.y, 0.25), 0.0);
        vec3 sky = mix(skyAt(up), mix(uSkyMid, uSkyTop, 0.4), ruffle * 0.45);
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        // Each ripple's face a little lighter turned to the sun, darker turned away (soft: the sky's
        // colour from the flat surface leaves the ripples to this and the Fresnel).
        vec2 sunAcross = normalize(uSunDir.xz + vec2(1e-4));
        body *= 1.0 - 4.0 * dot(tilt, sunAcross);
        vec3 colour = mix(body, sky, fresnel * (1.0 - 0.25 * ruffle));
        colour += vec3(1.0) * 0.3 * pow(max(dot(r, normalize(uSunDir)), 0.0), 120.0) * (1.0 - stir) * midW;
        // White water: a froth along a landing (its edge frayed), and where it runs fast.
        float blot = 0.5 + 0.9 * (gnoise((p - carry * p0 * CYCLE) * 1.2) * w0 + gnoise((p - carry * p1 * CYCLE) * 1.2 + 4.1) * (1.0 - w0));
        float froth = smoothstep(0.3, 0.85, stir + 0.3 * (blot - 0.5));
        float white = clamp(0.85 * froth + smoothstep(1.4, 2.4, speed) * smoothstep(0.6, 0.85, blot) * 0.6, 0.0, 0.85) * midW;
        colour = mix(colour, uFoam, white);
        float shore = smoothstep(pull, pull + aa * 2.5, edgeD);
        float alpha = mix(0.55, 1.0, 1.0 - through.g) * shore;
        alpha = max(alpha, white * shore);
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(colour, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: !opts.ground,
    polygonOffset: !!opts.ground,
    polygonOffsetFactor: opts.ground ? -1.5 : 0,
    polygonOffsetUnits: opts.ground ? -2 : 0,
  });
}

/** Where water lands, for the shader: the line it lands along, how far it stirs, how hard. */
export function setImpacts(material: ShaderMaterial, impacts: { flow: number; drop: number; spread: number; ends: [number, number, number, number] }[]) {
  const lines = material.uniforms.uImpactLine.value as Vector4[], infos = material.uniforms.uImpactInfo.value as Vector4[];
  const sorted = [...impacts].sort((a, b) => b.flow * b.drop - a.flow * a.drop).slice(0, MAX_IMPACTS);
  sorted.forEach((im, i) => {
    const energy = Math.sqrt(im.flow * im.drop); // as the falling water's power, roughly
    const strength = Math.min(Math.max(energy / 6, 0.15), 1);
    lines[i].set(...im.ends);
    // Metres it stirs over (a few, more for a heavier fall), its wavelength (longer for a heavier
    // fall), a seed for its jitter.
    infos[i].set(1.2 + 1.6 * strength, strength, 0.9 + 0.9 * strength, i * 1.7);
  });
  material.uniforms.uImpactCount.value = sorted.length;
}
