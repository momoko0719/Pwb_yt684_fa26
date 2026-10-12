import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useLang, type Key } from './i18n';
import { SNIPPETS } from './shaders';
import { Glaze, Glow, Pearl, type SpecimenId } from './Specimens';

const PAPER = '#efe8d8';
const NIGHT = '#0b1016';
const CAMERAS: Record<SpecimenId, [number, number, number]> = { glaze: [0, 1.2, 5.5], pearl: [0, 2.6, 3.6], glow: [0, 9, 24] };

export default function App() {
  const { lang, setLang, t } = useLang();
  const [id, setId] = useState<SpecimenId>('glaze');
  const [mask, setMask] = useState(false);
  const [glaze, setGlaze] = useState({ power: 2.5, rim: 0.9 });
  const [pearl, setPearl] = useState({ film: 1.1, irid: 0.75, back: 0.6 });
  const [glow, setGlow] = useState({ glow: 1.2, waves: 0.8 });
  const bg = id === 'glow' ? NIGHT : PAPER;

  return (
    <div className="app" style={{ background: bg }}>
      <Canvas key={id} camera={{ position: CAMERAS[id], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={[bg]} />
        {id === 'glow' && <fog attach="fog" args={[NIGHT, 30, 70]} />}
        <hemisphereLight args={['#ffffff', '#8a8072', 1.0]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} />
        {id === 'glaze' && <Glaze {...glaze} mask={mask} />}
        {id === 'pearl' && <Pearl {...pearl} mask={mask} />}
        {id === 'glow' && <Glow {...glow} mask={mask} />}
        <OrbitControls makeDefault maxPolarAngle={id === 'glow' ? Math.PI * 0.45 : Math.PI} />
      </Canvas>

      <aside className="panel">
        <header>
          <h1>{t('title')}</h1>
          <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中' : 'EN'}</button>
        </header>
        <p className="dim">{t('subtitle')}</p>
        <p className="about">{t('about')}</p>

        <div className="row tabs">
          {(['glaze', 'pearl', 'glow'] as SpecimenId[]).map((m) => (
            <button key={m} className={m === id ? 'on' : ''} onClick={() => setId(m)}>{t(`m.${m}` as Key)}</button>
          ))}
        </div>

        <h2>{t(`m.${id}` as Key)}</h2>
        <p className="small">{t(`about.${id}` as Key)}</p>
        <p className="dim small">{t('key')}</p>
        <code className="snippet">{SNIPPETS[id]}</code>

        {id === 'glaze' && (
          <>
            <Slider label={t('power')} value={glaze.power} min={0.5} max={8} step={0.1} onChange={(v) => setGlaze({ ...glaze, power: v })} />
            <Slider label={t('rim')} value={glaze.rim} min={0} max={2} step={0.05} onChange={(v) => setGlaze({ ...glaze, rim: v })} />
          </>
        )}
        {id === 'pearl' && (
          <>
            <Slider label={t('film')} value={pearl.film} min={0.2} max={3} step={0.05} onChange={(v) => setPearl({ ...pearl, film: v })} />
            <Slider label={t('irid')} value={pearl.irid} min={0} max={1} step={0.05} onChange={(v) => setPearl({ ...pearl, irid: v })} />
            <Slider label={t('back')} value={pearl.back} min={0} max={1.5} step={0.05} onChange={(v) => setPearl({ ...pearl, back: v })} />
          </>
        )}
        {id === 'glow' && (
          <>
            <Slider label={t('glow')} value={glow.glow} min={0} max={2.5} step={0.05} onChange={(v) => setGlow({ ...glow, glow: v })} />
            <Slider label={t('waves')} value={glow.waves} min={0.1} max={1.6} step={0.05} onChange={(v) => setGlow({ ...glow, waves: v })} />
          </>
        )}

        <label className="check">
          <input type="checkbox" checked={mask} onChange={() => setMask(!mask)} />
          {t('mask')}
        </label>
        <p className="dim small">{id === 'glow' ? t('hintGlow') : t('hint')}</p>
      </aside>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="dim">{value.toFixed(2)}</span>
    </label>
  );
}
