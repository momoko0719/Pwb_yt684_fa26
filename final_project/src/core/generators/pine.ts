import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import type { IslandParams } from '../params/island';
import { createRng } from '../rng';
import type { IslandField } from './island';

export const PINE_VARIANTS = 4;

export interface PineSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** Direction (radians, in the xz plane) the tree reaches toward: its long limb points this way. */
  facing: number;
  /** Direction away from the island's centre; the tree leans this way. */
  yaw: number;
  /** Tilt (radians) away from the island's centre: trees on the edge lean out over the void. */
  lean: number;
  variant: number;
}

/**
 * Where pines grow: few of them, on ridges, peak shoulders and the cliff edge (Huangshan pines grow
 * out of rock, not on the meadow), never in pools, never on sheer faces, and apart from each other.
 * Candidates are scored, then drawn by score with a minimum spacing.
 */
export function placePines(field: IslandField, p: IslandParams, count: number, avoid?: (x: number, z: number) => boolean): PineSpot[] {
  const rng = createRng(p.seed * 31 + 7);
  const s = p.radius / 31;
  const step = 0.6 * s;
  const candidates: { x: number; z: number; y: number; score: number; rho: number }[] = [];
  for (let i = 0; i < 1500; i++) {
    const angle = rng() * Math.PI * 2;
    const rho = Math.sqrt(0.05 + rng() * 0.9);
    const r = rho * field.rim(angle);
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const y = field.top(x, z);
    const yx = field.top(x + step, z), yz = field.top(x, z + step);
    if (y === null || yx === null || yz === null) continue;
    if (field.pools.some((q) => Math.hypot(x - q.x, z - q.z) < q.radius * 1.3)) continue;
    if (avoid?.(x, z)) continue;
    const slope = Math.hypot(yx - y, yz - y) / step;
    if (slope > 1.3) continue; // sheer rock: no foothold
    const onPeak = Math.min(field.lift(x, z) / Math.max(p.peakHeight, 1), 1);
    const edge = rho ** 4;
    const rocky = Math.min(slope / 0.5, 1);
    candidates.push({ x, z, y, rho, score: 0.15 + onPeak * 1.2 + edge * 1.1 + rocky * 0.6 });
  }
  const spots: PineSpot[] = [];
  const minGap = 4 * s;
  const total = () => candidates.reduce((sum, c) => sum + c.score, 0);
  while (spots.length < count && candidates.length) {
    let pick = rng() * total();
    const i = Math.max(0, candidates.findIndex((c) => (pick -= c.score) <= 0));
    const c = candidates.splice(i, 1)[0];
    if (spots.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < minGap)) continue;
    const yaw = Math.atan2(c.z, c.x);
    const edge = c.rho > 0.8;
    spots.push({
      x: c.x,
      y: c.y - 0.1 * s,
      z: c.z,
      scale: (0.46 + rng() * 0.26) * s,
      // On the edge the long limb reaches out over the void, like the Welcoming Pine; inland, anywhere.
      facing: edge ? yaw + (rng() - 0.5) * 0.6 : rng() * Math.PI * 2,
      yaw,
      lean: edge ? 0.15 + rng() * 0.2 : rng() * 0.08,
      variant: spots.length % PINE_VARIANTS,
    });
  }
  return spots;
}

/**
 * Huangshan pines grown from an L-system (Class 07). Pure functions: same seed, same tree.
 *
 * 1. expand: the axiom is rewritten by stochastic rules; near the end the trunk stops climbing and
 *    spreads into a crown of level limbs, which gives the flat top;
 * 2. interpret: a 3D turtle walks the string (F forward, + - turn, & pitch, * golden-angle roll,
 *    [ ] branch). Limbs are kept level (their "up" stays up), so + and - fan them out sideways into
 *    flat layers; twig tips turn up toward the light; limbs on the reaching side grow longer. Every
 *    tip leaves a tuft of needles that points up like a brush;
 * 3. mesh: one geometry per level of detail, cut by recursion depth:
 *    LOD0 every needle, over a dark core under each spray; LOD1 twigs dropped, each spray one flat
 *    cloud; LOD2 trunk only, one cloud per limb.
 */

interface Rule { from: string; to: string; weight: number; crown?: boolean }

