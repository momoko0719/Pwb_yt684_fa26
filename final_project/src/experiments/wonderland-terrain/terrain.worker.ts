/// <reference lib="webworker" />
import { BASE_DEPTH } from '../../core/sdf/terraceField';
import type { BasinMesh } from '../../core/terrain/basinMesh';
import { bakeLight, sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { undersideMesh, type UndersideMesh } from '../../core/terrain/undersideMesh';
import { bakeGround, groundRules, type GroundParams } from './ground';
import { buildTerrace, castHeights, type OutletNode, type PoolNode, type TerraceParams } from './terrace';
import { buildWater, type Water, type WaterParams } from './water';
import { buildZones, type Zones } from './zones';

/** The underside's numbers (sliders). */
export interface UndersideParams {
  /** Metres the keel hangs below the island's side. */
  depth: number;
  /** Hanging rocks (the main one counted). */
  rocks: number;
}
export const UNDERSIDE_DEFAULTS: UndersideParams = { depth: 120, rocks: 4 };

/** Asks of the terrain worker: build the island for these rules; bake the light for this sun. */
export type ToTerrain =
  | { type: 'ground'; id: number; params: GroundParams; terrace: TerraceParams; water: WaterParams; underside: UndersideParams }
  | { type: 'light'; id: number; sun: [number, number, number] };
export type FromTerrain =
  | { type: 'ground'; id: number; grid: HeightGrid; rim: Float32Array; terrace: BasinMesh[]; tops: number[]; pools: PoolNode[]; outlets: OutletNode[]; water: Water; zones: Zones; underside: UndersideMesh; ms: number }
  | { type: 'light'; id: number; light: Uint8Array; size: number; ms: number };

// What casts shadows, from the last island built, and where its water stands: kept for re-baking
// the light when the sun moves.
let casting: HeightGrid | null = null;
let wet: Uint8Array | null = null;

self.onmessage = (e: MessageEvent<ToTerrain>) => {
  const m = e.data;
  const t0 = performance.now();
  if (m.type === 'ground') {
    const { grid, rim } = bakeGround(m.params);
    const rules = groundRules(m.params);
    const terrace = buildTerrace(rules, grid, m.terrace, m.water.flow);
    const water = buildWater(rules, grid, terrace, m.water, m.params.seed); // digs into the grid
    // The side's top follows the ground as dug (a stream's notch where it pours over the rim).
    for (let k = 0; k < rim.length; k += 3) rim[k + 2] = sampleGrid(grid, rim[k], rim[k + 1]);
    // The zones (zones.ts), from the ground as dug and the water.
    const zones = buildZones(grid, water, rules.plate(0), m.params.seed);
    casting = castHeights(rules, grid, terrace.tops);
    wet = water.mask.slice();
    const underside = undersideMesh({ rim, top: -BASE_DEPTH, keel: rules.frame.keel, depth: m.underside.depth, rocks: m.underside.rocks, seed: m.params.seed });
    const buffers: ArrayBufferLike[] = [grid.data.buffer, rim.buffer];
    for (const b of terrace.meshes) buffers.push(b.positions.buffer, b.normals.buffer, b.occlusion.buffer, b.indices.buffer, b.water.positions.buffer, b.water.depths.buffer, b.water.flow.buffer, b.water.indices.buffer);
    for (const f of water.falls) buffers.push(f.positions.buffer, f.flow.buffer, f.extra.buffer, f.indices.buffer);
    for (const w of water.sheets) buffers.push(w.positions.buffer, w.depths.buffer, w.flow.buffer, w.indices.buffer);
    buffers.push(water.mask.buffer, zones.zone.buffer, zones.grove.buffer, zones.moisture.buffer, zones.toWater.buffer, zones.region.buffer);
    buffers.push(underside.positions.buffer, underside.normals.buffer, underside.occlusion.buffer, underside.indices.buffer);
    const reply: FromTerrain = { type: 'ground', id: m.id, grid, rim, terrace: terrace.meshes, tops: terrace.tops, pools: terrace.pools, outlets: terrace.outlets, water, zones, underside, ms: performance.now() - t0 };
    (self as unknown as Worker).postMessage(reply, buffers as ArrayBuffer[]);
  } else if (casting) {
    const light = bakeLight(casting, m.sun, wet ?? undefined);
    const reply: FromTerrain = { type: 'light', id: m.id, light, size: casting.size, ms: performance.now() - t0 };
    (self as unknown as Worker).postMessage(reply, [light.buffer]);
  }
};
