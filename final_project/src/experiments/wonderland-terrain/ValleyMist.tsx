import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial, Vector2 } from 'three';
import { createRng } from '../../core/rng';
import type { FallMesh } from '../../core/terrain/fallMesh';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import type { PoolNode } from './terrace';

/**
 * Mist where the water makes it (far-view study, round 5: docs/plan-2026-11-19-far-view.md): spray
 * at the foot of each fall, sized by its drop, and a thin breath over the pools. Not a ring of fog
 * round the island: mist that stays where it belongs marks the water from afar without washing
 * the mountains' contrast out. Soft puffs facing the eye, drifting up; one draw call. Fades in
 * with distance like the rest of the far detail, so close up the falls are as they were.
 */
export function ValleyMist({ uniforms, falls, pools, plunge, floor, seed, range }: {
  uniforms: WorldUniforms;
  falls: FallMesh[];
  pools: PoolNode[];
  plunge: { x: number; z: number; radius: number; level: number };
  /** The island's lowest ground: a fall landing below it has left the island (into the cloud). */
  floor: number;
  seed: number;
  /** Where it begins and where it is full, metres (as the ground's far detail). */
  range: [number, number];
}) {
  const geometry = useMemo(() => {
    const rand = createRng(seed + 211);
    const sites: [number, number, number, number, number][] = []; // x, y, z, radius, strength
    for (const f of falls) {
      if (!(f.drop > 1.5) || f.landing[1] < floor - 2) continue; // too small to raise spray, or off the island's edge
      const r = Math.min(10 + f.drop * 0.55, 45);
      sites.push([f.landing[0], f.landing[1], f.landing[2], r, Math.min(0.35 + f.drop / 60, 0.85)]);
    }
    if (plunge.radius > 0) sites.push([plunge.x, plunge.level, plunge.z, plunge.radius * 1.6, 0.5]);
    for (const p of pools) sites.push([p.centre[0], p.level, p.centre[1], 14, 0.3]);
    const centre: number[] = [], corner: number[] = [], shape: number[] = [];
    const quad = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (const [x, y, z, r, s] of sites) {
      const puffs = r > 20 ? 4 : 3;
      for (let i = 0; i < puffs; i++) {
        const a = rand() * Math.PI * 2, d = rand() * r * 0.5, size = r * (0.55 + rand() * 0.4);
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = y + size * 0.35 + rand() * r * 0.2;
        const phase = rand() * 100;
        for (const [u, v] of quad) {
          centre.push(px, py, pz);
          corner.push(u, v);
          shape.push(size, s * (0.7 + rand() * 0.3), phase);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(centre, 3));
    g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
    g.setAttribute('aShape', new Float32BufferAttribute(shape, 3));
    return g;
  }, [falls, pools, plunge, floor, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: uniforms.uTime, uColor: uniforms.uSkyHorizon, uRange: { value: new Vector2(60, 200) } },
    vertexShader: /* glsl */ `
      attribute vec2 aCorner; attribute vec3 aShape;
      uniform float uTime; uniform vec2 uRange;
      varying vec2 vUv; varying float vAlpha; varying float vPhase;
      void main() {
        // A slow rise and fall, each puff on its own beat; the quad turned to the eye.
        vec3 c = position + vec3(0.0, sin(uTime * 0.07 + aShape.z) * aShape.x * 0.08, 0.0);
        vec4 view = modelViewMatrix * vec4(c, 1.0);
        view.xy += aCorner * aShape.x;
        gl_Position = projectionMatrix * view;
        vUv = aCorner; vPhase = aShape.z;
        vAlpha = aShape.y * smoothstep(uRange.x, uRange.y, length(view.xyz));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying float vAlpha; varying float vPhase;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float r = length(vUv);
        if (r > 1.0 || vAlpha < 0.002) discard;
        vec2 q = vUv * 1.6 + vec2(vPhase, uTime * 0.02);
        float puff = vn(q * 1.5) * 0.65 + vn(q * 3.7 + 7.0) * 0.35;
        float a = (1.0 - smoothstep(0.2, 1.0, r)) * smoothstep(0.25, 0.7, puff) * vAlpha;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.9), a);
      }`,
  }), [uniforms]);
  useEffect(() => { (material.uniforms.uRange.value as Vector2).set(range[0] * 0.6, range[1] * 0.6); }, [material, range]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} renderOrder={4} frustumCulled={false} raycast={() => {}} />;
}
