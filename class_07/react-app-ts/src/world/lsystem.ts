import { Quaternion, Vector3 } from 'three';
import { createRng } from './noise';

/**
 * L-system in two steps:
 * 1. expand: rewrite the axiom with the rules, n times (a string that grows);
 * 2. interpret: a 3D "turtle" walks the string and leaves a skeleton (branch segments + leaf pads).
 *
 * Turtle symbols
 *   F      move forward, drawing a branch segment
 *   + -    turn left / right (yaw)
 *   & ^    pitch down / up
 *   \ /    roll left / right
 *   *      roll by the golden angle (137.5°), so side branches spiral like real phyllotaxis
 *   [ ]    push / pop: start a side branch, then come back
 *   L      a leaf pad (a cloud of needles)
 *   other letters (A, B, ...) are buds: they only matter for rewriting. Buds still left at the
 *   end become leaf pads, so the tips of the tree are green.
 */

export interface Rule {
  from: string;
  to: string;
  weight: number;
}

export interface Grammar {
  axiom: string;
  rules: Rule[];
}

/** Parse "A = F[&B]A : 0.5" lines. Several lines for the same letter = a stochastic choice by weight. */
export function parseRules(text: string): { rules: Rule[]; error: string | null } {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z])\s*=\s*([^:]*?)\s*(?::\s*([\d.]+))?$/);
    if (!m) return { rules, error: line };
    rules.push({ from: m[1], to: m[2].replace(/\s+/g, ''), weight: m[3] ? Number(m[3]) : 1 });
  }
  return { rules, error: null };
}

/** Hard cap so a greedy grammar cannot freeze the page. */
export const MAX_LENGTH = 200_000;

export function expand(grammar: Grammar, generations: number, seed: number): string[] {
  const rng = createRng(seed);
  const byLetter = new Map<string, Rule[]>();
  for (const r of grammar.rules) byLetter.set(r.from, [...(byLetter.get(r.from) ?? []), r]);
  const pick = (options: Rule[]) => {
    if (options.length === 1) return options[0].to;
    const total = options.reduce((s, o) => s + o.weight, 0);
    let x = rng() * total;
    for (const o of options) if ((x -= o.weight) <= 0) return o.to;
    return options[options.length - 1].to;
  };
  // Every generation is kept so the panel can show how the string grows.
  const out = [grammar.axiom.replace(/\s+/g, '')];
  for (let g = 0; g < generations; g++) {
    const prev = out[out.length - 1];
    let next = '';
    for (const c of prev) {
      const options = byLetter.get(c);
      next += options ? pick(options) : c;
      if (next.length > MAX_LENGTH) break;
    }
    out.push(next);
    if (next.length > MAX_LENGTH) break;
  }
  return out;
}

export interface TurtleParams {
  angle: number; // degrees
  length: number; // first segment length
  width: number; // trunk radius at the base
  lengthDecay: number; // each side branch is this much shorter than its parent
  widthDecay: number; // ... and this much thinner
  taper: number; // a branch gets this much thinner with every F
  gravity: number; // >0 bends branches down after every step, <0 lifts them
  jitter: number; // 0..1 randomness in every turn
  pad: number; // leaf pad radius
  heading: 'up' | 'down';
}

export interface Segment {
  a: Vector3;
  b: Vector3;
  r0: number;
  r1: number;
  depth: number;
  /** Id of the branch this part belongs to at each depth: lets a coarser LOD merge a whole branch. */
  owners: number[];
}

export interface Leaf {
  p: Vector3;
  size: number;
  depth: number;
  owners: number[];
}

export interface Skeleton {
  segments: Segment[];
  leaves: Leaf[];
  maxDepth: number;
}

const MAX_SEGMENTS = 40_000;
const GOLDEN = (137.5 * Math.PI) / 180;

export function interpret(str: string, buds: Set<string>, p: TurtleParams, seed: number): Skeleton {
  const rng = createRng(seed * 7 + 3);
  const turn = (deg: number) => ((deg * Math.PI) / 180) * (1 + p.jitter * (rng() - 0.5));
  const down = new Vector3(0, -1, 0);

  // H = heading, L = left, U = up: an orthonormal frame carried by the turtle.
  let pos = new Vector3();
  let H = new Vector3(0, p.heading === 'up' ? 1 : -1, 0);
  let L = new Vector3(-1, 0, 0);
  let U = new Vector3().crossVectors(H, L);
  let len = p.length;
  let width = p.width;
  let depth = 0;
  let owners: number[] = [0];
  let nextId = 1;
  const stack: { pos: Vector3; H: Vector3; L: Vector3; U: Vector3; len: number; width: number; depth: number; owners: number[] }[] = [];

  const segments: Segment[] = [];
  const leaves: Leaf[] = [];
  let maxDepth = 0;
  const q = new Quaternion();
  const rotate = (axis: Vector3, a: number) => {
    q.setFromAxisAngle(axis, a);
    H.applyQuaternion(q);
    L.applyQuaternion(q);
    U.applyQuaternion(q);
  };
  const leaf = () => leaves.push({ p: pos.clone(), size: p.pad * Math.sqrt(len / p.length) * (0.75 + rng() * 0.5), depth, owners: [...owners] });

  for (const c of str) {
    switch (c) {
      case 'F': {
        if (segments.length >= MAX_SEGMENTS) break;
        // A small random bend on every step makes the wood look grown, not built.
        if (p.jitter > 0) {
          rotate(L.clone(), (rng() - 0.5) * p.jitter * 0.25);
          rotate(H.clone(), (rng() - 0.5) * p.jitter * 0.6);
        }
        const a = pos.clone();
        pos = pos.clone().addScaledVector(H, len);
        const r1 = width * p.taper;
        segments.push({ a, b: pos.clone(), r0: width, r1, depth, owners });
        width = r1;
        // Tropism: pull the heading toward gravity, then carry the frame along.
        const nh = H.clone().addScaledVector(down, p.gravity * 0.25);
        if (p.gravity !== 0 && nh.lengthSq() > 1e-6) {
          nh.normalize();
          q.setFromUnitVectors(H, nh);
          H = nh;
          L.applyQuaternion(q);
          U.applyQuaternion(q);
        }
        break;
      }
      case '+': rotate(U.clone(), turn(p.angle)); break;
      case '-': rotate(U.clone(), -turn(p.angle)); break;
      case '&': rotate(L.clone(), turn(p.angle)); break;
      case '^': rotate(L.clone(), -turn(p.angle)); break;
      case '\\': rotate(H.clone(), turn(p.angle)); break;
      case '/': rotate(H.clone(), -turn(p.angle)); break;
      case '*': rotate(H.clone(), GOLDEN + (rng() - 0.5) * p.jitter); break;
      case '[':
        stack.push({ pos, H: H.clone(), L: L.clone(), U: U.clone(), len, width, depth, owners });
        depth += 1;
        maxDepth = Math.max(maxDepth, depth);
        len *= p.lengthDecay;
        width *= p.widthDecay;
        owners = [...owners, nextId++];
        break;
      case ']': {
        const s = stack.pop();
        if (!s) break;
        ({ pos, H, L, U, len, width, depth, owners } = s);
        break;
      }
      case 'L': leaf(); break;
      default:
        if (buds.has(c)) leaf();
    }
  }
  return { segments, leaves, maxDepth };
}
