/**
 * The way water runs through a pool, as potential flow on a grid: water comes in at sources (where
 * falls land, the spring) and leaves at sinks (the outlets); between them it runs down the gradient
 * of a potential φ whose Laplacian is the sources, with no flow through the shore (each cell is
 * balanced against its neighbours in the water only). The discharge per metre of width is
 * q = −∇φ (m²/s); over a depth d, the speed is q / d.
 *
 * Unlike a sum of radial sources and sinks, the flow goes round what stands in the pool (the plate
 * above, standing in the lower pools) and never crosses a shore. It is the steady flow of an ideal
 * fluid: no eddies, no inertia; a visual approximation, smooth everywhere, enough to carry the
 * water's texture and the debug view's particles.
 *
 * Solved by conjugate gradients over the water's cells (plain arrays: it runs in the terrain
 * worker). (Successive over-relaxation, at a few hundred sweeps, had not settled round a lower
 * pool's ring of 150 cells: its particles stalled halfway.)
 */
export interface FlowField {
  /** The first cell's centre, metres. */
  x0: number;
  z0: number;
  /** Metres between cells. */
  step: number;
  nx: number;
  nz: number;
  /** 1 where there is water. */
  mask: Uint8Array;
  /** Per cell, metres a second (x, z): the discharge over the depth there, or as given (fieldFrom). */
  vx: Float32Array;
  vz: Float32Array;
}

export interface Source {
  x: number;
  z: number;
  /** m³/s: positive comes in, negative goes out. */
  flow: number;
  /** Metres over which it is spread (at least the nearest cell). */
  radius: number;
}

const MAX_ITERATIONS = 3000;
const TOLERANCE = 1e-7; // of the sources' size, the residual at which it stops

/**
 * Solve the flow for a mask and its sources (what comes in is scaled to what goes out, so a steady
 * flow exists). Returns the discharge per metre (qx, qz: m²/s) per cell.
 */
