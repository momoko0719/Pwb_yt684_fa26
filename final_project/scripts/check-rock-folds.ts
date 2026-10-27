// Project check (docs/rock-folds-2026-10-27.md): the rock folds' field on several seeds: concavity
// percentiles on the mountains at both scales, how much of the mountain takes colour, bake time,
// and that it is the same built twice. Run from final_project: npx tsx scripts/check-rock-folds.ts [seeds]
import { createHash } from 'crypto';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildRockFolds, FOLD, foldStats } from '../src/experiments/wonderland-terrain/rockFolds';

let failures = 0;
for (const seed of (process.argv[2] ?? '684,7,42').split(',').map(Number)) {
  const build = () => {
    const params = { ...GROUND_DEFAULTS, seed };
    const { grid } = bakeGround(params);
    const rules = groundRules(params);
    const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
    buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
    return { grid, rules, folds: buildRockFolds(grid, rules.meadow) };
  };
  const { grid, rules, folds } = build();
  const f = (r: number) => { const s = foldStats(grid, rules.meadow, r); return `p10 ${s.p10.toFixed(2)} p50 ${s.p50.toFixed(2)} p75 ${s.p75.toFixed(2)} p90 ${s.p90.toFixed(2)} p97 ${s.p97.toFixed(2)} m`; };
  let mountain = 0, tinted = 0, plainTinted = 0, land = 0;
  for (let t = 0; t < folds.size * folds.size; t++) {
    if (grid.data[t * 4 + 3] >= 0) continue;
    land++;
    const m = folds.rgba[t * 4] / 255, w = m * folds.rgba[t * 4 + 1] / 255;
    if (m > 0.5) { mountain++; if (w > 0.3) tinted++; }
    else if (m < 0.05 && w > 0.05) plainTinted++;
  }
  console.log(`seed ${seed}: bake ${folds.ms.toFixed(0)} ms; mountain ${(mountain / land * 100).toFixed(1)}% of the island, of it folds over 0.3: ${(tinted / Math.max(mountain, 1) * 100).toFixed(1)}%; plain cells tinted ${plainTinted}`);
  console.log(`  concavity ${FOLD.fine.radius} m: ${f(FOLD.fine.radius)}`);
  console.log(`  concavity ${FOLD.broad.radius} m: ${f(FOLD.broad.radius)}`);
  if (plainTinted) { failures++; console.log('  FAIL: colour on the plain'); }
  const again = build().folds;
  const h = (a: Uint8Array) => createHash('md5').update(a).digest('hex').slice(0, 10);
  if (h(again.rgba) !== h(folds.rgba)) { failures++; console.log('  FAIL: not reproducible'); } else console.log(`  reproducible (${h(folds.rgba)})`);
}
console.log(failures ? `${failures} failures` : 'all hold');
process.exit(failures ? 1 : 0);
