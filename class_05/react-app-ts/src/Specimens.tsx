import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DoubleSide, IcosahedronGeometry, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { GLAZE, GLOW, PEARL } from './shaders';

export type SpecimenId = 'glaze' | 'pearl' | 'glow';

/** Cheap smooth 3D noise for shaping the rock once on the CPU. */
function lumpy(x: number, y: number, z: number) {
  return Math.sin(x * 2.1 + Math.cos(z * 1.7)) * 0.5 + Math.sin(y * 2.7 + x) * 0.3 + Math.sin(z * 3.3 - y * 1.3) * 0.2;
}

function rockGeometry() {
  // Weld the icosahedron's corners first so the stone shades smoothly instead of in facets.
  const g = mergeVertices(new IcosahedronGeometry(1, 6));
  const p = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // A taller, lumpier stone: a scholar's rock more than a ball.
    const k = 1 + 0.3 * lumpy(v.x, v.y, v.z) + 0.12 * lumpy(v.x * 2.6 + 3, v.y * 2.6, v.z * 2.6 - 1);
    v.multiplyScalar(k);
    v.y *= 1.45;
    v.x += 0.25 * Math.sin(v.y * 1.6); // a gentle lean, like a scholar's rock
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** One petal: wide in the middle, cupped across, curling back at the tip, with a frilled edge. */
function petalGeometry(length: number) {
  const g = new PlaneGeometry(1, 1, 12, 20);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2; // −1..1 across
    const v = p.getY(i) + 0.5; // 0..1 along
    const w = Math.pow(Math.sin(Math.PI * Math.min(v * 1.05, 1)), 0.7) * 0.45;
    const x = u * w * length;
    const y = v * length;
    const z = 0.25 * u * u * w * length - 0.35 * v * v * length + 0.04 * Math.sin(v * 22) * Math.abs(u) * length;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

type Uniforms = Record<string, { value: unknown }>;

/** Shader material props for one mesh; uniforms are then updated every frame through a ref. */
const shader = (src: { vertex: string; fragment: string }, uniforms: Uniforms, doubleSide = false) => ({
  args: [{ vertexShader: src.vertex, fragmentShader: src.fragment, uniforms, side: doubleSide ? DoubleSide : undefined }] as const,
});

export function Glaze({ power, rim, mask }: { power: number; rim: number; mask: boolean }) {
  const geo = useMemo(() => rockGeometry(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mesh = useRef<Mesh>(null);
  const mat = useRef<ShaderMaterial>(null);
  const args = useMemo(() => shader(GLAZE, { uPower: { value: 2 }, uRim: { value: 1 }, uMask: { value: 0 }, uLight: { value: new Vector3(2, 3, 2) } }), []);
  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.25;
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uPower.value = power;
    u.uRim.value = rim;
    u.uMask.value = mask ? 1 : 0;
  });
  return (
    <mesh ref={mesh} geometry={geo}>
      <shaderMaterial ref={mat} {...args} />
    </mesh>
  );
}

export function Pearl({ film, irid, back, mask }: { film: number; irid: number; back: number; mask: boolean }) {
  const outer = useMemo(() => petalGeometry(1.5), []);
  const inner = useMemo(() => petalGeometry(1.0), []);
  // Every petal gets its own material but they all share one uniforms object, so one update moves all.
  const args = useMemo(() => shader(PEARL, { uFilm: { value: 1 }, uIrid: { value: 1 }, uBack: { value: 1 }, uMask: { value: 0 }, uLight: { value: new Vector3(2, 1.2, 0) } }, true), []);
  const mat = useRef<ShaderMaterial>(null);
  // The light circles the flower, so the colours slide across the petals.
  useFrame(({ clock }) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const t = clock.elapsedTime * 0.4;
    u.uFilm.value = film;
    u.uIrid.value = irid;
    u.uBack.value = back;
    u.uMask.value = mask ? 1 : 0;
    (u.uLight.value as Vector3).set(Math.cos(t) * 2, 1.2, Math.sin(t) * 2);
  });
  const petal = (geo: PlaneGeometry, tilt: number) => (
    <mesh geometry={geo} rotation-x={-tilt}>
      <shaderMaterial ref={mat} {...args} />
    </mesh>
  );
  const ring = (count: number, tilt: number, geo: PlaneGeometry, offset: number) =>
    Array.from({ length: count }, (_, i) => (
      <group key={i} rotation-y={(i / count) * Math.PI * 2 + offset}>
        {petal(geo, tilt)}
      </group>
    ));
  return (
    <group position-y={-0.3}>
      {ring(7, 1.15, outer, 0)}
      {ring(5, 0.55, inner, 0.4)}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <group key={i} rotation={[Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35]}>
            <mesh position-y={0.35}>
              <cylinderGeometry args={[0.012, 0.015, 0.7, 5]} />
              <meshStandardMaterial color="#f0d8a0" />
            </mesh>
            <mesh position-y={0.72}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color="#ffd27a" emissive="#ffb84d" emissiveIntensity={0.6} />
            </mesh>
          </group>
        );
      })}
      <mesh position-y={-1.2}>
        <cylinderGeometry args={[0.04, 0.06, 2.2, 6]} />
        <meshStandardMaterial color="#6f8452" />
      </mesh>
    </group>
  );
}

export function Glow({ glow, waves, mask }: { glow: number; waves: number; mask: boolean }) {
  const geo = useMemo(() => new PlaneGeometry(90, 90, 220, 220), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useRef<ShaderMaterial>(null);
  const args = useMemo(() => shader(GLOW, { uTime: { value: 0 }, uGlow: { value: 1 }, uWaves: { value: 1 }, uMask: { value: 0 }, uTouch: { value: new Vector3() }, uTouchTime: { value: -100 } }), []);
  const last = useRef(-100);
  const touch = (x: number, z: number, t: number) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    (u.uTouch.value as Vector3).set(x, 0, z);
    u.uTouchTime.value = t;
    last.current = t;
  };
  useFrame(({ clock }) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uGlow.value = glow;
    u.uWaves.value = waves;
    u.uMask.value = mask ? 1 : 0;
    // When nobody touches the sea, a fish breaks the surface now and then.
    if (t - last.current > 3.5) touch(Math.sin(t * 1.3) * 12, Math.cos(t * 0.7) * 8 + 4, t);
  });
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const t = (mat.current?.uniforms.uTime.value as number) ?? 0;
    if (t - last.current > 0.6) touch(e.point.x, e.point.z, t);
  };
  return (
    <group>
      <mesh geometry={geo} rotation-x={-Math.PI / 2} onPointerMove={onMove}>
        <shaderMaterial ref={mat} {...args} />
      </mesh>
      {[[-9, -3, 0.6, 2.4], [-13, 2, 0.4, 1.8], [10, -6, 0.5, 2.0]].map(([x, z, y, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={[s, s * 0.8, s]}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#141a20" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
