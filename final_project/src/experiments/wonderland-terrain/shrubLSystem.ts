/**
 * Low multi-stem shrub. Borrows Penglai pine turtle / tube / aTone mesh helpers' *pattern*
 * (`core/generators/pine.ts`) with shrub-only rules. Does not change pine RULES.
 *
 * Form: 3–6 basal stems from a small ground cluster; first forks in the lower ~10–20% of height;
 * crown wider than tall; mix of upward and side reach — not a mini pine / not a Y-squashed tree.
 */
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { createRng } from '../../core/rng';

interface Rule { from: string; to: string; weight: number }

/**
 * S = plant basal stems (no tall central bole).
 * B = cane from near ground; early C twigs → leaf tufts.
 */
const AXIOM = 'S';
const RULES: Rule[] = [
  // 4–5 basal stems around the root ( * = yaw).
  { from: 'S', to: '[&B]*[&B]**[&B]*[&B]**[&B]', weight: 0.45 },
  { from: 'S', to: '[&B]*[&B]**[&B]*[&B]', weight: 0.35 },
  { from: 'S', to: '[&B]*[&B]**[&B]*[&B]**[&B]*[&B]', weight: 0.2 },
  // Short first segment then fork (keeps first branch low in plant height).
  { from: 'B', to: 'F[+C][-C]B', weight: 0.4 },
  { from: 'B', to: 'F[+C]B', weight: 0.25 },
  { from: 'B', to: 'F[-C]B', weight: 0.2 },
  { from: 'B', to: 'F^B', weight: 0.15 },
  { from: 'C', to: 'F[+D][-D]T', weight: 0.55 },
  { from: 'C', to: 'F[+D]T', weight: 0.25 },
  { from: 'C', to: 'F[-D]T', weight: 0.2 },
  { from: 'D', to: 'FT', weight: 1 },
];
const BUDS = new Set(['S', 'B', 'C', 'D', 'T']);
const GENERATIONS = 4; // shorter than a tree — keeps canes low

/** Turtle in unit-plant metres (~1 m tall after normalize). */
const TURTLE = {
  pitch: 28, // stems leave ground steeply (low bush, not 55° V)
  fan: 48, // wide side spread → crown width ≥ height after normalize
  length: 0.09,
  width: 0.014,
  lengthDecay: 0.78,
  widthDecay: 0.7,
  taper: 0.88,
  bend: 0.12,
  gravity: 0.01,
  light: 0.18,
  jitter: 0.3,
  reach: 0.2,
};

/** Shrub-only leaves — not pine needles. */
export const SHRUB_LEAF = { length: 0.055, width: 0.009, open: [0.4, 0.8] as [number, number], tipTaper: 0.32 };

const GOLDEN = (137.5 * Math.PI) / 180;

export function expandShrub(seed: number, generations = GENERATIONS): string {
  const rng = createRng(seed + 401);
  let s = AXIOM;
  for (let g = 0; g < generations; g++) {
    let next = '';
    for (const c of s) {
      const options = RULES.filter((r) => r.from === c);
      if (!options.length) { next += c; continue; }
      let x = rng() * options.reduce((sum, r) => sum + r.weight, 0);
      next += (options.find((r) => (x -= r.weight) <= 0) ?? options[options.length - 1]).to;
    }
    s = next;
  }
  return s;
}

interface Part { depth: number; owners: number[] }
interface Segment extends Part { a: Vector3; b: Vector3; r0: number; r1: number }
interface Tuft extends Part { p: Vector3; dir: Vector3 }
export interface ShrubSkeleton { segments: Segment[]; tufts: Tuft[] }

