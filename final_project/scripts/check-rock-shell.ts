// The den as one rock (rockShell.ts): for a run of seeds, no rock in the habitable air or the mouth,
// a roof over the bed, its size and triangle count.
import { shellAudit, shellField, SHELL_RULES } from '../src/experiments/wonderland-terrain/rockShell';
const seeds = process.argv.slice(2).map(Number);
const list = seeds.length ? seeds : [1, 7, 42, 684, 1000, 2024, 31337, 99991];
let bad = 0;
for (const seed of list) {
  const t = performance.now();
  const a = shellAudit(seed);
  // The rock must stay clear of the field's box (else the skin is cut flat there).
  const { rock } = shellField(seed), B = SHELL_RULES.box, m = 0.3;
  for (let x = B.x[0]; x <= B.x[1] && !a.fault; x += 0.2) for (let y = 0; y <= B.y[1] && !a.fault; y += 0.2) for (let z = B.z[0]; z <= B.z[1] && !a.fault; z += 0.2) {
    const nearEdge = x < B.x[0] + m || x > B.x[1] - m || y > B.y[1] - m || z < B.z[0] + m || z > B.z[1] - m;
    if (nearEdge && rock(x, y, z) < 0) a.fault = `rock reaches the field's edge at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
  }
  if (a.fault) bad++;
  console.log(`seed ${seed}: ${a.fault ?? 'ok'} · ${a.exterior.along.toFixed(2)} × ${a.exterior.across.toFixed(2)} × ${a.exterior.height.toFixed(2)} m · ${a.triangles} tris · ${(performance.now() - t).toFixed(0)} ms`);
}
console.log(bad ? `${bad} seeds fail` : 'all seeds hold');
process.exit(bad ? 1 : 0);
