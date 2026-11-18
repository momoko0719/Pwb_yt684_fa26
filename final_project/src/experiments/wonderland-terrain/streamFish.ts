import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { createRng } from '../../core/rng';
import { formFromSeed, SWIM, type FishForm } from './fishForm';
import { SCHOOL_DEFAULT, schoolPull, type SchoolParams } from './schoolRules';
import type { Water } from './water';

/** Where a fish may swim: deep enough water, the current there, the pool, the falls' landing spots. */
export interface FishPool {
  deepAt: (x: number, z: number) => boolean;
  flowAt: (x: number, z: number) => [number, number];
  centre: [number, number];
  radius: number;
  impacts: { x: number; z: number; spread: number }[];
  /** The school's shared state: its rule's knobs (the atlas changes them live) and where it is heading. */
  school: { params: SchoolParams; goal: [number, number] | null; seed: number; picks: number; goalAge: number };
}

/** The first small school uses real pool depth and flow cells, not screen coordinates. */
export interface StreamFishData extends FishForm {
  id: number; x: number; z: number; y: number;
  /** Cruising speed, m/s (from its length: SWIM.cruise body lengths a second). */
  swimSpeed: number;
  /** The current where it was born; it holds facing into it. */
  flowX: number; flowZ: number;
  /** How far from its birthplace it holds station, metres. */
  trackRadius: number;
  /** What its own stamina asks for (FISH_RULES' two marks); `state` is what the school does (the majority's wish). */
  wish: 'hold' | 'explore';
  energy: number; state: 'hold' | 'explore' | 'drift';
  pool: FishPool;
  /** Where it is now and which way it faces (radians, 0 = +x): moved by its swim rules each frame. */
  now: { x: number; z: number; heading: number; speed: number };
}

export const FISH_RULES = {
  minDepth: 0.55, surfaceGap: 0.22, bedGap: 0.18, poolFraction: 0.62,
  /** A school: six to ten (docs/plan-2026-11-18-school-herd.md). */
  count: [6, 10] as const,
  /** Stamina per second of island time (1× by default: about 100 s roaming, 50 s holding; at 10×, 10 s and 5 s). */
  energyDrain: 0.004, energyRecover: 0.008,
  /** Stamina marks: below `hold` it rests holding against the current; above `explore` it roams again. */
  hold: 0.28, explore: 0.68,
};

export function createStreamFish(seed: number, water: Water, grid: HeightGrid): StreamFishData[] {
  const field = water.field;
  if (!field || water.plunge.radius <= 0) return [];
  const rand = createRng(seed * 83 + 671);
  const count = FISH_RULES.count[0] + Math.floor(rand() * (FISH_RULES.count[1] - FISH_RULES.count[0] + 1));
  const cell = (px: number, pz: number) => {
    const ci = Math.round((px - field.x0) / field.step), cj = Math.round((pz - field.z0) / field.step);
    return ci < 0 || cj < 0 || ci >= field.nx || cj >= field.nz ? -1 : cj * field.nx + ci;
  };
  const pool: FishPool = {
    deepAt: (px, pz) => { const t = cell(px, pz); return t >= 0 && field.level[t] - sampleGrid(grid, px, pz) >= FISH_RULES.minDepth; },
    flowAt: (px, pz) => { const t = cell(px, pz); return t >= 0 ? [field.vx[t], field.vz[t]] : [0, 0]; },
    centre: [water.plunge.x, water.plunge.z],
    radius: water.plunge.radius,
    impacts: water.impacts.map((i) => ({ x: i.x, z: i.z, spread: i.spread })),
    school: { params: { ...SCHOOL_DEFAULT }, goal: null, seed: seed * 101 + 7, picks: 0, goalAge: 0 },
  };
  const fish: StreamFishData[] = [];
  for (let k = 0; k < count; k++) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const angle = 2 * Math.PI * rand(), radius = water.plunge.radius * FISH_RULES.poolFraction * Math.sqrt(rand());
      const x = water.plunge.x + Math.cos(angle) * radius, z = water.plunge.z + Math.sin(angle) * radius;
      if (water.impacts.some((impact) => Math.hypot(x - impact.x, z - impact.z) < impact.spread + 1.5)) continue;
      const t = cell(x, z);
      if (t < 0) continue;
      const surface = field.level[t], bed = sampleGrid(grid, x, z);
      if (!Number.isFinite(surface) || surface - bed < FISH_RULES.minDepth) continue;
      const y = Math.max(bed + FISH_RULES.bedGap, surface - FISH_RULES.surfaceGap - 0.1 * rand());
      const axis = Math.atan2(field.vz[t], field.vx[t] || .001);
      let trackRadius = Math.min(2.2, water.plunge.radius * .1);
      while (trackRadius > .35 && ![-1, 1].every((sign) => pool.deepAt(x + sign * Math.cos(axis) * trackRadius, z + sign * Math.sin(axis) * trackRadius))) trackRadius *= .75;
      if (trackRadius <= .35) continue;
      const form = formFromSeed(Math.floor(rand() * 1e6));
      const swimSpeed = form.length * (SWIM.cruise[0] + rand() * (SWIM.cruise[1] - SWIM.cruise[0]));
      fish.push({ ...form, id: k + 1, x, z, y, swimSpeed, flowX: field.vx[t], flowZ: field.vz[t], trackRadius,
        energy: 0.55 + 0.4 * rand(), wish: 'hold', state: 'hold', pool, now: { x, z, heading: axis + Math.PI, speed: 0 } });
      break;
    }
  }
  return fish;
}

