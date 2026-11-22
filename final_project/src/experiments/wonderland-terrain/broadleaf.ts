/**
 * Broadleaf trees for White Jade Island (round 11, docs/plan-2026-11-19-far-view.md): two species
 * beside the pines, grown by the same kind of L-system (core/generators/pine.ts) with their own
 * rules. Only the grammar and a few turtle numbers differ; the crown's shape is what they make.
 *
 * - Parasol (伞冠树): a short trunk forks low into three or four limbs leaning out; twigs turn up
 *   toward the light, so the leaf clumps at their tips meet in a wide, flat-topped dome, wider
 *   than tall. Warm orange; grows at the meadow's edge, where woodland meets open ground.
 * - Weeping (垂枝树, after shidare-zakura): a thick trunk and two whorls of limbs that arch out and
 *   down; whips leave every limb and branch, the top too, rise a little and then hang, so the
 *   crown is one rounded, curtained mound. Pale pink; grows only by water.
 *
 * The turtle: F forward, + - turn, & ^ pitch, * roll by the golden angle, [ ] branch (each branch
 * shorter and thinner), ! from here on a hanging whip. Leaf clumps grow where a twig ends (L or
 * any bud left unexpanded); the weeping tree's whips carry narrow streaks of blossom along their
 * length instead of bark. The geometry is normalised to 1 m
 * tall: scale it by the tree's height. Pure: the same seed gives the same tree.
 */
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { createRng } from '../../core/rng';

export type BroadleafKind = 'parasol' | 'weeping';

interface Rule { from: string; to: string; weight: number }
interface Species {
  axiom: string;
  rules: Rule[];
  generations: number;
  turtle: {
    pitch: number; fan: number; length: number; width: number; lengthDecay: number; widthDecay: number;
    taper: number; bend: number; jitter: number;
    /** Per step, twigs this deep or deeper turn toward the light by `light`... */
    lightFrom: number; light: number;
    /** ...or droop under their weight by `gravity` (and stop this high above the ground, turtle units). */
    gravityFrom: number; gravity: number; floor?: number;
    /** Whips by the trunk stop higher: at this height (turtle units) at the trunk, down to `floor` this far out. */
    floorIn?: [number, number];
    /** Instead: a droop for each depth (trunk, limb, branch...), so even the big limbs arch... */
    droop?: number[];
    /** ...and for whips (after a `!`), one for each step along the whip: they arc over, then hang. */
    whipDroop?: number[];
    /** Whips stop this much higher or lower at random (turtle units): a ragged hem. */
    floorJitter?: number;
    /** The trunk's own taper per step (a flared, heavy bole). */
    trunkTaper?: number;
    /** Each step of a hanging whip is this much longer (the curtain's length; atlas knob). */
    whipLength?: number;
  };
  leaf: {
    /** A clump at a twig's end: its radius and leaf count, the leaf size (turtle units). */
    clump: number; count: number; size: number;
    /** Leaves strung along twigs at least this deep, per unit of length (0: none). */
    alongFrom: number; along: number;
    /** Leaves on whips lie along them, long and narrow, so the curtain has a falling grain. */
    streak?: boolean;
    /** Each hanging whip also gets a ribbon of blossom this wide (turtle units): a dense veil, two triangles a step. */
    ribbon?: number;
  };
  /** Real heights (m) the island grows it at. */
  height: [number, number];
}

