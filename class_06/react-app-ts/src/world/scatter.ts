import { createRng, smoothstep } from './noise';
import { RIVER_WIDTH, ROAD_WIDTH, SIZE, type Land, type Stroke } from './terrain';

export type Species = 'pine' | 'reed' | 'flower' | 'rock' | 'pavilion' | 'lantern';
export const SPECIES: Species[] = ['pine', 'reed', 'flower', 'rock', 'pavilion', 'lantern'];

export interface Item {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  /** 0..1, read from the ground: how wet (plants) or how high (rocks); drives the color. */
  tint: number;
}

const SPACING = 1.1; // candidate grid, world units: one jittered candidate per cell

/**
 * One rule layer per species. Every candidate point asks the ground (height, slope, moisture,
 * distance to river and road) and the first species whose rule accepts it grows there.
 * - rock: only on steep ground (cliffs), more of them the steeper it is
 * - reed: only on river banks, never in the water
 * - pine: on gentle slopes in clumps (noise), avoiding cliffs, water and roads; smaller up high
 * - flower: on wet, flat ground; colour shifts with moisture
 * - pavilion: a few, on the flattest high spots, far apart
 * - lantern: along roads, at even spacing, alternating sides
 */
export function scatter(land: Land, strokes: Stroke[], seed: number, density: number, on: Record<Species, boolean>): Record<Species, Item[]> {
  const rng = createRng(seed ^ 0x51ed);
  const out: Record<Species, Item[]> = { pine: [], reed: [], flower: [], rock: [], pavilion: [], lantern: [] };
  const n = Math.floor(SIZE / SPACING);
  const half = SIZE / 2 - 2;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -SIZE / 2 + (i + rng()) * SPACING;
      const z = -SIZE / 2 + (j + rng()) * SPACING;
      const roll = rng();
      const yaw = rng() * Math.PI * 2;
      const size = rng();
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      const slope = land.sample(land.slope, x, z);
      const wet = land.sample(land.moisture, x, z);
      const river = land.sample(land.river, x, z);
      const road = land.sample(land.road, x, z);
      const y = land.heightAt(x, z);
      const clump = land.noise(x * 0.09 + 50, z * 0.09 - 20);
      if (river < RIVER_WIDTH * 0.9 || road < ROAD_WIDTH * 1.4) continue; // nothing grows in water or on the road

      if (on.rock && slope > 0.32 && roll < density * 0.35 * smoothstep(0.32, 0.6, slope)) {
        out.rock.push({ x, y, z, scale: 0.6 + size * 1.2, yaw, tint: smoothstep(-5, 12, y) });
      } else if (on.reed && river < RIVER_WIDTH * 2.2 && slope < 0.4 && roll < density * 0.9) {
        out.reed.push({ x, y, z, scale: 0.7 + 0.6 * wet, yaw, tint: wet });
      } else if (on.pine && slope < 0.28 && clump > 0.5 && wet > 0.05 && roll < density * 0.6 * smoothstep(0.5, 0.75, clump)) {
        const high = smoothstep(-2, 12, y);
        out.pine.push({ x, y, z, scale: (1.3 - 0.6 * high) * (0.8 + 0.4 * size), yaw, tint: wet });
      } else if (on.flower && wet > 0.45 && slope < 0.12 && roll < density * 0.5 * (wet - 0.3)) {
        out.flower.push({ x, y, z, scale: 0.6 + 0.6 * size, yaw, tint: wet });
      }
    }
  }

  // Pavilions: the flattest, highest candidates, at least 18 units apart.
  if (on.pavilion) {
    const spots: Item[] = [];
    for (let k = 0; k < 400; k++) {
      const x = (rng() - 0.5) * SIZE * 0.8;
      const z = (rng() - 0.5) * SIZE * 0.8;
      if (land.sample(land.slope, x, z) > 0.06 || land.sample(land.river, x, z) < 6) continue;
      spots.push({ x, y: land.heightAt(x, z), z, scale: 1, yaw: rng() * Math.PI, tint: 0 });
    }
    spots.sort((a, b) => b.y - a.y);
    for (const s of spots) {
      if (out.pavilion.length >= Math.round(2 + 3 * density)) break;
      if (out.pavilion.every((p) => Math.hypot(p.x - s.x, p.z - s.z) > 18)) out.pavilion.push(s);
    }
  }

  // Lanterns: every few units along each road, alternating sides.
  if (on.lantern) {
    for (const s of strokes.filter((st) => st.kind === 'road')) {
      for (let k = 2; k < s.path.length - 1; k += 4) {
        const [ax, az] = s.path[k - 1];
        const [bx, bz] = s.path[k + 1];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const side = k % 8 === 2 ? 1 : -1;
        const x = s.path[k][0] + (-(bz - az) / len) * ROAD_WIDTH * 1.6 * side;
        const z = s.path[k][1] + ((bx - ax) / len) * ROAD_WIDTH * 1.6 * side;
        out.lantern.push({ x, y: land.heightAt(x, z), z, scale: 1, yaw: 0, tint: 0 });
      }
    }
  }
  return out;
}