/** Seconds (real) before the school gives up on a goal it has not reached. */
const GOAL_S = 20;

const wrapAngle = (a: number) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const turnToward = (from: number, to: number, max: number) => from + Math.max(-max, Math.min(max, wrapAngle(to - from)));

/**
 * One step of one fish in its school (`dt` real seconds for swimming, `simDt` island seconds for
 * stamina). Priority, highest last so it wins:
 * 1. its wish (stamina) and the school's state (what most of them wish);
 * 2. roaming: toward the school's goal, a seeded deep point the first fish picks when the school
 *    reaches it; holding: into the current, near the first fish's birthplace;
 * 3. the school rule (schoolRules.ts): repel, align, attract;
 * 4. the water: shallow ahead → toward the pool's middle; a fall's landing → away.
 */
export function stepFish(fish: StreamFishData, all: StreamFishData[], dt: number, simDt: number) {
  fish.energy = Math.max(0, Math.min(1, fish.energy + (fish.state === 'hold' ? FISH_RULES.energyRecover : -FISH_RULES.energyDrain) * simDt));
  if (fish.energy < FISH_RULES.hold) fish.wish = 'hold'; else if (fish.energy > FISH_RULES.explore) fish.wish = 'explore';
  fish.state = all.filter((o) => o.wish === 'hold').length * 2 >= all.length ? 'hold' : 'explore';
  const now = fish.now, pool = fish.pool, school = pool.school, lead = all[0];
  let want: number, pace: number, goalWeight: number;
  if (fish.state === 'explore') {
    // A new goal when the school's first fish reaches it, or after GOAL_S without (a fall's landing or
    // shallows may stand between).
    if (fish === lead) school.goalAge += dt;
    if (fish === lead && (!school.goal || school.goalAge > GOAL_S || Math.hypot(school.goal[0] - now.x, school.goal[1] - now.z) < fish.length * 2)) {
      school.goalAge = 0;
      const rand = createRng(school.seed + school.picks++ * 7919);
      for (let k = 0; k < 16; k++) {
        const a = rand() * Math.PI * 2, r = pool.radius * 0.6 * Math.sqrt(rand());
        const gx = pool.centre[0] + Math.cos(a) * r, gz = pool.centre[1] + Math.sin(a) * r;
        if (pool.deepAt(gx, gz) && !pool.impacts.some((i) => Math.hypot(gx - i.x, gz - i.z) < i.spread + 1)) { school.goal = [gx, gz]; break; }
      }
    }
    want = school.goal ? Math.atan2(school.goal[1] - now.z, school.goal[0] - now.x) : now.heading;
    pace = fish.swimSpeed;
    // The first fish leads; the rest mostly follow the school.
    goalWeight = fish === lead ? 1 : 0.35;
  } else {
    school.goal = null;
    const [fx, fz] = pool.flowAt(now.x, now.z);
    const home = Math.hypot(lead.x - now.x, lead.z - now.z), range = lead.trackRadius * 1.6;
    want = home > range ? Math.atan2(lead.z - now.z, lead.x - now.x) : Math.atan2(-fz, -(fx || 1e-3));
    pace = fish.swimSpeed * (home > range ? 0.5 : 0.15);
    goalWeight = 0.8;
  }
  const pull = schoolPull({ x: now.x, z: now.z, heading: now.heading, length: fish.length }, all.map((o) => ({ x: o.now.x, z: o.now.z, heading: o.now.heading, length: o.length })), school.params);
  if (pull.dir) {
    const w = pull.repelled ? 2.5 : 1;
    want = Math.atan2(Math.sin(want) * goalWeight + pull.dir[1] * w, Math.cos(want) * goalWeight + pull.dir[0] * w);
  } else if (all.length > 1) {
    // Seeing no one: back toward the rest (a fish avoids being alone).
    let cx = 0, cz = 0;
    for (const o of all) if (o !== fish) { cx += o.now.x; cz += o.now.z; }
    want = Math.atan2(cz / (all.length - 1) - now.z, cx / (all.length - 1) - now.x);
    pace = Math.max(pace, fish.swimSpeed);
  }
  const look = fish.length * 1.5 + 0.4;
  if (!pool.deepAt(now.x + Math.cos(now.heading) * look, now.z + Math.sin(now.heading) * look)) want = Math.atan2(pool.centre[1] - now.z, pool.centre[0] - now.x);
  for (const i of pool.impacts) if (Math.hypot(now.x - i.x, now.z - i.z) < i.spread + 1) want = Math.atan2(now.z - i.z, now.x - i.x);
  now.heading = turnToward(now.heading, want, dt * 1.4);
  now.speed += (pace - now.speed) * Math.min(1, dt * 1.5);
  // Blocked by shallow water: slide along its edge (the nearest deep heading either side) rather than stop.
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
    const h = now.heading + off, nx = now.x + Math.cos(h) * now.speed * dt, nz = now.z + Math.sin(h) * now.speed * dt;
    if (pool.deepAt(nx, nz)) { now.x = nx; now.z = nz; if (off) now.heading = turnToward(now.heading, h, dt * 2); break; }
  }
}
