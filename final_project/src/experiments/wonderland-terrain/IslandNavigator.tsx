import { useEffect, useMemo, useRef, useState } from 'react';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { useLanguage } from '../../i18n/LanguageContext';
import { fill } from './LifeCard';
import type { StreamFishData } from './streamFish';
import { schoolShape } from './schoolRules';

/**
 * The island map (docs/life-ui-map-habitat-plan-2026-11-16.md, after Breath of the Wild's and
 * Firewatch's): the island drawn from its own height grid (light from the north-west, low ground a
 * little warmer than the peaks, a contour every 25 m), the water from the water mask, the rim; few
 * marks: the highest peak, the pool, and each life, which is a button on the map. Click the ground
 * to go there, a mark to meet that life.
 */
const SIZE = 280;
const CONTOUR_M = 25;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * The map's frame: a square around the island, turned so that it reads as the overview camera sees
 * it (looking along +x, toward the range): +x is up the map, +z to the right.
 */
interface Frame { cx: number; cz: number; span: number }
/** World to map, 0 to 1 across and down. */
const toUnit = (f: Frame, x: number, z: number) => ({ a: (z - f.cz) / f.span + 0.5, b: 0.5 - (x - f.cx) / f.span });
/** Map (0 to 1 across and down) to world. */
const toWorld = (f: Frame, a: number, b: number) => ({ x: f.cx + (0.5 - b) * f.span, z: f.cz + (a - 0.5) * f.span });

/** A square around the island's rim, with a little margin. */
function frameOf(rim: Float32Array): Frame {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < rim.length; i += 3) {
    minX = Math.min(minX, rim[i]); maxX = Math.max(maxX, rim[i]);
    minZ = Math.min(minZ, rim[i + 1]); maxZ = Math.max(maxZ, rim[i + 1]);
  }
  const span = Math.max(maxX - minX, maxZ - minZ) * 1.08;
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, span };
}

/** The relief, drawn once per island: an ImageData of SIZE × SIZE × scale, and its highest point. */
function drawRelief(grid: HeightGrid, mask: Uint8Array, f: Frame, px: number) {
  const img = new ImageData(px, px), h = new Float32Array(px * px), inside = new Uint8Array(px * px);
  const sea = rgb(JADE_UI.mapSea), low = rgb(JADE_UI.mapLow), high = rgb(JADE_UI.mapHigh), shade = rgb(JADE_UI.mapShade);
  const water = rgb(PORCELAIN.water), deep = rgb(PORCELAIN.waterDeep), ink = rgb(JADE_UI.ink);
  const range = Math.max(1, grid.top - grid.bottom);
  // Light from the map's upper left (up the map is +x, left is -z), raised; the gradient is metres per metre.
  const L = [0.5, 0.72, -0.5], len = Math.hypot(...L);
  let peak = { x: 0, z: 0, y: -Infinity };
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const { x, z } = toWorld(f, (i + 0.5) / px, (j + 0.5) / px), k = j * px + i;
    if (sampleGrid(grid, x, z, 3) > 0) continue;
    inside[k] = 1;
    const y = sampleGrid(grid, x, z), gx = sampleGrid(grid, x, z, 1), gz = sampleGrid(grid, x, z, 2);
    h[k] = y;
    if (y > peak.y) peak = { x, z, y };
    const n = [-gx * 0.7, 1, -gz * 0.7], nl = Math.hypot(...n);
    const lit = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * len));
    const tone = Math.pow((y - grid.bottom) / range, 0.7);
    let c = mix(low, high, tone);
    c = mix(c, shade, Math.min(0.7, Math.max(0, 0.9 - lit) * 1.1));
    const gi = Math.round(x / grid.texel + (grid.size - 1) / 2), gj = Math.round(z / grid.texel + (grid.size - 1) / 2);
    const wet = gi >= 0 && gj >= 0 && gi < grid.size && gj < grid.size ? mask[gj * grid.size + gi] / 255 : 0;
    if (wet > 0.02) c = mix(c, mix(water, deep, Math.min(1, wet * 1.3)), Math.min(1, 0.35 + wet));
    img.data.set([c[0], c[1], c[2], 255], k * 4);
  }
  // Contours: where the 25 m band changes between neighbours; and the sea of cloud outside.
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const k = j * px + i, o = k * 4;
    if (!inside[k]) { img.data.set([sea[0], sea[1], sea[2], 255], o); continue; }
    const band = Math.floor(h[k] / CONTOUR_M);
    const edge = (i + 1 < px && inside[k + 1] && Math.floor(h[k + 1] / CONTOUR_M) !== band) || (j + 1 < px && inside[k + px] && Math.floor(h[k + px] / CONTOUR_M) !== band);
    if (edge) for (let c = 0; c < 3; c++) img.data[o + c] += (ink[c] - img.data[o + c]) * 0.16;
  }
  return { img, peak };
}

