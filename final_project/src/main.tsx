import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ATLAS_UI, JADE_UI, PHOTO, SPEED_TRACK, SILK_UI, UI, LAYER, WEAR_DEBUG, ZONE_DEBUG } from './core/palette';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { LANGUAGES } from './i18n/strings';
import Ideas from './pages/Ideas';
import Atlas from './pages/Atlas';
import ExperimentPage from './pages/ExperimentPage';
import World from './pages/World';
import './index.css';

for (const [name, color] of Object.entries(UI)) {
  document.documentElement.style.setProperty(`--${name}`, color);
}
for (const [name, color] of Object.entries(ATLAS_UI)) {
  document.documentElement.style.setProperty(`--atlas-${name}`, color);
}
for (const [name, color] of Object.entries(JADE_UI)) {
  document.documentElement.style.setProperty(`--jade-${name}`, color);
}
// The layers' inks (LayersPanel.tsx swatches and world tags), the wear and zone debug colours.
for (const [name, color] of Object.entries(LAYER)) {
  document.documentElement.style.setProperty(`--layer-${name}`, color);
}
for (const [name, color] of Object.entries(WEAR_DEBUG)) {
  document.documentElement.style.setProperty(`--wear-${name}`, color);
}
ZONE_DEBUG.forEach((color, i) => document.documentElement.style.setProperty(`--zone-${i}`, color));
for (const [name, color] of Object.entries(SPEED_TRACK)) {
  document.documentElement.style.setProperty(`--speed-${name}`, color);
}
for (const [name, color] of Object.entries(PHOTO)) {
  document.documentElement.style.setProperty(`--photo-${name}`, color);
}
for (const [name, color] of Object.entries(SILK_UI)) {
  document.documentElement.style.setProperty(`--silk-${name}`, color);
}

function Header() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <header className="site-header">
      <nav>
        <NavLink to="/" end className="brand">{t('site.brand')}</NavLink>
        <NavLink to="/world">{t('nav.world')}</NavLink>
        <NavLink to="/atlas">{t('nav.atlas')}</NavLink>
      </nav>
      <div className="language-toggle">
        {LANGUAGES.map((lang) => (
          <button key={lang} className={lang === language ? 'active' : ''} onClick={() => setLanguage(lang)}>
            {t(`language.${lang}`)}
          </button>
        ))}
      </div>
    </header>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <HashRouter>
        <Header />
        <main>
          <Routes>
            {/* The landing page is the Ideas page (owner, 2026-11-22: the plain welcome page went). */}
            <Route path="/" element={<Ideas />} />
            <Route path="/ideas" element={<Navigate to="/" replace />} />
            <Route path="/atlas" element={<Atlas />} />
            {/* The island moved to World; old links still arrive. */}
            <Route path="/atlas/wonderland-terrain" element={<Navigate to="/world" replace />} />
            <Route path="/atlas/:id" element={<ExperimentPage />} />
            <Route path="/world" element={<World />} />
          </Routes>
        </main>
      </HashRouter>
    </LanguageProvider>
  </StrictMode>,
);
