import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { createRng } from '../../core/rng';
import { SHELTER_CAVITY } from './rockShelter';

/**
 * The den as one rock (docs/plan-2026-11-16-b.md, option 2): a single boulder with an open-fronted
 * cave, grown from a signed distance field and skinned by marching cubes (the creature's skin uses
 * the same).
 *
 * Local frame as the shelter's: origin at the lie, +x out of the front, +z the thick side, y up from
 * the buried base. The habitable air (SHELTER_CAVITY, the box the body uses) is never touched: the
 * cave is that box grown outward by a margin, rounded, only ever widened by its noise, and open all
 * the way out the front (no doorway for the body to pass through).
 *
 * It grows in five steps, each one rule with its own knob (ShellParams), so the atlas can show the
 * steps and let them be changed:
 * 1. boulder: an ellipsoid over the cave (size); grown until the rock round the cave is `wall` thick;
 * 2. lumps: 0 to 6 smaller rocks fused onto its back and sides (count, size);
 * 3. swells: broad outward bulges (height);
 * 4. cave: the habitable box carved out, open to the front;
 * 5. weathering: two octaves of noise on the surface (depth).
 */
export const SHELL_STEPS = ['boulder', 'lumps', 'swell', 'cave', 'weather'] as const;
export type ShellStep = typeof SHELL_STEPS[number];

export interface ShellParams {
  /** 0 small to 1 large (the wall rule may still grow it). */
  size: number;
  /** How many lumps, 0 to 6. */
  lumps: number;
  /** 0 small lumps to 1 large. */
  lumpSize: number;
  /** 0 smooth to 1 strongly swelling. */
  swell: number;
  /** 0 smooth to 1 deeply weathered. */
  weather: number;
}

export const SHELL_RULES = {
  /** Air kept round the habitable box before the rock begins, metres. */
  margin: 0.16,
  /** The cave runs this far out along +x: open to the front. */
  mouthTo: 2.6,
  /** The boulder's half sizes (x along, y up, z across), metres, and the seed's variation. */
  half: [2.0, 2.8, 2.0] as const, vary: 0.1,
  /**
   * Size knob 0..1: the boulder first grows to the least size the wall rule allows (from a start
   * below it), then is scaled by this range, so the knob always shows.
   */
  size: [1.0, 1.25] as const, start: 0.8,
  lumps: [0, 6] as const, lumpSize: [0.4, 1.1] as const,
  /** Broad swells, outward only (so they never thin a wall): wavelength and most height, metres. */
  swell: [2.2, 0.45] as const,
  /** Surface noise at weather 0.5: wavelengths (m) and depths (m). */
  noise: [[0.9, 0.11], [0.32, 0.035]] as const,
  /** How softly the lumps join the boulder, metres. */
  blend: 0.6,
  /** Least rock round the cave (but at the front), metres, before the surface noise. */
  wall: 0.35,
  grid: 96,
  /** Metres per marching-cubes cell along the boulder's longest side. */
  cell: 0.11,
  /** The field's box (local metres): room round the largest boulder (every knob at its most), so the skin always closes. */
  box: { x: [-6.4, 4.6], y: [-0.4, 6.4], z: [-5.6, 5.8] },
} as const;

/** The den's knobs as its seed sets them (what the island grows). */
export function birthShell(formSeed: number): ShellParams {
  const rand = createRng(formSeed * 53 + 29);
  return { size: rand() * 0.5, lumps: 3 + Math.floor(rand() * 3), lumpSize: 0.3 + rand() * 0.4, swell: 0.4 + rand() * 0.5, weather: 0.35 + rand() * 0.4 };
}

const softMin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/** Seeded 3-D value noise (a permutation from core/rng), about -1..1. */
function makeNoise(seed: number) {
  const rand = createRng(seed * 977 + 13);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const value = Array.from({ length: 256 }, () => rand() * 2 - 1);
  const at = (i: number, j: number, k: number) => value[perm[(perm[(perm[i & 255] + j) & 255] + k) & 255]];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = s(x - i), v = s(y - j), w = s(z - k);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    return l(l(l(at(i, j, k), at(i + 1, j, k), u), l(at(i, j + 1, k), at(i + 1, j + 1, k), u), v),
      l(l(at(i, j, k + 1), at(i + 1, j, k + 1), u), l(at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1), u), v), w);
  };
}

