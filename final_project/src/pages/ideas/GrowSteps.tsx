import { useEffect, useRef } from 'react';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { createNoise2D, fbm } from '../../core/noise';
import { createRng } from '../../core/rng';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';

/**
 * The island's four stages on one small patch of land, each card one stage further than the one
 * before (Ideas page, "How it grows"): a height map, the water that runs down it, the zones that
 * height, slope and water sort out, and what settles in them. A sketch of the island's own order
 * (terrain → hydrology → zones → life), not its code: one seeded valley, worked out once.
 */
const NX = 96, NZ = 68;
const POOL = 0.09;
type Zone = 'water' | 'wet' | 'slope' | 'wood' | 'open';

interface Patch {
  h: Float32Array;
  /** Where each cell drains to on its way to the pool (-1 in the pool). */
  down: Int32Array;
  /** 0 dry, 1 stream, 2 pool. */
  water: Uint8Array;
  zone: Zone[];
  slope: Float32Array;
  /** Pines and grass tufts (x, z in 0–1, size), the den and the pool's middle. */
  pines: [number, number, number][];
  grass: [number, number][];
  den: [number, number];
  pool: [number, number];
}

let cached: Patch | null = null;
function patch(): Patch {
  if (cached) return cached;
  const noise = createNoise2D(684), rand = createRng(11);
  const N = NX * NZ, h = new Float32Array(N);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = i / NX, z = j / NZ;
    // Ridges round the back and left, a bowl to the front right: rain has one place to go.
    const bowl = Math.hypot((x - 0.68) * 1.1, (z - 0.66) * 1.3);
    h[j * NX + i] = 0.22 * fbm(noise, x * 2.4, z * 2.4, { octaves: 4 }) + bowl + 0.25 * (1 - z) * (1 - x);
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let k = 0; k < N; k++) h[k] = (h[k] - lo) / (hi - lo);

  // Every cell drains to the pool: flood outward from the lowest cell, always taking the lowest
  // rim next (priority flood), so each cell's way down is the cell it was reached from.
  let start = 0;
  for (let k = 1; k < N; k++) if (h[k] < h[start]) start = k;
  const down = new Int32Array(N).fill(-2), level = new Float32Array(N);
  const heap: [number, number][] = [[h[start], start]];
  down[start] = -1; level[start] = h[start];
  const push = (e: [number, number]) => { heap.push(e); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], end = heap.pop()!; if (heap.length) { heap[0] = end; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const order: number[] = [];
  while (heap.length) {
    const [lv, k] = pop(); order.push(k);
    const i = k % NX, j = (k - i) / NX;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj, n = b * NX + a;
      if ((di || dj) && a >= 0 && b >= 0 && a < NX && b < NZ && down[n] === -2) { down[n] = k; level[n] = Math.max(h[n], lv + 1e-5); push([level[n], n]); }
    }
  }
  // Flow: every cell sends one unit of rain down; last reached first, each passes on what it gathered.
  const flow = new Float32Array(N).fill(1);
  for (let o = order.length - 1; o > 0; o--) { const k = order[o]; if (down[k] >= 0) flow[down[k]] += flow[k]; }
  const water = new Uint8Array(N);
  let px = 0, pz = 0, pn = 0;
  for (let k = 0; k < N; k++) {
    if (h[k] < POOL) { water[k] = 2; px += k % NX; pz += Math.floor(k / NX); pn++; } else if (flow[k] > 320) water[k] = 1;
  }
  const slope = new Float32Array(N);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const gx = h[j * NX + Math.min(NX - 1, i + 1)] - h[j * NX + Math.max(0, i - 1)];
    const gz = h[Math.min(NZ - 1, j + 1) * NX + i] - h[Math.max(0, j - 1) * NX + i];
    slope[j * NX + i] = Math.hypot(gx, gz) * NX * 0.5;
  }
  const near = (i: number, j: number, r: number) => {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < NX && b < NZ && water[b * NX + a]) return true;
    }
    return false;
  };
  const zone: Zone[] = [];
  for (let k = 0; k < N; k++) {
    const i = k % NX, j = (k - i) / NX;
    zone.push(water[k] ? 'water' : near(i, j, 2) ? 'wet' : slope[k] > 2.1 ? 'slope' : h[k] > 0.2 && h[k] < 0.62 ? 'wood' : 'open');
  }
  const pines: [number, number, number][] = [], grass: [number, number][] = [];
  for (let k = 0; k < N; k++) {
    const i = k % NX, j = (k - i) / NX;
    if (zone[k] === 'wood' && rand() < 0.035) pines.push([(i + rand()) / NX, (j + rand()) / NZ, 0.8 + rand() * 0.4]);
    if (zone[k] === 'wet' && rand() < 0.08) grass.push([(i + rand()) / NX, (j + rand()) / NZ]);
  }
  pines.sort((a, b) => a[1] - b[1]);
  const pool: [number, number] = [px / pn / NX, pz / pn / NZ];
  // The den: woodland edge, a fair walk from the pool.
  let den: [number, number] = [0.3, 0.4], best = Infinity;
  for (let k = 0; k < N; k++) {
    if (zone[k] !== 'wood') continue;
    const x = (k % NX) / NX, z = Math.floor(k / NX) / NZ, d = Math.abs(Math.hypot(x - pool[0], (z - pool[1]) * 0.7) - 0.32) + Math.abs(z - pool[1]) * 0.3;
    if (d < best) { best = d; den = [x, z]; }
  }
  cached = { h, down, water, zone, slope, pines, grass, den, pool };
  return cached;
}

