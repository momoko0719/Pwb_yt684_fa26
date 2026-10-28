import { BufferGeometry, Float32BufferAttribute } from 'three';
import { ROUTE_CLEAR, type Dwelling, type Spot } from './dwelling';

/**
 * A semi-open shelter for a home that is already chosen. The habitable volume is the same set of
 * solids as the white-box: back wall, one thick flank, a low cheek, a short roof. The mesh drawn
 * on top of that volume is a fractured slab. It may grow outward and upward. It does not lower
 * the roof underside, and it does not push an inner face into the cavity.
 *
 * Local frame: origin at the lie, +x out of the mouth, +z the thick flank, y up from the buried base.
 * Wall circles sit inside the solids. Search inflates them by ROUTE_CLEAR, so the bed and the
 * centre line stay outside that inflation. Headroom is the flat underside, checked against the mesh.
 */

type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
interface Solid {
  role: 'back' | 'flank' | 'cheek' | 'roof' | 'haunch';
  min: [number, number, number];
  max: [number, number, number];
  cavity: Face[];
}

/** Metres. Roof underside minus bury is the clearance on flat ground. */
const BURY = 0.22;
const ROOF_UNDER = 2.37;
const HEADROOM = 2.05;
/** Standing nose, metres ahead of the body origin. The back wall stays beyond this. */
const NOSE = 1.35;
const FACING_BIAS = 0.28;

const LOCAL_SOLIDS: Solid[] = [
  { role: 'back', min: [-2.9, 0, -1.2], max: [-1.72, 2.15, 2.2], cavity: ['px'] },
  { role: 'flank', min: [-2.9, 0, 1.22], max: [-0.28, 2.58, 2.42], cavity: ['nz', 'px'] },
  { role: 'cheek', min: [-2.55, 0, -1.72], max: [-0.6, 0.78, -1.12], cavity: ['pz', 'px'] },
  { role: 'roof', min: [-2.9, ROOF_UNDER, -0.2], max: [0.58, 2.74, 2.42], cavity: ['ny', 'px'] },
  // Inside the bevel. The square corner this used to fill is gone, so the box stays
  // on the cavity side of the new outer skin.
  { role: 'haunch', min: [-2.72, 0, 1.28], max: [-2.16, 1.85, 1.82], cavity: [] },
];

export interface ShelterCircle { x: number; z: number; r: number }

export interface ShelterPlan {
  bed: Spot;
  mouth: Spot;
  /** Mesh origin, metres. The base is buried `BURY` below the lowest ground sample. */
  originY: number;
  yaw: number;
  mirror: boolean;
  /** World seed and home index. The slab's outline uses this; coordinates are not hand-set. */
  formSeed: number;
  /** Pines, trees, shore stones, and the wall circles. */
  obstacles: ShelterCircle[];
  /** Wall circles only, already in world space. */
  walls: ShelterCircle[];
  headroomMin: number;
  /** Width between the cheek and the flank where both stand, metres. */
  interiorWidth: number;
  /** Lowest clearance under the roof over the bed and the inward walk, metres. */
  entranceClear: number;
  exterior: { along: number; across: number; height: number };
  /** Metres from the home anchor to the lie. */
  fromHome: number;
  /** 1 when the mouth faces the drink. */
  drinkAlign: number;
  slope: number;
  liveView: { from: [number, number, number]; to: [number, number, number] };
  cutView: { from: [number, number, number]; to: [number, number, number] };
  triangles: number;
}

/** The air the body uses. The slab must not place a vertex in here. */
const CAVITY = { x0: -1.55, x1: 0.48, z0: -0.95, z1: 1.05, y0: 0.4, y1: 2.36 };
/** The white-box roof footprint. The slab's underside has to keep covering it, at the same height. */
const ROOF_RECT = { x0: -2.9, x1: 0.58, z0: -0.2, z1: 2.42 };

