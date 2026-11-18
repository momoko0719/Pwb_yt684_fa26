import { useRef, type ReactNode } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';

/**
 * One card for every life on the island (docs/life-ui-map-habitat-plan-2026-11-16.md), after The
 * Sims' needs panel: a portrait; what it is doing now and what it is going for; each need as a bar
 * with its value, a mark where the creature acts on it (its threshold, from the sim's own rules), a
 * colour by how far above that mark it stands, and an arrow for which way it is moving; one mood word
 * from the lowest need. The creature and the fish use the same card, each with its own needs.
 */
export interface LifeNeed {
  key: string;
  label: string;
  icon: 'food' | 'water' | 'rest' | 'stamina';
  /** 0 to 1. */
  value: number;
  /** Below this the creature acts on it (seeks food, water, rest; a fish holds against the current). */
  act: number;
  /** What it does below `act`, for the mark's tooltip. */
  actNote: string;
  /** Optional second mark: above this a fish sets out to explore. */
  high?: { at: number; note: string };
}

export const NEED_ICON: Record<LifeNeed['icon'], string> = {
  food: 'M4 18c1-8 7-12 15-13-1 8-5 14-13 14m-1-2c3-3 6-5 10-7',
  water: 'M12 3C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-12Z',
  rest: 'M17 4a8 8 0 1 0 3 14A8 8 0 0 1 17 4Z',
  stamina: 'M13 2 5 14h6l-1 8 8-12h-6z',
};

/** Its colour step: comfortably above the mark, near it, below it, far below (half of it). */
export function needTone(value: number, act: number): 'good' | 'ok' | 'low' | 'critical' {
  if (value >= act + 0.15) return 'good';
  if (value >= act) return 'ok';
  if (value >= act * 0.5) return 'low';
  return 'critical';
}

function NeedBar({ need }: { need: LifeNeed }) {
  const { t } = useLanguage();
  // Which way it moves: the change since the last reading, in steps of one to three arrows.
  const last = useRef<{ value: number; at: number } | null>(null);
  const trend = useRef(0);
  const now = performance.now();
  if (last.current && now - last.current.at > 250) {
    const rate = (need.value - last.current.value) / ((now - last.current.at) / 1000);
    const size = Math.abs(rate);
    trend.current = size < 0.002 ? 0 : Math.sign(rate) * (size < 0.01 ? 1 : size < 0.04 ? 2 : 3);
    last.current = { value: need.value, at: now };
  } else if (!last.current) last.current = { value: need.value, at: now };
  const tone = needTone(need.value, need.act);
  const arrows = trend.current === 0 ? '' : (trend.current > 0 ? '▲' : '▼').repeat(Math.abs(trend.current));
  return (
    <div className={`life-need life-need-${tone}`}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={NEED_ICON[need.icon]} /></svg>
      <span className="life-need-label">{need.label}</span>
      <span className="life-need-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(need.value * 100)} aria-label={need.label}>
        <span className="life-need-fill" style={{ width: `${Math.round(need.value * 100)}%` }} />
        <span className="life-need-mark" style={{ left: `${need.act * 100}%` }} title={`${Math.round(need.act * 100)} · ${need.actNote}`} />
        {need.high && <span className="life-need-mark life-need-mark-high" style={{ left: `${need.high.at * 100}%` }} title={`${Math.round(need.high.at * 100)} · ${need.high.note}`} />}
      </span>
      <span className="life-need-value">{Math.round(need.value * 100)}</span>
      <span className="life-need-trend" aria-label={trend.current > 0 ? t('life.rising') : trend.current < 0 ? t('life.falling') : t('life.steady')}>{arrows}</span>
    </div>
  );
}

export function LifeCard({ portrait, kicker, kickerNote, action, intent, mood, needs, traits, onForm, onClose, onNext, inline = false }: {
  portrait?: ReactNode;
  kicker: string;
  action: string;
  intent: string;
  /** The mood word and its tone (the lowest need's). */
  mood: { word: string; tone: ReturnType<typeof needTone> };
  needs: LifeNeed[];
  /** What its name means (shown on hover). */
  kickerNote?: string;
  /** Its seeded character, a word each, the scale on hover. */
  traits?: { word: string; note: string }[];
  /** To the next creature (the card follows, and the camera with it). */
  onNext?: () => void;
  onForm?: () => void;
  onClose?: () => void;
  /** Inside the atlas: in the flow of the page, no portrait button or close. */
  inline?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <section className={`life-card ${inline ? 'life-card-inline' : 'creature-status-dock'}`} aria-label={kicker}>
      {portrait && <button type="button" className={`creature-status-portrait life-portrait-${mood.tone}`} onClick={onForm} title={t('life.form')}>{portrait}</button>}
      <div className="creature-status-action">
        <small title={kickerNote}>{kicker}</small>
        <strong>{action}</strong>
        {intent && <span>{intent}</span>}
        <span className="life-tags"><span className={`life-mood life-mood-${mood.tone}`}>{mood.word}</span>{traits?.map((tr) => <span key={tr.word} className="life-trait" title={tr.note}>{tr.word}</span>)}</span>
        {onForm && <button type="button" onClick={onForm}>{t('life.form')} ↗</button>}
      </div>
      <div className="creature-status-meters">{needs.map((need) => <NeedBar key={need.key} need={need} />)}</div>
      {(onClose || onNext) && <div className="creature-status-side">
        {onClose && <button type="button" className="creature-status-close" onClick={onClose} aria-label={t('life.close')}>×</button>}
        {onNext && <button type="button" className="creature-status-next" onClick={onNext} aria-label={t('life.next')} title={t('life.next')}>›</button>}
      </div>}
    </section>
  );
}

/** A label from the strings by key, with `{n}` filled in. */
export const fill = (t: (k: StringKey) => string, key: StringKey, n: number) => t(key).replace('{n}', String(n));
