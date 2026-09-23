/**
 * Culled-faces meshing: Minecraft-style cubes.
 * Emits only faces between solid and empty voxels.
 */

export interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
}

const FACES: {
  dir: [number, number, number];
  corners: [number, number, number][];
  normal: [number, number, number];
}[] = [
  { // +X
    dir: [1, 0, 0],
    normal: [1, 0, 0],
    corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
  },
  { // −X
    dir: [-1, 0, 0],
    normal: [-1, 0, 0],
    corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
  },
  { // +Y
    dir: [0, 1, 0],
    normal: [0, 1, 0],
    corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]],
  },
  { // −Y
    dir: [0, -1, 0],
    normal: [0, -1, 0],
    corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]],
  },
  { // +Z
    dir: [0, 0, 1],
    normal: [0, 0, 1],
    corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
  },
  { // −Z
    dir: [0, 0, -1],
    normal: [0, 0, -1],
    corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]],
  },
];

function isSolid(vol: Float32Array, n: number, x: number, y: number, z: number, thr: number): boolean {
  if (x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n) return false;
  return vol[x + y * n + z * n * n] > thr;
}

export function meshCulled(
  volume: Float32Array,
  n: number,
  threshold: number,
  extent = 1,
): MeshBuffers {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vert = 0;
  const cell = (2 * extent) / n;
  const origin = -extent;

  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!isSolid(volume, n, x, y, z, threshold)) continue;
        for (const face of FACES) {
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          if (isSolid(volume, n, nx, ny, nz, threshold)) continue;

          const base = vert;
          for (const c of face.corners) {
            positions.push(
              origin + (x + c[0]) * cell,
              origin + (y + c[1]) * cell,
              origin + (z + c[2]) * cell,
            );
            normals.push(face.normal[0], face.normal[1], face.normal[2]);
            vert++;
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    triangleCount: indices.length / 3,
  };
}