/** Circles inside a wall's footprint. The roof is not an obstacle. */
function circlesOf(solids: Solid[]): { lx: number; lz: number; r: number }[] {
  const out: { lx: number; lz: number; r: number }[] = [];
  for (const b of solids) {
    if (b.role === 'roof') continue;
    const x0 = b.min[0], x1 = b.max[0], z0 = b.min[2], z1 = b.max[2];
    const sx = x1 - x0, sz = z1 - z0;
    const r = Math.min(0.4, sx / 2 - 0.08, sz / 2 - 0.08);
    if (r < 0.16) continue;
    const alongX = sx >= sz;
    const span = alongX ? sx : sz;
    const n = Math.max(1, Math.ceil(span / (r * 1.55)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const lx = alongX ? x0 + span * t : (x0 + x1) / 2;
      const lz = alongX ? (z0 + z1) / 2 : z0 + span * t;
      out.push({
        lx: Math.min(x1 - r, Math.max(x0 + r, lx)),
        lz: Math.min(z1 - r, Math.max(z0 + r, lz)),
        r,
      });
    }
  }
  return out;
}

/**
 * The form's own circles must leave the bed and the walk in from the mouth outside the
 * inflated radius. Independent of any island.
 */
export function shelterFormFault(): string | null {
  const circles = circlesOf(LOCAL_SOLIDS);
  const need = (x: number, z: number, extra: number) => {
    for (const c of circles) {
      if (Math.hypot(x - c.lx, z - c.lz) < c.r + ROUTE_CLEAR + extra) return true;
    }
    return false;
  };
  if (need(0, 0, 0.2)) return 'inflated wall covers the bed';
  for (let x = -0.15; x <= 2.7; x += 0.25) {
    if (need(x, 0, 0.08)) return `inflated wall covers the centre line at x ${x.toFixed(2)}`;
  }
  const back = LOCAL_SOLIDS.find((s) => s.role === 'back')!;
  if (-NOSE <= back.max[0]) return 'back wall is inside the standing nose';
  const roof = LOCAL_SOLIDS.find((s) => s.role === 'roof')!;
  if (roof.min[1] - BURY < HEADROOM) return 'flat-ground clearance is under the headroom';
  return null;
}

const toWorld = (bedX: number, bedZ: number, yaw: number, lx: number, lz: number, mirror: boolean): [number, number] => {
  const z = mirror ? -lz : lz;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [bedX + c * lx - s * z, bedZ + s * lx + c * z];
};

export function shelterLocal(plan: ShelterPlan, x: number, z: number): [number, number] {
  const dx = x - plan.bed.x, dz = z - plan.bed.z;
  const c = Math.cos(plan.yaw), s = Math.sin(plan.yaw);
  let lx = c * dx + s * dz;
  let lz = -s * dx + c * dz;
  if (plan.mirror) lz = -lz;
  return [lx, lz];
}

/** True when a world point is inside a solid (the roof included). Faces are outside. */
export function shelterContains(plan: ShelterPlan, x: number, y: number, z: number): boolean {
  const [lx, lz] = shelterLocal(plan, x, z);
  const ly = y - plan.originY;
  // shelterLocal undoes the mirror, so the test is against the unmirrored form.
  for (const b of LOCAL_SOLIDS) {
    if (lx > b.min[0] && lx < b.max[0] && ly > b.min[1] && ly < b.max[1] && lz > b.min[2] && lz < b.max[2]) return true;
  }
  return false;
}

/** Ground-to-roof metres, or Infinity where the sky is open. The underside is flat; the outline is the slab's. */
export function shelterClearance(plan: ShelterPlan, x: number, z: number, groundY: number): number {
  const [lx, lz] = shelterLocal(plan, x, z);
  if (!pointInPoly(roofOutline(formPhase(plan.formSeed)), lx, lz)) return Infinity;
  return plan.originY + ROOF_UNDER - groundY;
}

/** One low-frequency field for a whole shelter. About -1..1. Not a per-vertex jitter. */
function formPhase(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * Math.PI * 2;
}

function wave(x: number, z: number, phase: number): number {
  return Math.sin(x * 0.72 + phase) * 0.62 + Math.cos(z * 0.55 + phase * 1.37) * 0.38;
}

function unit(x: number, z: number, phase: number): number {
  return 0.5 + 0.5 * wave(x, z, phase);
}

type Poly = [number, number][];

/** One roof plate. A tooth on the lip or a lobe on the cheek reads as a torn edge, so the plan stays blunt. */
function roofOutline(phase: number): Poly {
  const u = (x: number, z: number) => unit(x, z, phase);
  // Rear and cheek stay outside the wall tops. The front stays past the protected rectangle.
  return [
    [-3.36 - 0.04 * u(-3.4, -0.1), -0.20],
    [-3.44 - 0.04 * u(-3.5, 1.1), 1.10],
    [-3.24 - 0.04 * u(-3.2, 2.3), 2.58],
    [-1.05, 2.70 + 0.05 * u(-1.0, 2.7)],
    [0.72, 2.50],
    [0.86, 1.15],
    [0.78, -0.28],
    [-1.55, -1.48],
    [-2.90, -1.64],
    [-3.32, -0.70],
  ];
}

/** Crown height. Even enough that one corner does not fold into a fin. */
function roofCrown(x: number, z: number, phase: number): number {
  return 2.84 + 0.10 * unit(x, z, phase);
}

function pointInPoly(poly: Poly, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 0) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const ab = cross(a, b, c) * cross(a, b, d);
  const cd = cross(c, d, a) * cross(c, d, b);
  return ab < -1e-8 && cd < -1e-8;
}

