import { createRng } from '../../core/rng';

/**
 * One species, one skeleton, three continuous axes. Stage 3 drives the catalog preview
 * and the shared measurements. It does not replace the fixed BODY the island sim still uses.
 *
 * Limits are taken from the shelter and the drink stance already in the code:
 * - The tightest roof the shelter will accept is 2.05 m (rockShelter HEADROOM). Seed 42
 *   sits on that number. The standing crown, horn included, stays at or under 2.00 m.
 * - A drinking forefoot is planted 0.30 m ahead of its hip (BODY.drinkSplay). The hip has
 *   to stay high enough that this reach stretches the standing leg by at most 11%.
 * - The bowed neck has to put the muzzle at or below 0.20 m, so the existing shore solver
 *   can still meet water. The island's drink rules are not changed here.
 */
export const MORPH_VERSION = 3;
export const SHELTER_HEADROOM_M = 2.05;
export const CROWN_LIMIT_M = 2.0;
const DRINK_SPLAY_M = 0.3;
const MIN_HIP_M = 0.64;
const MAX_LEG_STRETCH = 1.11;
const DRINK_MUZZLE_MAX_M = 0.2;

export interface MorphAxes {
  /** 0 light, 1 heavy. */
  bulk: number;
  /** Independent torso depth/fullness; does not change leg height or body length. */
  depth: number;
  /** 0 low and steady, 1 tall. */
  stature: number;
  /** 0 horns spread flat, 1 horns lifted. */
  crown: number;
  /** An actual topology choice, not a continuous crossfade between antlers. */
  hornType: 'single' | 'paired';
  /** Generations of the antler's branching rule (ANTLER_RULE): 0 a bare beam, 3 up to eight tines. */
  branches: 0 | 1 | 2 | 3;
}

export interface Vec3 { x: number; y: number; z: number }

