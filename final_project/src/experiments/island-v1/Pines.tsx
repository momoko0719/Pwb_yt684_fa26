import { useEffect, useMemo } from 'react';
import { Group, LOD, Mesh, Quaternion, Vector3, type ShaderMaterial } from 'three';
import type { IslandField } from '../../core/generators/island';
import { expandPine, interpretPine, pineGeometry, placePines, PINE_LODS, PINE_VARIANTS } from '../../core/generators/pine';
import type { IslandParams } from '../../core/params/island';
import { SIZES } from '../../core/scale';

/** Switch distances in metres (core/scale.ts): every needle up close, a few broad needles far away. */
const LOD_DISTANCE = [0, ...SIZES.pine.lod];
const UP = new Vector3(0, 1, 0);

/**
 * A few Huangshan pines on the ridges and the cliff edge. Each tree is a three.js LOD object holding
 * three meshes; the renderer picks one by camera distance every frame (Class 07).
 */
export default function Pines({ field, island, count, material, avoid }: { field: IslandField; island: IslandParams; count: number; material: ShaderMaterial; avoid?: (x: number, z: number) => boolean }) {
  // A few seeded variants, each grown once and meshed at every level of detail.
  const variants = useMemo(
    () => Array.from({ length: PINE_VARIANTS }, (_, v) => {
      const seed = island.seed * 10 + v;
      const skeleton = interpretPine(expandPine(seed), seed);
      return PINE_LODS.map((lod) => pineGeometry(skeleton, lod, seed));
    }),
    [island.seed],
  );
  useEffect(() => () => variants.flat().forEach((g) => g.dispose()), [variants]);

  const spots = useMemo(() => placePines(field, island, count, avoid), [field, island, count, avoid]);
  const group = useMemo(() => {
    const root = new Group();
    for (const spot of spots) {
      const tree = new LOD();
      tree.userData.scaleId = 'pine'; // measured by the scale view
      variants[spot.variant].forEach((geometry, lod) => tree.addLevel(new Mesh(geometry, material), LOD_DISTANCE[lod]));
      tree.position.set(spot.x, spot.y, spot.z);
      // Lean away from the centre (about an axis across the outward direction), then turn the tree so
      // its reaching side (+x in its own frame) faces `facing`.
      const outward = new Vector3(Math.cos(spot.yaw), 0, Math.sin(spot.yaw));
      const lean = new Quaternion().setFromAxisAngle(new Vector3().crossVectors(UP, outward).normalize(), spot.lean);
      tree.quaternion.copy(lean.multiply(new Quaternion().setFromAxisAngle(UP, -spot.facing)));
      tree.scale.setScalar(spot.scale);
      root.add(tree);
    }
    return root;
  }, [spots, variants, material, island.radius]);

  return <primitive object={group} />;
}
