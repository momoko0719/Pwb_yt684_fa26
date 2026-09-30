import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createRng } from '../rng';
import type { IslandParams } from '../params/island';
import type { IslandField } from './island';

/** Thin falls: a few white threads dropping off the rim, breaking into vapour partway down. */
const FALL_LENGTH: [number, number] = [0.625, 0.94]; // fraction of undersideDepth, before the thread has dissolved
const MIN_LENGTH = 10; // world units, so shallow islands still get a visible fall
const FALL_WIDTH = 0.06; // fraction of radius at the lip, so the thread stays visible on large islands
const FALL_SPREAD = 3; // the thread is this many times wider where it dissolves
const LAUNCH = 0.015; // fraction of radius outside the rim where the water leaves the edge
const THROW = 0.25; // horizontal throw in world units: out = THROW * sqrt(drop), like water leaving a ledge
const SWAY = 0.02; // fraction of radius of side-to-side drift at the bottom
const SEGMENTS = 48; // rows along each fall
const CANDIDATES = 96; // rim angles tried
const BAY_BIAS = 0.15; // how much randomness competes with "prefer bays" when picking angles
const MIN_GAP = 0.6; // radians between falls
const FALL_SEED_SALT = 0x27d4eb2f;

/**
 * Crossed ribbons, one pair per fall. Attributes: `uv` (x across 0..1, y along 0 lip to 1 end),
 * `aSeed` (per fall, 0..1) and `aLength` (world units, so the shader can scale its streaks).
 * Pure function: same params, same geometry.
 */
export function createWaterfalls(field: IslandField, p: IslandParams, count: number): BufferGeometry {
  const rng = createRng((p.seed ^ FALL_SEED_SALT) >>> 0);
  const angles = pickAngles(field, p, Math.max(Math.round(count), 0), rng);

  const positions: number[] = [];
  const uvs: number[] = [];
  const seeds: number[] = [];
  const lengths: number[] = [];
  const indices: number[] = [];

  angles.forEach((angle) => {
    const seed = rng();
    const length = Math.max(MIN_LENGTH, p.undersideDepth * (FALL_LENGTH[0] + (FALL_LENGTH[1] - FALL_LENGTH[0]) * rng()));
    const out = [Math.cos(angle), Math.sin(angle)];
    const side = [-out[1], out[0]];
    const lip = field.rim(angle) + LAUNCH * p.radius;
    const phase = rng() * 100;

    // Path center and width at each row; the sway comes from the island's own noise.
    const path = Array.from({ length: SEGMENTS + 1 }, (_, k) => {
      const v = k / SEGMENTS;
      const drop = v * length;
      const reach = lip + THROW * Math.sqrt(drop);
      const drift = SWAY * p.radius * v * v * field.noise(v * 2 + phase, phase);
      return {
        x: out[0] * reach + side[0] * drift,
        y: field.rimY - drop,
        z: out[1] * reach + side[1] * drift,
        half: 0.5 * FALL_WIDTH * p.radius * (1 + (FALL_SPREAD - 1) * v * v),
        v,
      };
    });

    // Two ribbons: one facing out from the cliff, one edge-on to it, so the fall has body from any side.
    for (const across of [side, out]) {
      const start = positions.length / 3;
      path.forEach(({ x, y, z, half, v }) => {
        for (const u of [0, 1]) {
          const s = (u * 2 - 1) * half;
          positions.push(x + across[0] * s, y, z + across[1] * s);
          uvs.push(u, v);
          seeds.push(seed);
          lengths.push(length);
        }
      });
      for (let k = 0; k < SEGMENTS; k++) {
        const a = start + k * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aLength', new Float32BufferAttribute(lengths, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Rim angles for the falls. Water gathers in bays, so angles where the rim pulls in score
 * better; a seeded random term keeps the choice from being the same bays every time.
 * Greedy: best score first, skipping angles too close to one already taken.
 */
function pickAngles(field: IslandField, p: IslandParams, count: number, rng: () => number): number[] {
  const offset = rng() * Math.PI * 2;
  const candidates = Array.from({ length: CANDIDATES }, (_, i) => {
    const angle = offset + (i / CANDIDATES) * Math.PI * 2;
    return { angle, score: field.rim(angle) / p.radius + BAY_BIAS * rng() };
  }).sort((a, b) => a.score - b.score);

  const picked: number[] = [];
  const gap = Math.min(MIN_GAP, (Math.PI * 2) / Math.max(count, 1) / 2);
  for (const { angle } of candidates) {
    if (picked.length >= count) break;
    const clear = picked.every((a) => Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a))) >= gap);
    if (clear) picked.push(angle);
  }
  return picked;
}
