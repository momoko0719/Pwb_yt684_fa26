import type { ReactNode } from 'react';
import { LAYER, WEAR_DEBUG, ZONE_DEBUG } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { ZONE_NAMES } from './zones';

/**
 * Layers (docs/plan-2026-11-19-layers-and-rebuild.md): ways of looking at the island that show the
 * rules at work. They never change the world (that is Settings' job): each one only reveals what
 * the island already computes, from the same data its rules use, with a legend saying how to read it.
 */
export type Surface = 'normal' | 'height' | 'slope' | 'folds' | 'zones' | 'density';
export interface Layers {
  /** What the ground itself shows (one at a time: each recolours it). */
  surface: Surface;
  flow: boolean;
  waterGraph: boolean;
  sites: boolean;
  traces: boolean;
  /** Footprints so far: the contact map (walked, drunk, rested), the stone turning to jade. */
  prints: boolean;
  /** Its four feet while it walks: planted, or swinging. */
  feet: boolean;
  goals: boolean;
  relations: boolean;
  school: boolean;
  scale: boolean;
}
export const NO_LAYERS: Layers = { surface: 'normal', flow: false, waterGraph: false, sites: false, traces: false, prints: false, feet: false, goals: false, relations: false, school: false, scale: false };
type Overlay = Exclude<keyof Layers, 'surface'>;

const SURFACES: Surface[] = ['normal', 'height', 'slope', 'folds', 'zones', 'density'];
const GROUPS: { id: string; items: Overlay[] }[] = [
  { id: 'water', items: ['flow', 'waterGraph'] },
  { id: 'life', items: ['sites', 'traces', 'prints', 'feet', 'goals', 'relations', 'school'] },
  { id: 'scale', items: ['scale'] },
];

const ICON: Record<string, ReactNode> = {
  layers: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
};

export function LayersButton({ open, count, onOpen }: { open: boolean; count: number; onOpen: (open: boolean) => void }) {
  const { t } = useLanguage();
  return <button type="button" className="layers-toggle" aria-expanded={open} aria-label={t('layers.title')} title={t('layers.title')} onClick={() => onOpen(!open)}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON.layers}</svg>
    {count > 0 && <span className="layers-count">{count}</span>}
  </button>;
}

export function LayersPanel({ layers, onChange, onClose, onClear }: { layers: Layers; onChange: (next: Layers) => void; onClose: () => void; onClear: () => void }) {
  const { t } = useLanguage();
  const set = <K extends keyof Layers>(k: K, v: Layers[K]) => onChange({ ...layers, [k]: v });
  return <aside className="layers-panel" aria-label={t('layers.title')}>
    <header>
      <div><small>{t('layers.eyebrow')}</small><h2>{t('layers.title')}</h2></div>
      <button type="button" className="exhibit-close" aria-label={t('exhibit.close')} onClick={onClose}>×</button>
    </header>
    <p className="layers-lead">{t('layers.lead')}</p>
    <section>
      <h3>{t('layers.group.ground')}</h3>
      <div className="layers-surfaces" role="radiogroup" aria-label={t('layers.group.ground')}>
        {SURFACES.map((s) => <button key={s} type="button" role="radio" aria-checked={layers.surface === s} onClick={() => set('surface', s)} title={t(`layers.s.${s}.note` as StringKey)}>
          <i className={`layers-swatch layers-swatch-${s}`} aria-hidden="true" />{t(`layers.s.${s}` as StringKey)}
        </button>)}
      </div>
      {layers.surface !== 'normal' && <p className="layers-note">{t(`layers.s.${layers.surface}.note` as StringKey)}</p>}
    </section>
    {GROUPS.map((g) => <section key={g.id}>
      <h3>{t(`layers.group.${g.id}` as StringKey)}</h3>
      {g.items.map((k) => <label key={k} className="layers-row">
        <input type="checkbox" checked={layers[k]} onChange={(e) => set(k, e.target.checked)} />
        <span><b>{t(`layers.o.${k}` as StringKey)}</b><small>{t(`layers.o.${k}.note` as StringKey)}</small></span>
      </label>)}
    </section>)}
    <footer><button type="button" className="layers-clear" onClick={onClear}>{t('layers.clear')}</button></footer>
  </aside>;
}