export const BROADLEAF: Record<BroadleafKind, Species> = {
  parasol: {
    axiom: 'A',
    rules: [
      { from: 'A', to: 'FFX', weight: 0.7 }, // trunk: two steps, then the fork
      { from: 'A', to: 'FX', weight: 0.3 },
      { from: 'X', to: '[&B]*[&B]*[&B]*[C]', weight: 0.5 }, // three or four limbs leaning out, one short leader up the middle
      { from: 'X', to: '[&B]*[&B]*[&B]*[&B]*[FC]', weight: 0.5 },
      // Each step along a limb sends out side branches and a shorter limb onward, so the limbs taper outward.
      { from: 'B', to: 'F[+C][-C][B]', weight: 0.45 },
      { from: 'B', to: 'F[+C][B]', weight: 0.25 },
      { from: 'B', to: 'F[-C][B]', weight: 0.2 },
      { from: 'B', to: 'FC', weight: 0.1 },
      { from: 'C', to: 'F[+D][-D]L', weight: 0.6 },
      { from: 'C', to: 'F[+D]L', weight: 0.4 },
      { from: 'D', to: 'FL', weight: 1 },
    ],
    generations: 6,
    turtle: { pitch: 60, fan: 42, length: 1, width: 0.2, lengthDecay: 0.84, widthDecay: 0.66, taper: 0.9, bend: 0.14, jitter: 0.35, lightFrom: 1, light: 0.13, gravityFrom: 99, gravity: 0 },
    leaf: { clump: 0.85, count: 18, size: 0.34, alongFrom: 99, along: 0 },
    height: [7, 9],
  },
  weeping: {
    // After shidare-zakura seen in Japan (owner's photos, 2026-11-20) and three red-team reviews:
    // a thick flared trunk splits at 2–3 m into two or three leaning stems, each carrying whorls of
    // great limbs that run far out and arch down,
    // forking and turning as they go (a roll * before every side branch, so the crown fills a
    // round disc from above, not a star). Whips leave every limb and branch, the top included, as
    // fountains: a short rise, then a droop that grows along them, so the crown is one rounded,
    // curtained mound; their lengths vary, longest at the rim, the trunk showing underneath.
    axiom: 'A',
    rules: [
      { from: 'A', to: 'FFX', weight: 1 },
      // The trunk splits into two or three stems nearly as thick as itself (%), leaning apart (/).
      { from: 'X', to: '[%/S]*[%/S]*[%/S]', weight: 0.5 },
      { from: 'X', to: '[%/S]*[%/S]', weight: 0.5 },
      // A stem: whorls of limbs, ending in a weeping crown of its own.
      { from: 'S', to: 'F[&B]*[&B]*F[&B]*[&B]*[C]', weight: 0.6 },
      { from: 'S', to: 'F[&B]*[&B]*[&B]*F[C]', weight: 0.4 },
      // A limb: forks as it goes (a shorter limb onward), whips and branches all along.
      { from: 'B', to: 'F[W]*[+C]F[^W]*[-C][B]', weight: 0.5 },
      { from: 'B', to: 'F*[-C][W]F*[+C][^W][B]', weight: 0.3 },
      { from: 'B', to: 'F[W]*[+C][^W]L', weight: 0.2 },
      // A branch: whips on every side; now and then another branch.
      { from: 'C', to: '*F[W]*[+W][^W]F*[-W][W]L', weight: 0.5 },
      { from: 'C', to: '*F[W]*[+C]F[-W][W]L', weight: 0.3 },
      { from: 'C', to: 'F*[W]F[^W]L', weight: 0.2 },
      // A whip: rises a little, then hangs; three to nine steps long.
      { from: 'W', to: '!^FFFL', weight: 0.2 },
      { from: 'W', to: '!^FFFFFL', weight: 0.3 },
      { from: 'W', to: '!^FFFFFFFL', weight: 0.3 },
      { from: 'W', to: '!^FFFFFFFFFL', weight: 0.2 },
    ],
    generations: 7,
    turtle: {
      pitch: 46, fan: 58, length: 1, width: 0.36, lengthDecay: 0.86, widthDecay: 0.72, taper: 0.9, trunkTaper: 0.96,
      bend: 0.45, jitter: 0.4, lightFrom: 99, light: 0, gravityFrom: 99, gravity: 0,
      floor: 0.5, floorIn: [2.6, 5], floorJitter: 0.6,
      droop: [0, 0.02, 0.06, 0.13, 0.22, 0.3], whipDroop: [0.12, 0.3, 0.55, 0.9],
    },
    leaf: { clump: 0.3, count: 5, size: 0.2, alongFrom: 99, along: 6, streak: true, ribbon: 0.22 },
    height: [7, 10],
  },
};

const GOLDEN = (137.5 * Math.PI) / 180;

