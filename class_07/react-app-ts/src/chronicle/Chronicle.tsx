import { useMemo, useState } from 'react';
import { useLang, type Key } from '../i18n';
import MiniWorld from './MiniWorld';
import { autoplay, type Palette } from './play';
import { toWorld } from './traits';
import { BIG_PICTURE, BOOKENDS, FIRST_GAME, FIRST_PALETTE, TAGS, TAG_TEXT, type T2, type Tag } from './world';

const COUNT = 6;

export default function Chronicle() {
  const { lang, t } = useLang();
  const tx = (s: T2) => s[lang];
  const [palette, setPalette] = useState<Palette>(FIRST_PALETTE);
  const [batch, setBatch] = useState(1);
  const toggle = (tag: Tag) => setPalette((p) => ({ ...p, [tag]: !p[tag] }));

  // World 1 continues the game we played; the others start from the bookends alone.
  const worlds = useMemo(
    () => Array.from({ length: COUNT }, (_, i) => {
      const h = autoplay(palette, batch * 31 + i, i === 0 ? FIRST_GAME : []);
      return { ...toWorld(h), blocked: h.blocked };
    }),
    [palette, batch],
  );

  return (
    <div className="chronicle">
      <header className="ch-head">
        <h1>{t('ch.title')}</h1>
        <p className="dim">{t('ch.subtitle')}</p>
        <p className="lead">{t('ch.about')}</p>
      </header>

      <section className="rules">
        <div className="bookends">
          <span><b>{t('ch.start')}</b> {t('ch.startShort')}</span>
          <span>→ ? →</span>
          <span><b>{t('ch.end')}</b> {t('ch.endShort')}</span>
        </div>
        <div className="palette-line">
          <b>{t('ch.rules')}</b>
          {TAGS.map((tag) => (
            <button key={tag} className={`chip ${palette[tag] ? 'yes' : 'no'}`} onClick={() => toggle(tag)}>
              {palette[tag] ? '✓' : '✕'} {tx(TAG_TEXT[tag])}
            </button>
          ))}
          <button className="primary" onClick={() => setBatch((b) => b + 1)}>{t('ch.again')}</button>
        </div>
        <p className="dim small">{t('ch.paletteHint')}</p>
      </section>

      <section className="worlds">
        {worlds.map((w, i) => (
          <article className="world" key={`${batch}-${i}`}>
            <div className="view">
              <MiniWorld traces={w.traces} seed={batch * 31 + i} />
            </div>
            <h3>{i === 0 ? t('ch.ours') : `${t('ch.worldN')} ${i + 1}`}</h3>
            <p className="traces">
              {[...w.traces].map((tr) => (
                <span key={tr} className="trace">{t(`trace.${tr}` as Key)}</span>
              ))}
            </p>
            <p className="steps small">
              {w.steps.map((c) => tx(c.title)).join(' → ')}
              {w.blocked && <b className="stuck"> {t('ch.stuck').replace('{x}', t(`beat.${w.blocked}` as Key))}</b>}
            </p>
          </article>
        ))}
      </section>

      <section>
        <details>
          <summary>{t('ch.record')}</summary>
          <p className="big">“{tx(BIG_PICTURE)}”</p>
          <p><b>{t('ch.start')} ☁</b> {tx(BOOKENDS.start.text)}</p>
          <ul>
            {FIRST_GAME.map((c) => (
              <li key={c.id}>
                {t(`kind.${c.kind}` as Key)} {c.tone === 'light' ? '☀' : '☁'} <b>{tx(c.title)}</b>: {tx(c.text)}
              </li>
            ))}
          </ul>
          <p><b>{t('ch.end')} ☀</b> {tx(BOOKENDS.end.text)}</p>
        </details>
      </section>
    </div>
  );
}
