import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * The sim speed as a slider (owner, 2026-11-21: stepping through by clicks overshot the one wanted).
 * A glass track with one stop per speed; drag the knob (it carries the speed) or click a stop; arrow
 * keys step. The track is the island's own change, left to right: white jade, white stone, stone
 * turned to jade; the part up to the knob is lit.
 */

export function SpeedSlider({ speeds, speed, onSpeed }: { speeds: readonly number[]; speed: number; onSpeed: (s: number) => void }) {
  const { t } = useLanguage();
  const track = useRef<HTMLDivElement>(null);
  const at = Math.max(0, speeds.indexOf(speed));
  const last = speeds.length - 1;
  const frac = last > 0 ? at / last : 0;
  const pick = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    const f = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    const i = Math.round(f * last);
    if (speeds[i] !== speed) onSpeed(speeds[i]);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX); };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (e.buttons & 1) pick(e.clientX); };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    // Kept here: the camera's arrow-key panning (listening on the window) must not move too.
    e.preventDefault(); e.stopPropagation();
    onSpeed(speeds[Math.min(Math.max(at + d, 0), last)]);
  };
  return (
    <div ref={track} className={`speed-slider${at > 0 ? ' fast' : ''}`} role="slider" tabIndex={0}
      aria-label={t('leva.dwellSpeed')} aria-valuemin={speeds[0]} aria-valuemax={speeds[last]} aria-valuenow={speed} aria-valuetext={`${speed}×`}
      title={t('leva.dwellSpeed')} onPointerDown={down} onPointerMove={move} onKeyDown={key}
      style={{ '--f': frac } as CSSProperties}>
      <div className="speed-fill" aria-hidden="true" />
      {speeds.map((v, i) => <span key={v} className={`speed-stop${i <= at ? ' on' : ''}`} style={{ left: `calc(12px + (100% - 24px) * ${last > 0 ? i / last : 0})` }} aria-hidden="true" />)}
      <span className="speed-knob" aria-hidden="true">{speed}×</span>
    </div>
  );
}