const AXIOM = 'FFA';
const RULES: Rule[] = [
  // Trunk: climbs, sometimes bare, sometimes with one or two limbs (golden-angle apart).
  { from: 'A', to: 'F[&B]*A', weight: 0.4 },
  { from: 'A', to: 'F[&B]**[&B]*A', weight: 0.4 },
  { from: 'A', to: 'FA', weight: 0.2 },
  // The last generations: the trunk stops and spreads into level limbs (the flat top).
  { from: 'A', to: 'F[&B]**[&B]**[&B]', weight: 1, crown: true },
  // Limb: grows on, setting sprays to either side.
  { from: 'B', to: 'F[-C]B', weight: 0.3 },
  { from: 'B', to: 'F[+C]B', weight: 0.3 },
  { from: 'B', to: 'F[-C][+C]B', weight: 0.25 },
  { from: 'B', to: 'FB', weight: 0.15 },
  // Spray: a fan of twigs in the plane of the limb.
  { from: 'C', to: 'F[-D][+D]C', weight: 0.4 },
  { from: 'C', to: 'F[-D]C', weight: 0.25 },
  { from: 'C', to: 'F[+D]C', weight: 0.25 },
  { from: 'C', to: 'FD', weight: 0.1 },
  // Twig: sets shoots to either side and ends in a tuft of needles.
  { from: 'D', to: 'F[-E][+E]F[-E][+E]T', weight: 0.6 },
  { from: 'D', to: 'F[-E][+E]T', weight: 0.4 },
  // Shoot: this year's growth, clothed in needles.
  { from: 'E', to: 'FT', weight: 1 },
];
const BUDS = new Set(['A', 'B', 'C', 'D', 'E', 'T']); // every bud left at the end becomes a tuft
const GENERATIONS = 8;
/** Generations (counted from the end) in which the trunk spreads into its crown. */
const CROWN = 3;

const TURTLE = {
  pitch: 74, // degrees for & : limbs leave the trunk almost level
  fan: 48, // degrees for + - : sprays and twigs fan out within the limb's layer
  length: 0.9,
  width: 0.24,
  lengthDecay: 0.74,
  widthDecay: 0.55,
  taper: 0.93,
  /** Per step, the trunk wanders (bend) and limbs sag (gravity); twigs turn up toward light. */
  bend: 0.26,
  gravity: 0.05,
  light: 0.14,
  jitter: 0.4,
  /** How much longer limbs grow on the reaching side (+x in the tree's own frame). */
  reach: 0.7,
  tuft: 0.6,
};
const GOLDEN = (137.5 * Math.PI) / 180;