/**
 * The atlas knobs (and "apply to island"): three numbers per species that the visitor can turn.
 * Their birth values are the species' own, so untouched knobs grow exactly the trees above.
 * - parasol: spread (degrees the limbs lean out), light (how hard twigs turn up), clump (leaf clump size);
 * - weeping: reach (degrees the great limbs lean out), arch (how hard limbs and whips bend down,
 *   x the species' droop), whip (x the length of each whip step: the curtain's length).
 */
export type BroadleafKnobs = Record<string, number>;
export interface BroadleafKnob { key: string; min: number; max: number; step: number }
export const BROADLEAF_KNOBS: Record<BroadleafKind, BroadleafKnob[]> = {
  parasol: [
    { key: 'spread', min: 35, max: 80, step: 1 },
    { key: 'light', min: 0, max: 0.3, step: 0.01 },
    { key: 'clump', min: 0.5, max: 1.3, step: 0.01 },
  ],
  weeping: [
    { key: 'reach', min: 28, max: 64, step: 1 },
    { key: 'arch', min: 0.4, max: 1.6, step: 0.01 },
    { key: 'whip', min: 0.5, max: 1.5, step: 0.01 },
  ],
};
export function birthKnobs(kind: BroadleafKind): BroadleafKnobs {
  const sp = BROADLEAF[kind];
  return kind === 'parasol'
    ? { spread: sp.turtle.pitch, light: sp.turtle.light, clump: sp.leaf.clump }
    : { reach: sp.turtle.pitch, arch: 1, whip: 1 };
}
/** True when these knobs grow the species' own tree (nothing turned). */
export function isBirth(kind: BroadleafKind, knobs?: BroadleafKnobs | null): boolean {
  if (!knobs) return true;
  const b = birthKnobs(kind);
  return Object.keys(b).every((k) => knobs[k] === undefined || Math.abs(knobs[k] - b[k]) < 1e-6);
}
/** The species with its knobs turned. */
function speciesOf(kind: BroadleafKind, knobs?: BroadleafKnobs | null): Species {
  const sp = BROADLEAF[kind];
  if (isBirth(kind, knobs)) return sp;
  const k = { ...birthKnobs(kind), ...knobs };
  if (kind === 'parasol') {
    const grow = k.clump / sp.leaf.clump;
    return { ...sp, turtle: { ...sp.turtle, pitch: k.spread, light: k.light }, leaf: { ...sp.leaf, clump: k.clump, count: Math.round(sp.leaf.count * grow ** 1.5) } };
  }
  return {
    ...sp,
    turtle: {
      ...sp.turtle, pitch: k.reach, whipLength: k.whip,
      droop: sp.turtle.droop?.map((d) => d * k.arch),
      whipDroop: sp.turtle.whipDroop?.map((d) => Math.min(d * k.arch, 1.5)),
    },
  };
}

/** The string after all generations, and for each symbol the generation that wrote it (0: the axiom). */
export function expandBroadleafTagged(kind: BroadleafKind, seed: number): { str: string; birth: Uint8Array } {
  const sp = BROADLEAF[kind];
  const rng = createRng(seed + 503);
  let s = sp.axiom, born: number[] = Array.from(s, () => 0);
  for (let g = 0; g < sp.generations; g++) {
    let next = '';
    const nextBorn: number[] = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const options = sp.rules.filter((r) => r.from === c);
      if (!options.length) { next += c; nextBorn.push(born[i]); continue; }
      let x = rng() * options.reduce((sum, r) => sum + r.weight, 0);
      const to = (options.find((r) => (x -= r.weight) <= 0) ?? options[options.length - 1]).to;
      next += to;
      for (let j = 0; j < to.length; j++) nextBorn.push(g + 1);
    }
    s = next; born = nextBorn;
  }
  return { str: s, birth: Uint8Array.from(born) };
}

export function expandBroadleaf(kind: BroadleafKind, seed: number): string {
  return expandBroadleafTagged(kind, seed).str;
}

interface Segment { a: Vector3; b: Vector3; r0: number; r1: number; depth: number; hang: boolean; gen: number }
interface Tip { p: Vector3; dir: Vector3; gen: number }
/** buds[g]: where the buds stood after generation g (only when the generations were given): the growing points. */
export interface BroadleafSkeleton { segments: Segment[]; tips: Tip[]; buds: Vector3[][] }

