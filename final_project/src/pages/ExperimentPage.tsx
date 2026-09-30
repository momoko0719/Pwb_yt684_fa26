import { lazy, Suspense, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Leva } from 'leva';
import { UI } from '../core/palette';
import { useLanguage } from '../i18n/LanguageContext';
import { experiments } from '../experiments/registry';

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
