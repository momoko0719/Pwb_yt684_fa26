/**
 * Why the wide-basin tint missed the faces. Seed 684.
 * Compares isotropic blur(h)−h (the foot ring) with cross-slope hollow (the faces).
 * Usage: npx tsx scripts/probe-fold-faces.ts [seed]
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildRockFolds, FOLD } from '../src/experiments/wonderland-terrain/rockFolds';

const seed = Number(process.argv[2] ?? 684);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const folds = buildRockFolds(grid, rules.meadow);

const { size, texel, data } = grid;
const h = new Float32Array(size * size);
for (let t = 0; t < h.length; t++) h[t] = data[t * 4];

function box(src: Float32Array, radius: number) {
  const a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (from: Float32Array, to: Float32Array, step: number, along: number) => {
    for (let line = 0; line < size; line++) {
      const base = line * along;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += from[base + Math.min(Math.max(k, 0), size - 1) * step];
      for (let k = 0; k < size; k++) {
        to[base + k * step] = sum / (2 * radius + 1);
        sum += from[base + Math.min(k + radius + 1, size - 1) * step] - from[base + Math.max(k - radius, 0) * step];
      }
    }
  };
  for (let p = 0; p < 3; p++) { pass(a, b, 1, size); pass(b, a, size, 1); }
  return a;
}
const iso40 = box(h, 40);
const at = (i: number) => (i - (size - 1) / 2) * texel;

type Bucket = { n: number; iso: number[]; wide: number[]; fold: number[] };
const buckets: Record<string, Bucket> = {
  foot: { n: 0, iso: [], wide: [], fold: [] },
  body: { n: 0, iso: [], wide: [], fold: [] },
  ridge: { n: 0, iso: [], wide: [], fold: [] },
};
const picks: { kind: string; x: number; z: number; lift: number; mountain: number; fold: number; wide: number; iso: number }[] = [];

for (let j = 2; j < size - 2; j += 2) {
  for (let i = 2; i < size - 2; i += 2) {
    const t = j * size + i;
    if (data[t * 4 + 3] >= 0) continue;
    const lift = h[t] - rules.meadow(at(i), at(j), data[t * 4 + 3]);
    if (lift < 6) continue;
    const mountain = folds.rgba[t * 4] / 255;
    const fold = folds.rgba[t * 4 + 1] / 255;
    const wide = folds.rgba[t * 4 + 3] / 255;
    const iso = iso40[t] - h[t];
    const kind = lift < 22 ? 'foot' : wide < 0.08 && fold < 0.15 ? 'ridge' : 'body';
    const b = buckets[kind];
    b.n++;
    if (b.iso.length < 4000) { b.iso.push(iso); b.wide.push(wide); b.fold.push(fold); }
    const x = at(i), z = at(j);
    const row = { kind, x: +x.toFixed(1), z: +z.toFixed(1), lift: +lift.toFixed(1), mountain: +mountain.toFixed(2), fold: +fold.toFixed(2), wide: +wide.toFixed(2), iso: +iso.toFixed(2) };
    if (kind === 'foot' && iso > 6 && picks.filter((p) => p.kind === 'foot').length < 1) picks.push(row);
    if (kind === 'ridge' && lift > 50 && picks.filter((p) => p.kind === 'ridge').length < 1) picks.push(row);
    if (kind === 'body' && wide > 0.55 && lift > 35 && picks.filter((p) => p.kind === 'body-wide').length < 1) picks.push({ ...row, kind: 'body-wide' });
    if (kind === 'body' && wide < 0.12 && fold < 0.2 && lift > 40 && picks.filter((p) => p.kind === 'body-plane').length < 1) picks.push({ ...row, kind: 'body-plane' });
  }
}

const q = (a: number[], f: number) => {
  const s = a.slice().sort((p, c) => p - c);
  return s.length ? s[Math.floor(f * (s.length - 1))].toFixed(2) : '-';
};
console.log(`seed ${seed} bake ${folds.ms.toFixed(0)} ms  wide ease ${FOLD.wide.from}–${FOLD.wide.to} m @ r=${FOLD.wide.radius}`);
for (const [name, b] of Object.entries(buckets)) {
  console.log(
    `${name} n≈${b.n}  iso40 p50/p90 ${q(b.iso, 0.5)}/${q(b.iso, 0.9)} m`
    + `  wide p50/p90 ${q(b.wide, 0.5)}/${q(b.wide, 0.9)}`
    + `  fold6/18 p50/p90 ${q(b.fold, 0.5)}/${q(b.fold, 0.9)}`,
  );
}
console.log('samples', JSON.stringify(picks, null, 2));
const bands = [6, 14, 22, 30, 45, 70, 200];
for (let b = 0; b < bands.length - 1; b++) {
  const w: number[] = [], m: number[] = [];
  let n = 0, hi = 0;
  for (let j = 2; j < size - 2; j += 2) {
    for (let i = 2; i < size - 2; i += 2) {
      const t = j * size + i;
      if (data[t * 4 + 3] >= 0) continue;
      const lift = h[t] - rules.meadow(at(i), at(j), data[t * 4 + 3]);
      if (lift < bands[b] || lift >= bands[b + 1]) continue;
      n++;
      const wide = folds.rgba[t * 4 + 3] / 255;
      const mountain = folds.rgba[t * 4] / 255;
      if (w.length < 3000) { w.push(wide); m.push(mountain * wide); }
      if (wide > 0.45) hi++;
    }
  }
  console.log(`lift ${bands[b]}–${bands[b + 1]} n=${n} wide>0.45 ${(100 * hi / Math.max(n, 1)).toFixed(0)}%  wide p50 ${q(w, 0.5)} p90 ${q(w, 0.9)}  mtn*wide p50 ${q(m, 0.5)} p90 ${q(m, 0.9)}`);
}

// Old shipped mix at these samples: wide=smoothstep(bowl)*... was near 0 on faces, high on foot.
function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
console.log('--- if these iso40 values were eased 0.55–4.2 (old basin) ---');
for (const p of picks) {
  const basin = smooth(0.55, 4.2, p.iso);
  const wideOld = smooth(0.12, 0.72, basin);
  console.log(`${p.kind} basinEase ${basin.toFixed(2)} oldWideMask ${wideOld.toFixed(2)} newWide ${p.wide.toFixed(2)} mountain ${p.mountain.toFixed(2)} productOld≈${(p.mountain * wideOld).toFixed(2)}`);
}