/** Ear clip. The outline is short and simple; a failed clip is a form fault, not a fallback fan. */
function earClip(poly: Poly): number[] | null {
  if (!ringCcw(poly)) poly.reverse();
  const idx = poly.map((_, i) => i);
  const tris: number[] = [];
  const area = (a: number, b: number, c: number) => {
    const [ax, az] = poly[a], [bx, bz] = poly[b], [cx, cz] = poly[c];
    return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  };
  const contains = (p: number, a: number, b: number, c: number) => {
    const c1 = area(a, b, p), c2 = area(b, c, p), c3 = area(c, a, p);
    return !((c1 < -1e-8 || c2 < -1e-8 || c3 < -1e-8) && (c1 > 1e-8 || c2 > 1e-8 || c3 > 1e-8));
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < 48) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      if (area(i0, i1, i2) <= 1e-8) continue;
      let ear = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (contains(j, i0, i1, i2)) { ear = false; break; }
      }
      if (!ear) continue;
      tris.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) return null;
  }
  if (idx.length !== 3) return null;
  tris.push(idx[0], idx[1], idx[2]);
  return tris;
}

class Slab {
  pos: number[] = [];
  occ: number[] = [];
  idx: number[] = [];
  v(x: number, y: number, z: number, o: number): number {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.occ.push(o);
    return i;
  }
  tri(a: number, b: number, c: number) { this.idx.push(a, b, c); }
  x(i: number) { return this.pos[i * 3]; }
  y(i: number) { return this.pos[i * 3 + 1]; }
  z(i: number) { return this.pos[i * 3 + 2]; }
}

/** Quad a-b-c-d, wound so the face looks away from a point inside the stone. */
function addQuad(slab: Slab, a: number, b: number, c: number, d: number, inside: [number, number, number]) {
  const ax = slab.x(a), ay = slab.y(a), az = slab.z(a);
  const bx = slab.x(b) - ax, by = slab.y(b) - ay, bz = slab.z(b) - az;
  const cx = slab.x(c) - ax, cy = slab.y(c) - ay, cz = slab.z(c) - az;
  const nx = by * cz - bz * cy;
  const ny = bz * cx - bx * cz;
  const nz = bx * cy - by * cx;
  const toward = nx * (inside[0] - ax) + ny * (inside[1] - ay) + nz * (inside[2] - az);
  if (toward > 0) { slab.tri(a, c, b); slab.tri(a, d, c); }
  else { slab.tri(a, b, c); slab.tri(a, c, d); }
}

interface Corner { x: number; y: number; z: number; o: number }

/** Each face gets its own vertices, so a coarse slab stays faceted instead of blending into a blob. */
function faceQuad(slab: Slab, a: Corner, b: Corner, c: Corner, d: Corner, inside: [number, number, number]) {
  addQuad(
    slab,
    slab.v(a.x, a.y, a.z, a.o),
    slab.v(b.x, b.y, b.z, b.o),
    slab.v(c.x, c.y, c.z, c.o),
    slab.v(d.x, d.y, d.z, d.o),
    inside,
  );
}

function loft(slab: Slab, profiles: Corner[][], inside: [number, number, number]) {
  for (let i = 0; i < profiles.length - 1; i++) {
    const a = profiles[i], b = profiles[i + 1];
    for (let k = 0; k < a.length; k++) {
      const k2 = (k + 1) % a.length;
      faceQuad(slab, a[k], a[k2], b[k2], b[k], inside);
    }
  }
  const first = profiles[0], last = profiles[profiles.length - 1];
  faceQuad(slab, first[0], first[3], first[2], first[1], inside);
  faceQuad(slab, last[0], last[1], last[2], last[3], inside);
}

function addRoof(slab: Slab, phase: number, outline: Poly, tris: number[]) {
  const top: number[] = [], bot: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const [x, z] = outline[i];
    // Top and underside share the plan. Pulling only the top vertex folded the rim into a fin.
    top.push(slab.v(x, roofCrown(x, z, phase), z, 0.96));
    bot.push(slab.v(x, ROOF_UNDER, z, 0.40));
  }
  const ny = (() => {
    const a = top[tris[0]], b = top[tris[1]], c = top[tris[2]];
    const bz = slab.z(b) - slab.z(a);
    const cz = slab.z(c) - slab.z(a);
    const bx = slab.x(b) - slab.x(a), cx = slab.x(c) - slab.x(a);
    return bz * cx - bx * cz;
  })();
  const flip = ny < 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    if (flip) { slab.tri(top[a], top[c], top[b]); slab.tri(bot[a], bot[b], bot[c]); }
    else { slab.tri(top[a], top[b], top[c]); slab.tri(bot[a], bot[c], bot[b]); }
  }
  const inside: [number, number, number] = [-0.6, 2.6, 0.8];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const b0 = slab.v(slab.x(bot[i]), slab.y(bot[i]), slab.z(bot[i]), 0.84);
    const b1 = slab.v(slab.x(bot[j]), slab.y(bot[j]), slab.z(bot[j]), 0.84);
    const t0 = slab.v(slab.x(top[i]), slab.y(top[i]), slab.z(top[i]), 0.90);
    const t1 = slab.v(slab.x(top[j]), slab.y(top[j]), slab.z(top[j]), 0.90);
    addQuad(slab, b0, b1, t1, t0, inside);
  }
}

/** Batter, metres of setback per metre of height. Shared so each back facet stays planar. */
const BATTER = 0.10;

/**
 * Two wide outer planes, then a bevel onto the flank. The inner base is not in here:
 * it stays on x = -1.72. Outer x stays past the wall circles.
 */