const BUDS = new Set(['A', 'X', 'S', 'B', 'C', 'D', 'W', 'L']);

export function interpretBroadleaf(kind: BroadleafKind, str: string, seed: number, knobs?: BroadleafKnobs | null, birth?: Uint8Array): BroadleafSkeleton {
  const p = speciesOf(kind, knobs).turtle;
  const rng = createRng(seed * 7 + 13);
  const turn = (deg: number) => ((deg * Math.PI) / 180) * (1 + p.jitter * (rng() - 0.5));
  const up = new Vector3(0, 1, 0), down = new Vector3(0, -1, 0);
  let pos = new Vector3();
  let H = new Vector3(0, 1, 0), L = new Vector3(-1, 0, 0), U = new Vector3().crossVectors(H, L);
  let len = p.length, width = p.width, depth = 0, hang = false, step = 0, stopShift = 0;
  const stack: { pos: Vector3; H: Vector3; L: Vector3; U: Vector3; len: number; width: number; depth: number; hang: boolean; step: number; stopShift: number }[] = [];
  const segments: Segment[] = [], tips: Tip[] = [], buds: Vector3[][] = [];
  const q = new Quaternion();
  const rotate = (axis: Vector3, a: number) => { q.setFromAxisAngle(axis, a); H.applyQuaternion(q); L.applyQuaternion(q); U.applyQuaternion(q); };
  const tropism = (target: Vector3, amount: number) => {
    const nh = H.clone().addScaledVector(target, amount).normalize();
    q.setFromUnitVectors(H, nh);
    H = nh; L.applyQuaternion(q); U.applyQuaternion(q);
  };
  for (let i = 0; i < str.length; i++) {
    const c = str[i], gen = birth ? birth[i] : 0;
    // A run of symbols written after generation g grew from one bud of generation g, standing where the run starts.
    if (birth) for (let g = i > 0 ? birth[i - 1] : 0; g < gen; g++) (buds[g] ??= []).push(pos.clone());
    if (c === 'F') {
      const wander = hang ? p.bend * 0.3 : depth === 0 ? p.bend * 0.6 : p.bend; // limbs wind; trunk and whips less
      rotate(L.clone(), (rng() - 0.5) * wander);
      rotate(U.clone(), (rng() - 0.5) * wander);
      if (p.droop) {
        const wd = p.whipDroop;
        tropism(down, hang && wd ? wd[Math.min(step++, wd.length - 1)] : p.droop[Math.min(depth, p.droop.length - 1)]);
        // A whip stops short of the ground; by the trunk it stops higher, so the trunk shows under the curtain.
        const r = Math.hypot(pos.x, pos.z), stop = (p.floorIn ? Math.max(p.floorIn[0] * (1 - r / p.floorIn[1]), p.floor ?? 0) : (p.floor ?? -Infinity)) + stopShift;
        if (hang && pos.y + H.y * len < stop) continue;
      } else if (depth >= p.gravityFrom) {
        tropism(down, p.gravity);
        if (pos.y + H.y * len < (p.floor ?? -Infinity)) continue; // a whip stops short of the ground
      }
      else if (depth >= p.lightFrom) tropism(up, p.light);
      const a = pos.clone();
      pos = pos.clone().addScaledVector(H, len * (hang ? p.whipLength ?? 1 : 1) * (0.85 + 0.3 * rng()));
      const taper = depth === 0 && p.trunkTaper ? p.trunkTaper : p.taper;
      // The trunk's first step flares out at the foot.
      segments.push({ a, b: pos.clone(), r0: segments.length === 0 ? width * 1.5 : width, r1: width * taper, depth, hang, gen });
      width *= taper;
    } else if (c === '+') rotate(U.clone(), turn(p.fan));
    else if (c === '-') rotate(U.clone(), -turn(p.fan));
    else if (c === '&') rotate(L.clone(), turn(p.pitch));
    else if (c === '^') rotate(L.clone(), -turn(p.pitch));
    else if (c === '/') rotate(L.clone(), turn(p.pitch * 0.4)); // a slight lean
    else if (c === '%') width *= 0.85 / p.widthDecay; // this branch stays nearly as thick as its parent
    else if (c === '*') rotate(H.clone(), GOLDEN + (rng() - 0.5) * p.jitter);
    else if (c === '!') { hang = true; step = 0; stopShift = (rng() - 0.5) * (p.floorJitter ?? 0); }
    else if (c === '[') {
      stack.push({ pos, H: H.clone(), L: L.clone(), U: U.clone(), len, width, depth, hang, step, stopShift });
      depth += 1; len *= p.lengthDecay; width *= p.widthDecay;
    } else if (c === ']') {
      const s = stack.pop();
      if (s) ({ pos, H, L, U, len, width, depth, hang, step, stopShift } = s);
    } else if (BUDS.has(c) && depth >= 1) tips.push({ p: pos.clone(), dir: H.clone(), gen });
  }
  return { segments, tips, buds };
}

