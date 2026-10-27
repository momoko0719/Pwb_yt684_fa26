/** Dump grass clump centres for a disc (top-down lattice check). Usage: npx tsx scripts/probe-grass-centres.ts [seed] [x] [z] */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';
import { buildCover } from '../src/experiments/wonderland-terrain/cover';
import { buildChunk, COVER_NEAR } from '../src/experiments/wonderland-terrain/CoverGrass';

const seed = Number(process.argv[2] ?? 684);
const fx = Number(process.argv[3] ?? -80);
const fz = Number(process.argv[4] ?? 40);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const cover = buildCover(zones, grid, seed, 0.78);
const CHUNK = COVER_NEAR.chunk, RING = COVER_NEAR.chunkRing;
const cx0 = Math.floor(fx / CHUNK), cz0 = Math.floor(fz / CHUNK);
const centres: { x: number; z: number }[] = [];
let clumps = 0, blades = 0;
for (let jz = -RING; jz <= RING; jz++) for (let ix = -RING; ix <= RING; ix++) {
  const c = buildChunk(cover, grid, seed, cx0 + ix, cz0 + jz);
  clumps += c.clumps; blades += c.blades;
  // Recover clump centres: groups of blades sharing nearly the same y-root and within clumpR.
  // Simpler: every unique (round x/0.05, round z/0.05) of first blade of each — use go spacing.
  // buildChunk doesn't return centres; approximate from blade offsets by clustering.
  for (let i = 0; i < c.go.length; i += 3) {
    // Only record a centre candidate every time we see a new cluster seed — use low-leaf first blade:
    // Not available. Instead dump all blade xz and let the report use a subsample of roots.
  }
  // Re-derive centres the same way as buildChunk for plotting.
}
// Rebuild centres via the same trial path by importing logic through a second pass of chunks:
// Prefer reading blade positions and taking the median of the densest 0.4 m bins.
const bins = new Map<string, { x: number; z: number; n: number }>();
for (let jz = -RING; jz <= RING; jz++) for (let ix = -RING; ix <= RING; ix++) {
  const c = buildChunk(cover, grid, seed, cx0 + ix, cz0 + jz);
  for (let i = 0; i < c.go.length; i += 3) {
    const x = c.go[i], z = c.go[i + 2];
    if (Math.hypot(x - fx, z - fz) > COVER_NEAR.radius) continue;
    const k = `${Math.round(x / 0.4)},${Math.round(z / 0.4)}`;
    const b = bins.get(k) ?? { x: 0, z: 0, n: 0 };
    b.x += x; b.z += z; b.n++; bins.set(k, b);
  }
}
for (const b of bins.values()) if (b.n >= 3) centres.push({ x: b.x / b.n, z: b.z / b.n });
centres.sort((a, b) => a.z - b.z || a.x - b.x);
const xs = centres.map((c) => c.x), zs = centres.map((c) => c.z);
const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
const W = 48, H = 48;
const grid2 = Array.from({ length: H }, () => Array.from({ length: W }, () => ' '));
for (const c of centres) {
  const u = Math.min(W - 1, Math.max(0, Math.floor(((c.x - minX) / Math.max(maxX - minX, 1e-3)) * (W - 1))));
  const v = Math.min(H - 1, Math.max(0, Math.floor(((c.z - minZ) / Math.max(maxZ - minZ, 1e-3)) * (H - 1))));
  grid2[H - 1 - v][u] = '·';
}
console.log(`seed ${seed} focus (${fx},${fz}): ${clumps} clumps, ${blades} blades, ${centres.length} centres in disc`);
console.log(grid2.map((r) => r.join('')).join('\n'));
console.log('sample centres:', centres.slice(0, 8).map((c) => `(${c.x.toFixed(2)}, ${c.z.toFixed(2)})`).join(' '));