function backCourse(phase: number) {
  const u = (x: number, z: number) => unit(x, z, phase);
  const z0 = -1.16 - 0.06 * u(-2.1, -1.15);
  const z1 = 0.18 + 0.24 * (u(-2.55, 0.15) - 0.5);
  const z2 = 1.50 + 0.12 * (u(-2.4, 1.4) - 0.5);
  return {
    z: [z0, z1, z2],
    x: [
      Math.min(-3.02 - 0.08 * u(-3.0, z0), -2.96),
      Math.min(-3.30 - 0.06 * u(-3.25, z1), -3.16),
      Math.min(-3.06 - 0.06 * u(-3.05, z2), -2.98),
    ],
    h: [2.62, 2.66, 2.63] as [number, number, number],
    flank: {
      x: -2.70 - 0.06 * u(-2.7, 2.35),
      z: 2.44 + 0.08 * u(-2.55, 2.5),
      y: 2.62,
    },
    /** Cheek-side outer corner, cut back so the end is not a right angle. */
    cheek: { x: -2.86, z: z0 - 0.18 },
  };
}

function addFlank(slab: Slab, phase: number) {
  const course = backCourse(phase);
  const u = (x: number, z: number) => unit(x, z, phase);
  const xs = [course.flank.x, -2.22 + 0.12 * (u(-2.2, 2.2) - 0.5), -1.18 + 0.10 * (u(-1.1, 2.1) - 0.5), -0.52, -0.28];
  xs.sort((a, b) => a - b);
  const profiles: Corner[][] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const cavity = x >= -2.88;
    const uu = u(x, 2.3);
    const zInnerBase = cavity ? 1.22 : 1.58;
    // The top of the inner face steps back into the stone, so the wall is not a vertical post.
    const zInnerTop = cavity ? 1.22 + 0.12 + 0.14 * uu : zInnerBase;
    const rear = i === 0;
    const zBase = rear ? course.flank.z : (x < -2.9 ? 2.70 : 2.44) + 0.06 * uu;
    const zTop = rear ? course.flank.z : zBase - 0.28 - 0.10 * uu;
    const yTop = rear ? course.flank.y : x < -2.95 ? 1.88 : 2.62 + 0.10 * uu;
    const xTop = rear ? x + BATTER * yTop : i >= xs.length - 2 ? x - 0.35 - 0.25 * (i === xs.length - 1 ? 1 : 0.45) : x;
    const xInnerTop = i === xs.length - 1 ? x - 0.48 : x;
    const innerOcc = cavity && x < -1.45 ? 0.36 : cavity ? 0.50 : 0.82;
    profiles.push([
      { x, y: 0, z: zBase, o: 0.62 },
      { x: xTop, y: yTop, z: zTop, o: 0.86 },
      { x: xInnerTop, y: yTop, z: zInnerTop, o: innerOcc },
      { x, y: 0, z: zInnerBase, o: cavity ? 0.58 : 0.70 },
    ]);
  }
  loft(slab, profiles, [-1.6, 1.2, 1.9]);
}

function addBack(slab: Slab, phase: number) {
  const c = backCourse(phase);
  const u = (x: number, z: number) => unit(x, z, phase);
  const inside: [number, number, number] = [-2.15, 1.1, 0.35];
  const xIn = -1.72;
  const cap = (xBase: number, h: number) => xBase + BATTER * h;
  const inTop = (z: number) => -1.86 - 0.05 * u(-1.9, z);
  // One value per face. The old loft mixed 0.84 on the top edge with 0.52 on the base,
  // so each diagonal split into a lighter triangle.
  const skin = 0.78;
  const deep = 0.40;
  const stone = (x: number, y: number, z: number, o: number): Corner => ({ x, y, z, o });
  for (let i = 0; i < 2; i++) {
    const h0 = c.h[i], h1 = c.h[i + 1];
    const zA = c.z[i], zB = c.z[i + 1];
    const ax = cap(c.x[i], h0), bx = cap(c.x[i + 1], h1);
    faceQuad(slab,
      stone(c.x[i], 0, zA, skin), stone(ax, h0, zA, skin),
      stone(bx, h1, zB, skin), stone(c.x[i + 1], 0, zB, skin), inside);
    const iA = inTop(zA), iB = inTop(zB);
    faceQuad(slab,
      stone(xIn, 0, zA, deep), stone(xIn, 0, zB, deep),
      stone(iB, h1, zB, deep), stone(iA, h0, zA, deep), inside);
    faceQuad(slab,
      stone(ax, h0, zA, 0.70), stone(iA, h0, zA, 0.70),
      stone(iB, h1, zB, 0.70), stone(bx, h1, zB, 0.70), inside);
    faceQuad(slab,
      stone(c.x[i], 0, zA, 0.55), stone(xIn, 0, zA, 0.55),
      stone(xIn, 0, zB, 0.55), stone(c.x[i + 1], 0, zB, 0.55), inside);
  }
  const h0 = c.h[0], h2 = c.h[2];
  const cheek = c.cheek;
  faceQuad(slab,
    stone(c.x[0], 0, c.z[0], skin), stone(cap(c.x[0], h0), h0, c.z[0], skin),
    stone(cap(cheek.x, h0), h0, cheek.z, skin), stone(cheek.x, 0, cheek.z, skin), inside);
  faceQuad(slab,
    stone(cheek.x, 0, cheek.z, 0.74), stone(cap(cheek.x, h0), h0, cheek.z, 0.74),
    stone(inTop(c.z[0]), h0, c.z[0], 0.74), stone(xIn, 0, c.z[0], 0.74), inside);
  const o2x = cap(c.x[2], h2);
  faceQuad(slab,
    stone(xIn, 0, c.z[2], 0.74), stone(inTop(c.z[2]), h2, c.z[2], 0.74),
    stone(o2x, h2, c.z[2], 0.74), stone(c.x[2], 0, c.z[2], 0.74), inside);
  // One plane from the back's outer edge onto the flank. Replaces the square corner.
  const f = c.flank;
  faceQuad(slab,
    stone(c.x[2], 0, c.z[2], 0.76), stone(o2x, h2, c.z[2], 0.76),
    stone(f.x + BATTER * f.y, f.y, f.z, 0.76), stone(f.x, 0, f.z, 0.76), inside);
}

