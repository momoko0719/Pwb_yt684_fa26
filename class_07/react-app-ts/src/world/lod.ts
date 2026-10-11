import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, OctahedronGeometry, Vector3 } from 'three';
import { createRng } from './noise';
import type { Leaf, Segment, Skeleton } from './lsystem';

/**
 * Levels of detail, read straight from the grammar's recursion depth.
 *
 *   LOD0  everything: every twig, every leaf pad, round branches (7 sides).
 *   LOD1  twigs (depth >= 2) are dropped; the leaves of each dropped twig merge into one bigger pad.
 *   LOD2  only the trunk is kept; each main branch becomes one pad (or one stick if it has no leaves).
 *
 * Far away you cannot see a twig, but you can still see where the green masses are,
 * so each level keeps the silhouette and throws away the detail.
 */
export const LODS = [0, 1, 2] as const;
export type Lod = (typeof LODS)[number];

const SPEC: Record<Lod, { cut: number; sides: number; padDetail: 'ico1' | 'ico0' | 'oct' }> = {
  0: { cut: Infinity, sides: 7, padDetail: 'ico1' },
  1: { cut: 2, sides: 4, padDetail: 'ico0' },
  2: { cut: 1, sides: 3, padDetail: 'oct' },
};

export interface TreeColors {
  bark: string;
  leafTop: string;
  leafBottom: string;
}

// Polyhedron geometries are already non-indexed: three vertices per triangle.
const padBase = {
  ico1: new IcosahedronGeometry(1, 1).getAttribute('position').array as Float32Array,
  ico0: new IcosahedronGeometry(1, 0).getAttribute('position').array as Float32Array,
  oct: new OctahedronGeometry(1, 0).getAttribute('position').array as Float32Array,
};

export interface TreeMesh {
  geometry: BufferGeometry;
  triangles: number;
}

export function buildTree(skel: Skeleton, lod: Lod, colors: TreeColors, seed: number): TreeMesh {
  const { cut, sides, padDetail } = SPEC[lod];
  const rng = createRng(seed * 13 + lod);
  const pos: number[] = [];
  const col: number[] = [];
  const bark = new Color(colors.bark);
  const top = new Color(colors.leafTop);
  const bottom = new Color(colors.leafBottom);

  const tube = (a: Vector3, b: Vector3, r0: number, r1: number) => {
    const dir = new Vector3().subVectors(b, a).normalize();
    const side = Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(dir, side).normalize();
    const v = new Vector3().crossVectors(dir, u);
    const ring = (c: Vector3, r: number, i: number) => {
      const t = (i / sides) * Math.PI * 2;
      return c.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(v, Math.sin(t) * r);
    };
    for (let i = 0; i < sides; i++) {
      const a0 = ring(a, r0, i), a1 = ring(a, r0, i + 1), b0 = ring(b, r1, i), b1 = ring(b, r1, i + 1);
      for (const p of [a0, b0, a1, a1, b0, b1]) {
        pos.push(p.x, p.y, p.z);
        col.push(bark.r, bark.g, bark.b);
      }
    }
  };

  const tmp = new Color();
  const pad = (c: Vector3, rx: number, ry: number) => {
    const base = padBase[padDetail];
    const yaw = rng() * Math.PI * 2;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const shade = 0.85 + rng() * 0.3;
    for (let i = 0; i < base.length; i += 3) {
      const x = base[i] * rx, y = base[i + 1] * ry, z = base[i + 2] * rx;
      pos.push(c.x + x * cs - z * sn, c.y + y, c.z + x * sn + z * cs);
      // Darker underneath, lighter on top, like ink layered on a pine pad.
      tmp.copy(bottom).lerp(top, (base[i + 1] + 1) / 2).multiplyScalar(shade);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  };

  // Branches: keep shallow ones; group the rest by the branch that owns them at the cut depth.
  const cutSegs = new Map<number, Segment[]>();
  for (const s of skel.segments) {
    if (s.depth < cut) tube(s.a, s.b, s.r0, s.r1);
    else push(cutSegs, s.owners[cut], s);
  }
  // Leaves: shallow ones stay; deep ones merge per owning branch.
  const groups = new Map<number, Leaf[]>();
  for (const l of skel.leaves) {
    if (l.depth < cut) pad(l.p, l.size, l.size * 0.38);
    else push(groups, l.owners[cut], l);
  }
  if (Number.isFinite(cut)) {
    // Leafless dropped branches (e.g. the bare classic plant) collapse into one stick each.
    for (const [id, segs] of cutSegs) {
      if (groups.has(id)) continue;
      const root = segs[0].a;
      let far = segs[0].b;
      for (const s of segs) if (s.b.distanceToSquared(root) > far.distanceToSquared(root)) far = s.b;
      tube(root, far, segs[0].r0, segs[0].r0 * 0.4);
    }
    for (const leaves of groups.values()) {
      const c = new Vector3();
      for (const l of leaves) c.add(l.p);
      c.divideScalar(leaves.length);
      let rx = 0, ry = 0;
      for (const l of leaves) {
        rx = Math.max(rx, Math.hypot(l.p.x - c.x, l.p.z - c.z) + l.size * 0.8);
        ry = Math.max(ry, Math.abs(l.p.y - c.y) + l.size * 0.35);
      }
      pad(c, rx, ry);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, triangles: pos.length / 9 };
}

function push<T>(map: Map<number, T[]>, key: number, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
