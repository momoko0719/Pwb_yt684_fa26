import { useState } from 'react';
import { LanguageProvider, useI18n } from './i18n/LanguageContext';
import { StudioConfigProvider, useStudioConfig } from './studio/StudioConfigContext';
import DensityTab from './components/DensityTab';
import CsgTab from './components/CsgTab';
import MeshingTab from './components/MeshingTab';
import ChunkingTab from './components/ChunkingTab';
import CloudBar from './components/CloudBar';
import type { StationId } from './lib/studioConfig';
import './App.css';

const TAB_ORDER: StationId[] = ['density', 'csg', 'meshing', 'chunking'];

function AppInner() {
  const { t, lang, toggle, showJargon, setShowJargon } = useI18n();
  const { config, setStation } = useStudioConfig();
  const tab = config.station;
  const [showWelcome, setShowWelcome] = useState(true);
  const [showOutcomes, setShowOutcomes] = useState(true);

  const stepIndex = TAB_ORDER.indexOf(tab);
  const stepLabel = t.tour.stepOf.replace('{n}', String(stepIndex + 1));

  const goNext = () => {
    if (stepIndex < TAB_ORDER.length - 1) setStation(TAB_ORDER[stepIndex + 1]);
  };
  const goPrev = () => {
    if (stepIndex > 0) setStation(TAB_ORDER[stepIndex - 1]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-kicker">Class 04</p>
          <h1 className="brand">{t.brand}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>

        <nav className="tab-nav" aria-label="Studio stations">
          {TAB_ORDER.map(id => {
            const meta = t.tabs[id];
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                className={`tab-btn ${active ? 'active' : ''}`}
                onClick={() => setStation(id)}
              >
                <span className="tab-label">{meta.label}</span>
                {showJargon && <span className="tab-jargon">{meta.jargon}</span>}
              </button>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className={`jargon-toggle ${showJargon ? 'on' : ''}`}
            onClick={() => setShowJargon(!showJargon)}
          >
            {showJargon ? t.shared.hideJargon : t.shared.showJargon}
          </button>
          <button type="button" className="lang-btn" onClick={toggle} title="Language">
            {t.langToggle}
            <span className="lang-curr">{lang.toUpperCase()}</span>
          </button>
        </div>
      </header>

      <CloudBar />

      {showWelcome && (
        <div className="welcome-overlay" role="dialog" aria-labelledby="welcome-title">
          <div className="welcome-card">
            <p className="welcome-mark">◈</p>
            <h2 id="welcome-title">{t.welcome.title}</h2>
            <p className="welcome-body">{t.welcome.body}</p>
            <div className="welcome-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => { setShowWelcome(false); setStation('density'); }}
              >
                {t.welcome.start}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowWelcome(false)}>
                {t.welcome.dismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOutcomes && !showWelcome && (
        <section className="outcomes-bar">
          <div className="outcomes-head">
            <h2>{t.outcomes.title}</h2>
            <button type="button" className="dismiss" onClick={() => setShowOutcomes(false)} aria-label="Close">×</button>
          </div>
          <div className="outcomes-grid">
            {t.outcomes.items.map(item => (
              <article key={item.title} className="outcome-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {showJargon && <span className="jargon-pill">{t.shared.jargonTag}: {item.jargon}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      <main className="main">
        {tab === 'density' && <DensityTab />}
        {tab === 'csg' && <CsgTab />}
        {tab === 'meshing' && <MeshingTab />}
        {tab === 'chunking' && <ChunkingTab />}
      </main>

      {!showWelcome && (
        <footer className="studio-tour">
          <button type="button" className="tour-btn" onClick={goPrev} disabled={stepIndex === 0}>
            {t.tour.prev}
          </button>
          <span className="tour-step">{stepLabel}</span>
          {stepIndex < TAB_ORDER.length - 1 ? (
            <button type="button" className="tour-btn tour-next" onClick={goNext}>
              {t.tour.next}
            </button>
          ) : (
            <button type="button" className="tour-btn" onClick={() => setShowWelcome(true)}>
              {t.tour.again}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <StudioConfigProvider>
        <AppInner />
      </StudioConfigProvider>
    </LanguageProvider>
  );
}
