import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { JADE_UI } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { pickTone } from './shrubs';
import { SHRUB_TONE_COLOURS } from './plantModels';

const R = 46, W = 16, C = 64; // ring radius, ring width, centre (px, in a 128 box)
const MIN = 0; // a share may go to nothing (no iron-red patches at all)

/** A point on the ring at share `f` (0 at the top, clockwise). */
const at = (f: number, r = R) => [C + r * Math.sin(f * 2 * Math.PI), C - r * Math.cos(f * 2 * Math.PI)] as const;
function arc(f0: number, f1: number) {
  if (f1 - f0 <= 1e-4) return '';
  if (f1 - f0 >= 0.9999) return `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R}`;
  const [x0, y0] = at(f0), [x1, y1] = at(f1);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * The shrub's colour rule, drawn: a ring cut into three shares (grey-olive, ochre, iron red),
 * read clockwise from the top. Each patch on the island rolls once; where its roll falls on the
 * ring is its colour. The two dots are the boundaries: drag them (or use the arrow keys) to change
 * the shares. Beside it, how the island's own patches come out under the shares shown.
 */
export function ShrubMix({ mix, onMix, rolls }: {
  mix: [number, number, number];
  onMix: (olive: number, ochre: number) => void;
  /** The island's patches' rolls (one each), to count them under this mix. */
  rolls?: number[];
}) {
  const { t } = useLanguage();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<0 | 1 | null>(null);
  const b1 = mix[0], b2 = mix[0] + mix[1];
  const set = (which: 0 | 1, f: number) => {
    const v = Math.round(Math.min(Math.max(f, 0), 1) * 100) / 100;
    if (which === 0) onMix(Math.min(Math.max(v, MIN), b2), b2 - Math.min(Math.max(v, MIN), b2));
    else { const e = Math.min(Math.max(v, b1), 1); onMix(b1, e - b1); }
  };
  const share = (e: PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width * 128 - C, y = (e.clientY - box.top) / box.height * 128 - C;
    let f = Math.atan2(x, -y) / (2 * Math.PI);
    if (f < 0) f += 1;
    return f;
  };
  const move = (e: PointerEvent) => {
    if (drag.current === null) return;
    let f = share(e);
    // Past the top: keep to the near end rather than jump round the ring.
    if (drag.current === 0 && f > b2 + (1 - b2) / 2) f = 0;
    if (drag.current === 1 && f < b1 / 2) f = 1;
    set(drag.current, f);
  };
  const key = (which: 0 | 1) => (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.01 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.01 : 0;
    if (!d) return;
    e.preventDefault();
    set(which, (which === 0 ? b1 : b2) + d);
  };
  const counts = [0, 0, 0];
  for (const r of rolls ?? []) counts[pickTone(r, mix)]++;
  const name = (i: number) => t(`plant.mix.${i}` as StringKey);
  const bounds: [number, 0 | 1, string, string][] = [[b1, 0, name(0), name(1)], [b2, 1, name(1), name(2)]];

  return <div className="shrub-mix">
    <strong>{t('plant.mix.title')}</strong>
    <div className="shrub-mix-row">
      <svg ref={svg} viewBox="0 0 128 128" className="shrub-mix-ring"
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
        <circle cx={C} cy={C} r={R} fill="none" stroke={JADE_UI.paper} strokeWidth={W} />
        {[[0, b1], [b1, b2], [b2, 1]].map(([f0, f1], i) => (
          <path key={i} d={arc(f0, f1)} fill="none" stroke={SHRUB_TONE_COLOURS[i as 0 | 1 | 2][0]} strokeWidth={W} />
        ))}
        {/* The fixed start at the top: a short tick. */}
        <line x1={C} y1={C - R - W / 2 - 2} x2={C} y2={C - R + W / 2 + 2} stroke={JADE_UI.ink} strokeWidth={1.2} />
        {bounds.map(([f, which, a, b]) => {
          const [x, y] = at(f);
          return <circle key={which} cx={x} cy={y} r={7.5} className="shrub-mix-handle" fill={JADE_UI.paper} stroke={JADE_UI.ink} strokeWidth={1.4}
            tabIndex={0} role="slider" aria-label={t('plant.mix.handle').replace('{a}', a).replace('{b}', b)}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)}
            onPointerDown={(e) => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = which; }}
            onKeyDown={key(which)} />;
        })}
        {rolls && <>
          <text x={C} y={C - 2} textAnchor="middle" className="shrub-mix-n">{rolls.length}</text>
          <text x={C} y={C + 13} textAnchor="middle" className="shrub-mix-sub">{t('plant.mix.island')}</text>
        </>}
      </svg>
      <ul className="shrub-mix-legend">
        {mix.map((m, i) => <li key={i}>
          <i style={{ background: SHRUB_TONE_COLOURS[i as 0 | 1 | 2][0] }} />
          <span>{name(i)}</span>
          <b>{Math.round(m * 100)}%</b>
          {rolls && <em>{t('plant.mix.patches').replace('{n}', String(counts[i]))}</em>}
        </li>)}
      </ul>
    </div>
    <p className="morph-note">{t('plant.mix.note')}</p>
  </div>;
}