/** A rounded box (half sizes b, corner radius r) centred at c. */
const roundBox = (x: number, y: number, z: number, c: number[], b: number[], r: number) => {
  const qx = Math.abs(x - c[0]) - b[0], qy = Math.abs(y - c[1]) - b[1], qz = Math.abs(z - c[2]) - b[2];
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};
const ellipsoid = (x: number, y: number, z: number, c: number[], r: number[]) =>
  (Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]) - 1) * Math.min(r[0], r[1], r[2]);

/**
 * The den's distance field: negative in rock. Also the cave alone (negative in air). `upTo` stops the
 * growth after that step (the atlas's growth steps); the island uses all five.
 */
export function shellField(formSeed: number, params: ShellParams = birthShell(formSeed), upTo: ShellStep = 'weather') {
  const stage = SHELL_STEPS.indexOf(upTo);
  const rand = createRng(formSeed * 31 + 7);
  const noise = makeNoise(formSeed);
  const R = SHELL_RULES, C = SHELTER_CAVITY;
  const vary = () => 1 + (rand() * 2 - 1) * R.vary;
  const k = R.size[0] + (R.size[1] - R.size[0]) * params.size;
  const half = [R.half[0] * vary() * R.start, R.half[1] * vary() * R.start, R.half[2] * vary() * R.start];
  // The boulder sits over the cave, a little toward its back and thick side; its top leans by the seed.
  const centre = [-0.5 + (rand() - 0.5) * 0.2, 0.1, 0.15 + (rand() - 0.5) * 0.2];
  const lean = (rand() - 0.5) * 0.25;
  // A rule, not luck: the rock round the cave is at least `wall` thick (plus the noise's depth) on
  // its back, sides and top. Sample the middle lines of those faces of a box that much larger than
  // the cave; grow the boulder until all of them are inside.
  {
    const T = R.wall + 0.12, g = R.margin + 0.12 + T;
    const lo = [C.x0 - g, 0.3, C.z0 - g], hi = [C.x1 + g, C.y1 + g, C.z1 + g];
    const inside = (p: number[]) => Math.hypot((p[0] - centre[0]) / half[0], (p[1] - centre[1]) / half[1], (p[2] - centre[2]) / half[2]) <= 1;
    const at = (i: number, j: number, q: number) => [lo[0] + (hi[0] - lo[0]) * i / 4, lo[1] + (hi[1] - lo[1]) * j / 4, lo[2] + (hi[2] - lo[2]) * q / 4];
    const samples: number[][] = [];
    for (let m = 1; m <= 3; m++) {
      samples.push(at(0, 2, m), at(0, m, 2));            // the back
      samples.push(at(m, 2, 0), at(2, m, 0));            // one side
      samples.push(at(m, 2, 4), at(2, m, 4));            // the other
      samples.push(at(m, 4, 2), at(2, 4, m));            // the top
    }
    const need = samples.filter((p) => p[1] > 0.3);
    for (let n = 0; n < 40 && !need.every(inside); n++) for (let c = 0; c < 3; c++) half[c] *= 1.03;
    for (let c = 0; c < 3; c++) half[c] *= k;
  }
  // Six lumps are always drawn from the seed (so changing the count does not move the others).
  const allLumps = Array.from({ length: R.lumps[1] }, () => {
    // Round the back and sides only (never across the front): an angle from the back, a height.
    // θ from straight back (0) round to the sides (±π/2) and a little past: never the front, where
    // the cave would cut a lump loose (a stray rock in the mouth).
    const th = (rand() * 2 - 1) * 0.58 * Math.PI, h = 0.35 + rand() * 0.45, f = 0.8 + rand() * 0.4, sy = 0.7 + rand() * 0.3, sz = 0.8 + rand() * 0.3;
    const size = (R.lumpSize[0] + (R.lumpSize[1] - R.lumpSize[0]) * params.lumpSize) * f;
    return { c: [centre[0] - Math.cos(th) * half[0] * 0.66, half[1] * h * 0.8, centre[2] + Math.sin(th) * half[2] * 0.66], r: [size, size * sy, size * sz] };
  });
  const lumps = allLumps.slice(0, Math.round(params.lumps));
  // The cave: the habitable box grown by the margin (down below the ground), open out the front.
  const caveC = [(C.x0 + R.mouthTo) / 2, (C.y0 + C.y1) / 2 - 0.4, (C.z0 + C.z1) / 2];
  const caveB = [(R.mouthTo - C.x0) / 2, (C.y1 - C.y0) / 2 + 0.4, (C.z1 - C.z0) / 2];
  // Widen only: the noise may push the cave wall outward, never in.
  const cave = (x: number, y: number, z: number) =>
    roundBox(x, y, z, caveC, caveB, R.margin + 0.12) - Math.abs(noise(x / 0.7 + 20, y / 0.7, z / 0.7)) * 0.12;
  const weather = params.weather * 2;
  const rock = (x: number, y: number, z: number) => {
    let d = ellipsoid(x + lean * (y - centre[1]) * 0.3, y, z, centre, half);
    if (stage >= 1) for (const l of lumps) d = softMin(d, ellipsoid(x, y, z, l.c, l.r), R.blend);
    if (stage >= 2) d -= (0.5 + 0.5 * noise(x / R.swell[0] + 7, y / R.swell[0], z / R.swell[0] - 3)) * R.swell[1] * params.swell;
    if (stage >= 4) for (const [wave, depth] of R.noise) d += noise(x / wave, y / wave, z / wave) * depth * weather;
    // A flat base under the ground.
    d = Math.max(d, -(y - R.box.y[0] - 0.3));
    return stage >= 3 ? Math.max(d, -cave(x, y, z)) : d;
  };
  return { rock, cave };
}

