import type { StudyMeta, ParamValues, ParamDef, StudyCategory } from '../studies/types';
import { CATEGORY_ORDER } from '../studies/types';
import { STUDIES } from '../studies/catalog';
import { useI18n } from '../i18n/LanguageContext';
import { PATH_ORDER } from '../i18n/strings';

export default function SidePanel({
  study, params, showMask, onSelect, onParam, onMask,
}: {
  study: StudyMeta;
  params: ParamValues;
  showMask: boolean;
  onSelect: (id: string) => void;
  onParam: (key: string, value: number | boolean | string) => void;
  onMask: (v: boolean) => void;
}) {
  const { ui, study: studyCopy, toggle, lang } = useI18n();
  const copy = studyCopy(study.id);

  const byCat = CATEGORY_ORDER.map(cat => ({
    cat,
    items: STUDIES.filter(s => s.category === cat),
  }));

  const pathIndex = PATH_ORDER.indexOf(study.id as typeof PATH_ORDER[number]);
  const nextId = pathIndex >= 0 && pathIndex < PATH_ORDER.length - 1
    ? PATH_ORDER[pathIndex + 1]
    : null;

  return (
    <aside className="side">
      <header className="side-head">
        <div className="side-head-row">
          <p className="kicker">{ui.kicker}</p>
          <button type="button" className="lang-btn" onClick={toggle}>
            {ui.langToggle}
            <span>{lang.toUpperCase()}</span>
          </button>
        </div>
        <h1 className="brand">{ui.brand}</h1>
        <p className="tagline">{ui.tagline}</p>
      </header>

      <nav className="study-nav" aria-label="Shader studies">
        {byCat.map(({ cat, items }) => (
          <div key={cat} className="cat-block">
            <h2 className="cat-label">{ui.categories[cat as StudyCategory]}</h2>
            <ul className="study-list">
              {items.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`study-btn ${study.id === s.id ? 'active' : ''}`}
                    onClick={() => onSelect(s.id)}
                  >
                    {studyCopy(s.id).name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <section className="study-detail">
        <p className="you-are-here">{ui.youAreHere}</p>
        <h2 className="detail-name">{copy.name}</h2>
        <p className="detail-short">{copy.short}</p>

        <div className="guide-cards">
          <article className="guide-card">
            <h3>{ui.meaning}</h3>
            <p>{copy.meaning}</p>
          </article>
          <article className="guide-card">
            <h3>{ui.useFor}</h3>
            <p>{copy.useFor}</p>
          </article>
          <article className="guide-card accent">
            <h3>{ui.tryThis}</h3>
            <p>{copy.tryThis}</p>
          </article>
          <article className="guide-card insight">
            <h3>{ui.insight}</h3>
            <p>{copy.insight}</p>
          </article>
        </div>

        {study.hasMask && (
          <>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={showMask}
                onChange={e => onMask(e.target.checked)}
              />
              <span>{ui.showMask}</span>
            </label>
            <p className="mask-hint">{ui.maskHint}</p>
          </>
        )}

        <div className="params">
          {study.params.map(p => (
            <ParamControl
              key={p.key}
              def={p}
              label={ui.paramLabels[p.key] ?? p.label}
              value={params[p.key]}
              onChange={v => onParam(p.key, v)}
            />
          ))}
        </div>

        {study.snippet && (
          <pre className="snippet"><code>{study.snippet}</code></pre>
        )}

        {nextId && (
          <button type="button" className="next-btn" onClick={() => onSelect(nextId)}>
            {ui.nextStudy}
          </button>
        )}
      </section>
    </aside>
  );
}

function ParamControl({
  def, label, value, onChange,
}: {
  def: ParamDef;
  label: string;
  value: number | boolean | string | undefined;
  onChange: (v: number | boolean | string) => void;
}) {
  if (def.kind === 'bool') {
    return (
      <label className="toggle-row">
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }
  if (def.kind === 'select' && def.options) {
    return (
      <label className="param-row">
        <span className="param-label">{label}</span>
        <select
          className="param-select"
          value={String(value ?? def.default)}
          onChange={e => onChange(e.target.value)}
        >
          {def.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }
  const n = typeof value === 'number' ? value : Number(def.default);
  return (
    <label className="param-row">
      <span className="param-label">
        {label}
        <strong>{def.step !== undefined && def.step >= 1 ? String(Math.round(n)) : n.toFixed(2)}</strong>
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={n}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  );
}