export interface CreatureMorph {
  version: number;
  worldSeed: number;
  creatureSeed: number;
  axes: MorphAxes;
  torso: { stand: number; lie: number; along: number; up: number; across: number };
  hips: [number, number][];
  hipDrop: number;
  shoulder: [number, number];
  neckLength: number;
  neckUp: number;
  head: { front: number; level: number };
  horn: { length: number; lift: number; spread: number };
  rest: { along: number; across: number };
  /** Ground to the highest horn sample, standing. */
  crownHeight: number;
  /** Muzzle above the ground at the deepest bow used for the drink check. */
  drinkMuzzleY: number;
  /** Standing hip height, and how far a drinking forefoot sits ahead of it. */
  foot: { hip: number; reach: number; stretch: number };
  hornEnvelope: { rise: number; ahead: number; back: number; across: number };
  id: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Birth place in the three axes. Mass and reach are correlated; the sliders can still leave that. */
export function birthAxes(creatureSeed: number): MorphAxes {
  const rng = createRng(creatureSeed || 1);
  const mass = rng();
  const reach = rng();
  const topology = rng();
  const branchSeed = rng();
  return {
    bulk: mass,
    depth: clamp01(0.35 + 0.45 * mass + 0.2 * rng()),
    stature: clamp01(0.55 * reach + 0.45 * (1 - mass)),
    crown: clamp01(0.48 + 0.34 * reach - 0.26 * mass),
    hornType: topology < 0.24 ? 'single' : 'paired',
    branches: Math.floor(branchSeed * 4) as 0 | 1 | 2 | 3,
  };
}

function v(x: number, y: number, z: number): Vec3 { return { x, y, z }; }

function quad(a: Vec3, b: Vec3, c: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return v(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}

/**
 * The antler grows by a branching rule, as an L-system does (course session 7): it starts as one
 * beam; each generation, every segment puts out one new tine, at the next of its fork points
 * (half way, three quarters, a third), a little over half its length, turned alternately upward and
 * forward. 0 generations: a bare beam; 1: two segments; 2: four; 3: eight. Tines shorter than
 * `minLength` stop growing.
 */
export const ANTLER_RULE = { forkAt: [0.5, 0.74, 0.3], scale: 0.56, turn: 0.62, minLength: 0.035, thinning: 0.62 };

export interface AntlerSegment { points: Vec3[]; gen: number; width: number }

const sub3 = (a: Vec3, b: Vec3) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit3 = (a: Vec3) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return v(a.x / l, a.y / l, a.z / l); };
const along3 = (a: Vec3, d: Vec3, k: number) => v(a.x + d.x * k, a.y + d.y * k, a.z + d.z * k);

/** Grow `generations` of the rule on a beam; `out` leans tines outward along z (−1, 0, 1). */
export function growAntler(beam: Vec3[], generations: number, out: number, width: number): AntlerSegment[] {
  const segs: (AntlerSegment & { forks: number })[] = [{ points: beam, gen: 0, width, forks: 0 }];
  for (let g = 1; g <= generations; g++) {
    for (const p of segs.slice()) {
      if (p.forks >= ANTLER_RULE.forkAt.length) continue;
      const n = p.points.length - 1;
      const i = Math.max(1, Math.min(n - 1, Math.round(ANTLER_RULE.forkAt[p.forks] * n)));
      let length = 0;
      for (let k = 1; k <= n; k++) length += Math.hypot(...Object.values(sub3(p.points[k], p.points[k - 1])) as [number, number, number]);
      const L = length * ANTLER_RULE.scale;
      if (L < ANTLER_RULE.minLength) continue;
      const root = p.points[i], t = unit3(sub3(p.points[i + 1], p.points[i - 1]));
      // Turned toward up or toward the face, alternating by generation and fork.
      const toward = (p.gen + p.forks) % 2 === 0 ? v(0, 1, 0) : v(1, 0, 0);
      const perp = unit3(along3(toward, t, -dot3(toward, t)));
      const dir = unit3(v(
        t.x * Math.cos(ANTLER_RULE.turn) + perp.x * Math.sin(ANTLER_RULE.turn),
        t.y * Math.cos(ANTLER_RULE.turn) + perp.y * Math.sin(ANTLER_RULE.turn),
        t.z * Math.cos(ANTLER_RULE.turn) + perp.z * Math.sin(ANTLER_RULE.turn) + out * 0.28,
      ));
      const tip = along3(root, dir, L), mid = along3(along3(root, dir, L * 0.5), v(0, 1, 0), L * 0.1);
      const points: Vec3[] = [];
      for (let k = 0; k <= 5; k++) points.push(quad(root, mid, tip, k / 5));
      p.forks++;
      segs.push({ points, gen: g, width: p.width * ANTLER_RULE.thinning, forks: 0 });
    }
  }
  return segs.map(({ points, gen, width: w }) => ({ points, gen, width: w }));
}

export interface MorphFigure {
  torso: { at: Vec3; ry: number; rz: number }[];
  neck: { at: Vec3; ry: number; rz: number }[];
  head: { at: Vec3; ry: number; rz: number }[];
  ears: { at: Vec3; ry: number; rz: number }[][];
  horns: Vec3[][];
  /** Root radius of each horn segment, metres (it tapers to its tip): each generation thinner. */
  hornWidths: number[];
  tail: { at: Vec3; ry: number; rz: number }[];
  legs: { hip: Vec3; knee: Vec3; foot: Vec3 }[];
}

function drinkMuzzleY(stand: number, shoulderUp: number, shoulderAlong: number, neckLength: number, front: number): number {
  const pitch = -0.2;
  const torso = stand - 0.2;
  const fu = shoulderAlong * Math.sin(pitch) + shoulderUp * Math.cos(pitch);
  const shoulderY = torso + fu;
  const neck = -1.15;
  const headAng = neck * (1 - 0.55);
  const up = neckLength * Math.sin(neck) + front * Math.sin(headAng);
  return shoulderY + up;
}

/** The standing figure and the measurements Stage 4 will have to share with the sim. */
export function resolveMorph(input: { worldSeed: number; creatureSeed: number; axes: MorphAxes }): { morph: CreatureMorph; figure: MorphFigure } {
  const axes: MorphAxes = {
    bulk: clamp01(input.axes.bulk), depth: clamp01(input.axes.depth ?? input.axes.bulk), stature: clamp01(input.axes.stature), crown: clamp01(input.axes.crown),
    hornType: input.axes.hornType === 'single' ? 'single' : 'paired',
    branches: Math.max(0, Math.min(3, Math.round(input.axes.branches ?? 2))) as 0 | 1 | 2 | 3,
  };
  const b = axes.bulk, d = axes.depth, s = axes.stature, c = axes.crown;
  const along = lerp(0.48, 0.66, b);
  const up = lerp(0.24, 0.29, b) + lerp(0.015, 0.115, d);
  const across = lerp(0.17, 0.26, b) + lerp(0.025, 0.09, d);
  const stand = lerp(0.73, 0.90, s);
  const lie = lerp(0.28, 0.36, 0.7 * b + 0.3 * (1 - s));
  // A grazing quadruped's neck (a horse's, a sheep's): from the withers forward and up at about
  // 50°, long enough to bring the mouth to the ground with the forelegs nearly straight; its top
  // line arched (steeper at the root, flatter toward the head); the face sloping down and forward.
  // (It was near upright, 72°, with the face turned up: a llama's or a bird's, odd lying and drinking.)
  // (Long-legged, it needs a horse's or a deer's neck to reach water: shorter, it found no stand on seeds 7 and 42.)
  const neckLength = lerp(0.70, 0.76, s);
  // (Nearer the concept, a deer's or a qilin's: the neck rising steeply from a deep chest and
  // curving forward to a short, slim face held a little down; a horse's long, low face read wrong.)
  const neckUp = lerp(0.98, 1.04, s);
  const front = lerp(0.22, 0.26, s);
  const faceDown = -0.36; // radians: the face's slope from level, standing
  const shoulderAlong = along * 0.72;
  const shoulderUp = up * 0.35;
  const hipAlong = along * 0.64;
  const hipAcross = across * 0.58;
  const hipDrop = lerp(0.05, 0.07, b);
  const hornLength = lerp(0.26, 0.32, c);
  const hornLift = lerp(0.08, 1.02, c);
  const hornSpread = hornLength * lerp(0.62, 0.22, c);

  const torso: MorphFigure['torso'] = [];
  const stations = [0, 0.18, 0.4, 0.62, 0.82, 1];
  for (const t of stations) {
    const back = stand + up * lerp(-0.02, 0.28, Math.sin(t * Math.PI * 0.85));
    const drop = up * (1.1 + 0.4 * d) * (0.64 + 0.36 * Math.sin(Math.PI * t));
    const frontTaper = t > 0.8 ? 1 - 0.42 * ((t - 0.8) / 0.2) ** 2 : 1;
    const ry = Math.max(0.09, drop * 0.5 * frontTaper);
    const centerY = back - ry;
    const chest = t > 0.7 ? 1 + (t - 0.7) * b : 1;
    torso.push({
      at: v(lerp(-along, along * 0.74, t), centerY, 0),
      ry,
      rz: Math.max(0.08, across * (0.78 + 0.32 * Math.sin(Math.PI * t)) * chest * frontTaper),
    });
  }
  const chestAt = torso[3];
  // Anchor the sculpt's throat at the same upper-front shoulder used by the live body.
  // Starting it in the torso centre forced the old head solver to pull the face away.
  const neckRoot = v(shoulderAlong + along * 0.04, stand + shoulderUp * 0.3, 0);
  const neck: MorphFigure['neck'] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const ang = neckUp * (1.2 - 0.42 * t);
    const dist = neckLength * Math.max(0, t - 0.12) * 0.9;
    // Keep a broad, continuous throat from the chest to the jaw. The old thin
    // tube was easily mistaken for a loose head when the forelegs overlapped it.
    const thick = lerp(Math.max(chestAt.ry * 0.54, 0.11), Math.max(0.07, up * 0.24), t);
    neck.push({
      at: v(neckRoot.x + Math.cos(ang) * dist, neckRoot.y + chestAt.ry * 0.15 + Math.sin(ang) * dist, 0),
      ry: thick,
      rz: thick * 0.9,
    });
  }
  const head: MorphFigure['head'] = [];
  const headAng = faceDown;
  const headRy = Math.max(neck[6].ry * 1.15, 0.075);
  const headRz = Math.max(neck[6].rz * 1.2, 0.065);
  head.push({ at: { ...neck[6].at }, ry: headRy, rz: headRz });
  let hx = neck[6].at.x, hy = neck[6].at.y;
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    hx += Math.cos(headAng) * (front / 4);
    hy += Math.sin(headAng) * (front / 4);
    const taper = 1 - t * 0.55;
    head.push({ at: v(hx, hy, 0), ry: Math.max(0.035, headRy * taper), rz: Math.max(0.03, headRz * taper) });
  }

  const cranium = head[1].at;
  const ears: MorphFigure['ears'] = [-1, 1].map((side) => {
    const root = v(cranium.x - 0.02, cranium.y + up * 0.28, side * across * 0.42);
    const tip = v(root.x - 0.15, root.y + lerp(0.11, 0.16, 1 - b), side * (Math.abs(root.z) + 0.19));
    return [
      { at: root, ry: 0.029, rz: 0.025 },
      { at: v((root.x + tip.x) / 2, (root.y + tip.y) / 2, (root.z + tip.z) / 2), ry: 0.067, rz: 0.043 },
      { at: tip, ry: 0.006, rz: 0.004 },
    ];
  });

  const hornRoot = v(cranium.x, cranium.y + up * 0.25, 0);
  const horns: Vec3[][] = (axes.hornType === 'single' ? [0] : [-1, 1]).map((side) => {
    const back = Math.cos(hornLift);
    const raised = Math.sin(hornLift);
    const tip = v(
      hornRoot.x - back * hornLength * 0.8 + raised * hornLength * 0.12,
      hornRoot.y + raised * hornLength,
      side * (Math.max(across, 0.12) * 0.35 + hornSpread),
    );
    const mid = v(
      (hornRoot.x + tip.x) / 2 - hornLength * 0.12,
      (hornRoot.y + tip.y) / 2 + hornLength * 0.12,
      (side * Math.max(across, 0.12) * 0.2 + tip.z) / 2,
    );
    const root = v(hornRoot.x, hornRoot.y, side * Math.max(across, 0.12) * 0.2);
    const samples: Vec3[] = [];
    for (let i = 0; i <= 7; i++) samples.push(quad(root, mid, tip, i / 7));
    return samples;
  });
  const hornWidths: number[] = [];
  const beams = horns.splice(0);
  for (const [mainIndex, main] of beams.entries()) {
    const out = axes.hornType === 'single' ? 0 : (mainIndex === 0 ? -1 : 1);
    for (const seg of growAntler(main, axes.branches, out, 0.03)) { horns.push(seg.points); hornWidths.push(seg.width); }
  }

  const rump = torso[0].at;
  const tail: MorphFigure['tail'] = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12, u = 1 - t;
    // Monotonic curve: the old return toward the rump made the narrow tip look
    // like a second, detached piece at normal preview scale.
    const dx = u ** 3 * 0.12 + 3 * u * u * t * -0.07 + 3 * u * t * t * -0.27 + t ** 3 * -0.34;
    const dy = u ** 3 * 0.015 + 3 * u * u * t * 0.025 + 3 * u * t * t * 0.11 + t ** 3 * 0.35;
    return {
      at: v(rump.x + dx, rump.y + dy, 0),
      ry: 0.056 * (1 - t) ** 0.72 + 0.013,
      rz: 0.044 * (1 - t) ** 0.72 + 0.011,
    };
  });

  const hipY = stand - hipDrop;
  const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([alongSign, acrossSign]) => {
    const hip = v(alongSign * hipAlong, hipY, acrossSign * hipAcross);
    const foot = v(hip.x + alongSign * 0.02, 0, hip.z);
    const knee = v(hip.x + alongSign * 0.06, hipY * 0.48, hip.z);
    return { hip, knee, foot };
  });

  let crownHeight = 0, hornAhead = 0, hornBack = 0, hornAcross = 0, hornRise = 0;
  for (const samples of horns) {
    for (const p of samples) {
      crownHeight = Math.max(crownHeight, p.y);
      hornAhead = Math.max(hornAhead, p.x - hornRoot.x);
      hornBack = Math.min(hornBack, p.x - hornRoot.x);
      hornAcross = Math.max(hornAcross, Math.abs(p.z));
      hornRise = Math.max(hornRise, p.y - hornRoot.y);
    }
  }
  const drinkY = drinkMuzzleY(stand, shoulderUp, shoulderAlong, neckLength, front);
  const hip = hipY;
  const stretch = Math.hypot(hip, DRINK_SPLAY_M) / hip;

  const morph: CreatureMorph = {
    version: MORPH_VERSION,
    worldSeed: input.worldSeed,
    creatureSeed: input.creatureSeed,
    axes,
    torso: { stand, lie, along, up, across },
    hips: [[hipAlong, hipAcross], [hipAlong, -hipAcross], [-hipAlong, hipAcross], [-hipAlong, -hipAcross]],
    hipDrop,
    shoulder: [shoulderAlong, shoulderUp],
    neckLength,
    neckUp,
    head: { front, level: 0.55 },
    horn: { length: hornLength, lift: hornLift, spread: hornSpread },
    rest: { along: hipAlong + along * 0.4, across: hipAcross + across * 0.5 },
    crownHeight,
    drinkMuzzleY: drinkY,
    foot: { hip, reach: DRINK_SPLAY_M, stretch },
    hornEnvelope: { rise: hornRise, ahead: hornAhead, back: hornBack, across: hornAcross },
    id: `v${MORPH_VERSION}:${input.worldSeed}:${input.creatureSeed}:${axes.bulk.toFixed(4)}:${axes.depth.toFixed(4)}:${axes.stature.toFixed(4)}:${axes.crown.toFixed(4)}:${axes.hornType}:${axes.branches}`,
  };
  return { morph, figure: { torso, neck, head, ears, horns, hornWidths, tail, legs } };
}

