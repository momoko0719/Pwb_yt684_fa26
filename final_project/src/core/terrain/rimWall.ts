import { BufferAttribute, BufferGeometry } from 'three';

/**
 * The island's side, as a mesh: a wall straight down from the rim (the outline as a ring of points,
 * each with the ground's height there) to `bottom`, where the underside (undersideMesh.ts) hangs
 * from it. The height map's own surface is cut off at the outline (its pixels dropped there), so
 * the wall meets it exactly at the rim.
 */
export function rimWall(rim: Float32Array, bottom: number): BufferGeometry {
  const n = rim.length / 3;
  const positions: number[] = [], normals: number[] = [], index: number[] = [];
  for (let k = 0; k < n; k++) {
    const x = rim[k * 3], z = rim[k * 3 + 1], h = rim[k * 3 + 2];
    // Outward: across the ring's tangent (from the neighbours).
    const p = ((k - 1 + n) % n) * 3, q = ((k + 1) % n) * 3;
    const tx = rim[q] - rim[p], tz = rim[q + 1] - rim[p + 1], tl = Math.hypot(tx, tz) || 1;
    const nx = tz / tl, nz = -tx / tl;
    positions.push(x, h, z, x, bottom, z);
    normals.push(nx, 0, nz, nx, 0, nz);
  }
  for (let k = 0; k < n; k++) {
    const a = k * 2, b = ((k + 1) % n) * 2;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('aOcclusion', new BufferAttribute(new Float32Array(positions.length / 3).fill(1), 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
