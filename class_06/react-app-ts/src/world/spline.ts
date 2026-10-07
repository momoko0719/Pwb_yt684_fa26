/** A 2D point on the ground plane (x, z). */
export type P2 = [number, number];

/**
 * Catmull-Rom spline through the points the visitor drew, resampled at even spacing.
 * Drawing by mouse gives jittery, uneven points; this turns them into a smooth line.
 */
export function smoothPath(raw: P2[], spacing: number): P2[] {
  // Thin out points that are too close, so mouse jitter does not become wiggles.
  const pts: P2[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= spacing * 2) pts.push(p);
  }
  if (pts.length < 2) return pts;
  const dense: P2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  // Resample at even spacing along the curve.
  const out: P2[] = [dense[0]];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const [ax, az] = dense[i - 1];
    const [bx, bz] = dense[i];
    const seg = Math.hypot(bx - ax, bz - az);
    let d = spacing - carry;
    while (d <= seg) {
      out.push([ax + ((bx - ax) * d) / seg, az + ((bz - az) * d) / seg]);
      d += spacing;
    }
    carry = seg - (d - spacing);
  }
  return out;
}

/** Nearest point on a polyline: distance, the point itself, and the unit tangent there (direction of travel). */
export function nearest(path: P2[], x: number, z: number): { dist: number; px: number; pz: number; tx: number; tz: number } {
  let best = { dist: Infinity, px: 0, pz: 0, tx: 0, tz: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / len2, 0), 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const dist = Math.hypot(x - px, z - pz);
    if (dist < best.dist) {
      const len = Math.sqrt(len2);
      best = { dist, px, pz, tx: dx / len, tz: dz / len };
    }
  }
  return best;
}
