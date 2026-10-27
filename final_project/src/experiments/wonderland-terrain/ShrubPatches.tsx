import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type ShaderMaterial } from 'three';
import { PORCELAIN } from '../../core/palette';
import { createPineMaterial } from '../../core/shaders/pine';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { SHRUB_LOD, SHRUB_VARIANTS, type Shrub, type ShrubTone } from './shrubs';
import { makeShrubLods, shrubLeafMetrics } from './shrubLSystem';

const UP = new Vector3(0, 1, 0);
const REBUCKET = 0.2;
const MOVE = 4;
const HYST = 8;
const [NEAR, MID] = SHRUB_LOD;

const TONE_PAIR: Record<ShrubTone, [string, string]> = {
  0: [PORCELAIN.shrub, PORCELAIN.shrubShade],
  1: [PORCELAIN.shrubOchre, PORCELAIN.shrubOchreShade],
  2: [PORCELAIN.shrubRed, PORCELAIN.shrubRedShade],
};

function applyTone(mat: ShaderMaterial, tone: ShrubTone) {
  const [hi, lo] = TONE_PAIR[tone];
  (mat.uniforms.uNeedle.value as Color).set(hi);
  (mat.uniforms.uNeedleShade.value as Color).set(lo);
  (mat.uniforms.uBark.value as Color).set(PORCELAIN.pineBark);
}

/**
 * Instanced shrubs: L-system branch mesh (pine turtle/tube/aTone pattern) with distance LOD.
 * One material recipe (createPineMaterial + rimLight); colours set per tone bucket.
 */
export function ShrubPatches({ plants, uniforms }: { plants: Shrub[]; uniforms: WorldUniforms }) {
  const shapes = useMemo(() => Array.from({ length: SHRUB_VARIANTS }, (_, v) => makeShrubLods(v)), []);
  useEffect(() => () => {
    for (const s of shapes) { s.near.dispose(); s.mid.dispose(); s.far.dispose(); }
  }, [shapes]);

  // One material per tone so instance colours stay the patch's class (not mixed in one draw).
  const materials = useMemo(() => {
    const mk = (tone: ShrubTone) => {
      const m = createPineMaterial(uniforms);
      applyTone(m, tone);
      m.uniforms.uSnow.value = 0;
      return m;
    };
    return [mk(0), mk(1), mk(2)] as ShaderMaterial[];
  }, [uniforms]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  const matrices = useMemo(() => {
    const arr = new Float32Array(plants.length * 16);
    const m = new Matrix4(), q = new Quaternion(), pos = new Vector3(), scale = new Vector3();
    plants.forEach((p, i) => {
      m.compose(
        pos.set(p.x, p.y, p.z),
        q.setFromAxisAngle(UP, p.yaw),
        // Uniform crown in XZ — the old 0.85 Z squash made every plant read as a flat V.
        scale.set(p.height * p.width, p.height, p.height * p.width),
      ).toArray(arr, i * 16);
    });
    return arr;
  }, [plants]);

  const group = useMemo(() => {
    const root = new Group();
    const n = Math.max(plants.length, 1);
    const make = (g: BufferGeometry, mat: ShaderMaterial) => {
      const mesh = new InstancedMesh(g, mat, n);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.raycast = () => {};
      mesh.userData.orbitIgnore = true;
      return mesh;
    };
    // Buckets: [lod 0|1|2][variant][tone]
    const near = shapes.map((s) => materials.map((mat) => make(s.near, mat)));
    const mid = shapes.map((s) => materials.map((mat) => make(s.mid, mat)));
    const far = shapes.map((s) => materials.map((mat) => make(s.far, mat)));
    for (const band of [near, mid, far]) for (const byTone of band) root.add(...byTone);
    return { root, near, mid, far };
  }, [plants.length, shapes, materials]);

  useEffect(() => () => {
    for (const band of [group.near, group.mid, group.far]) {
      for (const byTone of band) byTone.forEach((m) => m.dispose());
    }
  }, [group]);

  const band = useRef<Uint8Array | null>(null);
  const last = useRef({ at: -Infinity, x: Infinity, z: Infinity });

  useFrame(({ camera, clock }) => {
    const { x, z } = camera.position;
    if (clock.elapsedTime - last.current.at < REBUCKET && Math.hypot(x - last.current.x, z - last.current.z) < MOVE) return;
    last.current = { at: clock.elapsedTime, x, z };
    if (!band.current || band.current.length !== plants.length) band.current = new Uint8Array(plants.length);
    const counts = [
      Array.from({ length: SHRUB_VARIANTS }, () => [0, 0, 0]),
      Array.from({ length: SHRUB_VARIANTS }, () => [0, 0, 0]),
      Array.from({ length: SHRUB_VARIANTS }, () => [0, 0, 0]),
    ];
    const cy = camera.position.y;
    const into = (mesh: InstancedMesh, slot: number, i: number) => {
      (mesh.instanceMatrix.array as Float32Array).set(matrices.subarray(i * 16, i * 16 + 16), slot * 16);
    };
    plants.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - cy, p.z - z);
      let b = band.current![i];
      if (b === 0) {
        if (d > NEAR + HYST) b = d < MID + HYST ? 1 : 2;
      } else if (b === 1) {
        if (d < NEAR - 2) b = 0;
        else if (d > MID + HYST) b = 2;
      } else if (d < MID - 2) b = d < NEAR ? 0 : 1;
      band.current![i] = b;
      const slot = counts[b][p.variant][p.tone]++;
      const mesh = (b === 0 ? group.near : b === 1 ? group.mid : group.far)[p.variant][p.tone];
      into(mesh, slot, i);
    });
    for (let b = 0; b < 3; b++) {
      const meshes = b === 0 ? group.near : b === 1 ? group.mid : group.far;
      meshes.forEach((byTone, v) => byTone.forEach((mesh, t) => {
        mesh.count = counts[b][v][t];
        mesh.instanceMatrix.needsUpdate = true;
      }));
    }
  });

  return <primitive object={group.root} />;
}

export function makeShrubPreviewGeometry(variant = 0, tone: ShrubTone = 0): {
  geometry: BufferGeometry;
  tone: ShrubTone;
  metrics: ReturnType<typeof shrubLeafMetrics>;
  disposeExtra: () => void;
} {
  const lods = makeShrubLods(variant);
  return {
    geometry: lods.near,
    tone,
    metrics: shrubLeafMetrics(0.8, 1.5),
    disposeExtra: () => { lods.mid.dispose(); lods.far.dispose(); },
  };
}

export function shrubToneColors(tone: ShrubTone): [string, string] {
  return TONE_PAIR[tone];
}

export function shrubLodTriCounts(variant = 0) {
  return makeShrubLods(variant).tris;
}