const hex = (c: string) => [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);
const rgb = (c: number[], a = 1) => `rgba(${c.map(Math.round).join(',')},${a})`;
const PAPER = hex(JADE_UI.paper), SHADE = hex(JADE_UI.mapShade), LINE = hex(JADE_UI.jadeDeep);
const WATER = hex(PORCELAIN.water), DEEP = hex(PORCELAIN.waterDeep);
const ZONE_COL: Record<Zone, number[]> = {
  water: WATER, wet: hex(PORCELAIN.jadeDrink), slope: hex(PORCELAIN.rockFace), wood: hex(PORCELAIN.pineNeedle), open: hex(JADE_UI.mapHigh),
};

/** The patch as one small picture (a cell a pixel), drawn smoothed up to the card's size. */
function paint(img: ImageData, P: Patch, o: { sun: number; contours: boolean; water: boolean; tint: number; reveal: number; t: number }) {
  const lx = Math.cos(o.sun), lz = Math.sin(o.sun), d = img.data;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    const gx = P.h[j * NX + Math.min(NX - 1, i + 1)] - P.h[j * NX + Math.max(0, i - 1)];
    const gz = P.h[Math.min(NZ - 1, j + 1) * NX + i] - P.h[Math.max(0, j - 1) * NX + i];
    const lit = Math.max(0, Math.min(1, 0.55 - (gx * lx + gz * lz) * 14));
    let c = mix(mix(SHADE, PAPER, 0.3 + 0.7 * lit), PAPER, P.h[k] * 0.3);
    const on = Math.max(0, Math.min(1, (o.reveal * 1.2 - i / NX) * 6));
    if (o.tint > 0) c = mix(c, mix(ZONE_COL[P.zone[k]], c, 0.2), o.tint * on);
    if (o.contours) {
      const a = Math.floor(P.h[k] * 12);
      if ((i < NX - 1 && a !== Math.floor(P.h[k + 1] * 12)) || (j < NZ - 1 && a !== Math.floor(P.h[k + NX] * 12))) c = mix(c, LINE, 0.55);
    }
    if (o.water && P.water[k]) c = mix(WATER, DEEP, (P.water[k] === 2 ? 0.5 + (POOL - P.h[k]) * 3 : 0.3) + 0.05 * Math.sin(o.t * 2 + i * 0.4 + j * 0.3));
    d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = 255;
  }
}

function pine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = rgb(hex(PORCELAIN.contactShadow), 0.25);
  ctx.beginPath(); ctx.ellipse(x + s * 0.35, y, s * 0.5, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PORCELAIN.pineNeedleShade;
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s * 0.55, y); ctx.lineTo(x - s * 0.55, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PORCELAIN.pineNeedle;
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s * 0.08, y); ctx.lineTo(x - s * 0.55, y); ctx.closePath(); ctx.fill();
}

type Stage = 0 | 1 | 2 | 3;

