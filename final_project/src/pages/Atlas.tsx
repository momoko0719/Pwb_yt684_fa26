import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { experiments, externalEntries, type EntryKind, type ExperimentMeta } from '../experiments/registry';

interface Card {
  meta: ExperimentMeta;
  url?: string;
}

const GROUPS: { kind: EntryKind; label: StringKey }[] = [
  { kind: 'class-exercise', label: 'atlas.techniques' },
  { kind: 'world-study', label: 'atlas.worldStudies' },
];

const CARDS: Card[] = [
  ...experiments.map((e) => ({ meta: e.meta })),
  ...externalEntries.map((e) => ({ meta: e, url: e.url })),
];

export default function Atlas() {
  const { t } = useLanguage();
  return (
    <section className="page">
      <h1>{t('atlas.title')}</h1>
      {GROUPS.map(({ kind, label }) => {
        const cards = CARDS.filter((c) => c.meta.kind === kind);
        return (
          <section key={kind}>
            <h2>{t(label)}</h2>
            {cards.length === 0 && <p className="dim">{t('atlas.empty')}</p>}
            <div className="cards">
              {cards.map((c) => <AtlasCard key={c.meta.id} card={c} />)}
            </div>
          </section>
        );
      })}
    </section>
  );
}

function AtlasCard({ card }: { card: Card }) {
  const { language, t } = useLanguage();
  const { meta, url } = card;
  const body = (
    <>
      <h3>{meta.title[language]}</h3>
      <p>{meta.summary[language]}</p>
      <p className="dim">
        {t('atlas.session')} {meta.session} · {meta.date}
        {url && ` · ${t('atlas.external')} ↗`}
      </p>
      <p className="dim">{meta.techniques.join(' · ')}</p>
    </>
  );
  return url
    ? <a className="card" href={url} target="_blank" rel="noreferrer">{body}</a>
    : <Link className="card" to={`/atlas/${meta.id}`}>{body}</Link>;
}