/**
 * The den's mesh for a seed: position, normal, and `aOcclusion` (darker inside the cave, toward its
 * back), as the shelter material reads it. Mirrored across z when `mirror`.
 */
export function shellGeometry(mirror: boolean, formSeed: number, params?: ShellParams, upTo: ShellStep = 'weather', grid: number = SHELL_RULES.grid): BufferGeometry {
  const { rock, cave } = shellField(formSeed, params, upTo);
  // A coarse look first for where the rock is, then the fine cells only round that (padded): the
  // same fineness for a small boulder or a large one, and never the field's edge.
  const B = SHELL_RULES.box, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], step = 0.3;
  for (let x = B.x[0]; x <= B.x[1]; x += step) for (let y = B.y[0]; y <= B.y[1]; y += step) for (let z = B.z[0]; z <= B.z[1]; z += step) {
    if (rock(x, y, z) > step) continue;
    lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); lo[2] = Math.min(lo[2], z);
    hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); hi[2] = Math.max(hi[2], z);
  }
  const pad = 0.45;
  for (let c = 0; c < 3; c++) { lo[c] = Math.max(lo[c] - pad, [B.x, B.y, B.z][c][0]); hi[c] = Math.min(hi[c] + pad, [B.x, B.y, B.z][c][1]); }
  const span = [0, 1, 2].map((c) => hi[c] - lo[c]), mid = [0, 1, 2].map((c) => (lo[c] + hi[c]) / 2);
  // About 11 cm cells along the longest side (the island's), at most `grid`.
  const n = Math.min(grid, Math.max(32, Math.ceil(Math.max(...span) / SHELL_RULES.cell)));
  const field = new MarchingCubes(n, new ShaderMaterial(), false, false, 200000);
  field.isolation = 0;
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = mid[0] + (i / (n / 2) - 1) * span[0] / 2, y = mid[1] + (j / (n / 2) - 1) * span[1] / 2, z = mid[2] + (k / (n / 2) - 1) * span[2] / 2;
    // The outermost cells stay air, so the skin closes even if a lump reaches the box.
    const edge = i < 2 || j < 2 || k < 2 || i > n - 3 || j > n - 3 || k > n - 3;
    field.field[i + j * n + k * n * n] = edge ? -1 : -rock(x, y, z);
  }
  // One rock: keep only the largest connected body of solid cells; specks the noise leaves in thin
  // places, or a piece the cave cuts loose, become air.
  {
    const f = field.field, N = n * n * n, label = new Int32Array(N).fill(-1), sizes: number[] = [];
    const stack: number[] = [];
    for (let c0 = 0; c0 < N; c0++) {
      if (f[c0] <= 0 || label[c0] >= 0) continue;
      const id = sizes.length; let size = 0;
      label[c0] = id; stack.push(c0);
      while (stack.length) {
        const c = stack.pop()!; size++;
        const i = c % n, j = Math.floor(c / n) % n, k = Math.floor(c / (n * n));
        if (i > 0 && f[c - 1] > 0 && label[c - 1] < 0) { label[c - 1] = id; stack.push(c - 1); }
        if (i < n - 1 && f[c + 1] > 0 && label[c + 1] < 0) { label[c + 1] = id; stack.push(c + 1); }
        if (j > 0 && f[c - n] > 0 && label[c - n] < 0) { label[c - n] = id; stack.push(c - n); }
        if (j < n - 1 && f[c + n] > 0 && label[c + n] < 0) { label[c + n] = id; stack.push(c + n); }
        if (k > 0 && f[c - n * n] > 0 && label[c - n * n] < 0) { label[c - n * n] = id; stack.push(c - n * n); }
        if (k < n - 1 && f[c + n * n] > 0 && label[c + n * n] < 0) { label[c + n * n] = id; stack.push(c + n * n); }
      }
      sizes.push(size);
    }
    const main = sizes.indexOf(Math.max(...sizes));
    for (let c = 0; c < N; c++) if (label[c] >= 0 && label[c] !== main) f[c] = -Math.abs(f[c]) - 0.01;
  }
  field.update();
  const count = field.geometry.drawRange.count;
  const pos = (field.geometry.getAttribute('position').array as Float32Array).slice(0, count * 3);
  const nrm = (field.geometry.getAttribute('normal').array as Float32Array).slice(0, count * 3);
  field.geometry.dispose(); (field.material as ShaderMaterial).dispose();
  const occ = new Float32Array(count);
  for (let v = 0; v < count; v++) {
    const x = mid[0] + pos[v * 3] * span[0] / 2, y = mid[1] + pos[v * 3 + 1] * span[1] / 2, z = mid[2] + pos[v * 3 + 2] * span[2] / 2;
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    // Inside the cave (its wall), darker toward the back.
    const inCave = Math.max(0, 1 - Math.abs(cave(x, y, z)) / 0.35);
    occ[v] = 1 - inCave * (0.35 + 0.3 * Math.min(1, Math.max(0, (0.5 - x) / 2)));
  }
  // MarchingCubes' normals are in its unit box; rescale them to metres.
  for (let v = 0; v < count; v++) {
    const a = nrm[v * 3] / span[0], b = nrm[v * 3 + 1] / span[1], c = nrm[v * 3 + 2] / span[2], l = Math.hypot(a, b, c) || 1;
    nrm[v * 3] = a / l; nrm[v * 3 + 1] = b / l; nrm[v * 3 + 2] = c / l;
  }
  // Faces must turn outward (the shelter material draws front faces only): compare each triangle's
  // winding with the field's normal; if most disagree, turn them all.
  let agree = 0;
  for (let t = 0; t < count; t += 3) {
    const e1 = [0, 1, 2].map((c) => pos[(t + 1) * 3 + c] - pos[t * 3 + c]), e2 = [0, 1, 2].map((c) => pos[(t + 2) * 3 + c] - pos[t * 3 + c]);
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    agree += Math.sign(g[0] * nrm[t * 3] + g[1] * nrm[t * 3 + 1] + g[2] * nrm[t * 3 + 2]);
  }
  const swap = (t: number) => {
    for (const arr of [pos, nrm]) for (let c = 0; c < 3; c++) { const a = arr[(t + 1) * 3 + c]; arr[(t + 1) * 3 + c] = arr[(t + 2) * 3 + c]; arr[(t + 2) * 3 + c] = a; }
    const o = occ[t + 1]; occ[t + 1] = occ[t + 2]; occ[t + 2] = o;
  };
  if (agree < 0) for (let t = 0; t < count; t += 3) swap(t);
  if (mirror) {
    for (let v = 0; v < count; v++) { pos[v * 3 + 2] = -pos[v * 3 + 2]; nrm[v * 3 + 2] = -nrm[v * 3 + 2]; }
    for (let t = 0; t < count; t += 3) swap(t);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('aOcclusion', new Float32BufferAttribute(occ, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/**
 * Circles round the boulder's foot (local x, z, r), for the creature's ways: walked round its outline at
 * knee height, one every 20°, each set in from the edge. None on the mouth's side, where the way in is.
 */
export function shellFootCircles(formSeed: number, params?: ShellParams): { lx: number; lz: number; r: number }[] {
  const { rock } = shellField(formSeed, params);
  const out: { lx: number; lz: number; r: number }[] = [];
  const cx = -0.5, cz = 0.15, r = 0.45, y = 0.6;
  for (let a = 0; a < 360; a += 20) {
    const dx = Math.cos(a * Math.PI / 180), dz = Math.sin(a * Math.PI / 180);
    let edge = -1;
    for (let t = 0.2; t < 4.5; t += 0.05) if (rock(cx + dx * t, y, cz + dz * t) < 0) edge = t;
    if (edge < 0) continue;
    const lx = cx + dx * (edge - r * 0.9), lz = cz + dz * (edge - r * 0.9);
    // Only the opening itself is left free: the front corners beside it keep their circles.
    if (lx > SHELTER_CAVITY.x1 - 0.2 && lz > SHELTER_CAVITY.z0 - 0.1 && lz < SHELTER_CAVITY.z1 + 0.1) continue;
    out.push({ lx, lz, r });
  }
  return out;
}

/** The boulder's bounding size from its field (metres), without building the mesh. */
function shellExtent(rock: (x: number, y: number, z: number) => number) {
  const B = SHELL_RULES.box, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let x = B.x[0]; x <= B.x[1]; x += 0.15) for (let y = 0; y <= B.y[1]; y += 0.15) for (let z = B.z[0]; z <= B.z[1]; z += 0.15) {
    if (rock(x, y, z) >= 0) continue;
    const p = [x, y, z];
    for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[c]); hi[c] = Math.max(hi[c], p[c]); }
  }
  return { along: hi[0] - lo[0], across: hi[2] - lo[2], height: hi[1] - lo[1] };
}

