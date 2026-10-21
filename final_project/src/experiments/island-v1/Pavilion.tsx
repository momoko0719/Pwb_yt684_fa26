import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Group, Mesh, Vector3, type ShaderMaterial } from 'three';
import { createPavilion, type PartKind } from '../../core/generators/pavilion';
import { PROPS } from '../../core/palette';
import { createPropMaterial } from '../../core/shaders/prop';
import type { WorldUniforms } from '../../core/shaders/uniforms';

const COLORS: Record<PartKind, string> = {
  plinth: PROPS.plinth,
  step: PROPS.step,
  column: PROPS.column,
  beam: PROPS.beam,
  roof: PROPS.roof,
  finial: PROPS.finial,
};

/**
 * The pavilion at the end of a path, from the grammar in core/generators/pavilion.ts. It appears
 * `delay` seconds after it mounts, when the path's stones reach it.
 */
export default function Pavilion({ position, facing, uniforms, seed, delay = 0 }: { position: Vector3; facing: number; uniforms: WorldUniforms; seed: number; delay?: number }) {
  const materials = useMemo(() => {
    const m = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, createPropMaterial(uniforms, c)])) as Record<PartKind, ShaderMaterial>;
    m.roof.side = DoubleSide;
    return m;
  }, [uniforms]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const blocks = useMemo(() => createPavilion(facing, seed), [facing, seed]);
  const group = useMemo(() => {
    const root = new Group();
    root.userData.scaleId = 'pavilion'; // measured by the scale view
    for (const b of blocks) {
      const mesh = new Mesh(b.geometry, materials[b.kind]);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(b.matrix);
      root.add(mesh);
    }
    root.visible = false;
    return root;
  }, [blocks, materials]);
  useEffect(() => () => blocks.forEach((b) => b.geometry.dispose()), [blocks]);

  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    group.visible = clock.elapsedTime - start.current >= delay;
  });

  return <primitive object={group} position={position} />;
}
