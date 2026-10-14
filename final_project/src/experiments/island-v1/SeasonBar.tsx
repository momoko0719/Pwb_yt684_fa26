import { useEffect, useState } from 'react';
import { TERM_COUNT, termOfDate } from '../../core/season';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';

const YEAR_SECONDS = 120; // one turn of the year when it plays on its own
const TICK_MS = 50;

/**
 * The year of solar terms under the island: drag through the 24 terms, or let the year turn on its
 * own (for the exhibition). "Today" jumps back to the current term.
 */
export default function SeasonBar({ term, onChange }: { term: number; onChange: (t: number | ((t: number) => number)) => void }) {
  const { t } = useLanguage();
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const step = (TERM_COUNT / YEAR_SECONDS) * (TICK_MS / 1000);
    const id = setInterval(() => onChange((v) => (v + step) % TERM_COUNT), TICK_MS);
    return () => clearInterval(id);
  }, [playing, onChange]);

  const index = Math.floor(term) % TERM_COUNT;
  return (
    <div className="season-bar">
      <button type="button" className="season-play" onClick={() => setPlaying(!playing)} title={t(playing ? 'season.pause' : 'season.play')}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="season-name">
        <span className="dim">{t('season.title')}</span>
        <b>{t(`term.${index}` as StringKey)}</b>
      </div>
      <input
        type="range"
        min={0}
        max={TERM_COUNT}
        step={0.01}
        value={term}
        onChange={(e) => onChange(Number(e.target.value) % TERM_COUNT)}
        aria-label={t('season.title')}
      />
      <button type="button" className="season-today" onClick={() => onChange(termOfDate(new Date()))}>{t('season.today')}</button>
    </div>
  );
}
