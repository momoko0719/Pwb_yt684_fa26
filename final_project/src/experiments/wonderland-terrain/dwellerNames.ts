import { createRng } from '../../core/rng';
import { clamp01, type MorphAxes } from './creatureMorph';

/**
 * Who each creature is (as The Sims names its people at random): a name from a list of jade and
 * stone words (strings.ts `dweller.name.<i>` and its meaning `dweller.gloss.<i>`, in both languages),
 * and its antlers. All from the island's seed and the creature's id: the same island, the same names.
 */
export const NAME_COUNT = 14;

/** Distinct name indices for `count` creatures on this island. */
export function dwellerNames(worldSeed: number, count: number): number[] {
  const rand = createRng(worldSeed * 17 + 3);
  const pool = Array.from({ length: NAME_COUNT }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

/**
 * Its antlers: one or two, how many generations of the branching rule, how they sweep. Only the
 * antlers vary: the body the simulation walks with (BODY in dwelling.ts) stays the one sculpt, so
 * feet, drinking reach and the den's headroom hold for every creature (every antler passes
 * check-morph-rework).
 */
export function dwellerAntlers(worldSeed: number, id: number): Pick<MorphAxes, 'hornType' | 'branches' | 'crown'> {
  const rand = createRng(worldSeed * 29 + id * 53 + 1);
  return { hornType: rand() < 0.25 ? 'single' : 'paired', branches: Math.floor(rand() * 4) as 0 | 1 | 2 | 3, crown: clamp01(0.3 + rand() * 0.6) };
}

/**
 * Its whole form, at birth: build, belly and height as well as the antlers, each seeded. Mass and
 * reach are loosely tied (as birthAxes ties them); every value stays in the editor's range, which
 * check-morph-rework holds to the drinking reach, the den's headroom and the leg's stretch.
 */
export function dwellerForm(worldSeed: number, id: number): MorphAxes {
  const rand = createRng(worldSeed * 41 + id * 67 + 9);
  const mass = rand(), reach = rand();
  return {
    bulk: mass,
    depth: clamp01(0.3 + 0.5 * mass + 0.2 * rand()),
    stature: clamp01(0.55 * reach + 0.45 * (1 - mass)),
    ...dwellerAntlers(worldSeed, id),
  };
}

/** A trait's word: which third of its range it falls in. */
export const traitWord = (v: number) => (v < 1 / 3 ? 'low' : v > 2 / 3 ? 'high' : 'mid');