/** Bark tubes, then leaf cards: aTone.x 0 bark / 1 leaf, aTone.y 0 shaded underside .. 1 lit top (the pine material reads both). */
export function broadleafGeometry(kind: BroadleafKind, skel: BroadleafSkeleton, seed: number, detail: 0 | 1 = 0, knobs?: BroadleafKnobs | null): BufferGeometry {
  const sp = speciesOf(kind, knobs);
  const rng = createRng(seed * 19 + 5);
  const pos: number[] = [], nor: number[] = [], tone: number[] = [];
  const vert = (v: Vector3, n: Vector3, kindOf: number, shade: number) => { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); tone.push(kindOf, shade); };
  const sides = detail === 0 ? 6 : 4;
  const tube = (a: Vector3, b: Vector3, r0: number, r1: number) => {
    const dir = new Vector3().subVectors(b, a).normalize();
    const side = Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(dir, side).normalize(), v = new Vector3().crossVectors(dir, u);
    const radial = (i: number) => { const t = (i / sides) * Math.PI * 2; return u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)); };
    for (let i = 0; i < sides; i++) {
      const n0 = radial(i), n1 = radial(i + 1);
      for (const [c, r, n] of [[a, r0, n0], [b, r1, n0], [a, r0, n1], [a, r0, n1], [b, r1, n0], [b, r1, n1]] as [Vector3, number, Vector3][]) vert(c.clone().addScaledVector(n, r), n, 0, 0.5);
    }
  };
  // Whips are hidden in their blossom (streaked species): only the limbs show dark through the curtain.
  for (const s of skel.segments) if ((detail === 0 || s.depth <= 2) && !(s.hang && sp.leaf.streak)) tube(s.a, s.b, s.r0, s.r1);
  // Shade by height in the crown: pale on top, deeper underneath and inside.
  let top = 1e-3;
  for (const s of skel.segments) top = Math.max(top, s.b.y);
  // A leaf: a small diamond card facing `n` (the clump's outward direction, so the crown shades as one soft mass).
  const card = (c: Vector3, n: Vector3, size: number, shade: number, along?: Vector3) => {
    let du: Vector3, dv: Vector3;
    if (along) { // long and narrow, lying along the whip
      du = along.clone().normalize().multiplyScalar(size * 0.9);
      dv = new Vector3().crossVectors(n, du).normalize().multiplyScalar(size * 0.22);
    } else {
      const t = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      const u = new Vector3().crossVectors(n, t).normalize(), v = new Vector3().crossVectors(n, u);
      const a = rng() * Math.PI;
      du = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).multiplyScalar(size * 0.5);
      dv = v.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, -Math.sin(a)).multiplyScalar(size * 0.32);
    }
    const p0 = c.clone().sub(du), p1 = c.clone().add(dv), p2 = c.clone().add(du), p3 = c.clone().sub(dv);
    vert(p0, n, 1, shade); vert(p1, n, 1, shade); vert(p2, n, 1, shade);
    vert(p0, n, 1, shade); vert(p2, n, 1, shade); vert(p3, n, 1, shade);
  };
  const L = sp.leaf, keep = detail === 0 ? 1 : L.streak ? 0.5 : 0.45, grow = detail === 0 ? 1 : L.streak ? 1.25 : 1.5;
  const up = new Vector3(0, 1, 0);
  for (const t of skel.tips) {
    const centre = t.p.clone().addScaledVector(up, L.clump * 0.25);
    for (let k = 0; k < L.count; k++) {
      if (rng() > keep) continue;
      // A point in the clump, more of them toward its skin (a rounded mass, not a ball of dust).
      const d = new Vector3(rng() * 2 - 1, (rng() * 2 - 1) * 0.75, rng() * 2 - 1).normalize();
      const r = L.clump * (0.55 + 0.45 * Math.sqrt(rng()));
      const at = centre.clone().addScaledVector(d, r);
      const n = d.clone().addScaledVector(up, 0.35).normalize();
      const lit = L.streak ? Math.min(0.45 + 0.55 * (at.y / top), 1) : Math.min(Math.max(0.5 + 0.5 * d.y, 0), 1);
      card(at, n, L.size * grow * (0.8 + 0.4 * rng()), lit);
    }
  }
  if (L.ribbon) {
    // A ribbon down each whip, across it round the crown (facing out), shaded by height: the veil.
    for (const s of skel.segments) {
      if (!s.hang || rng() > (detail === 0 ? 1 : 0.7)) continue;
      const mid = s.a.clone().lerp(s.b, 0.5);
      const out = new Vector3(mid.x, 0, mid.z);
      if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
      out.normalize();
      const across = new Vector3().crossVectors(up, out).lerp(out, (rng() - 0.5) * 0.6).normalize().multiplyScalar(L.ribbon * grow * (0.7 + 0.6 * rng()) * 0.5);
      const la = Math.min(0.45 + 0.55 * (s.a.y / top), 1), lb = Math.min(0.45 + 0.55 * (s.b.y / top), 1);
      const a0 = s.a.clone().sub(across), a1 = s.a.clone().add(across), b0 = s.b.clone().sub(across), b1 = s.b.clone().add(across);
      vert(a0, out, 1, la); vert(a1, out, 1, la); vert(b1, out, 1, lb);
      vert(a0, out, 1, la); vert(b1, out, 1, lb); vert(b0, out, 1, lb);
    }
  }
  if (L.along > 0) {
    for (const s of skel.segments) {
      if (s.depth < L.alongFrom && !s.hang) continue;
      const len = s.a.distanceTo(s.b), count = Math.round(len * L.along * keep * (0.7 + 0.6 * rng()));
      for (let k = 0; k < count; k++) {
        const at = s.a.clone().lerp(s.b, rng()).add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(L.size * 0.8));
        const out = new Vector3(at.x, 0, at.z).normalize().addScaledVector(up, 0.25).normalize();
        const lit = L.streak ? Math.min(0.45 + 0.55 * (at.y / top) + 0.05 * rng(), 1) : 0.3 + 0.4 * rng();
        card(at, out, L.size * grow * (0.75 + 0.4 * rng()), lit, L.streak ? new Vector3().subVectors(s.b, s.a) : undefined);
      }
    }
  }
  // Normalise to 1 m tall, the foot staying at the origin (keep the crown's own proportions).
  let maxY = 0;
  for (let i = 1; i < pos.length; i += 3) maxY = Math.max(maxY, pos[i]);
  const h = Math.max(maxY, 1e-3);
  for (let i = 0; i < pos.length; i++) pos[i] /= h;
  const g = new BufferGeometry();
  g.userData.unit = h; // turtle units per metre of height: the growth stages scale by the grown tree's
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('aTone', new Float32BufferAttribute(tone, 2));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** One tree of a species: its unit-height geometry and how wide its crown came out (width ÷ height). */
export function growBroadleaf(kind: BroadleafKind, seed: number, detail: 0 | 1 = 0, knobs?: BroadleafKnobs | null): { geometry: BufferGeometry; spread: number; tips: number; triangles: number } {
  const skel = interpretBroadleaf(kind, expandBroadleaf(kind, seed), seed, knobs);
  const geometry = broadleafGeometry(kind, skel, seed, detail, knobs);
  const b = geometry.boundingBox!;
  return { geometry, spread: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), tips: skel.tips.length, triangles: geometry.getAttribute('position').count / 3 };
}

