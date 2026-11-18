import { useEffect, useRef, useState } from 'react';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { SCHOOL_DEFAULT, SCHOOL_LIMITS, schoolShape, type SchoolParams } from './schoolRules';
import type { StreamFishData } from './streamFish';

const VIEW_M = 12;

/**
 * The school in the atlas (fish entry): the real school, seen from above, live (each fish a short
 * stroke along its heading; the first fish's three zones as rings, its blind cone shaded), and the
 * rule's four knobs. The knobs change the school on the island at once: they are its rule, not a preview.
 */
export function SchoolPanel({ school }: { school: StreamFishData[] }) {
  const { t } = useLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const params = school[0]?.pool.school.params;
  const [, redraw] = useState(0);
  const [shape, setShape] = useState<{ order: number; spread: number } | null>(null);
  useEffect(() => {
    let frame = 0, ticks = 0;
    const draw = () => {
      const c = canvas.current, ctx = c?.getContext('2d');
      if (c && ctx && school.length) {
        const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
        if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const s = schoolShape(school.map((f) => ({ x: f.now.x, z: f.now.z, heading: f.now.heading, length: f.length })));
        const k = Math.min(w, h) / VIEW_M, X = (x: number) => w / 2 + (x - s.centre[0]) * k, Y = (z: number) => h / 2 + (z - s.centre[1]) * k;
        ctx.fillStyle = JADE_UI.mist; ctx.fillRect(0, 0, w, h);
        // The water that is deep enough, sampled coarsely.
        const pool = school[0].pool;
        ctx.fillStyle = PORCELAIN.waterTint;
        for (let px = 0; px < w; px += 6) for (let pz = 0; pz < h; pz += 6) {
          if (pool.deepAt(s.centre[0] + (px - w / 2) / k, s.centre[1] + (pz - h / 2) / k)) ctx.fillRect(px, pz, 6, 6);
        }
        const lead = school[0], p = pool.school.params, L = lead.length;
        // The first fish's zones and blind cone.
        ctx.beginPath(); ctx.moveTo(X(lead.now.x), Y(lead.now.z));
        const back = lead.now.heading + Math.PI, half = (p.blind * Math.PI) / 360;
        ctx.arc(X(lead.now.x), Y(lead.now.z), p.attract * L * k, back - half, back + half); ctx.closePath();
        ctx.fillStyle = JADE_UI.line; ctx.fill();
        for (const [r, colour] of [[p.repel, JADE_UI.seal], [p.align, JADE_UI.jadeDeep], [p.attract, JADE_UI.inkDim]] as const) {
          ctx.beginPath(); ctx.arc(X(lead.now.x), Y(lead.now.z), r * L * k, 0, Math.PI * 2); ctx.strokeStyle = colour; ctx.lineWidth = 1; ctx.stroke();
        }
        for (const f of school) {
          const hx = Math.cos(f.now.heading) * f.length * k * 0.5, hz = Math.sin(f.now.heading) * f.length * k * 0.5;
          ctx.beginPath(); ctx.moveTo(X(f.now.x) - hx, Y(f.now.z) - hz); ctx.lineTo(X(f.now.x) + hx, Y(f.now.z) + hz);
          ctx.strokeStyle = f === lead ? JADE_UI.seal : JADE_UI.ink; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
        }
        if (++ticks % 15 === 0) setShape({ order: s.order, spread: s.spread });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [school]);
  if (!params) return null;
  const set = (key: keyof SchoolParams, v: number) => {
    params[key] = v;
    // The zones stay nested: repel ≤ align ≤ attract.
    if (params.align < params.repel) params.align = params.repel;
    if (params.attract < params.align) params.attract = params.align;
    redraw((n) => n + 1);
  };
  const row = (key: keyof SchoolParams, step: number) => (
    <label key={key}>
      <span>{t(`school.${key}` as StringKey)}</span>
      <span>{key === 'blind' ? `${Math.round(params[key])}°` : `${params[key].toFixed(1)} ${t('school.bodies')}`}</span>
      <input type="range" min={SCHOOL_LIMITS[key][0]} max={SCHOOL_LIMITS[key][1]} step={step} value={params[key]} aria-label={t(`school.${key}` as StringKey)} onChange={(e) => set(key, Number(e.target.value))} />
    </label>
  );
  return <div className="school-panel">
    <strong>{t('school.title').replace('{n}', String(school.length))}</strong>
    <canvas ref={canvas} aria-label={t('school.view')} />
    {shape && <p className="morph-readout">{t('school.readout').replace('{o}', shape.order.toFixed(2)).replace('{s}', shape.spread.toFixed(1))}</p>}
    <div className="morph-controls">
      {row('repel', 0.1)}
      {row('align', 0.1)}
      {row('attract', 0.1)}
      {row('blind', 5)}
    </div>
    <div className="morph-actions">
      <button type="button" className="resource-btn" onClick={() => { Object.assign(params, SCHOOL_DEFAULT); redraw((n) => n + 1); }}>{t('school.reset')}</button>
    </div>
    <span className="morph-note">{t('school.note')}</span>
  </div>;
}
