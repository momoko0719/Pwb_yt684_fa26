import type { Sdf } from './sdf';

/**
 * Turns a signed distance field into triangles (surface nets, a smoother cousin of the marching
 * cubes from Class 04: one vertex per cell the surface passes through, at the average of where
 * the surface crosses the cell's edges, so flat faces stay flat and rounded edges stay round).
 *
 * Only blocks near the surface are sampled: a block whose centre is further from the surface than
 * its half-diagonal (with a margin for noise-bent distances) is skipped whole.
 *
 * Each vertex is then pulled onto the surface along the field's gradient (one Newton step): the
 * average of edge crossings sits off a curved or scaled field by up to a cell, which shows as a
 * faint saw edge along creases.
 *
 * Per vertex: a normal from the field's gradient, and ambient occlusion from the field itself
 * (sample outward along the normal; where other surfaces are close, the point is in a crease), the
 * soft contact shadow a porcelain sculpture needs.
 */
export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SdfMesh {
  positions: Float32Array;
  normals: Float32Array;
  occlusion: Float32Array;
  indices: Uint32Array;
  stats: { cells: number; sampled: number; vertices: number; triangles: number; ms: number };
}

const BLOCK = 4; // cells per block side
const MARGIN = 1.15; // how far beyond the half-diagonal a block may still hold surface (noise-bent distances)
const SLACK = 1; // plus this many metres, whatever the cell: at fine cells blocks are small and a bent distance skipped real surface (holes)
const AO_STEPS = [0.6, 1.5, 3, 6, 10]; // metres out along the normal
const AO_STRENGTH = 0.9;