/** The string after a number of rewrites; every bud is replaced by one of its rules, chosen by weight. */
export function expandPine(seed: number, generations = GENERATIONS): string {
  const rng = createRng(seed);
  let s = AXIOM;
  for (let g = 0; g < generations; g++) {
    const crown = g >= generations - CROWN;
    let next = '';
    for (const c of s) {
      const options = RULES.filter((r) => r.from === c && (c !== 'A' || !!r.crown === crown));
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
/** A tuft of needles at a shoot tip: where, and which way the shoot points. */
interface Tuft extends Part { p: Vector3; dir: Vector3 }
export interface PineSkeleton { segments: Segment[]; tufts: Tuft[] }

export function interpretPine(str: string, seed: number): PineSkeleton {
  const rng = createRng(seed * 7 + 3);
  const p = TURTLE;
  const turn = (deg: number) => ((deg * Math.PI) / 180) * (1 + p.jitter * (rng() - 0.5));
  const up = new Vector3(0, 1, 0);
  const reachSide = new Vector3(1, 0, 0);
  let pos = new Vector3();
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
    H.applyQuaternion(q);
    L.applyQuaternion(q);
    U.applyQuaternion(q);
  };
  /** Bend the heading toward `target` by `amount`, carrying the frame along. */
  const tropism = (target: Vector3, amount: number) => {
    const nh = H.clone().addScaledVector(target, amount).normalize();
    q.setFromUnitVectors(H, nh);
    H = nh;
    L.applyQuaternion(q);
    U.applyQuaternion(q);
  };
  /** Roll about the heading so "left" is level: a limb's turns then stay in a flat layer. */
  const level = () => {
    const l = new Vector3().crossVectors(up, H);
    if (l.lengthSq() < 1e-6) return;
    L = l.normalize();
    U = new Vector3().crossVectors(H, L);
  };
  const tuft = () => tufts.push({ p: pos.clone(), dir: H.clone(), depth, owners: [...owners] });

  for (const c of str) {
    if (c === 'F') {
      if (depth === 0) {
        // The trunk wanders a little, but keeps climbing.
        rotate(L.clone(), (rng() - 0.5) * p.bend * 2);
        rotate(U.clone(), (rng() - 0.5) * p.bend * 2);
        tropism(up, 0.08);
      } else {
        rotate(U.clone(), (rng() - 0.5) * p.jitter * 0.3);
        level();
      }
      // Limbs reaching toward the open side grow longer.
      const step = depth === 0 ? len : len * (1 + p.reach * Math.max(0, H.dot(reachSide)));
      const a = pos.clone();
      pos = pos.clone().addScaledVector(H, step);
      // The base of the trunk flares where it grips the rock.
      const r0 = segments.length === 0 ? width * 1.6 : width;
      segments.push({ a, b: pos.clone(), r0, r1: width * p.taper, depth, owners });
      width *= p.taper;
      // Needles clothe the young wood, not just its tips.
      if (depth >= 2) tuft();
      if (depth === 1) tropism(up, -p.gravity);
      else if (depth >= 2) tropism(up, p.light);
    } else if (c === '+') rotate(U.clone(), turn(p.fan));
    else if (c === '-') rotate(U.clone(), -turn(p.fan));
    else if (c === '&') rotate(L.clone(), turn(p.pitch));
    else if (c === '^') rotate(L.clone(), -turn(p.pitch));
    else if (c === '*') rotate(H.clone(), GOLDEN + (rng() - 0.5) * p.jitter);
    else if (c === '[') {
      stack.push({ pos, H: H.clone(), L: L.clone(), U: U.clone(), len, width, depth, owners });
      depth += 1;
      len *= p.lengthDecay;
      width *= p.widthDecay;
      owners = [...owners, nextId++];
    } else if (c === ']') {
      const s = stack.pop();
      if (s) ({ pos, H, L, U, len, width, depth, owners } = s);
    } else if (BUDS.has(c)) tuft();
  }
  return { segments, tufts };
}

export const PINE_LODS = [0, 1, 2] as const;
export type PineLod = (typeof PINE_LODS)[number];
/**
 * Every level cuts at the sprays (recursion depth 2). Needles grow all along the young shoots, like a
 * bottle brush, and gather in a tuft at each tip; there is nothing under them, the mass is the
 * needles themselves.
 *   LOD0: every twig and needle (along: needles per unit of shoot; tuft: needles per tip);
 *   LOD1: a few, wider needles, one stick per spray for its twigs;
 *   LOD2: only the tip tufts, three broad needles each: still layered sprays, never a blob.
 */
const CUT = 2;
const SPEC: Record<PineLod, { sides: number; along: number; tuft: number; widen: number; twigs: boolean }> = {
  0: { sides: 7, along: 90, tuft: 14, widen: 1, twigs: true },
  1: { sides: 4, along: 14, tuft: 4, widen: 2.6, twigs: false },
  2: { sides: 3, along: 0, tuft: 3, widen: 7, twigs: false },
};
/**
 * Huangshan pine needles are short and stiff. Along a shoot they stand out at 35-55 degrees, leaning
 * forward and up; at the tip they close into an upright brush.
 */
const NEEDLE = { length: 0.36, width: 0.012, open: [0.6, 0.95], tipOpen: [0.15, 0.7], lift: 0.35 };

export function pineGeometry(skel: PineSkeleton, lod: PineLod, seed: number): BufferGeometry {
  const { sides, along, tuft, widen, twigs } = SPEC[lod];
  const cut = CUT;
  const rng = createRng(seed * 13 + lod);
  const pos: number[] = [];
  const nor: number[] = [];
  const tone: number[] = [];
  const vert = (p: Vector3, n: Vector3, kind: number, shade: number) => {
    pos.push(p.x, p.y, p.z);
    nor.push(n.x, n.y, n.z);
    tone.push(kind, shade);
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
      const corners: [Vector3, number, Vector3][] = [[a, r0, n0], [b, r1, n0], [a, r0, n1], [a, r0, n1], [b, r1, n0], [b, r1, n1]];
      for (const [c, r, n] of corners) vert(c.clone().addScaledVector(n, r), n, 0, 0.5);
    }
  };
  const up = new Vector3(0, 1, 0);
  /** One needle: a thin blade from `base` along `dir`, lit as if facing `out` and up; dark at the base. */
  const needle = (base: Vector3, dir: Vector3, out: Vector3, length: number) => {
    const tip = base.clone().addScaledVector(dir, length);
    const across = new Vector3().crossVectors(dir, out).normalize().multiplyScalar(NEEDLE.width * widen);
    const n = out.clone().addScaledVector(up, 0.8).normalize();
    vert(base.clone().sub(across), n, 1, 0.2);
    vert(base.clone().add(across), n, 1, 0.2);
    vert(tip, n, 1, 0.75);
  };
  /** A frame around an axis: two unit vectors across it. */
  const across = (axis: Vector3) => {
    const side = Math.abs(axis.y) < 0.9 ? up : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(axis, side).normalize();
    return [u, new Vector3().crossVectors(axis, u)] as const;
  };
  const splay = (axis: Vector3, u: Vector3, v: Vector3, around: number, open: number, lift: number) => {
    const out = u.clone().multiplyScalar(Math.cos(around)).addScaledVector(v, Math.sin(around));
    const dir = axis.clone().multiplyScalar(Math.cos(open)).addScaledVector(out, Math.sin(open)).addScaledVector(up, lift).normalize();
    return { out, dir };
  };
  const between = ([lo, hi]: number[]) => lo + (hi - lo) * rng();
  /** Needles all along a young shoot, standing out forward and a little up. */
  const shoot = (s: Segment) => {
    const axis = new Vector3().subVectors(s.b, s.a);
    const length = axis.length();
    axis.normalize();
    const [u, v] = across(axis);
    const count = Math.round(length * along * (0.8 + 0.4 * rng()));
    for (let k = 0; k < count; k++) {
      const { out, dir } = splay(axis, u, v, rng() * Math.PI * 2, between(NEEDLE.open), NEEDLE.lift);
      needle(s.a.clone().lerp(s.b, rng()), dir, out, NEEDLE.length * (0.8 + 0.4 * rng()));
    }
  };
  /** The brush at a tip: needles closing around an axis between the shoot and the sky. */
  const brush = (t: Tuft) => {
    const axis = t.dir.clone().addScaledVector(up, 0.9).normalize();
    const [u, v] = across(axis);
    for (let k = 0; k < tuft; k++) {
      const { out, dir } = splay(axis, u, v, (k / tuft) * Math.PI * 2 + rng() * 0.6, between(NEEDLE.tipOpen), 0);
      needle(t.p.clone().addScaledVector(t.dir, -0.08 * rng()), dir, out, NEEDLE.length * (0.9 + 0.4 * rng()));
    }
  };
  const group = <T extends Part>(items: T[]) => {
    const keep: T[] = [];
    const groups = new Map<number, T[]>();
    for (const it of items) {
      if (it.depth < cut) keep.push(it);
      else groups.set(it.owners[cut], [...(groups.get(it.owners[cut]) ?? []), it]);
    }
    return { keep, groups };
  };
  const segs = group(skel.segments);
  segs.keep.forEach((s) => tube(s.a, s.b, s.r0, s.r1));
  // Bare wood of a spray with no needles drawn: one stick from its base to its farthest tip.
  const stick = (list: Segment[]) => {
    const root = list[0].a;
    const far = list.reduce((f, s) => (s.b.distanceToSquared(root) > f.distanceToSquared(root) ? s.b : f), list[0].b);
    tube(root, far, list[0].r0, list[0].r0 * 0.4);
  };
  for (const list of segs.groups.values()) {
    if (twigs) list.forEach((s) => tube(s.a, s.b, s.r0, s.r1));
    else stick(list);
  }
  if (along) for (const seg of skel.segments) if (seg.depth >= CUT) shoot(seg);
  skel.tufts.forEach(brush);
  return finish(pos, nor, tone);
}

function finish(pos: number[], nor: number[], tone: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('aTone', new Float32BufferAttribute(tone, 2));
  g.computeBoundingSphere();
  return g;
}
