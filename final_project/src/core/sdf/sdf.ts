/**
 * Signed distance functions (Class 04: density fields and CSG). A shape is a function from a point
 * to its distance from the surface: negative inside, positive outside. Shapes combine by union,
 * subtraction and their smooth versions (smin), so a whole island can be carved from simple
 * pieces by rules. Pure functions throughout; all lengths in metres.
 *
 * Distances stay close to true (Lipschitz about 1) for the primitives; noise-displaced and
 * smoothed shapes may overshoot a little, which callers allow for with a safety margin.
 */
export type Sdf = (x: number, y: number, z: number) => number;

// ---- Combining ----

export const union = (...shapes: Sdf[]): Sdf => (x, y, z) => {
  let d = Infinity;
  for (const s of shapes) d = Math.min(d, s(x, y, z));
  return d;
};

/** a minus b. */
export const subtract = (a: Sdf, b: Sdf): Sdf => (x, y, z) => Math.max(a(x, y, z), -b(x, y, z));

export const intersect = (a: Sdf, b: Sdf): Sdf => (x, y, z) => Math.max(a(x, y, z), b(x, y, z));

/** Polynomial smooth minimum (Class 04 smin): unions that melt together over k metres. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

export const smoothUnion = (k: number, ...shapes: Sdf[]): Sdf => (x, y, z) => {
  let d = Infinity;
  for (const s of shapes) d = d === Infinity ? s(x, y, z) : smin(d, s(x, y, z), k);
  return d;
};

/** a minus b, with a rounded seam of k metres. */
export const smoothSubtract = (a: Sdf, b: Sdf, k: number): Sdf => (x, y, z) => -smin(-a(x, y, z), b(x, y, z), k);

/**
 * Skip a shape's (possibly costly) evaluation outside its bounding sphere. Outside, the answer is
 * at least `clear` metres (the shape must sit at least that far inside the sphere), so a smooth
 * union with a blend under `clear` never sees a false surface at the sphere's edge.
 */
export const bounded = (cx: number, cy: number, cz: number, radius: number, shape: Sdf, clear = 8): Sdf => (x, y, z) => {
  const far = Math.hypot(x - cx, y - cy, z - cz) - radius;
  return far > 0 ? far + clear : shape(x, y, z);
};

// ---- Primitives ----

export const sphere = (cx: number, cy: number, cz: number, r: number): Sdf => (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r;

/** Box centred at (cx, cy, cz), half sizes (hx, hy, hz), edges rounded by r. */
export const roundBox = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r: number): Sdf => (x, y, z) => {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};

/** A cone hanging from (cx, top, cz) down to a point at (cx, top - h, cz), radius r at the top. */
export const hangingCone = (cx: number, top: number, cz: number, r: number, h: number): Sdf => (x, y, z) => {
  const q = Math.hypot(x - cx, z - cz);
  const t = Math.min(Math.max((top - y) / h, 0), 1);
  const radial = q - r * (1 - t);
  const vertical = Math.max(y - top, top - h - y);
  const slant = radial * (h / Math.hypot(h, r));
  return Math.max(slant, vertical);
};

/**
 * A rounded cone between two points: radius r1 at a, r2 at b, both ends round (after Inigo
 * Quilez's sdRoundCone). Hanging rock is a few of these melted together.
 */
export function roundCone(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number): Sdf {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - ax, pay = y - ay, paz = z - az;
    const yv = pax * bax + pay * bay + paz * baz;
    const zv = yv - l2;
    const cx = pax * l2 - bax * yv, cy = pay * l2 - bay * yv, cz = paz * l2 - baz * yv;
    const x2 = cx * cx + cy * cy + cz * cz;
    const y2 = yv * yv * l2;
    const z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - r1;
  };
}

// ---- 2D outlines, extruded ----

/** A 2D outline as a signed distance in the ground plane (x, z). */
export type Sdf2 = (x: number, z: number) => number;

/**
 * A rounded, wavy outline: a circle of radius r whose radius wobbles by `wobble` (share of r)
 * with a few sines around it (phases from a seed). Distance is scaled down to stay safe.
 */
export function blob(cx: number, cz: number, r: number, wobble: number, phases: number[]): Sdf2 {
  return (x, z) => {
    const dx = x - cx, dz = z - cz;
    const a = Math.atan2(dz, dx);
    let w = 0;
    phases.forEach((p, i) => { w += Math.sin((i + 2) * a + p) / (i + 2); });
    return (Math.hypot(dx, dz) - r * (1 + wobble * w)) * (1 / (1 + wobble * 2));
  };
}

/** A 2D outline grown or shrunk by `by` metres. */
export const inset = (shape: Sdf2, by: number): Sdf2 => (x, z) => shape(x, z) + by;

/**
 * A slab: the 2D outline extruded from `bottom` to `top`, its upper edge rounded by `round`
 * metres, so the slab reads as a soft, thick sheet (porcelain, cut paper).
 */
export function slab(outline: Sdf2, bottom: number, top: number, round: number): Sdf {
  return (x, y, z) => {
    const d2 = outline(x, z) + round;
    const dy = Math.max(y - top + round, bottom - y);
    const ox = Math.max(d2, 0), oy = Math.max(dy, 0);
    return Math.min(Math.max(d2, dy), 0) + Math.hypot(ox, oy) - round;
  };
}

/** Linear interpolation clamped, and smoothstep, for shape rules. */
export const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
