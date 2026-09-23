/**
 * Signed Distance Field primitives + CSG ops.
 * Convention: negative = inside the solid.
 */

export type Vec3 = { x: number; y: number; z: number };

function length2(x: number, y: number): number {
  return Math.hypot(x, y);
}

function length3(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

export function sdfSphere(p: Vec3, r: number): number {
  return length3(p.x, p.y, p.z) - r;
}

export function sdfBox(p: Vec3, half: Vec3): number {
  const qx = Math.abs(p.x) - half.x;
  const qy = Math.abs(p.y) - half.y;
  const qz = Math.abs(p.z) - half.z;
  const outside = length3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qy, qz), 0);
  return outside + inside;
}

export function sdfTorus(p: Vec3, major: number, minor: number): number {
  const q = length2(p.x, p.z) - major;
  return length2(q, p.y) - minor;
}

export function sdfCylinder(p: Vec3, r: number, h: number): number {
  const d = length2(p.x, p.z) - r;
  const dy = Math.abs(p.y) - h;
  const outside = length2(Math.max(d, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(d, dy), 0);
  return outside + inside;
}

export type PrimitiveKind = 'sphere' | 'box' | 'torus' | 'cylinder';

export function evalPrimitive(kind: PrimitiveKind, p: Vec3): number {
  switch (kind) {
    case 'sphere':   return sdfSphere(p, 0.55);
    case 'box':      return sdfBox(p, { x: 0.45, y: 0.45, z: 0.45 });
    case 'torus':    return sdfTorus(p, 0.4, 0.16);
    case 'cylinder': return sdfCylinder(p, 0.35, 0.55);
  }
}

export type CsgOp = 'union' | 'intersect' | 'subtract' | 'smoothUnion' | 'shell';

/** Polynomial smooth min (IQ). */
export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function combineSDF(
  a: number, b: number, op: CsgOp,
  smoothK = 0.2, thickness = 0.08,
): number {
  switch (op) {
    case 'union':       return Math.min(a, b);
    case 'intersect':   return Math.max(a, b);
    case 'subtract':    return Math.max(a, -b);
    case 'smoothUnion': return smin(a, b, Math.max(smoothK, 0.001));
    case 'shell':       return Math.abs(a) - thickness;
  }
}
