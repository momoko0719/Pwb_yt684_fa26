import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Plant } from '../../core/generators/forest';
import { PORCELAIN } from '../../core/palette';
import { createPineMaterial } from '../../core/shaders/pine';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { growBroadleaf, type BroadleafKind, type BroadleafKnobs } from './broadleaf';
import { BROADLEAF_VARIANTS } from './woods';

/** Metres: the grown tree within the first, its lighter version beyond (± HYST so it does not flicker). */
export const BROADLEAF_LOD = 150;
const HYST = 12;
const REBUCKET = 0.3, MOVE = 4;
const UP = new Vector3(0, 1, 0);
const COLOURS: Record<BroadleafKind, [string, string]> = {
  parasol: [PORCELAIN.parasolLeaf, PORCELAIN.parasolLeafShade],
  weeping: [PORCELAIN.weepingLeaf, PORCELAIN.weepingLeafShade],
};

/**
 * The broadleaf trees on the island (round 11): parasol trees at the woodland's edge, weeping
 * trees by water (woods.ts growBroadleaves). A few grown variants of each species (broadleaf.ts,
 * the same L-system as the atlas card), instanced; each tree drawn grown up close and lighter
 * (fewer leaves, no fine twigs) beyond BROADLEAF_LOD. Clicking one opens its atlas card.
 */
export function Broadleaves({ parasol, weeping, knobs, uniforms, onPick, onHover }: {
  parasol: Plant[];
  weeping: Plant[];
  /** Knobs saved from the atlas ("apply to island"): every tree of that kind regrows with them. */
  knobs?: Partial<Record<BroadleafKind, BroadleafKnobs>>;
  uniforms: WorldUniforms;
  onPick?: (kind: BroadleafKind) => void;
  onHover?: (hover: boolean) => void;
}) {
  return <>
    <Species kind="parasol" plants={parasol} knobs={knobs?.parasol} uniforms={uniforms} onPick={onPick} onHover={onHover} />
    <Species kind="weeping" plants={weeping} knobs={knobs?.weeping} uniforms={uniforms} onPick={onPick} onHover={onHover} />
  </>;
}

function Species({ kind, plants, knobs, uniforms, onPick, onHover }: { kind: BroadleafKind; plants: Plant[]; knobs?: BroadleafKnobs; uniforms: WorldUniforms; onPick?: (kind: BroadleafKind) => void; onHover?: (hover: boolean) => void }) {
  const material = useMemo(() => {
    const m = createPineMaterial(uniforms);
    (m.uniforms.uNeedle.value as Color).set(COLOURS[kind][0]);
    (m.uniforms.uNeedleShade.value as Color).set(COLOURS[kind][1]);
    (m.uniforms.uBark.value as Color).set(PORCELAIN.broadleafBark);
    return m;
  }, [uniforms, kind]);
  useEffect(() => () => material.dispose(), [material]);
  // The species' variants, each grown near and far (seeds fixed per variant: the same trees every visit).
  const knobKey = JSON.stringify(knobs ?? null);
  const shapes = useMemo(() => Array.from({ length: BROADLEAF_VARIANTS }, (_, v) => ({
    near: growBroadleaf(kind, 1 + v * 3, 0, knobs).geometry,
    far: growBroadleaf(kind, 1 + v * 3, 1, knobs).geometry,
  })), [kind, knobKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => shapes.forEach((s) => { s.near.dispose(); s.far.dispose(); }), [shapes]);
  const matrices = useMemo(() => {
    const out = new Float32Array(plants.length * 16);
    const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3();
    plants.forEach((t, i) => m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(UP, t.yaw), s.setScalar(t.height)).toArray(out, i * 16));
    return out;
  }, [plants]);
  const meshes = useMemo(() => {
    const make = (g: typeof shapes[number]['near']) => {
      const mesh = new InstancedMesh(g, material, Math.max(plants.length, 1));
      mesh.frustumCulled = false;
      mesh.count = 0;
      if (!onPick) mesh.raycast = () => {};
      mesh.userData.orbitIgnore = true;
      return mesh;
    };
    return shapes.map((s) => ({ near: make(s.near), far: make(s.far) }));
  }, [shapes, material, plants.length, Boolean(onPick)]);
  useEffect(() => () => meshes.forEach((m) => { m.near.dispose(); m.far.dispose(); }), [meshes]);

  const last = useRef({ at: -Infinity, x: Infinity, y: Infinity, z: Infinity });
  const band = useRef<Uint8Array | null>(null);
  useFrame(({ camera, clock }) => {
    const { x, y, z } = camera.position;
    if (clock.elapsedTime - last.current.at < REBUCKET && Math.hypot(x - last.current.x, y - last.current.y, z - last.current.z) < MOVE) return;
    last.current = { at: clock.elapsedTime, x, y, z };
    if (!band.current || band.current.length !== plants.length) band.current = new Uint8Array(plants.length).fill(1);
    const near = new Array(meshes.length).fill(0), far = new Array(meshes.length).fill(0);
    plants.forEach((t, i) => {
      const d = Math.hypot(t.x - x, t.y - y, t.z - z);
      const b = band.current![i] === 0 ? (d > BROADLEAF_LOD + HYST ? 1 : 0) : (d < BROADLEAF_LOD - HYST ? 0 : 1);
      band.current![i] = b;
      const v = Math.min(t.variant, meshes.length - 1);
      const mesh = b === 0 ? meshes[v].near : meshes[v].far;
      const n = b === 0 ? near[v]++ : far[v]++;
      (mesh.instanceMatrix.array as Float32Array).set(matrices.subarray(i * 16, i * 16 + 16), n * 16);
    });
    meshes.forEach((m, v) => {
      m.near.count = near[v]; m.far.count = far[v];
      m.near.instanceMatrix.needsUpdate = m.far.instanceMatrix.needsUpdate = true;
      if (onPick) { m.near.boundingSphere = null; m.far.boundingSphere = null; }
    });
  });

  const events = onPick ? {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover?.(true); },
    onPointerOut: () => onHover?.(false),
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(kind); },
  } : {};
  return <>{meshes.map((m, v) => <group key={v}>
    <primitive object={m.near} {...events} />
    <primitive object={m.far} {...events} />
  </group>)}</>;
}
