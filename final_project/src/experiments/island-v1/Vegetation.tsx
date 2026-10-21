import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type ShaderMaterial } from 'three';
import { BOULDER_VARIANTS, boulderGeometry, shrubGeometry, type Plant } from '../../core/generators/forest';
import { expandPine, forestPineModel, GROWN_PINE_HEIGHT, interpretPine, pineGeometry, PINE_VARIANTS } from '../../core/generators/pine';
import { GROUND } from '../../core/palette';
import { SIZES } from '../../core/scale';
import { createPropMaterial } from '../../core/shaders/prop';
import type { WorldUniforms } from '../../core/shaders/uniforms';

const [NEAR, MID] = SIZES.forest.lod; // metres: grown pines inside NEAR, three-tier stand-ins inside MID, two-tier crowns beyond
const REBUCKET = 0.3; // seconds between sorting trees into their level of detail
const MOVE = 4; // ...or as soon as the camera has moved this far
const UP = new Vector3(0, 1, 0);

/**
 * The forest, the rhododendron thickets and the boulders. Tens of thousands of trees cannot each be
 * a grown pine, so each tree is drawn at one of three levels by its distance to the camera, the
 * same idea as the lone pines' LOD (Class 07) but for instanced crowds: the grown L-system pine
 * (its lightest level) up close, a three-tier stand-in in the middle distance, a two-tier crown far
 * away. Shrubs and boulders are single instanced meshes.
 */
export default function Vegetation({ trees, shrubs, boulders, seed, pineMaterial, uniforms }: {
  trees: Plant[];
  shrubs: Plant[];
  boulders: Plant[];
  seed: number;
  pineMaterial: ShaderMaterial;
  uniforms: WorldUniforms;
}) {
  // Shapes: the grown pine variants (same seeds as the lone pines) and the two stand-ins.
  const shapes = useMemo(() => ({
    near: Array.from({ length: PINE_VARIANTS }, (_, v) => {
      const s = seed * 10 + v;
      return pineGeometry(interpretPine(expandPine(s), s), 2, s);
    }),
    mid: forestPineModel('mid'),
    far: forestPineModel('far'),
  }), [seed]);
  useEffect(() => () => [...shapes.near, shapes.mid, shapes.far].forEach((g) => g.dispose()), [shapes]);

  // Each tree's placement twice: scaled for the grown pine, and for the one-unit stand-ins.
  const matrices = useMemo(() => {
    const grown = new Float32Array(trees.length * 16), unit = new Float32Array(trees.length * 16);
    const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3();
    trees.forEach((t, i) => {
      p.set(t.x, t.y, t.z);
      q.setFromAxisAngle(UP, t.yaw);
      m.compose(p, q, s.setScalar(t.height / GROWN_PINE_HEIGHT)).toArray(grown, i * 16);
      m.compose(p, q, s.setScalar(t.height)).toArray(unit, i * 16);
    });
    return { grown, unit };
  }, [trees]);

  // One instanced mesh per shape, sized for every tree; each frame they draw only their share.
  const meshes = useMemo(() => {
    const make = (g: BufferGeometry) => {
      const mesh = new InstancedMesh(g, pineMaterial, Math.max(trees.length, 1));
      mesh.frustumCulled = false;
      mesh.count = 0;
      return mesh;
    };
    return { near: shapes.near.map(make), mid: make(shapes.mid), far: make(shapes.far) };
  }, [shapes, pineMaterial, trees.length]);

  const last = useRef({ at: -Infinity, x: Infinity, z: Infinity });
  useFrame(({ camera, clock }) => {
    const { x, z } = camera.position;
    if (clock.elapsedTime - last.current.at < REBUCKET && Math.hypot(x - last.current.x, z - last.current.z) < MOVE) return;
    last.current = { at: clock.elapsedTime, x, z };
    const counts = { near: new Array(PINE_VARIANTS).fill(0), mid: 0, far: 0 };
    const cy = camera.position.y;
    const into = (mesh: InstancedMesh, n: number, from: Float32Array, i: number) => (mesh.instanceMatrix.array as Float32Array).set(from.subarray(i * 16, i * 16 + 16), n * 16);
    trees.forEach((t, i) => {
      const d = Math.hypot(t.x - x, t.y - cy, t.z - z);
      if (d < NEAR) into(meshes.near[t.variant], counts.near[t.variant]++, matrices.grown, i);
      else if (d < MID) into(meshes.mid, counts.mid++, matrices.unit, i);
      else into(meshes.far, counts.far++, matrices.unit, i);
    });
    meshes.near.forEach((mesh, v) => { mesh.count = counts.near[v]; mesh.instanceMatrix.needsUpdate = true; });
    meshes.mid.count = counts.mid;
    meshes.mid.instanceMatrix.needsUpdate = true;
    meshes.far.count = counts.far;
    meshes.far.instanceMatrix.needsUpdate = true;
  });

  // Shrubs and boulders: static, one instanced mesh each (boulders one per variant).
  const ground = useMemo(() => {
    const group = new Group();
    const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3(), c = new Color();
    const shrubMat = createPropMaterial(uniforms, GROUND.shrub);
    const shrubShape = shrubGeometry();
    const thicket = new InstancedMesh(shrubShape, shrubMat, Math.max(shrubs.length, 1));
    shrubs.forEach((t, i) => {
      thicket.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(UP, t.yaw), s.set(t.height * 1.6, t.height, t.height * 1.3)));
      thicket.setColorAt(i, c.setScalar(0.85 + 0.3 * ((i * 0.618) % 1)));
    });
    thicket.count = shrubs.length;
    group.add(thicket);
    const stoneMat = createPropMaterial(uniforms, GROUND.boulder);
    const stoneShapes = Array.from({ length: BOULDER_VARIANTS }, (_, v) => boulderGeometry(v));
    stoneShapes.forEach((shape, v) => {
      const mine = boulders.filter((b) => b.variant === v);
      const mesh = new InstancedMesh(shape, stoneMat, Math.max(mine.length, 1));
      mine.forEach((b, i) => {
        mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q.setFromAxisAngle(UP, b.yaw), s.set(b.height * 1.3, b.height, b.height * 1.1)));
        mesh.setColorAt(i, c.setScalar(0.85 + 0.25 * ((i * 0.618) % 1)));
      });
      mesh.count = mine.length;
      group.add(mesh);
    });
    return { group, dispose: () => { shrubMat.dispose(); stoneMat.dispose(); shrubShape.dispose(); stoneShapes.forEach((g) => g.dispose()); } };
  }, [shrubs, boulders, uniforms]);
  useEffect(() => () => ground.dispose(), [ground]);

  return (
    <>
      {meshes.near.map((mesh, v) => <primitive key={`n${v}`} object={mesh} />)}
      <primitive object={meshes.mid} />
      <primitive object={meshes.far} />
      <primitive object={ground.group} />
    </>
  );
}