/** Checks: no rock in the habitable box or the walk out of the mouth; the roof covers the bed; size. */
export function shellAudit(formSeed: number, withMesh = true, params?: ShellParams) {
  const { rock } = shellField(formSeed, params);
  const C = SHELTER_CAVITY;
  let fault: string | null = null;
  for (let x = C.x0; x <= C.x1 && !fault; x += 0.1) for (let y = C.y0; y <= C.y1 && !fault; y += 0.1) for (let z = C.z0; z <= C.z1 && !fault; z += 0.1) {
    if (rock(x, y, z) < 0) fault = `rock in the habitable air at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
  }
  // The way in: the body's width (±0.5 m) and the headroom over the ground (BURY 0.22 + 2.05).
  for (let x = C.x1; x <= SHELL_RULES.mouthTo && !fault; x += 0.1) for (let y = C.y0; y <= 2.27 && !fault; y += 0.1) for (let z = -0.5; z <= 0.5 && !fault; z += 0.1) {
    if (rock(x, y, z) < 0) fault = `rock in the mouth at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
  }
  // A roof over the bed: rock somewhere above the lie.
  let roof = false;
  for (let y = C.y1; y < 4 && !roof; y += 0.05) if (rock(0, y, 0) < 0) roof = true;
  if (!fault && !roof) fault = 'no roof over the bed';
  if (!withMesh) return { fault, triangles: 0, exterior: shellExtent(rock) };
  const g = shellGeometry(false, formSeed, params), b = g.boundingBox!;
  const out = { fault, triangles: g.getAttribute('position').count / 3, exterior: { along: b.max.x - b.min.x, across: b.max.z - b.min.z, height: b.max.y - b.min.y } };
  g.dispose();
  return out;
}