/** One stage, live: the sun turns over the relief, rain runs, zones sweep in, things settle and move. */
function StageCanvas({ stage }: { stage: Stage }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const P = patch(), rand = createRng(29 + stage);
    const small = document.createElement('canvas'); small.width = NX; small.height = NZ;
    const sctx = small.getContext('2d')!, img = sctx.createImageData(NX, NZ);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fresh = () => { let k = 0; do k = Math.floor(rand() * NX * NZ); while (P.water[k]); return k; };
    // Rain drops (stage 2): each runs down cell by cell, the way the flood found, into the pool.
    const drops = Array.from({ length: 90 }, () => ({ k: fresh(), f: rand(), age: rand() * 2 }));
    let frame = 0, t = 0, last = performance.now();
    const draw = (now: number) => {
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (!w || !h) { frame = requestAnimationFrame(draw); return; }
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const sweep = stage === 2 ? Math.min(1, (t % 8) / 3.5) : 1;
      paint(img, P, { sun: -2.3 + (stage === 0 ? Math.sin(t * 0.4) * 1.1 : 0), contours: stage === 0, water: stage >= 1, tint: stage === 2 ? 0.9 : stage === 3 ? 0.5 : 0, reveal: sweep, t });
      sctx.putImageData(img, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(small, 0, 0, w, h);
      const cw = w / NX, ch = h / NZ;
      if (stage === 1) {
        for (const d of drops) {
          d.f += dt * 9; d.age += dt;
          while (d.f >= 1) { d.f -= 1; const n = P.down[d.k]; if (n < 0 || P.water[n] === 2) { d.k = fresh(); d.age = 0; } else d.k = n; }
          const n = P.down[d.k] >= 0 ? P.down[d.k] : d.k;
          const x0 = (d.k % NX + 0.5) * cw, z0 = (Math.floor(d.k / NX) + 0.5) * ch;
          const x1 = (n % NX + 0.5) * cw, z1 = (Math.floor(n / NX) + 0.5) * ch;
          ctx.fillStyle = rgb(DEEP, Math.min(1, d.age * 1.5) * 0.85);
          ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * d.f, z0 + (z1 - z0) * d.f, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (stage === 2 && sweep < 1) {
        ctx.fillStyle = rgb(LINE, 0.6);
        ctx.fillRect((sweep * 1.2 - 1 / 12) * w, 0, 1.2, h);
      }
      if (stage === 3) {
        const grow = reduced ? 1 : Math.min(1, t / 2.5), u = w / 100;
        ctx.strokeStyle = PORCELAIN.cover; ctx.lineWidth = 0.8; ctx.beginPath();
        for (const [gx, gz] of P.grass) { const x = gx * w, y = gz * h; ctx.moveTo(x, y); ctx.lineTo(x - u * 0.5, y - u * 1.4); ctx.moveTo(x, y); ctx.lineTo(x + u * 0.6, y - u * 1.2); }
        ctx.stroke();
        const shown = Math.floor(P.pines.length * grow);
        for (let n = 0; n < shown; n++) { const [px, pz, s] = P.pines[n]; pine(ctx, px * w, pz * h, s * u * 2.4); }
        // The den, and its creature walking out to the pool to drink and back.
        const [dx, dz] = P.den, [wx, wz] = P.pool;
        ctx.fillStyle = PORCELAIN.shelterWarm; ctx.strokeStyle = PORCELAIN.crease; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(dx * w, dz * h, u * 4.2, u * 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = rgb(hex(PORCELAIN.crease), 0.75);
        ctx.beginPath(); ctx.ellipse(dx * w, dz * h + u * 1.2, u * 1.8, u * 1.3, 0, Math.PI, 0, true); ctx.fill();
        const s = 0.5 - 0.5 * Math.cos(t * 0.5);
        const ex = dx + (wx - 0.08 - dx) * s, ez = dz + 0.06 + (wz - 0.02 - dz - 0.06) * s;
        ctx.fillStyle = JADE_UI.paper; ctx.strokeStyle = JADE_UI.ink; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(ex * w, ez * h, u * 1.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let f = 0; f < 5; f++) {
          const a = t * 0.7 + f * 1.25, fx = (wx + Math.cos(a) * 0.07) * w, fz = (wz + Math.sin(a) * 0.08) * h;
          ctx.fillStyle = PORCELAIN.fishBody;
          ctx.beginPath(); ctx.ellipse(fx, fz, u * 1.1, u * 0.45, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [stage]);
  return <canvas ref={canvas} className="ideas-grow-canvas" aria-hidden="true" />;
}

const KEYS = ['height', 'water', 'zones', 'life'] as const;

/** The four cards, numbered, each with its own live picture and one line saying what happens. */
export function GrowSteps() {
  const { t } = useLanguage();
  return <ol className="ideas-grow">
    {KEYS.map((k, i) => <li key={k}>
      <StageCanvas stage={i as Stage} />
      <b><span>{i + 1}</span>{t(`ideas.step.${k}` as StringKey)}</b>
      <small>{t(`ideas.step.${k}.note` as StringKey)}</small>
      {k === 'zones' && <span className="ideas-zone-key">{(['wet', 'slope', 'wood'] as const).map((z) => <span key={z}><i style={{ background: rgb(ZONE_COL[z]) }} />{t(`ideas.zone.${z}` as StringKey)}</span>)}</span>}
    </li>)}
  </ol>;
}