export function IslandNavigator({ grid, mask, rim, fish, plunge, creatures, creatureName, onGo, onFish, onCreature }: {
  grid: HeightGrid; mask: Uint8Array; rim: Float32Array; fish: StreamFishData[];
  plunge: { x: number; z: number; radius: number };
  creatures: { x: number; z: number }[];
  creatureName: (i: number) => string;
  onGo: (x: number, z: number) => void; onFish: (fish: StreamFishData) => void; onCreature: (i: number) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useMemo(() => frameOf(rim), [rim]);
  const scale = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
  const relief = useMemo(() => (open ? drawRelief(grid, mask, frame, Math.round(SIZE * scale)) : null), [open, grid, mask, frame, scale]);
  // The lives move: their marks are read again twice a second while the map is open.
  const [, tick] = useState(0);
  useEffect(() => { if (!open) return; const id = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(id); }, [open]);
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext('2d');
    if (!c || !ctx || !relief) return;
    c.width = relief.img.width; c.height = relief.img.height;
    ctx.putImageData(relief.img, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.beginPath();
    for (let i = 0; i < rim.length; i += 3) { const p = toMap(rim[i], rim[i + 1]); if (i === 0) ctx.moveTo(p.left, p.top); else ctx.lineTo(p.left, p.top); }
    ctx.closePath(); ctx.strokeStyle = JADE_UI.jadeDeep; ctx.lineWidth = 1.1; ctx.stroke();
  }, [relief, rim, scale]); // eslint-disable-line react-hooks/exhaustive-deps
  function toMap(x: number, z: number) { const u = toUnit(frame, x, z); return { left: u.a * SIZE, top: u.b * SIZE }; }
  const go = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const w = toWorld(frame, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
    onGo(w.x, w.z);
    setOpen(false);
  };
  const mark = (x: number, z: number, nudge = { left: 0, top: 0 }) => { const p = toMap(x, z); return { left: `${(p.left + nudge.left) / SIZE * 100}%`, top: `${(p.top + nudge.top) / SIZE * 100}%` }; };
  // A label kept clear of the map's edge.
  const label = (x: number, z: number) => { const p = toMap(x, z); return { left: `${Math.min(84, Math.max(16, p.left / SIZE * 100))}%`, top: `${Math.min(94, Math.max(8, p.top / SIZE * 100))}%` }; };
  // The school is one mark, at its centre; a click meets the fish nearest that centre.
  const school = fish.length ? schoolShape(fish.map((f) => ({ x: f.now.x, z: f.now.z, heading: f.now.heading, length: f.length }))) : null;
  const nearest = school ? fish.reduce((b, f) => (Math.hypot(f.now.x - school.centre[0], f.now.z - school.centre[1]) < Math.hypot(b.now.x - school.centre[0], b.now.z - school.centre[1]) ? f : b)) : null;
  const schoolNudge = school && creatures.some((c) => Math.hypot(toMap(c.x, c.z).left - toMap(...school.centre).left, toMap(c.x, c.z).top - toMap(...school.centre).top) < 14) ? { left: 14, top: 0 } : { left: 0, top: 0 };
  return <div className="island-navigator">
    <button type="button" className="island-navigator-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('map.title')} title={t('map.open')}><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/></svg></button>
    {open && <div className="island-navigator-panel">
      <strong>{t('map.title')}</strong>
      <div className="island-map">
        <canvas ref={canvas} onClick={go} aria-label={t('map.title')} />
        {relief && <span className="island-map-label island-map-peak" style={label(relief.peak.x, relief.peak.z)}>▲ {fill(t, 'map.peak', Math.round(relief.peak.y))}</span>}
        <span className="island-map-label" style={label(plunge.x, plunge.z + plunge.radius + 16)}>{t('map.pool')}</span>
        {creatures.map((c, i) => <button key={i} type="button" className="island-map-mark island-map-dweller" style={mark(c.x, c.z, i > 0 && Math.hypot(c.x - creatures[0].x, c.z - creatures[0].z) < 3 ? { left: 12, top: 0 } : undefined)} data-name={creatures.length > 1 ? `${t('map.dweller')} ${creatureName(i)}` : t('map.dweller')} aria-label={creatures.length > 1 ? `${t('map.dweller')} ${creatureName(i)}` : t('map.dweller')} onClick={() => { onCreature(i); setOpen(false); }} />)}
        {school && nearest && <button type="button" className="island-map-mark island-map-fish" style={mark(school.centre[0], school.centre[1], schoolNudge)} data-name={fill(t, 'map.school', fish.length)} aria-label={fill(t, 'map.school', fish.length)} onClick={() => { onFish(nearest); setOpen(false); }} />}
      </div>
    </div>}
  </div>;
}
