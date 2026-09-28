import { useMemo, useState, useCallback } from 'react';
import SidePanel from './components/SidePanel';
import Viewport from './components/Viewport';
import { LanguageProvider, useI18n } from './i18n/LanguageContext';
import { getStudy, defaultsFor } from './studies/catalog';
import type { ParamValues } from './studies/types';
import './App.css';

function AppInner() {
  const { ui, study: studyCopy } = useI18n();
  const [studyId, setStudyId] = useState('fresnel');
  const study = useMemo(() => getStudy(studyId), [studyId]);
  const [params, setParams] = useState<ParamValues>(() => defaultsFor(getStudy('fresnel')));
  const [showMask, setShowMask] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const onSelect = useCallback((id: string) => {
    const s = getStudy(id);
    setStudyId(id);
    setParams(defaultsFor(s));
    setShowMask(false);
  }, []);

  const onParam = useCallback((key: string, value: number | boolean | string) => {
    setParams(p => ({ ...p, [key]: value }));
  }, []);

  const copy = studyCopy(studyId);

  return (
    <div className="lab">
      {showWelcome && (
        <div className="welcome-overlay" role="dialog" aria-labelledby="welcome-title">
          <div className="welcome-card">
            <p className="welcome-mark">◈</p>
            <h2 id="welcome-title">{ui.welcomeTitle}</h2>
            <p className="welcome-body">{ui.welcomeBody}</p>
            <p className="welcome-how">{ui.welcomeHow}</p>
            <ol className="welcome-steps">
              <li>{ui.pathLabel}: Basics → Gradients → Spatial → …</li>
              <li>{ui.tryThis}: {studyCopy('fresnel').tryThis}</li>
              <li>{ui.showMask}</li>
            </ol>
            <div className="welcome-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => { setShowWelcome(false); onSelect('fresnel'); }}
              >
                {ui.welcomeStart}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowWelcome(false)}>
                {ui.welcomeSkip}
              </button>
            </div>
          </div>
        </div>
      )}

      <SidePanel
        study={study}
        params={params}
        showMask={showMask}
        onSelect={onSelect}
        onParam={onParam}
        onMask={setShowMask}
      />
      <main className="stage">
        <div className="stage-frame">
          <Viewport studyId={studyId} params={params} showMask={showMask} />
          <div className="stage-caption">
            <span>{copy.name}</span>
            <span>{ui.orbit}</span>
          </div>
          <div className="stage-insight">
            <strong>{ui.insight}</strong>
            <span>{copy.insight}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}
