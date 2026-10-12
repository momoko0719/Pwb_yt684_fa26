import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Island, { PAPER } from './Island';
import { useLang, type Key } from './i18n';
import { DEFAULT_EROSION, runErosionStep } from './lib/erosion';
import { buildStages, DEFAULTS, RES, type Params, type Stages } from './lib/pipeline';
import type { NoiseType, ShapingFn } from './types';

const NOISES: NoiseType[] = ['perlin', 'value', 'worley', 'cellular'];
const SHAPES: ShapingFn[] = ['linear', 'ridged', 'terrace', 'power'];
const MAX_STEPS = 60;

export default function App() {
  const { lang, setLang, t } = useLang();
  const [p, setP] = useState<Params>(DEFAULTS);
  const [heightScale, setHeightScale] = useState(7);
  const [drops, setDrops] = useState(400);
  const set = <K extends keyof Params>(k: K) => (v: Params[K]) => setP((old) => ({ ...old, [k]: v }));

  const stages = useMemo(() => buildStages(p), [p]);

  // Erosion runs step by step on top of the island stage. Results remember which stages they came
  // from, so any change upstream simply starts over.
  const [erosion, setErosion] = useState<{ of: Stages; map: Float32Array; steps: number; fallen: number } | null>(null);
  const [rainingOn, setRainingOn] = useState<Stages | null>(null);
  const eroded = erosion?.of === stages ? erosion : null;
  const raining = rainingOn === stages && (eroded?.steps ?? 0) < MAX_STEPS;
  useEffect(() => {
    if (!raining) return;
    const id = setInterval(() => {
      setErosion((prev) => {
        const cur = prev?.of === stages ? prev : null;
        if (cur && cur.steps >= MAX_STEPS) return prev;
        const next = runErosionStep(cur?.map ?? stages.island, RES, { ...DEFAULT_EROSION, dropletsPerStep: drops });
        return { of: stages, map: next, steps: (cur?.steps ?? 0) + 1, fallen: (cur?.fallen ?? 0) + drops };
      });
    }, 120);
    return () => clearInterval(id);
  }, [raining, stages, drops]);

  const height = eroded?.map ?? stages.island;
  const fallen = eroded?.fallen ?? 0;

  return (
    <div className="app" style={{ background: PAPER }}>
      <Canvas camera={{ position: [34, 26, 40], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={[PAPER]} />
        <fog attach="fog" args={[PAPER, 80, 170]} />
        <hemisphereLight args={['#ffffff', '#8a8072', 1.2]} />
        <directionalLight position={[30, 40, 10]} intensity={1.7} />
        <Island height={height} mask={stages.mask} noise={stages.noise} heightScale={heightScale} />
        <OrbitControls makeDefault target={[0, 0, 0]} minDistance={15} maxDistance={140} />
      </Canvas>

      <aside className="panel">
        <header>
          <h1>{t('title')}</h1>
          <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中' : 'EN'}</button>
        </header>
        <p className="dim">{t('subtitle')}</p>
        <p className="about">{t('about')}</p>

        {/* The pipeline at a glance: every stage as a small map */}
        <div className="stages">
          {(['noise', 'shaped', 'mask', 'island'] as const).map((s, i) => (
            <figure key={s}>
              <MapThumb data={s === 'island' ? height : stages[s]} />
              <figcaption>{i + 1} {t(`stage.${s}` as Key)}</figcaption>
            </figure>
          ))}
        </div>

        <h2>{t('h.noise')}</h2>
        <p className="dim small">{t('about.noise')}</p>
        <div className="row tabs">
          {NOISES.map((n) => (
            <button key={n} className={p.noise === n ? 'on' : ''} onClick={() => set('noise')(n)}>{t(`n.${n}` as Key)}</button>
          ))}
        </div>
        <Slider label={t('scale')} value={p.scale} min={1} max={8} step={0.1} onChange={set('scale')} />
        <Slider label={t('octaves')} value={p.octaves} min={1} max={8} step={1} onChange={set('octaves')} />
        <Slider label={t('persistence')} value={p.persistence} min={0.2} max={0.8} step={0.01} onChange={set('persistence')} />

        <h2>{t('h.shape')}</h2>
        <p className="dim small">{t('about.shape')}</p>
        <div className="row tabs">
          {SHAPES.map((s) => (
            <button
              key={s}
              className={p.shaping === s ? 'on' : ''}
              onClick={() => setP((old) => ({ ...old, shaping: s, shapingParam: s === 'terrace' ? 6 : s === 'power' ? 1.8 : old.shapingParam }))}
            >
              {t(`s.${s}` as Key)}
            </button>
          ))}
        </div>
        {p.shaping === 'terrace' && <Slider label={t('steps')} value={p.shapingParam} min={2} max={14} step={1} onChange={set('shapingParam')} />}
        {p.shaping === 'power' && <Slider label={t('exponent')} value={p.shapingParam} min={0.4} max={4} step={0.1} onChange={set('shapingParam')} />}

        <h2>{t('h.island')}</h2>
        <p className="dim small">{t('about.island')}</p>
        <Slider label={t('radius')} value={p.radius} min={0.4} max={1} step={0.01} onChange={set('radius')} />
        <Slider label={t('edge')} value={p.edge} min={0.1} max={0.9} step={0.01} onChange={set('edge')} />

        <h2>{t('h.erosion')}</h2>
        <p className="dim small">{t('about.erosion')}</p>
        <div className="row">
          <button className="primary" onClick={() => setRainingOn(raining ? null : stages)}>{raining ? t('pause') : t('rain')}</button>
          <button onClick={() => { setRainingOn(null); setErosion(null); }}>{t('reset')}</button>
          <span className="dim small counter">{fallen.toLocaleString()} {t('fallen')}</span>
        </div>
        <Slider label={t('drops')} value={drops} min={100} max={2000} step={100} onChange={setDrops} />

        <h2>{t('view')}</h2>
        <Slider label={t('height')} value={heightScale} min={2} max={18} step={0.5} onChange={setHeightScale} />
        <div className="row">
          <button onClick={() => set('seed')(p.seed + 1)}>{t('seed')} · {p.seed}</button>
        </div>
        <p className="dim small">{t('hint')}</p>
      </aside>
    </div>
  );
}

/** A heightmap drawn as ink on paper: dark = high. */
function MapThumb({ data }: { data: Float32Array }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(RES, RES);
    for (let i = 0; i < data.length; i++) {
      const v = Math.min(Math.max(data[i], 0), 1);
      img.data[i * 4] = 239 - v * 212;
      img.data[i * 4 + 1] = 232 - v * 206;
      img.data[i * 4 + 2] = 216 - v * 192;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [data]);
  return <canvas ref={ref} width={RES} height={RES} />;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="dim">{Number.isInteger(step) ? value : value.toFixed(2)}</span>
    </label>
  );
}
