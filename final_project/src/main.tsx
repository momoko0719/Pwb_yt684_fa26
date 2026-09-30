import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { UI } from './core/palette';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { LANGUAGES } from './i18n/strings';
import Home from './pages/Home';
import Ideas from './pages/Ideas';
import Atlas from './pages/Atlas';
import ExperimentPage from './pages/ExperimentPage';
import World from './pages/World';
import './index.css';

for (const [name, color] of Object.entries(UI)) {
  document.documentElement.style.setProperty(`--${name}`, color);
}

function Header() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <header className="site-header">
      <nav>
        <NavLink to="/" end className="brand">{t('site.title')}</NavLink>
        <NavLink to="/ideas">{t('nav.ideas')}</NavLink>
        <NavLink to="/atlas">{t('nav.atlas')}</NavLink>
        <NavLink to="/world">{t('nav.world')}</NavLink>
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
            <Route path="/" element={<Home />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/atlas" element={<Atlas />} />
            <Route path="/atlas/:id" element={<ExperimentPage />} />
            <Route path="/world" element={<World />} />
          </Routes>
        </main>
      </HashRouter>
    </LanguageProvider>
  </StrictMode>,
);
