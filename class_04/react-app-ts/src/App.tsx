import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Grotto from './Grotto';
import { buildMesh, PAPER, type Method } from './lib/buildMesh';
import { useLang, type Key } from './i18n';
import { DEFAULTS, makeBaseDensity, makeDensity, type GrottoParams } from './lib/grotto';

const SLICE = 96;

export default function App() {
  const { lang, setLang, t } = useLang();
  const [p, setP] = useState<GrottoParams>(DEFAULTS);
  const [method, setMethod] = useState<Method>('smooth');
  const [n, setN] = useState(56);
  const set = <K extends keyof GrottoParams>(k: K) => (v: GrottoParams[K]) => setP((old) => ({ ...old, [k]: v }));

  const mesh = useMemo(() => buildMesh(p, n, method), [p, n, method]);

  // Slices through the field, the way a geologist would cut the mountain open.
  const slices = useMemo(() => {
    const base = makeBaseDensity(p);
    const carved = makeDensity(p);
    const section = (f: (x: number, y: number, z: number) => number) => (u: number, v: number) => f(u * 1.1, -v * 1.1, 0.05);
    const level = (f: (x: number, y: number, z: number) => number) => (u: number, v: number) => f(u * 1.1, -0.02, v * 1.1);
    return [section(base), section(carved), level(carved)];
  }, [p]);

  return (
    <div className="app" style={{ background: PAPER }}>
      <Canvas camera={{ position: [44, 6, 22], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={[PAPER]} />
        <fog attach="fog" args={[PAPER, 70, 160]} />
        <hemisphereLight args={['#ffffff', '#8a8072', 1.0]} />
        <directionalLight position={[20, 30, 10]} intensity={1.5} />
        <Grotto geometry={mesh.geometry} cave={p.cave} flat={method === 'blocks'} />
        <OrbitControls makeDefault target={[0, -2, 0]} minDistance={6} maxDistance={110} />
      </Canvas>

      <aside className="panel">
        <header>
          <h1>{t('title')}</h1>
          <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中' : 'EN'}</button>
        </header>
        <p className="dim">{t('subtitle')}</p>
        <p className="about">{t('about')}</p>

        <div className="stages three">
          {(['base', 'carved', 'cave'] as const).map((s, i) => (
            <figure key={s}>
              <SliceThumb field={slices[i]} />
              <figcaption>{i + 1} {t(`stage.${s}` as Key)}</figcaption>
            </figure>
          ))}
        </div>

        <h2>{t('h.density')}</h2>
        <p className="dim small">{t('about.density')}</p>
        <Slider label={t('roughness')} value={p.roughness} min={0} max={0.6} step={0.01} onChange={set('roughness')} />
        <Slider label={t('noiseScale')} value={p.noiseScale} min={1} max={5} step={0.1} onChange={set('noiseScale')} />

        <h2>{t('h.carve')}</h2>
        <p className="dim small">{t('about.carve')}</p>
        <div className="row tabs">
          {(['cave', 'shaft', 'hollow'] as const).map((k) => (
            <button key={k} className={p[k] ? 'on' : ''} onClick={() => set(k)(!p[k])}>{t(k)}</button>
          ))}
        </div>
        <Slider label={t('smooth')} value={p.smooth} min={0} max={0.25} step={0.01} onChange={set('smooth')} />

        <h2>{t('h.mesh')}</h2>
        <p className="dim small">{t('about.mesh')}</p>
        <div className="row tabs">
          <button className={method === 'blocks' ? 'on' : ''} onClick={() => setMethod('blocks')}>{t('blocks')}</button>
          <button className={method === 'smooth' ? 'on' : ''} onClick={() => setMethod('smooth')}>{t('marching')}</button>
        </div>
        <Slider label={t('resolution')} value={n} min={24} max={80} step={4} onChange={setN} />
        <p className="dim small">{mesh.triangles.toLocaleString()} {t('tris')} · {mesh.ms} {t('ms')}</p>

        <h2>{t('view')}</h2>
        <div className="row">
          <button onClick={() => set('seed')(p.seed + 1)}>{t('seed')} · {p.seed}</button>
        </div>
        <p className="dim small">{t('hint')}</p>
      </aside>
    </div>
  );
}

/** A slice through the density field: ink where there is rock, paper where it is empty. */
function SliceThumb({ field }: { field: (u: number, v: number) => number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(SLICE, SLICE);
    for (let j = 0; j < SLICE; j++) {
      for (let i = 0; i < SLICE; i++) {
        const d = field((i / (SLICE - 1)) * 2 - 1, (j / (SLICE - 1)) * 2 - 1);
        const k = (j * SLICE + i) * 4;
        // Solid in ink, a thin vermilion line on the surface itself (density ≈ 0).
        const edge = Math.abs(d) < 0.012;
        const rgb = edge ? [179, 58, 42] : d > 0 ? [43, 42, 39] : [239, 232, 216];
        img.data.set([...rgb, 255], k);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [field]);
  return <canvas ref={ref} width={SLICE} height={SLICE} />;
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
