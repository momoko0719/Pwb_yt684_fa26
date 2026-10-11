import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ISLAND, VARIANTS, type Island, type TreeSpot } from './world/island';
import { LODS, type Lod, type TreeMesh } from './world/lod';

export const PAPER = '#efe8d8';
const TINTS: Record<Lod, string> = { 0: '#c0392b', 1: '#d19a3a', 2: '#3a6ea5' };

function treeMaterial(lod: Lod) {
  return new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, emissive: new Color(TINTS[lod]), emissiveIntensity: 0 });
}

export type View = Lod | 'compare';

/** One tree on a paper disc; the hanging vine gets a floating rock to hang from. */
export function TreeScene({ meshes, view, vine, frameKey }: { meshes: TreeMesh[]; view: View; vine: boolean; frameKey: string }) {
  const materials = useMemo(() => LODS.map(treeMaterial), []);
  const radius = meshes[0].geometry.boundingSphere?.radius ?? 5;
  const center = meshes[0].geometry.boundingSphere?.center ?? new Vector3();
  const gap = radius * 2.1;
  const shown = view === 'compare' ? LODS : [view];
  useFrameCamera(frameKey, center, radius * (view === 'compare' ? 4.2 : 2.8), view === 'compare');

  return (
    <>
      {!vine && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
          <circleGeometry args={[view === 'compare' ? gap * 2 : radius * 1.2, 48]} />
          <meshStandardMaterial color="#e2d9c4" roughness={1} />
        </mesh>
      )}
      {shown.map((lod) => {
        const x = view === 'compare' ? (lod - 1) * gap : 0;
        return (
          <group key={lod} position-x={x}>
            {vine && (
              <mesh position-y={1.2} scale={[3.2, 1.6, 2.6]}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color="#6f6b63" flatShading roughness={1} />
              </mesh>
            )}
            <mesh geometry={meshes[lod].geometry} material={materials[lod]} />
            {view === 'compare' && (
              <Html position={[0, vine ? 3.5 : center.y + radius * 1.05, 0]} center className="label">
                LOD{lod} · {meshes[lod].triangles.toLocaleString()} △
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

/** Re-frame the camera when the tree (or the comparison) changes shape a lot, not on every slider move. */
function useFrameCamera(key: string, center: Vector3, distance: number, front: boolean) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const last = useRef('');
  useEffect(() => {
    if (!controls || last.current === key) return;
    last.current = key;
    controls.target.copy(center);
    const dir = (front ? new Vector3(0, 0.3, 1) : new Vector3(1, 0.45, 1)).normalize();
    controls.object.position.copy(center).addScaledVector(dir, distance);
    controls.update();
  }, [controls, key, center, distance, front]);
}

export interface ForestStats {
  fps: number;
  triangles: number;
  perLod: [number, number, number];
}

/**
 * The forest: one InstancedMesh per (variant, LOD). Every frame each tree measures its distance to
 * the camera and is written into the instance list of the level it needs; nothing is rebuilt.
 */
export function ForestScene(props: {
  island: Island;
  spots: TreeSpot[];
  meshes: TreeMesh[][]; // [variant][lod]
  lodOn: boolean;
  tint: boolean;
  near: number;
  far: number;
  onStats: (s: ForestStats) => void;
}) {
  const { island, spots, meshes, lodOn, tint, near, far, onStats } = props;
  const materials = useMemo(() => LODS.map(treeMaterial), []);
  useEffect(() => materials.forEach((m) => (m.emissiveIntensity = tint ? 0.6 : 0)), [materials, tint]);

  const refs = useRef<(InstancedMesh | null)[]>([]);
  const capacity = useMemo(() => {
    const c = Array(VARIANTS).fill(0);
    for (const s of spots) c[s.variant]++;
    return c as number[];
  }, [spots]);
  const matrices = useMemo(
    () => spots.map((s) => new Matrix4().compose(new Vector3(s.x, s.y, s.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), s.yaw), new Vector3(s.scale, s.scale, s.scale))),
    [spots],
  );

  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: 0, frames: 0 });
  useFrame(({ camera }, dt) => {
    const counts = Array.from({ length: VARIANTS * 3 }, () => 0);
    const perLod: [number, number, number] = [0, 0, 0];
    const cam = camera.position;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const d = Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z);
      const lod: Lod = !lodOn ? 0 : d > far ? 2 : d > near ? 1 : 0;
      const k = s.variant * 3 + lod;
      refs.current[k]?.setMatrixAt(counts[k]++, matrices[i]);
      perLod[lod]++;
    }
    refs.current.forEach((m, k) => {
      if (!m) return;
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
    });
    acc.current.t += dt;
    acc.current.frames++;
    if (acc.current.t > 0.5) {
      onStats({ fps: Math.round(acc.current.frames / acc.current.t), triangles: gl.info.render.triangles, perLod });
      acc.current = { t: 0, frames: 0 };
    }
  });

  return (
    <>
      <Ground island={island} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.4}>
        <planeGeometry args={[ISLAND * 4, ISLAND * 4]} />
        <meshStandardMaterial color="#dcd6c6" roughness={1} />
      </mesh>
      {meshes.map((byLod, v) =>
        byLod.map((m, lod) => (
          <instancedMesh
            key={`${v}-${lod}-${spots.length}`}
            ref={(r) => void (refs.current[v * 3 + lod] = r)}
            args={[m.geometry, materials[lod], Math.max(1, capacity[v])]}
            frustumCulled={false}
          />
        )),
      )}
    </>
  );
}

function Ground({ island }: { island: Island }) {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(ISLAND * 1.2, ISLAND * 1.2, 160, 160);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    const colors: number[] = [];
    const low = new Color('#e6dcc4'), high = new Color('#a59d8d'), c = new Color();
    for (let i = 0; i < p.count; i++) {
      const y = island.heightAt(p.getX(i), p.getZ(i));
      p.setY(i, y);
      c.copy(low).lerp(high, Math.min(Math.max(y / 60, 0), 1));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [island]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={1} flatShading />
    </mesh>
  );
}