export function potentialFlow(grid: { x0: number; z0: number; step: number; nx: number; nz: number; mask: Uint8Array }, sources: Source[]): { qx: Float32Array; qz: Float32Array } {
  const { x0, z0, step, nx, nz, mask } = grid;
  const n = nx * nz;
  const s = new Float64Array(n);
  // Spread each source over the water within its radius (weighted toward its middle).
  const place = (src: Source, sign: number) => {
    const cells: [number, number][] = [];
    let total = 0;
    const r = Math.max(src.radius, step);
    const i0 = Math.max(Math.floor((src.x - r - x0) / step), 0), i1 = Math.min(Math.ceil((src.x + r - x0) / step), nx - 1);
    const j0 = Math.max(Math.floor((src.z - r - z0) / step), 0), j1 = Math.min(Math.ceil((src.z + r - z0) / step), nz - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const t = j * nx + i;
      if (!mask[t]) continue;
      const d = Math.hypot(x0 + i * step - src.x, z0 + j * step - src.z);
      if (d > r) continue;
      const w = 1 - d / (r + step);
      cells.push([t, w]); total += w;
    }
    if (!cells.length) {
      // Nothing within reach: the nearest water.
      let best = -1, bd = Infinity;
      for (let t = 0; t < n; t++) {
        if (!mask[t]) continue;
        const d = Math.hypot(x0 + (t % nx) * step - src.x, z0 + Math.floor(t / nx) * step - src.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best >= 0) { cells.push([best, 1]); total = 1; }
    }
    for (const [t, w] of cells) s[t] += (sign * Math.abs(src.flow) * w) / total;
  };
  const ins = sources.filter((q) => q.flow > 0), outs = sources.filter((q) => q.flow < 0);
  const inTotal = ins.reduce((a, q) => a + q.flow, 0), outTotal = -outs.reduce((a, q) => a + q.flow, 0);
  for (const q of ins) place({ ...q, flow: (q.flow / (inTotal || 1)) * Math.min(inTotal, outTotal || inTotal) }, 1);
  for (const q of outs) place({ ...q, flow: (q.flow / (outTotal || 1)) * Math.min(inTotal, outTotal || inTotal) }, -1);

  // The water's cells and each one's water neighbours (left, right, down, up; −1: shore).
  const cells: number[] = [], id = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) if (mask[t]) { id[t] = cells.length; cells.push(t); }
  const m = cells.length;
  const nb = new Int32Array(m * 4).fill(-1);
  cells.forEach((t, c) => {
    const i = t % nx, j = Math.floor(t / nx);
    if (i > 0) nb[c * 4] = id[t - 1];
    if (i < nx - 1) nb[c * 4 + 1] = id[t + 1];
    if (j > 0) nb[c * 4 + 2] = id[t - nx];
    if (j < nz - 1) nb[c * 4 + 3] = id[t + nx];
  });
  // Σ over each cell's water neighbours of (φ_cell − φ_neighbour) = its source (what flows out of
  // it is what is put in). Symmetric and semi-definite; the sources sum to nothing, so it has a
  // solution (up to a constant), found by conjugate gradients.
  const apply = (x: Float64Array, out: Float64Array) => {
    for (let c = 0; c < m; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) { const o = nb[c * 4 + k]; if (o >= 0) sum += x[c] - x[o]; }
      out[c] = sum;
    }
  };
  const b = new Float64Array(m);
  cells.forEach((t, c) => { b[c] = s[t]; });
  const phi = new Float64Array(m), r = b.slice(), d = b.slice(), ad = new Float64Array(m);
  const dot = (x: Float64Array, y: Float64Array) => { let a = 0; for (let c = 0; c < m; c++) a += x[c] * y[c]; return a; };
  let rr = dot(r, r);
  const stop = TOLERANCE * TOLERANCE * Math.max(rr, 1e-30);
  for (let it = 0; it < MAX_ITERATIONS && rr > stop; it++) {
    apply(d, ad);
    const dad = dot(d, ad);
    if (dad <= 0) break;
    const alpha = rr / dad;
    for (let c = 0; c < m; c++) { phi[c] += alpha * d[c]; r[c] -= alpha * ad[c]; }
    const next = dot(r, r);
    for (let c = 0; c < m; c++) d[c] = r[c] + (next / rr) * d[c];
    rr = next;
  }
  // q = −∇φ at each cell: the mean of the flows through its two faces each way, none through a
  // face on the shore (so along a shore the flow runs along it).
  const qx = new Float32Array(n), qz = new Float32Array(n);
  const face = (c: number, k: number) => { const o = nb[c * 4 + k]; return o >= 0 ? (phi[c] - phi[o]) / step : 0; };
  cells.forEach((t, c) => {
    let x = (face(c, 1) - face(c, 0)) / 2, z = (face(c, 3) - face(c, 2)) / 2;
    // On the shore: nothing outward, and a touch inward (a curved shore otherwise lets what is
    // carried along it drift off it, the field's own curve not followed exactly).
    const ix = (nb[c * 4] < 0 ? 1 : 0) - (nb[c * 4 + 1] < 0 ? 1 : 0), iz = (nb[c * 4 + 2] < 0 ? 1 : 0) - (nb[c * 4 + 3] < 0 ? 1 : 0);
    const il = Math.hypot(ix, iz);
    if (il > 0) {
      const ux = ix / il, uz = iz / il, inward = x * ux + z * uz, speed = Math.hypot(x, z);
      if (inward < 0) { x -= inward * ux; z -= inward * uz; }
      x += 0.08 * speed * ux; z += 0.08 * speed * uz;
    }
    qx[t] = x; qz[t] = z;
  });
  return { qx, qz };
}

/**
 * A field's value at (x, z): bilinear over its water cells only (a cell on land takes no part), or
 * the nearest water cell within two cells; null where there is none.
 */
export function sampleField(f: { x0: number; z0: number; step: number; nx: number; nz: number; mask: Uint8Array }, a: ArrayLike<number>, b: ArrayLike<number>, x: number, z: number): [number, number] | null {
  const gx = (x - f.x0) / f.step, gz = (z - f.z0) / f.step;
  const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
  let sa = 0, sb = 0, w = 0;
  for (let dj = 0; dj <= 1; dj++) for (let di = 0; di <= 1; di++) {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= f.nx || jj >= f.nz) continue;
    const t = jj * f.nx + ii;
    if (!f.mask[t]) continue;
    const k = (di ? u : 1 - u) * (dj ? v : 1 - v);
    sa += a[t] * k; sb += b[t] * k; w += k;
  }
  if (w > 1e-4) return [sa / w, sb / w];
  let best = -1, bd = Infinity;
  for (let dj = -2; dj <= 3; dj++) for (let di = -2; di <= 3; di++) {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= f.nx || jj >= f.nz) continue;
    const t = jj * f.nx + ii;
    if (!f.mask[t]) continue;
    const d = (ii - gx) ** 2 + (jj - gz) ** 2;
    if (d < bd) { bd = d; best = t; }
  }
  return best >= 0 ? [a[best], b[best]] : null;
}
