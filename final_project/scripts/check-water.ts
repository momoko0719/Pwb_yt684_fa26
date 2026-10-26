// Project check (docs/wonderland-handoff.md): the water system's continuity for several seeds and flows.
// Run from final_project: npx tsx scripts/check-water.ts   (VARIATION=0 for the agreed layout)
import { sampleGrid } from '../src/core/terrain/heightGrid';
import { sampleField } from '../src/core/terrain/potentialFlow';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';

type F = { x0: number; z0: number; step: number; nx: number; nz: number; mask: Uint8Array; vx: Float32Array; vz: Float32Array };
const onWater = (f: F, x: number, z: number) => {
  const i = Math.round((x - f.x0) / f.step), j = Math.round((z - f.z0) / f.step);
  return i >= 0 && j >= 0 && i < f.nx && j < f.nz && f.mask[j * f.nx + i] === 1;
};
// Follow the field's direction from (x, z), `ds` metres a step, until `done`; count steps off the
// water (a crossed shore). (By direction: a slow pool's middle moves millimetres a second.)
const unit = (a: [number, number]): [number, number] => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
export const offAt: [number, number][] = [];
const follow = (f: F, x: number, z: number, done: (x: number, z: number) => boolean, ds = 0.4, max = 6000) => {
  let off = 0;
  offAt.length = 0;
  for (let s = 0; s < max; s++) {
    if (done(x, z)) return { reached: true, off, s };
    const a0 = sampleField(f, f.vx, f.vz, x, z);
    if (!a0) return { reached: false, off, s };
    const a = unit(a0);
    const b = unit(sampleField(f, f.vx, f.vz, x + a[0] * ds * 0.5, z + a[1] * ds * 0.5) ?? a0);
    x += b[0] * ds; z += b[1] * ds;
    if (!onWater(f, x, z)) { off++; offAt.push([x, z]); }
  }
  return { reached: false, off, s: max };
};

let problems = 0;
for (const seed of [684, 7, 42, 1234]) {
  for (const flow of [0.3, 3, 15]) {
    const params = { ...GROUND_DEFAULTS, seed, frame: { ...GROUND_DEFAULTS.frame, variation: Number(process.env.VARIATION ?? GROUND_DEFAULTS.frame.variation) } };
    const { grid } = bakeGround(params);
    const rules = groundRules(params);
    const t = performance.now();
    const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, flow);
    const water = buildWater(rules, grid, terrace, { ...WATER_DEFAULTS, flow }, seed);
    const ms = Math.round(performance.now() - t);
    const lines: string[] = [];
    // Pools: particles from each inflow reach one of the pool's lips, never leaving the water.
    for (const pool of terrace.pools) {
      const lips = terrace.outlets.filter((o) => o.pool === pool.id).flatMap((o) => o.lip);
      let reached = 0, total = 0, off = 0, steps = 0, nearLip = 0, missed = 0;
      for (const q of pool.inflows) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * 2 * Math.PI, r = Math.max(q.spread * 0.5, 1.5);
          const sx = q.x + Math.cos(a) * r, sz = q.z + Math.sin(a) * r;
          if (!onWater(pool.field, sx, sz)) continue; // (behind the landing, under the wall above)
          const res = follow(pool.field, sx, sz, (x, z) => lips.some((lp) => Math.hypot(lp.x - x, lp.z - z) < 1.5));
          total++; if (res.reached) { reached++; steps = Math.max(steps, res.s); } off += res.off;
          for (const [x, z] of offAt) if (lips.some((lp) => Math.hypot(lp.x - x, lp.z - z) < 5)) nearLip++;
          if (!res.reached && missed++ < 2) {
            const st = offAt.length ? offAt[offAt.length - 1] : [sx, sz];
            lines.push(`    missed: from (${sx.toFixed(1)}, ${sz.toFixed(1)}), last off at (${st[0].toFixed(1)}, ${st[1].toFixed(1)}), ${res.s} steps`);
          }
        }
      }
      if (reached < total || off - nearLip > 0) problems++;
      lines.push(`  pool ${pool.id}: ${reached}/${total} particles from its inflows reach an outlet (longest path ${(steps * 0.4).toFixed(0)} m), ${off} steps off the water (${nearLip} within 5 m of a lip)`);
    }
    // Below the terrace: shares, ways to the rim, levels only falling, the water below both banks.
    const streams = water.ways.slice(1).filter((w) => w.points.length > 3 && !(w.points[0][0] === water.ways[0].points[0][0]) || true);
    const sum = water.ways.slice(1, 1 + WATER_DEFAULTS.streams).reduce((a, w) => a + w.flow, 0);
    let rising = 0, spilling = 0, short = 0;
    for (const w of streams) {
      for (let k = 1; k < w.points.length; k++) if (w.points[k][1] > w.points[k - 1][1] + 1e-6) rising++;
    }
    // A visible edge: on the mesh's edge (a neighbour off it), the water above the ground (not at the rim's lip).
    if (water.field) {
      const f = water.field, L = f.level;
      for (let j = 1; j + 1 < f.nz; j++) for (let i = 1; i + 1 < f.nx; i++) {
        const t = j * f.nx + i;
        if (Number.isNaN(L[t])) continue;
        if (!(Number.isNaN(L[t - 1]) || Number.isNaN(L[t + 1]) || Number.isNaN(L[t - f.nx]) || Number.isNaN(L[t + f.nx]))) continue;
        const x = f.x0 + i * f.step, z = f.z0 + j * f.step;
        if (sampleGrid(grid, x, z, 3) > -1.5) continue;
        if (L[t] > sampleGrid(grid, x, z) + 0.01) spilling++;
      }
    }
    const ends = water.ways.filter((w) => !w.main || w === water.ways[0]).length;
    for (const w of water.ways.slice(1)) {
      const [x, , z] = w.points[w.points.length - 1];
      const o = sampleGrid(grid, x, z, 3);
      const intoPool = Math.hypot(x - water.plunge.x, z - water.plunge.z) < water.plunge.radius * 2.6;
      if (o < -1 && !intoPool) short++;
    }
    // Particles from the plunge pool reach the rim.
    let down = 0, downTotal = 0, downOff = 0;
    if (water.field) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 2 * Math.PI, r = water.plunge.radius * 0.5;
        const res = follow(water.field, water.plunge.x + Math.cos(a) * r, water.plunge.z + Math.sin(a) * r, (x, z) => sampleGrid(grid, x, z, 3) > -1.5, 0.25, 8000);
        downTotal++; if (res.reached) down++; downOff += res.off;
      }
    }
    if (rising || spilling > 2 || short || Math.abs(sum - flow) > 1e-6 || down < downTotal * 0.9) problems++;
    lines.push(`  below: shares ${water.ways.slice(1).map((w) => `${w.flow.toFixed(2)}${w.main ? '*' : ''}`).join(' + ')} = ${sum.toFixed(3)} (in ${flow}); level rising ${rising}; mesh edges standing above the ground ${spilling}; ways ending short ${short}; plunge→rim particles ${down}/${downTotal} (${downOff} steps off)`);
    void ends;
    console.log(`seed ${seed}, flow ${flow} (${ms} ms)`);
    console.log(lines.join('\n'));
  }
}
console.log(problems ? `${problems} problems` : 'all continuous');
