import { lazy, Suspense, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Leva } from 'leva';
import { UI } from '../core/palette';
import { useLanguage } from '../i18n/LanguageContext';
import { experiments, externalEntries } from '../experiments/registry';

const LEVA_THEME = {
  colors: {
    elevation1: UI.bg,
    elevation2: UI.bg,
    elevation3: UI.line,
    accent1: UI.accent,
    accent2: UI.accent,
    accent3: UI.accent,
    highlight1: UI.textDim,
    highlight2: UI.textDim,
    highlight3: UI.text,
    vivid1: UI.accent,
  },
};

export default function ExperimentPage() {
  const { id } = useParams();
  const { language, t } = useLanguage();
  const entry = experiments.find((e) => e.meta.id === id);
  const Scene = useMemo(() => (entry ? lazy(entry.load) : null), [entry]);

  const technique = externalEntries.findIndex((e) => e.id === id);
  if (technique >= 0) return <TechniqueFrame index={technique} />;

  if (!entry || !Scene) {
    return (
      <section className="page">
        <p className="dim">{t('experiment.notFound')}</p>
        <Link to="/atlas">{t('experiment.back')}</Link>
      </section>
    );
  }

  return (
    <section className="experiment">
      <div className="experiment-caption">
        <Link to="/atlas">← {t('experiment.back')}</Link>
        <span>{entry.meta.title[language]}</span>
      </div>
      <div className="leva-dock">
        <Leva fill flat theme={LEVA_THEME} />
      </div>
      <Suspense fallback={<p className="page dim">{t('experiment.loading')}</p>}>
        <Scene />
      </Suspense>
    </section>
  );
}

/**
 * A class exercise (built into public/atlas/ by scripts/build-atlas.mjs) shown inside the site:
 * the site menu stays on top, a thin bar steps back to the atlas or to the next technique.
 */
function TechniqueFrame({ index }: { index: number }) {
  const { language, t } = useLanguage();
  const meta = externalEntries[index];
  const prev = externalEntries[index - 1];
  const next = externalEntries[index + 1];
  // The exercise opens in the site's language: ?lang= goes before any #hash in its address.
  const [path, hash] = meta.url.split('#');
  const src = `${import.meta.env.BASE_URL}${path}?lang=${language}${hash ? `#${hash}` : ''}`;
  return (
    <section className="technique-frame">
      <div className="technique-bar">
        <Link to="/atlas">← {t('experiment.back')}</Link>
        <span className="technique-title">{meta.course} · {meta.title[language]}</span>
        <span className="technique-steps">
          {prev && <Link to={`/atlas/${prev.id}`}>‹ {prev.title[language]}</Link>}
          {next && <Link to={`/atlas/${next.id}`}>{next.title[language]} ›</Link>}
          <a href={src} target="_blank" rel="noreferrer">{t('atlas.newTab')} ↗</a>
        </span>
      </div>
      <iframe key={src} src={src} title={meta.title[language]} />
    </section>
  );
}