export function interpretShrub(str: string, seed: number): ShrubSkeleton {
  const rng = createRng(seed * 7 + 11);
  const p = TURTLE;
  const turn = (deg: number) => ((deg * Math.PI) / 180) * (1 + p.jitter * (rng() - 0.5));
  const up = new Vector3(0, 1, 0);
  // Small basal offset so stems do not share one exact root point.
  let pos = new Vector3((rng() - 0.5) * 0.04, 0.01, (rng() - 0.5) * 0.04);
  let H = new Vector3(0, 1, 0);
  let L = new Vector3(-1, 0, 0);
  let U = new Vector3().crossVectors(H, L);
  let len = p.length;
  let width = p.width;
  let depth = 0;
  let owners = [0];
  let nextId = 1;
  const stack: { pos: Vector3; H: Vector3; L: Vector3; U: Vector3; len: number; width: number; depth: number; owners: number[] }[] = [];
  const segments: Segment[] = [];
  const tufts: Tuft[] = [];
  const q = new Quaternion();
  const rotate = (axis: Vector3, a: number) => {
    q.setFromAxisAngle(axis, a);
    H.applyQuaternion(q); L.applyQuaternion(q); U.applyQuaternion(q);
  };
  const tropism = (target: Vector3, amount: number) => {
    const nh = H.clone().addScaledVector(target, amount).normalize();
    q.setFromUnitVectors(H, nh);
    H = nh; L.applyQuaternion(q); U.applyQuaternion(q);
  };
  for (const c of str) {
    if (c === 'F') {
      rotate(L.clone(), (rng() - 0.5) * p.bend);
      rotate(U.clone(), (rng() - 0.5) * p.bend * 0.5);
      if (depth >= 1) tropism(up, p.light * 0.45);
      else tropism(up, -p.gravity);
      const a = pos.clone();
      pos = pos.clone().addScaledVector(H, len);
      segments.push({ a, b: pos.clone(), r0: width, r1: width * p.taper, depth, owners });
      width *= p.taper;
      if (depth >= 1) tufts.push({ p: pos.clone().lerp(a, 0.4), dir: H.clone(), depth, owners: [...owners] });
    } else if (c === '+') rotate(U.clone(), turn(p.fan));
    else if (c === '-') rotate(U.clone(), -turn(p.fan));
    else if (c === '&') rotate(L.clone(), turn(p.pitch));
    else if (c === '^') rotate(L.clone(), -turn(p.pitch * 0.65));
    else if (c === '*') {
      rotate(H.clone(), GOLDEN + (rng() - 0.5) * p.jitter);
      // Nudge next stem origin slightly on the ground plane.
      pos = new Vector3(pos.x + (rng() - 0.5) * 0.05, Math.max(pos.y, 0.01), pos.z + (rng() - 0.5) * 0.05);
    } else if (c === '[') {
      stack.push({ pos, H: H.clone(), L: L.clone(), U: U.clone(), len, width, depth, owners });
      depth += 1;
      len *= p.lengthDecay;
      width *= p.widthDecay;
      owners = [...owners, nextId++];
    } else if (c === ']') {
      const s = stack.pop();
      if (s) ({ pos, H, L, U, len, width, depth, owners } = s);
    } else if (BUDS.has(c)) {
      tufts.push({ p: pos.clone(), dir: H.clone(), depth, owners: [...owners] });
    }
  }
  return { segments, tufts };
}

export type ShrubLod = 0 | 1 | 2;

const SPEC: Record<ShrubLod, { sides: number; along: number; tip: number; widen: number }> = {
  0: { sides: 5, along: 22, tip: 4, widen: 1 },
  1: { sides: 4, along: 7, tip: 3, widen: 1.7 },
  2: { sides: 3, along: 0, tip: 2, widen: 2.8 },
};

