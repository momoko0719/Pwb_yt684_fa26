import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import { createRng } from '../../core/rng';

/**
 * Watching-stone stele: a short wide tablet (not a needle pillar). Metres.
 * Broad face, readable thickness, soft taper, slightly irregular crown, mild bevel via mid-edge
 * rings. Warm grey-white vs the base — no text, gold, or glow.
 */
export const STELE = {
  height: 0.95,
  /** Face width (X) and thickness (Z) at the base — wide tablet, not a needle. */
  face: 0.52,
  thick: 0.18,
  taper: 0.11,
  /** Top edge irregularity (metres). */
  jitter: 0.02,
  /** Bevel inset on plan (metres) — softens silhouette in side light. */
  bevel: 0.022,
};

/** Stele material tint vs porcelain base (greyer so it separates from the seat). */
export const STELE_TINT = '#B8B3A8';

/** Closed stele mesh with aOcclusion. Pure for a given seed. */
export function steleGeometry(seed: number): BufferGeometry {
  const rng = createRng(seed * 17 + 91);
  const h = STELE.height;
  const w0 = STELE.face / 2, d0 = STELE.thick / 2;
  const w1 = w0 * (1 - STELE.taper), d1 = d0 * (1 - STELE.taper * 0.4);
  const bv = STELE.bevel;
  const j = () => (rng() - 0.5) * 2 * STELE.jitter;
  // Three rings: base, mid (bevel), crown — wider face, not a column.
  const ring = (y: number, w: number, d: number, jit: boolean): number[][] => {
    const jj = jit ? j : () => 0;
    return [
      [-w + jj(), y, -d + jj()], [w + jj(), y, -d + jj()], [w + jj(), y, d + jj()], [-w + jj(), y, d + jj()],
    ];
  };
  const base = ring(0, w0, d0, false);
  const mid = ring(bv * 2.2, w0 - bv * 0.35, d0 - bv * 0.25, false);
  // Slightly uneven crown height on corners for an irregular top silhouette.
  const topH = [h + j() * 0.35, h + j() * 0.35, h + j() * 0.35, h + j() * 0.35];
  const top = [
    [-w1 + j(), topH[0], -d1 + j()], [w1 + j(), topH[1], -d1 + j()],
    [w1 + j(), topH[2], d1 + j()], [-w1 + j(), topH[3], d1 + j()],
  ];
  const rings = [base, mid, top];
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const pushTri = (A: number[], B: number[], C: number[]) => {
    const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2];
    const bx = C[0] - A[0], by = C[1] - A[1], bz = C[2] - A[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    const baseI = pos.length / 3;
    for (const p of [A, B, C]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(nx, ny, nz);
    }
    idx.push(baseI, baseI + 1, baseI + 2);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };
  // Bottom
  quad(base[0], base[3], base[2], base[1]);
  // Top
  quad(top[0], top[1], top[2], top[3]);
  // Sides between rings
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      quad(A[k], A[n], B[n], B[k]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('aOcclusion', new BufferAttribute(new Float32Array(pos.length / 3).fill(0.88), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Low watching base: smaller than the old board, slight plan irregularity. Metres. */
export const WATCH_BASE = {
  half: [1.05, 0.72] as [number, number],
  rise: 0.09,
  flat: 0.4,
  off: 6,
  offWay: 4.5,
  /** Plan jitter as share of half-size. */
  edgeJitter: 0.06,
};

/** Slightly irregular low slab for the watching base (warm white porcelain). */
export function watchBaseGeometry(seed: number, half: [number, number], height: number): BufferGeometry {
  const rng = createRng(seed * 23 + 5);
  const hw = half[0], hd = half[1], h = height;
  const j = (s: number) => (rng() - 0.5) * 2 * s;
  const ew = hw * WATCH_BASE.edgeJitter, ed = hd * WATCH_BASE.edgeJitter;
  // Top and bottom rings with mild plan jitter — reads as a cut stone, not a perfect box.
  const bot = [
    [-hw + j(ew), 0, -hd + j(ed)], [hw + j(ew), 0, -hd + j(ed)],
    [hw + j(ew), 0, hd + j(ed)], [-hw + j(ew), 0, hd + j(ed)],
  ];
  const top = [
    [-hw * 0.97 + j(ew), h, -hd * 0.97 + j(ed)], [hw * 0.97 + j(ew), h, -hd * 0.97 + j(ed)],
    [hw * 0.97 + j(ew), h, hd * 0.97 + j(ed)], [-hw * 0.97 + j(ew), h, hd * 0.97 + j(ed)],
  ];
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const pushTri = (A: number[], B: number[], C: number[]) => {
    const ax = B[0] - A[0], ay = B[1] - A[1], az = B[2] - A[2];
    const bx = C[0] - A[0], by = C[1] - A[1], bz = C[2] - A[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    const b = pos.length / 3;
    for (const p of [A, B, C]) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); }
    idx.push(b, b + 1, b + 2);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { pushTri(a, b, c); pushTri(a, c, d); };
  quad(bot[0], bot[3], bot[2], bot[1]);
  quad(top[0], top[1], top[2], top[3]);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    quad(bot[k], bot[n], top[n], top[k]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('aOcclusion', new BufferAttribute(new Float32Array(pos.length / 3).fill(0.95), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