/**
 * The tree as it grows, for the atlas's replay: one bare skeleton per generation (every branch
 * written by that generation or before, those of this generation in leaf colour so the eye finds
 * what it added), then the grown tree. All at the grown tree's scale (1 = its height), so the
 * tree grows on screen instead of each stage filling the frame.
 */
export function growBroadleafStages(kind: BroadleafKind, seed: number, knobs?: BroadleafKnobs | null): { stages: BufferGeometry[]; grown: BufferGeometry; spread: number } {
  const sp = speciesOf(kind, knobs);
  const { str, birth } = expandBroadleafTagged(kind, seed);
  const skel = interpretBroadleaf(kind, str, seed, knobs, birth);
  const grown = broadleafGeometry(kind, skel, seed, 0, knobs);
  const unit = grown.userData.unit as number;
  // Stage 0 is the single bud it starts from; stage G every branch, bare.
  const stages: BufferGeometry[] = [];
  for (let g = 0; g <= sp.generations; g++) stages.push(skeletonStage(skel.segments, skel.buds[g] ?? [], g, unit));
  const b = grown.boundingBox!;
  return { stages, grown, spread: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) };
}

/** A branch as the growth replay needs it: its ends, radii (turtle units) and the generation that wrote it. */
export interface StageSegment { a: Vector3; b: Vector3; r0: number; r1: number; gen: number }
/**
 * How a stage is laid in the grown plant's frame: x and z scaled by `xz` after dividing by `unit`
 * (a shrub widened to its crown), the foot at `y0`; the bud diamonds `bud` and the finest twig
 * `min` across (turtle units; defaults suit the broadleaf trees).
 */