/** One legend for everything that is on, bottom left: how to read each colour and line. */
export function LayersLegend({ layers, heights }: { layers: Layers; heights: [number, number] | null }) {
  const { t } = useLanguage();
  const blocks: { id: string; title: string; rows: ReactNode }[] = [];
  const sw = (c: string, label: string, kind: 'box' | 'line' | 'ring' | 'dash' = 'box') => <div className="layers-legend-row" key={label}><i className={`lg-${kind}`} style={{ ['--c' as string]: c }} />{label}</div>;
  const bar = (stops: string[], lo: string, hi: string, mid?: string) => <div className="layers-legend-bar"><i style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} /><span><em>{lo}</em>{mid && <em>{mid}</em>}<em>{hi}</em></span></div>;
  switch (layers.surface) {
    case 'height': blocks.push({ id: 'h', title: t('layers.s.height'), rows: <>{bar([LAYER.heightLow, LAYER.heightMid, LAYER.heightHigh], `${Math.round(heights?.[0] ?? 0)} m`, `${Math.round(heights?.[1] ?? 0)} m`)}{sw(LAYER.contour, t('layers.lg.contour'), 'line')}</> }); break;
    case 'slope': blocks.push({ id: 's', title: t('layers.s.slope'), rows: <>{bar([LAYER.slopeFlat, LAYER.slopeMid, LAYER.slopeSteep], t('layers.lg.flat'), t('layers.lg.tooSteep'), t('layers.lg.limit'))}</> }); break;
    case 'folds': blocks.push({ id: 'f', title: t('layers.s.folds'), rows: <>{bar([LAYER.foldNone, LAYER.foldFull], t('layers.lg.none'), t('layers.lg.strong'))}</> }); break;
    case 'zones': blocks.push({ id: 'z', title: t('layers.s.zones'), rows: <>{ZONE_NAMES.slice(1).map((n, i) => sw(ZONE_DEBUG[i + 1], t(`zones.${n}` as StringKey)))}</> }); break;
    case 'density': blocks.push({ id: 'd', title: t('layers.s.density'), rows: <>{bar([LAYER.densityNone, LAYER.densityFull], t('layers.lg.none'), t('layers.lg.dense'))}{sw(LAYER.trampled, t('layers.lg.trampled'))}</> }); break;
    default: break;
  }
  if (layers.flow) blocks.push({ id: 'fl', title: t('layers.o.flow'), rows: <><div className="layers-legend-row">{t('layers.lg.particles')}</div>{sw(LAYER.fallBand, t('layers.lg.fallBands'))}</> });
  if (layers.waterGraph) blocks.push({ id: 'wg', title: t('layers.o.waterGraph'), rows: <>{sw(LAYER.waterMain, t('layers.lg.pool'), 'ring')}{sw(LAYER.waterMain, t('layers.lg.main'), 'line')}{sw(LAYER.water, t('layers.lg.branch'), 'line')}</> });
  if (layers.sites) blocks.push({ id: 'si', title: t('layers.o.sites'), rows: <>{sw(LAYER.den, t('layers.lg.den'), 'ring')}{sw(LAYER.stand, t('layers.lg.stand'), 'ring')}{sw(LAYER.graze, t('layers.lg.graze'))}</> });
  if (layers.traces) blocks.push({ id: 'tr', title: t('layers.o.traces'), rows: <>{sw(LAYER.route, t('layers.lg.route'), 'line')}</> });
  if (layers.prints) blocks.push({ id: 'pr', title: t('layers.o.prints'), rows: <>{sw(WEAR_DEBUG.walk, t('layers.lg.walk'))}{sw(WEAR_DEBUG.drink, t('layers.lg.drink'))}{sw(WEAR_DEBUG.rest, t('layers.lg.rest'))}<div className="layers-legend-row">{t('layers.lg.printsMore')}</div></> });
  if (layers.feet) blocks.push({ id: 'ft', title: t('layers.o.feet'), rows: <>{sw(LAYER.footPlanted, t('layers.lg.planted'))}{sw(LAYER.footSwing, t('layers.lg.swing'))}</> });
  if (layers.goals) blocks.push({ id: 'go', title: t('layers.o.goals'), rows: <>{sw(LAYER.heading, t('layers.lg.heading'), 'line')}{sw(LAYER.move, t('layers.lg.move'), 'line')}{sw(LAYER.goal, t('layers.lg.goal'))}{sw(LAYER.stand, t('layers.lg.drinkLine'), 'line')}{sw(LAYER.rest, t('layers.lg.bed'), 'ring')}</> });
  if (layers.relations) blocks.push({ id: 're', title: t('layers.o.relations'), rows: <>{sw(LAYER.follow, t('layers.lg.together'), 'dash')}{sw(LAYER.yieldTo, t('layer.yield'))}</> });
  if (layers.school) blocks.push({ id: 'sc', title: t('layers.o.school'), rows: <>{sw(LAYER.fishRepel, t('ideas.fish.repel'), 'dash')}{sw(LAYER.fishAlign, t('ideas.fish.align'), 'dash')}{sw(LAYER.fishAttract, t('ideas.fish.attract'), 'dash')}{sw(LAYER.fishGoal, t('layers.lg.fishGoal'), 'line')}</> });
  if (!blocks.length) return null;
  return <div className="layers-legend" aria-label={t('layers.legend')}>
    {blocks.map((b) => <div key={b.id} className="layers-legend-block"><strong>{b.title}</strong>{b.rows}</div>)}
  </div>;
}