function ringCcw(poly: Poly): boolean {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a >= 0;
}

function addCheek(slab: Slab, phase: number): boolean {
  const u = (x: number, z: number) => unit(x, z, phase);
  const plan: Poly = [
    [-2.48, -1.12],
    [-0.70, -1.12],
    [-0.95, -1.58 - 0.14 * u(-0.9, -1.6)],
    [-1.70, -1.92 - 0.10 * u(-1.6, -1.9)],
    [-2.45, -1.48 - 0.12 * u(-2.3, -1.6)],
  ];
  const crown = [0.36, 0.28, 0.12, 0.06, 0.16];
  if (!ringCcw(plan)) { plan.reverse(); crown.reverse(); }
  const tris = earClip(plan);
  if (!tris) return false;
  const top: number[] = [], bot: number[] = [];
  for (let i = 0; i < plan.length; i++) {
    const [x, z] = plan[i];
    top.push(slab.v(x, crown[i], z, z > -1.16 ? 0.55 : 0.86));
    bot.push(slab.v(x, 0, z, 0.58));
  }
  const a0 = top[tris[0]], b0 = top[tris[1]], c0 = top[tris[2]];
  const ny = (slab.z(b0) - slab.z(a0)) * (slab.x(c0) - slab.x(a0)) - (slab.x(b0) - slab.x(a0)) * (slab.z(c0) - slab.z(a0));
  const flip = ny < 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    if (flip) { slab.tri(top[a], top[c], top[b]); slab.tri(bot[a], bot[b], bot[c]); }
    else { slab.tri(top[a], top[b], top[c]); slab.tri(bot[a], bot[c], bot[b]); }
  }
  const inside: [number, number, number] = [-1.5, 0.25, -1.45];
  for (let i = 0; i < plan.length; i++) {
    const j = (i + 1) % plan.length;
    faceQuad(
      slab,
      { x: slab.x(bot[i]), y: slab.y(bot[i]), z: slab.z(bot[i]), o: 0.70 },
      { x: slab.x(bot[j]), y: slab.y(bot[j]), z: slab.z(bot[j]), o: 0.70 },
      { x: slab.x(top[j]), y: slab.y(top[j]), z: slab.z(top[j]), o: 0.82 },
      { x: slab.x(top[i]), y: slab.y(top[i]), z: slab.z(top[i]), o: 0.82 },
      inside,
    );
  }
  return true;
}

/** Local slab. `mirror` flips Z after the form is built, so the rules stay in one frame. */
export function shelterGeometry(mirror: boolean, formSeed: number): BufferGeometry {
  const phase = formPhase(formSeed);
  const outline = roofOutline(phase);
  const tris = earClip(outline);
  const slab = new Slab();
  if (tris) addRoof(slab, phase, outline, tris);
  addFlank(slab, phase);
  addBack(slab, phase);
  addCheek(slab, phase);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(slab.pos, 3));
  g.setAttribute('aOcclusion', new Float32BufferAttribute(slab.occ, 1));
  g.setIndex(slab.idx);
  if (mirror) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i));
    const index = g.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1), c = index.getX(i + 2);
      index.setX(i + 1, c);
      index.setX(i + 2, b);
    }
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function sub3(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot3(a: number[], b: number[]) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Segment t in (0, 1) hits the triangle. A graze along the boundary does not count. */
function segmentHitsTri(p: number[], q: number[], a: number[], b: number[], c: number[]): boolean {
  const dir = sub3(q, p);
  const e1 = sub3(b, a), e2 = sub3(c, a);
  const pv = cross3(dir, e2);
  const det = dot3(e1, pv);
  if (Math.abs(det) < 1e-8) return false;
  const inv = 1 / det;
  const tvec = sub3(p, a);
  const u = dot3(tvec, pv) * inv;
  if (u < 0.002 || u > 0.998) return false;
  const qv = cross3(tvec, e1);
  const v = dot3(dir, qv) * inv;
  if (v < 0.002 || u + v > 0.998) return false;
  const t = dot3(e2, qv) * inv;
  return t > 0.002 && t < 0.998;
}

function segmentHitsBox(p: number[], q: number[], box: number[][]): boolean {
  let t0 = 0, t1 = 1;
  const d = sub3(q, p);
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (p[i] <= box[0][i] || p[i] >= box[1][i]) return false;
    } else {
      let a = (box[0][i] - p[i]) / d[i];
      let b = (box[1][i] - p[i]) / d[i];
      if (a > b) { const s = a; a = b; b = s; }
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
  }
  return t1 > 0.002 && t0 < 0.998;
}