/** Why this morph would break the shelter, the drink, or the forefoot. Null when it holds. */
export function morphFault(morph: CreatureMorph): string | null {
  if (morph.crownHeight > CROWN_LIMIT_M) return `crown ${morph.crownHeight.toFixed(3)} m is over ${CROWN_LIMIT_M} m`;
  if (morph.drinkMuzzleY > DRINK_MUZZLE_MAX_M) return `drinking muzzle stays at ${morph.drinkMuzzleY.toFixed(3)} m`;
  if (morph.foot.hip < MIN_HIP_M) return `hip ${morph.foot.hip.toFixed(3)} m is under ${MIN_HIP_M} m`;
  if (morph.foot.stretch > MAX_LEG_STRETCH) return `forefoot stretch ${morph.foot.stretch.toFixed(3)}`;
  if (morph.hornEnvelope.across > 0.55) return `horn span ${morph.hornEnvelope.across.toFixed(3)} m`;
  return null;
}

/** Whole slider cube for both horn topologies and every branch tier. */
export function morphSpaceFaults(worldSeed = 684): string[] {
  const faults: string[] = [];
  for (const hornType of ['single', 'paired'] as const) for (const branches of [0, 1, 2, 3] as const)
  for (let i = 0; i < 5; i++) for (let d = 0; d < 3; d++) for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) {
    const axes: MorphAxes = { bulk: i / 4, depth: d / 2, stature: j / 4, crown: k / 4, hornType, branches };
    const { morph } = resolveMorph({ worldSeed, creatureSeed: 1, axes });
    const fault = morphFault(morph);
    if (fault) faults.push(`${hornType}/${branches}/${axes.bulk},${axes.depth},${axes.stature},${axes.crown}: ${fault}`);
  }
  return faults;
}
