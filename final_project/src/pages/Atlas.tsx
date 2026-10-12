import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { experiments, externalEntries, type ExperimentMeta } from '../experiments/registry';

const BASE = import.meta.env.BASE_URL;
const CLAY_STUDIO = 'https://pwb-class04-clay.web.app';

/** The atlas as a research notebook: one world study on top, then every class technique in course order. */
export default function Atlas() {
  const { t } = useLanguage();
  const studies = experiments.filter((e) => e.meta.kind === 'world-study');
  return (
    <section className="atlas">
      <div className="atlas-inner">
        <h1>{t('atlas.title')}</h1>
        <p className="atlas-intro">{t('atlas.intro')}</p>

        <h2>{t('atlas.worldStudies')}</h2>
        {studies.map(({ meta }) => (
          <AtlasCard key={meta.id} meta={meta} wide />
        ))}

        <h2>{t('atlas.techniques')}</h2>
        <div className="atlas-grid">
          {externalEntries.map((e) => (
            <AtlasCard key={e.id} meta={e} />
          ))}
        </div>

        <p className="atlas-footer">
          {t('atlas.footer')} <a href={CLAY_STUDIO} target="_blank" rel="noreferrer">Clay Studio ↗</a>
        </p>
      </div>
    </section>
  );
}

/** Every card opens inside the site (the world study as its scene, a technique in a frame). */
function AtlasCard({ meta, wide }: { meta: ExperimentMeta; wide?: boolean }) {
  const { language, t } = useLanguage();
  const to = `/atlas/${meta.id}`;
  return (
    <article className={`atlas-card${wide ? ' wide' : ''}`}>
      {meta.image && (
        <Link to={to} className="atlas-img">
          <img src={BASE + meta.image} alt={meta.title[language]} loading="lazy" />
        </Link>
      )}
      <div className="atlas-text">
        <p className="atlas-meta">{meta.course} · {meta.techniques.slice(0, 4).join(' · ')}</p>
        <h3>{meta.title[language]}</h3>
        {meta.learned && <p><b>{t('atlas.learned')}</b> {meta.learned[language]}</p>}
        {meta.guixu && <p><b>{t('atlas.forGuixu')}</b> {meta.guixu[language]}</p>}
        <Link className="atlas-open" to={to}>{t('atlas.open')} →</Link>
      </div>
    </article>
  );
}