/** True when the triangle enters the activity box, even if every vertex is outside it. */
function triCutsBox(a: number[], b: number[], c: number[], box: number[][]): boolean {
  const verts = [a, b, c];
  for (const v of verts) {
    if (v[0] > box[0][0] && v[0] < box[1][0] && v[1] > box[0][1] && v[1] < box[1][1] && v[2] > box[0][2] && v[2] < box[1][2]) return true;
  }
  for (let i = 0; i < 3; i++) if (segmentHitsBox(verts[i], verts[(i + 1) % 3], box)) return true;
  const xs = [box[0][0], box[1][0]], ys = [box[0][1], box[1][1]], zs = [box[0][2], box[1][2]];
  const corners: number[][] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) corners.push([x, y, z]);
  const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
  for (const [i, j] of edges) if (segmentHitsTri(corners[i], corners[j], a, b, c)) return true;
  return false;
}

function skinDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz || 1;
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

/** Wall circles have to stay inside the new outer skin. The old boxes are not assumed to match. */
function circleOutsideSkin(phase: number): string | null {
  const c = backCourse(phase);
  const u = (x: number, z: number) => unit(x, z, phase);
  const xs = [c.flank.x, -2.22 + 0.12 * (u(-2.2, 2.2) - 0.5), -1.18 + 0.10 * (u(-1.1, 2.1) - 0.5), -0.52, -0.28];
  xs.sort((a, b) => a - b);
  const poly: [number, number][] = [[c.cheek.x, c.cheek.z], ...c.z.map((z, i) => [c.x[i], z] as [number, number])];
  for (let i = 0; i < xs.length; i++) {
    if (i === 0) poly.push([xs[i], c.flank.z]);
    else {
      const uu = u(xs[i], 2.3);
      poly.push([xs[i], (xs[i] < -2.9 ? 2.70 : 2.44) + 0.06 * uu]);
    }
  }
  for (const circ of circlesOf(LOCAL_SOLIDS)) {
    for (let i = 0; i < poly.length - 1; i++) {
      const d = skinDist(circ.lx, circ.lz, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]);
      if (d + 0.04 < circ.r) {
        return `circle (${circ.lx.toFixed(2)}, ${circ.lz.toFixed(2)}) r ${circ.r.toFixed(2)} crosses the outer skin`;
      }
    }
  }
  return null;
}

export interface ShelterMeshAudit {
  fault: string | null;
  triangles: number;
  exterior: { along: number; across: number; height: number };
}

