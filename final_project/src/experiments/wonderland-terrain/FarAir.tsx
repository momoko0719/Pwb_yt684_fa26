import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, MeshBasicMaterial, NormalBlending, ShaderMaterial, Vector3 } from 'three';
import { FAR_STYLE } from '../../core/palette';
import { createRng } from '../../core/rng';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import type { IslandBox } from './Exhibit';

/**
 * The air around the island (far-view study, step 4: docs/plan-2026-11-19-far-view.md): what makes
 * the space between the eye and the island read as deep, all cheap. Two soft bands of mist that
 * drift round the island at its waist and below it, a small flock of birds circling, and a few far
 * islands, pale with distance, on the horizon. A handful of flat meshes and one small shader.
 */
export function FarAir({ uniforms, box, seed }: { uniforms: WorldUniforms; box: IslandBox; seed: number }) {
  const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
  const r = Math.max(box.maxX - box.minX, box.maxZ - box.minZ) / 2;
  return <group>
    {/* (The band at the island's waist is gone: mist now rises only where the water makes it, ValleyMist.tsx.) */}
    <MistBand uniforms={uniforms} centre={[cx, cz]} y={box.minY + (box.maxY - box.minY) * 0.08} inner={r * 0.55} outer={r * 2.3} strength={0.5} speed={-0.0025} />
    <Flock centre={[cx, cz]} radius={r * 0.9} y={box.maxY * 0.7} seed={seed} />
    <FarIslands uniforms={uniforms} centre={[cx, cz]} seed={seed} y={box.minY * 0.3} />
  </group>;
}

/** A flat ring of mist, thick in the middle of its width, thinning to nothing at both edges, broken by drifting noise. */
function MistBand({ uniforms, centre, y, inner, outer, strength, speed }: { uniforms: WorldUniforms; centre: [number, number]; y: number; inner: number; outer: number; strength: number; speed: number }) {
  const material = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending,
    uniforms: { uTime: uniforms.uTime, uColor: uniforms.uSkyHorizon, uInner: { value: inner }, uOuter: { value: outer }, uStrength: { value: strength }, uSpeed: { value: speed } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uInner, uOuter, uStrength, uSpeed; uniform vec3 uColor; varying vec2 vP;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float d = length(vP), t = (d - uInner) / (uOuter - uInner);
        if (t < 0.0 || t > 1.0) discard;
        float a = atan(vP.y, vP.x) + uTime * uSpeed;
        vec2 q = vec2(cos(a), sin(a)) * d * 0.012;
        float puff = vn(q * 1.0) * 0.6 + vn(q * 2.7 + 3.0) * 0.4;
        float alpha = sin(t * 3.14159) * smoothstep(0.25, 0.75, puff) * uStrength;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.65), alpha);
      }`,
  }), [uniforms, inner, outer, strength, speed]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh position={[centre[0], y, centre[1]]} rotation-x={-Math.PI / 2} material={material} renderOrder={5} raycast={() => {}}>
    <ringGeometry args={[inner, outer, 96, 1]} />
  </mesh>;
}

function wing(side: number) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, side * 0.5, 0.09, -0.34, side * 1.48, 0.02, -0.92, 0, 0, 0, side * 1.48, 0.02, -0.92, side * 0.82, -0.04, -0.44], 3));
  g.computeVertexNormals();
  return g;
}

/** A dozen birds circling the island in loose rings, wings beating; a bird's span about 3 m (seen from far). */
function Flock({ centre, radius, y, seed }: { centre: [number, number]; radius: number; y: number; seed: number }) {
  const left = useMemo(() => wing(-1), []), right = useMemo(() => wing(1), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: new Color(FAR_STYLE.bird), side: DoubleSide, transparent: true, opacity: 0.75, depthWrite: false }), []);
  useEffect(() => () => { left.dispose(); right.dispose(); material.dispose(); }, [left, right, material]);
  const birds = useMemo(() => {
    const rand = createRng(seed + 71);
    return Array.from({ length: 12 }, () => ({ r: radius * (0.8 + rand() * 0.5), h: y + (rand() - 0.5) * 40, speed: 0.025 + rand() * 0.015, phase: rand() * Math.PI * 2, flap: 4 + rand() * 2, size: 1.6 + rand() * 0.8 }));
  }, [seed, radius, y]);
  const refs = useRef<(Group | null)[]>([]);
  const ahead = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = b.phase + t * b.speed;
      g.position.set(centre[0] + Math.cos(a) * b.r, b.h + Math.sin(a * 3) * 3, centre[1] + Math.sin(a) * b.r);
      ahead.set(centre[0] + Math.cos(a + 0.01) * b.r, g.position.y, centre[1] + Math.sin(a + 0.01) * b.r);
      g.lookAt(ahead);
      const f = Math.sin(t * b.flap + i) * 0.5;
      g.children[0].rotation.z = -f; g.children[1].rotation.z = f;
    });
  });
  return <>{birds.map((b, i) => <group key={i} ref={(g) => { refs.current[i] = g; }} scale={b.size}>
    <mesh geometry={left} material={material} raycast={() => {}} />
    <mesh geometry={right} material={material} raycast={() => {}} />
  </group>)}</>;
}

/**
 * Three far islands on the horizon (the other mountains of Guixu): each a low dome over a hanging
 * keel, drawn in the air's own colour a shade deeper, faint, so they read as distance, not objects.
 */
function FarIslands({ uniforms, centre, seed, y }: { uniforms: WorldUniforms; centre: [number, number]; seed: number; y: number }) {
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false, fog: false }), []);
  const deep = useMemo(() => new Color(FAR_STYLE.farIsland), []);
  useFrame(() => { material.color.copy(uniforms.uSkyHorizon.value as Color).lerp(deep, 0.35); });
  useEffect(() => () => material.dispose(), [material]);
  const islands = useMemo(() => {
    const rand = createRng(seed + 113);
    return Array.from({ length: 3 }, (_, i) => ({ a: (i / 3) * Math.PI * 2 + 0.6 + rand() * 1.0, d: 2700 + rand() * 700, s: 70 + rand() * 70, h: 0.35 + rand() * 0.3, lift: (rand() - 0.5) * 160 }));
  }, [seed]);
  return <>{islands.map((o, i) => <group key={i} position={[centre[0] + Math.cos(o.a) * o.d, y + o.lift, centre[1] + Math.sin(o.a) * o.d]} scale={o.s}>
    <mesh material={material} scale={[1, o.h, 1]} raycast={() => {}}><sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    <mesh material={material} position={[0, -0.55, 0]} rotation-x={Math.PI} scale={[0.9, 1.1, 0.9]} raycast={() => {}}><coneGeometry args={[1, 1, 12, 1, true]} /></mesh>
  </group>)}</>;
}