export function shrubGeometry(skel: ShrubSkeleton, lod: ShrubLod, seed: number): BufferGeometry {
  const { sides, along, tip, widen } = SPEC[lod];
  const rng = createRng(seed * 17 + lod * 3);
  const pos: number[] = [], nor: number[] = [], tone: number[] = [];
  const vert = (p: Vector3, n: Vector3, kind: number, shade: number) => {
    pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); tone.push(kind, shade);
  };
  const tube = (a: Vector3, b: Vector3, r0: number, r1: number) => {
    const dir = new Vector3().subVectors(b, a).normalize();
    const side = Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(dir, side).normalize();
    const v = new Vector3().crossVectors(dir, u);
    const radial = (i: number) => {
      const t = (i / sides) * Math.PI * 2;
      return u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
    };
    for (let i = 0; i < sides; i++) {
      const n0 = radial(i), n1 = radial(i + 1);
      for (const [c, r, n] of [[a, r0, n0], [b, r1, n0], [a, r0, n1], [a, r0, n1], [b, r1, n0], [b, r1, n1]] as [Vector3, number, Vector3][]) {
        vert(c.clone().addScaledVector(n, r), n, 0, 0.5);
      }
    }
  };
  const up = new Vector3(0, 1, 0);
  const blade = (base: Vector3, dir: Vector3, out: Vector3, length: number) => {
    const tipP = base.clone().addScaledVector(dir, length);
    const mid = base.clone().addScaledVector(dir, length * 0.45);
    const across = new Vector3().crossVectors(dir, out).normalize().multiplyScalar(SHRUB_LEAF.width * widen);
    const n = out.clone().addScaledVector(up, 0.7).normalize();
    vert(base.clone().sub(across.clone().multiplyScalar(0.55)), n, 1, 0.25);
    vert(base.clone().add(across.clone().multiplyScalar(0.55)), n, 1, 0.25);
    vert(mid.clone().add(across), n, 1, 0.55);
    vert(base.clone().sub(across.clone().multiplyScalar(0.55)), n, 1, 0.25);
    vert(mid.clone().add(across), n, 1, 0.55);
    vert(mid.clone().sub(across), n, 1, 0.55);
    vert(mid.clone().sub(across.clone().multiplyScalar(SHRUB_LEAF.tipTaper)), n, 1, 0.55);
    vert(mid.clone().add(across.clone().multiplyScalar(SHRUB_LEAF.tipTaper)), n, 1, 0.55);
    vert(tipP, n, 1, 0.85);
  };
  const across = (axis: Vector3) => {
    const side = Math.abs(axis.y) < 0.9 ? up : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(axis, side).normalize();
    return [u, new Vector3().crossVectors(axis, u)] as const;
  };
  const cut = lod === 0 ? 99 : lod === 1 ? 3 : 2;
  for (const s of skel.segments) {
    if (s.depth <= cut) tube(s.a, s.b, s.r0, s.r1);
  }
  if (along > 0) {
    for (const s of skel.segments) {
      if (s.depth < 1) continue;
      const axis = new Vector3().subVectors(s.b, s.a);
      const len = axis.length(); if (len < 1e-4) continue;
      axis.normalize();
      const [u, v] = across(axis);
      const count = Math.max(1, Math.round(len * along * (0.7 + 0.5 * rng())));
      for (let k = 0; k < count; k++) {
        const around = rng() * Math.PI * 2;
        const open = SHRUB_LEAF.open[0] + (SHRUB_LEAF.open[1] - SHRUB_LEAF.open[0]) * rng();
        const out = u.clone().multiplyScalar(Math.cos(around)).addScaledVector(v, Math.sin(around));
        const dir = axis.clone().multiplyScalar(Math.cos(open)).addScaledVector(out, Math.sin(open)).addScaledVector(up, 0.2).normalize();
        blade(s.a.clone().lerp(s.b, rng()), dir, out, SHRUB_LEAF.length * (0.75 + 0.4 * rng()));
      }
    }
  }
  for (const t of skel.tufts) {
    if (t.depth < 1 && lod > 0) continue;
    const axis = t.dir.clone().addScaledVector(up, 0.45).normalize();
    const [u, v] = across(axis);
    for (let k = 0; k < tip; k++) {
      const around = (k / tip) * Math.PI * 2 + rng() * 0.4;
      const out = u.clone().multiplyScalar(Math.cos(around)).addScaledVector(v, Math.sin(around));
      const dir = axis.clone().multiplyScalar(0.5).addScaledVector(out, 0.75).normalize();
      blade(t.p, dir, out, SHRUB_LEAF.length * (0.85 + 0.3 * rng()) * (lod === 2 ? 1.35 : 1));
    }
  }
  // Normalize height to 1; also measure width — if crown is narrow, scale XZ up slightly (not squash Y).
  let minY = Infinity, maxY = -Infinity, maxR = 0;
  for (let i = 0; i < pos.length; i += 3) {
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
    maxR = Math.max(maxR, Math.hypot(pos[i], pos[i + 2]));
  }
  const h = Math.max(maxY - minY, 0.2);
  const widthScale = maxR / h < 0.55 ? 0.7 / Math.max(maxR / h, 0.2) : 1; // ensure crown width ≳ height
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] / h) * widthScale;
    pos[i + 1] = (pos[i + 1] - minY) / h;
    pos[i + 2] = (pos[i + 2] / h) * widthScale;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('aTone', new Float32BufferAttribute(tone, 2));
  g.computeBoundingSphere();
  return g;
}

export function makeShrubLods(variant: number): { near: BufferGeometry; mid: BufferGeometry; far: BufferGeometry; tris: { near: number; mid: number; far: number } } {
  const seed = 9137 + variant * 31;
  const skel = interpretShrub(expandShrub(seed), seed);
  const near = shrubGeometry(skel, 0, seed);
  const mid = shrubGeometry(skel, 1, seed + 1);
  const far = shrubGeometry(skel, 2, seed + 2);
  const tris = (g: BufferGeometry) => (g.getAttribute('position').count / 3);
  return { near, mid, far, tris: { near: tris(near), mid: tris(mid), far: tris(far) } };
}

export function shrubLeafMetrics(plantHeight = 0.8, widthRatio = 1.5) {
  return {
    unitLeafL: SHRUB_LEAF.length,
    unitLeafW: SHRUB_LEAF.width,
    worldLeafL: SHRUB_LEAF.length * plantHeight,
    worldLeafW: SHRUB_LEAF.width * plantHeight * widthRatio,
    plantHeight,
    crownWidth: plantHeight * widthRatio,
  };
}