export function meshSdf(sdf: Sdf, bounds: Bounds, cell: number): SdfMesh {
  const t0 = performance.now();
  const [x0, y0, z0] = bounds.min;
  const nx = Math.ceil((bounds.max[0] - x0) / cell), ny = Math.ceil((bounds.max[1] - y0) / cell), nz = Math.ceil((bounds.max[2] - z0) / cell);
  const NX = nx + 1, NY = ny + 1, NZ = nz + 1; // nodes
  const node = (i: number, j: number, k: number) => (k * NY + j) * NX + i;
  const values = new Float32Array(NX * NY * NZ).fill(NaN);
  let sampled = 0;

  // Sample the nodes of every block that may hold surface.
  const half = (Math.sqrt(3) * BLOCK * cell) / 2;
  for (let bk = 0; bk < nz; bk += BLOCK) {
    for (let bj = 0; bj < ny; bj += BLOCK) {
      for (let bi = 0; bi < nx; bi += BLOCK) {
        const cx = x0 + (bi + BLOCK / 2) * cell, cy = y0 + (bj + BLOCK / 2) * cell, cz = z0 + (bk + BLOCK / 2) * cell;
        if (Math.abs(sdf(cx, cy, cz)) > half * MARGIN + SLACK) continue;
        for (let k = bk; k <= Math.min(bk + BLOCK, nz); k++) {
          for (let j = bj; j <= Math.min(bj + BLOCK, ny); j++) {
            for (let i = bi; i <= Math.min(bi + BLOCK, nx); i++) {
              const n = node(i, j, k);
              if (!Number.isNaN(values[n])) continue;
              values[n] = sdf(x0 + i * cell, y0 + j * cell, z0 + k * cell);
              sampled++;
            }
          }
        }
      }
    }
  }

  // One vertex per cell the surface crosses.
  const cellIndex = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const vertexOf = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float64Array(8);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let inside = 0, missing = false;
        for (let c = 0; c < 8; c++) {
          const val = values[node(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
          if (Number.isNaN(val)) { missing = true; break; }
          v[c] = val;
          if (val < 0) inside++;
        }
        if (missing || inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of edges) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
          sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
          sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
          n++;
        }
        vertexOf[cellIndex(i, j, k)] = pos.length / 3;
        pos.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
      }
    }
  }

  // A quad across every node edge the surface crosses, joining the four cells around that edge.
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // Counter-clockwise seen from outside, so the outside is the front face and only it is drawn.
    if (flip) idx.push(a, b, c, b, d, c);
    else idx.push(a, c, b, b, c, d);
  };
  for (let k = 1; k < nz; k++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 0; i < nx; i++) { // x edges
        const a = values[node(i, j, k)], b = values[node(i + 1, j, k)];
        if (Number.isNaN(a) || Number.isNaN(b) || (a < 0) === (b < 0)) continue;
        quad(vertexOf[cellIndex(i, j - 1, k - 1)], vertexOf[cellIndex(i, j, k - 1)], vertexOf[cellIndex(i, j - 1, k)], vertexOf[cellIndex(i, j, k)], a < 0);
      }
    }
  }
  for (let k = 1; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 1; i < nx; i++) { // y edges
        const a = values[node(i, j, k)], b = values[node(i, j + 1, k)];
        if (Number.isNaN(a) || Number.isNaN(b) || (a < 0) === (b < 0)) continue;
        quad(vertexOf[cellIndex(i - 1, j, k - 1)], vertexOf[cellIndex(i - 1, j, k)], vertexOf[cellIndex(i, j, k - 1)], vertexOf[cellIndex(i, j, k)], a < 0);
      }
    }
  }
  for (let k = 0; k < nz; k++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 1; i < nx; i++) { // z edges
        const a = values[node(i, j, k)], b = values[node(i, j, k + 1)];
        if (Number.isNaN(a) || Number.isNaN(b) || (a < 0) === (b < 0)) continue;
        quad(vertexOf[cellIndex(i - 1, j - 1, k)], vertexOf[cellIndex(i, j - 1, k)], vertexOf[cellIndex(i - 1, j, k)], vertexOf[cellIndex(i, j, k)], a < 0);
      }
    }
  }

  // Onto the surface; normals from the gradient; occlusion from the field along the normal.
  const count = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(count * 3);
  const occlusion = new Float32Array(count);
  const e = cell * 0.25;
  const gradient = (x: number, y: number, z: number) => [
    (sdf(x + e, y, z) - sdf(x - e, y, z)) / (2 * e),
    (sdf(x, y + e, z) - sdf(x, y - e, z)) / (2 * e),
    (sdf(x, y, z + e) - sdf(x, y, z - e)) / (2 * e),
  ];
  for (let p = 0; p < count; p++) {
    let x = positions[p * 3], y = positions[p * 3 + 1], z = positions[p * 3 + 2];
    const d = sdf(x, y, z);
    let [gx, gy, gz] = gradient(x, y, z);
    const g2 = gx * gx + gy * gy + gz * gz;
    if (g2 > 1e-6) {
      // Newton step to the zero crossing, no further than half a cell.
      const s = Math.max(Math.min(d / g2, cell * 0.5 / Math.sqrt(g2)), -cell * 0.5 / Math.sqrt(g2));
      x -= gx * s; y -= gy * s; z -= gz * s;
      positions[p * 3] = x; positions[p * 3 + 1] = y; positions[p * 3 + 2] = z;
      [gx, gy, gz] = gradient(x, y, z);
    }
    // The field may be a scaled distance (kept safe for steep risers); the gradient's length is
    // that scale, so dividing by it gives occlusion in true metres.
    const len = Math.hypot(gx, gy, gz) || 1;
    gx /= len; gy /= len; gz /= len;
    normals.set([gx, gy, gz], p * 3);
    let occ = 0, weight = 1;
    for (const s of AO_STEPS) {
      occ += (weight * Math.max(s - sdf(x + gx * s, y + gy * s, z + gz * s) / len, 0)) / s;
      weight *= 0.7;
    }
    occlusion[p] = Math.min(Math.max(1 - AO_STRENGTH * occ / 2.5, 0), 1);
  }
  return {
    positions, normals, occlusion, indices: new Uint32Array(idx),
    stats: { cells: nx * ny * nz, sampled, vertices: count, triangles: idx.length / 3, ms: performance.now() - t0 },
  };
}