/** The drawn slab against the cavity and the flat underside. Independent of the old box probe. */
export function shelterMeshAudit(formSeed: number): ShelterMeshAudit {
  const phase = formPhase(formSeed);
  const outline = roofOutline(phase);
  const g = shelterGeometry(false, formSeed);
  const index = g.getIndex();
  const triangles = (index?.count ?? 0) / 3;
  const box = g.boundingBox!;
  const exterior = {
    along: box.max.x - box.min.x,
    across: box.max.z - box.min.z,
    height: box.max.y - box.min.y,
  };
  let fault: string | null = null;
  if (!earClip(outline)) fault = 'roof outline did not triangulate';
  for (let i = 0; i < outline.length && !fault; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    for (let j = i + 1; j < outline.length; j++) {
      const c = outline[j], d = outline[(j + 1) % outline.length];
      if (segmentsCross(a, b, c, d)) fault = 'roof outline crosses itself';
    }
  }
  for (let x = ROOF_RECT.x0; x <= ROOF_RECT.x1 + 1e-6 && !fault; x += 0.2) {
    for (let z = ROOF_RECT.z0; z <= ROOF_RECT.z1 + 1e-6; z += 0.2) {
      if (!pointInPoly(outline, x, z)) fault = `roof uncovers (${x.toFixed(2)}, ${z.toFixed(2)})`;
    }
  }
  const p = g.getAttribute('position');
  let cheek = false;
  for (let i = 0; i < p.count && !fault; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z < -1.3 && y >= 0 && y < 0.7) cheek = true;
    if (x > CAVITY.x0 && x < CAVITY.x1 && z > CAVITY.z0 && z < CAVITY.z1 && y > CAVITY.y0 && y < CAVITY.y1) {
      fault = `vertex in the cavity (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
    } else if (y > 2.4 && y < 2.58 && pointInPoly(outline, x, z)) {
      fault = `roof crown dipped to ${y.toFixed(2)}`;
    }
  }
  if (!fault && !cheek) fault = 'cheek is missing';
  const activity = [
    [CAVITY.x0 + 0.04, CAVITY.y0 + 0.04, CAVITY.z0 + 0.04],
    [CAVITY.x1 - 0.04, CAVITY.y1 - 0.04, CAVITY.z1 - 0.04],
  ];
  if (index) {
    for (let t = 0; t < index.count && !fault; t += 3) {
      const at = (k: number) => {
        const v = index.getX(t + k);
        return [p.getX(v), p.getY(v), p.getZ(v)];
      };
      if (triCutsBox(at(0), at(1), at(2), activity)) {
        const m = at(0);
        fault = `face cuts the activity space near (${m[0].toFixed(2)}, ${m[1].toFixed(2)}, ${m[2].toFixed(2)})`;
      }
    }
  }
  if (!fault) fault = circleOutsideSkin(phase);
  g.dispose();
  return { fault, triangles, exterior };
}

const exteriorOf = (solids: Solid[]) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of solids) {
    x0 = Math.min(x0, b.min[0]); x1 = Math.max(x1, b.max[0]);
    y0 = Math.min(y0, b.min[1]); y1 = Math.max(y1, b.max[1]);
    z0 = Math.min(z0, b.min[2]); z1 = Math.max(z1, b.max[2]);
  }
  return { along: x1 - x0, across: z1 - z0, height: y1 - y0 };
};

/**
 * Place one shelter for the dwelling's current home. The home anchor stays; the lie may move
 * a few metres so the body is inside. Null when every tried mouth is steep, wet, blocked, or short.
 */
export function placeShelter(input: {
  dwelling: Dwelling;
  obstacles: ShelterCircle[];
  /** World seed. The slab's breaks come from this and the home index, not from a hand-placed coordinate. */
  seed: number;
}): { plan: ShelterPlan | null; skip: string | null } {
  const fault = shelterFormFault();
  if (fault) return { plan: null, skip: `form: ${fault}` };
  const { dwelling } = input;
  const base = input.obstacles;
  const home = dwelling.sites.homes[dwelling.home];
  const drink = dwelling.sites.drink;
  const toDrink = Math.atan2(drink.z - home.z, drink.x - home.x);
  const ground = dwelling.groundAt;
  let best: { score: number; plan: ShelterPlan } | null = null;
  let skip = 'no direction kept the mouth, the bed, and the way to the drink open';

  const yaws = [0, 0.4, -0.4, 0.85, -0.85, 1.25, -1.25, 1.7, -1.7, Math.PI];
  const dists = [2.2, 3.0, 3.8];

  const tryOne = (yaw: number, dist: number, mirror: boolean): ShelterPlan | null => {
    const flank = yaw + (mirror ? -1 : 1) * Math.PI / 2;
    const bedX = home.x + Math.cos(flank) * dist;
    const bedZ = home.z + Math.sin(flank) * dist;
    const samples: [number, number][] = [];
    for (const b of LOCAL_SOLIDS) {
      if (b.role === 'roof') continue;
      for (let x = b.min[0]; x <= b.max[0] + 1e-6; x += 0.55) {
        for (let z = b.min[2]; z <= b.max[2] + 1e-6; z += 0.55) samples.push([x, z]);
      }
    }
    // The hollow and the walk in.
    for (let x = -1.4; x <= 2.7; x += 0.5) for (let z = -0.7; z <= 0.7; z += 0.45) samples.push([x, z]);
    dwelling.setObstacles(base);
    let minG = Infinity, maxG = -Infinity;
    for (const [lx, lz] of samples) {
      const [x, z] = toWorld(bedX, bedZ, yaw, lx, lz, mirror);
      if (!dwelling.dry(x, z)) return null;
      const h = ground(x, z);
      minG = Math.min(minG, h);
      maxG = Math.max(maxG, h);
    }
    const slope = maxG - minG;
    if (slope > 0.55) { skip = 'footprint slope over 0.55 m'; return null; }
    const originY = minG - BURY;
    const stand: [number, number][] = [[0, 0], [-1.15, 0], [-0.2, 0], [0.35, 0], [0, 0.35], [0, -0.35], [0.35, 0.3], [0.35, -0.3]];
    const roof = LOCAL_SOLIDS.find((s) => s.role === 'roof')!;
    let headroomMin = Infinity;
    for (const [lx, lz] of stand) {
      if (lx < roof.min[0] || lx > roof.max[0] || lz < roof.min[2] || lz > roof.max[2]) continue;
      const [x, z] = toWorld(bedX, bedZ, yaw, lx, lz, mirror);
      headroomMin = Math.min(headroomMin, originY + roof.min[1] - ground(x, z));
    }
    if (!(headroomMin < Infinity) || headroomMin < HEADROOM) { skip = `headroom ${headroomMin.toFixed(2)} m`; return null; }

    const [mx, mz] = toWorld(bedX, bedZ, yaw, 2.65, -0.15, mirror);
    const mouth: Spot = { x: mx, z: mz, facing: yaw };
    const facing = yaw + (mirror ? FACING_BIAS : -FACING_BIAS);
    const bed: Spot = { x: bedX, z: bedZ, facing };
    const localCircles = circlesOf(LOCAL_SOLIDS);
    const walls: ShelterCircle[] = localCircles.map((c) => {
      const [x, z] = toWorld(bedX, bedZ, yaw, c.lx, c.lz, mirror);
      return { x, z, r: c.r };
    });
    // The home anchor stays walkable, and the inward line stays outside the inflated walls.
    const blocked = (x: number, z: number, extra: number) =>
      walls.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + ROUTE_CLEAR + extra);
    if (blocked(home.x, home.z, 0) || blocked(bed.x, bed.z, 0.15) || blocked(mouth.x, mouth.z, 0.1)) return null;
    for (let x = -0.1; x <= 2.6; x += 0.3) {
      const [wx, wz] = toWorld(bedX, bedZ, yaw, x, 0, mirror);
      if (blocked(wx, wz, 0.05) || !dwelling.dry(wx, wz)) return null;
    }
    const merged = [...base, ...walls];
    dwelling.setObstacles(merged);
    if (!dwelling.dry(bed.x, bed.z) || !dwelling.dry(mouth.x, mouth.z) || !dwelling.dry(home.x, home.z)) {
      dwelling.setObstacles(base);
      return null;
    }
    if (!dwelling.dry(drink.x, drink.z)) { dwelling.setObstacles(base); return null; }
    const inward = dwelling.wayBetween([mouth.x, mouth.z], [bed.x, bed.z]);
    const out = dwelling.wayBetween([bed.x, bed.z], [drink.x, drink.z]);
    const back = dwelling.wayBetween([drink.x, drink.z], [mouth.x, mouth.z]);
    dwelling.setObstacles(base);
    if (!inward || !out || !back) { skip = 'no smoothed way through the mouth to the drink'; return null; }
    // The inward way stays in front of the back wall and off the flank.
    const flankWall = LOCAL_SOLIDS.find((s) => s.role === 'flank')!;
    const backWall = LOCAL_SOLIDS.find((s) => s.role === 'back')!;
    const cheek = LOCAL_SOLIDS.find((s) => s.role === 'cheek')!;
    for (const [x, z] of inward) {
      const dx = x - bedX, dz = z - bedZ, c = Math.cos(yaw), s = Math.sin(yaw);
      let lx = c * dx + s * dz, lz = -s * dx + c * dz;
      if (mirror) lz = -lz;
      if (lx < backWall.max[0] + 0.35) { skip = 'inward way cuts the back wall'; return null; }
      if (lz > flankWall.min[2] - 0.2) { skip = 'inward way cuts the flank'; return null; }
    }
    const interiorWidth = flankWall.min[2] - cheek.max[2];
    const triangles = LOCAL_SOLIDS.length * 12;
    const eye = (lx: number, lz: number, up: number): [number, number, number] => {
      const [x, z] = toWorld(bedX, bedZ, yaw, lx, lz, mirror);
      return [x, ground(x, z) + up, z];
    };
    const look = (lx: number, lz: number, up: number): [number, number, number] => {
      const [x, z] = toWorld(bedX, bedZ, yaw, lx, lz, mirror);
      return [x, ground(bedX, bedZ) + up, z];
    };
    return {
      bed, mouth, originY, yaw, mirror,
      obstacles: merged, walls,
      headroomMin, interiorWidth, entranceClear: headroomMin,
      exterior: exteriorOf(LOCAL_SOLIDS),
      fromHome: dist,
      drinkAlign: Math.cos(yaw - toDrink),
      slope,
      liveView: { from: eye(3.6, -5.2, 1.65), to: look(0.15, 0.05, 0.72) },
      cutView: { from: eye(-0.2, 5.6, 2.3), to: look(0.1, 0.4, 1.15) },
      triangles,
      formSeed: input.seed * 17 + dwelling.home,
    };
  };

  for (const mirror of [false, true]) {
    for (const off of yaws) {
      for (const dist of dists) {
        const plan = tryOne(toDrink + off, dist, mirror);
        if (!plan) continue;
        const score = plan.drinkAlign * 5 + (1 - dist / 6) - plan.slope * 2 + Math.min(plan.headroomMin - HEADROOM, 0.4);
        if (!best || score > best.score) best = { score, plan };
      }
    }
  }
  if (!best) return { plan: null, skip };
  const audit = shelterMeshAudit(best.plan.formSeed);
  if (audit.fault) return { plan: null, skip: audit.fault };
  best.plan.triangles = audit.triangles;
  best.plan.exterior = audit.exterior;
  dwelling.setObstacles(best.plan.obstacles);
  return { plan: best.plan, skip: null };
}