export interface StageOptions { xz?: number; y0?: number; bud?: number; min?: number }
/** The bare branches written by generation `g` or before (those of `g` itself marked as leaf). */
export function skeletonStage(segments: StageSegment[], buds: Vector3[], g: number, unit: number, opt: StageOptions = {}): BufferGeometry {
  const xz = opt.xz ?? 1, y0 = opt.y0 ?? 0;
  const put = (at: Vector3) => [(at.x / unit) * xz, (at.y - y0) / unit, (at.z / unit) * xz];
  const pos: number[] = [], nor: number[] = [], tone: number[] = [];
  // Each bud a small diamond in leaf colour: where the next generation's rule will write.
  const B = opt.bud ?? 0.2, axes = [new Vector3(1, 0, 0), new Vector3(0, 1.4, 0), new Vector3(0, 0, 1)];
  for (const b of buds) {
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      const corner = [axes[0].clone().multiplyScalar(sx * B), axes[1].clone().multiplyScalar(sy * B), axes[2].clone().multiplyScalar(sz * B)];
      const n = new Vector3(sx, sy, sz).normalize();
      for (const c of corner) { pos.push(...put(b.clone().add(c))); nor.push(n.x, n.y, n.z); tone.push(1, 1); }
    }
  }
  const MIN = opt.min ?? 0.028; // the finest twigs still read in the small frame (turtle units)
  for (const s of segments) {
    if (s.gen > g) continue;
    const fresh = s.gen === g;
    const dir = new Vector3().subVectors(s.b, s.a).normalize();
    const side = Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(dir, side).normalize(), v = new Vector3().crossVectors(dir, u);
    const r0 = Math.max(s.r0, MIN), r1 = Math.max(s.r1, MIN);
    for (let i = 0; i < 5; i++) {
      const t0 = (i / 5) * Math.PI * 2, t1 = ((i + 1) / 5) * Math.PI * 2;
      const n0 = u.clone().multiplyScalar(Math.cos(t0)).addScaledVector(v, Math.sin(t0));
      const n1 = u.clone().multiplyScalar(Math.cos(t1)).addScaledVector(v, Math.sin(t1));
      for (const [c, r, n] of [[s.a, r0, n0], [s.b, r1, n0], [s.a, r0, n1], [s.a, r0, n1], [s.b, r1, n0], [s.b, r1, n1]] as [Vector3, number, Vector3][]) {
        pos.push(...put(c.clone().addScaledVector(n, r))); nor.push(n.x, n.y, n.z); tone.push(fresh ? 1 : 0, fresh ? 0.85 : 0.5);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('aTone', new Float32BufferAttribute(tone, 2));
  geo.computeBoundingSphere();
  return geo;
}
