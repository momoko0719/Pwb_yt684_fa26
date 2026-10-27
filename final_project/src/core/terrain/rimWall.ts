import { BufferAttribute, BufferGeometry } from 'three';
import { RIM_JOIN } from './rimJoin';

/**
 * The island's side: a wall from the rim ring down to `bottom` (underside hangs from there),
 * plus an **inward flange** that meets the CDLOD top height field.
 *
 * Why the flange: the drawn top discards when outline > RIM_JOIN.outlineKeep. Morph and bilinear
 * outline put the visible top edge inside the discrete rim polygon. The flange samples the **same
 * height field** (and outline) the top uses, so its inner edge sits on the rendered surface —
 * not a flat rim-Y ledge, colour patch, or camera lift.
 *
 * Mid-edge samples densify the join (local edge mesh) without rewriting the whole island.
 *
 * `rim`: Float32Array of (x, z, height) around the island (heights already re-sampled after water).
 * `heightAt` / `outlineAt`: same grid the CDLOD skin reads (channels 0 and 3).
 */
export function rimWall(
  rim: Float32Array,
  bottom: number,
  inset = RIM_JOIN.flangeInsetMax,
  heightAt?: (x: number, z: number) => number,
  outlineAt?: (x: number, z: number) => number,
): BufferGeometry {
  const n = rim.length / 3;
  const positions: number[] = [], normals: number[] = [], occlusion: number[] = [], index: number[] = [];
  const hAt = heightAt ?? ((_: number, __: number) => 0);
  const oAt = outlineAt ?? (() => -1);
  const { flangeSolid, flangeStep, flangeLift, wallLift } = RIM_JOIN;

  /** One column: inner flange → rim top → wall foot. */
  const pushCol = (x: number, z: number, hRim: number, nx: number, nz: number) => {
    let ix = x, iz = z, innerH = hRim, reached = 0;
    for (let s = flangeStep; s <= inset; s += flangeStep) {
      const px = x - nx * s, pz = z - nz * s;
      const o = oAt(px, pz);
      const hy = heightAt ? hAt(px, pz) : hRim;
      if (Number.isFinite(hy) && hy > -80) {
        ix = px; iz = pz; innerH = hy; reached = s;
      }
      if (o < flangeSolid && reached >= 0.4) break;
    }
    if (reached < 0.35) {
      ix = x - nx * inset;
      iz = z - nz * inset;
      innerH = heightAt ? hAt(ix, iz) : hRim;
      if (!(innerH > -80)) innerH = hRim;
    }

    const ih = innerH + flangeLift;
    const rh = heightAt ? hAt(x, z) : hRim;
    const hTop = (Number.isFinite(rh) && rh > -80 ? rh : hRim) + wallLift;
    positions.push(ix, ih, iz, x, hTop, z, x, bottom, z);
    // Flange normal: cliff-leaning (not a flat bright shelf). Soft occlusion avoids a lit “夹层”.
    const upN = 0.42, outN = Math.sqrt(1 - upN * upN);
    normals.push(nx * outN, upN, nz * outN, nx, 0, nz, nx, 0, nz);
    occlusion.push(0.9, 0.94, 1);
  };

  // Rim points + mid-edge samples (denser join, same height/outline rules).
  const cols: { x: number; z: number; h: number; nx: number; nz: number }[] = [];
  for (let k = 0; k < n; k++) {
    const x = rim[k * 3], z = rim[k * 3 + 1], hRim = rim[k * 3 + 2];
    const p = ((k - 1 + n) % n) * 3, q = ((k + 1) % n) * 3;
    const tx = rim[q] - rim[p], tz = rim[q + 1] - rim[p + 1], tl = Math.hypot(tx, tz) || 1;
    const nx = tz / tl, nz = -tx / tl;
    cols.push({ x, z, h: hRim, nx, nz });
    const k1 = (k + 1) % n;
    const x2 = rim[k1 * 3], z2 = rim[k1 * 3 + 1], h2 = rim[k1 * 3 + 2];
    const mx = (x + x2) * 0.5, mz = (z + z2) * 0.5;
    const hx = x2 - x, hz = z2 - z, hl = Math.hypot(hx, hz) || 1;
    const mnx = hz / hl, mnz = -hx / hl;
    const mh = heightAt ? hAt(mx, mz) : (hRim + h2) * 0.5;
    cols.push({ x: mx, z: mz, h: Number.isFinite(mh) && mh > -80 ? mh : (hRim + h2) * 0.5, nx: mnx, nz: mnz });
  }

  for (const c of cols) pushCol(c.x, c.z, c.h, c.nx, c.nz);

  const m = cols.length;
  for (let k = 0; k < m; k++) {
    const a = k * 3, b = ((k + 1) % m) * 3;
    index.push(a, a + 1, b, a + 1, b + 1, b);
    index.push(a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('aOcclusion', new BufferAttribute(new Float32Array(occlusion), 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
