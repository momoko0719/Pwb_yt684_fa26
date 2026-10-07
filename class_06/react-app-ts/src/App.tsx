import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import Landscape, { type Tool } from './Landscape';
import { useLang, type Key } from './i18n';
import { STYLES, type StyleId } from './styles';
import { buildFlow, type Vortex } from './world/flow';
import { createNoise } from './world/noise';
import { scatter, SPECIES, type Species } from './world/scatter';
import { smoothPath, type P2 } from './world/spline';
import { buildLand, SIZE, type Stroke } from './world/terrain';

type Chapter = 'scatter' | 'path' | 'flow' | 'all';
const CHAPTERS: Chapter[] = ['scatter', 'path', 'flow', 'all'];
const TOOLS: Tool[] = ['look', 'river', 'road', 'vortex'];

/** A first river so the land is never empty: a meandering line across the map, from noise. */
function starterRiver(seed: number): Stroke {
  const noise = createNoise(seed + 99);
  const raw: P2[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const x = -SIZE * 0.45 + t * SIZE * 0.9;
    raw.push([x, (noise(t * 3, 1.7) - 0.5) * SIZE * 0.6]);
  }
  return { kind: 'river', path: smoothPath(raw, 1) };
}

export default function App() {
  const { lang, setLang, t } = useLang();
  const [seed, setSeed] = useState(6);
  const [chapter, setChapter] = useState<Chapter>('all');
  const [tool, setTool] = useState<Tool>('look');
  const [styleId, setStyleId] = useState<StyleId>('ink');
  const [strokes, setStrokes] = useState<Stroke[]>(() => [starterRiver(6)]);
  const [vortices, setVortices] = useState<Vortex[]>([]);
  const [density, setDensity] = useState(0.7);
  const [layers, setLayers] = useState<Record<Species, boolean>>(() => Object.fromEntries(SPECIES.map((s) => [s, true])) as Record<Species, boolean>);
  const [current, setCurrent] = useState(3);
  const [wind, setWind] = useState(0.6);
  const [windAngle, setWindAngle] = useState(0.6);
  const [particleCount, setParticleCount] = useState(4000);
  const [arrows, setArrows] = useState(false);
  const controls = useRef<OrbitControlsImpl>(null);

  const land = useMemo(() => buildLand(seed, strokes), [seed, strokes]);
  const items = useMemo(() => scatter(land, strokes, seed, density, layers), [land, strokes, seed, density, layers]);
  const flow = useMemo(() => buildFlow(land, strokes, vortices, { current, wind, windAngle }), [land, strokes, vortices, current, wind, windAngle]);
  const style = STYLES[styleId];
  const placed = SPECIES.reduce((sum, s) => sum + items[s].length, 0);

  const showScatter = chapter !== 'flow';
  const showParticles = chapter === 'flow' || chapter === 'all';
  const hint: Key = tool === 'look' ? 'hint.look' : tool === 'vortex' ? 'hint.vortex' : 'hint.draw';

  const topView = () => {
    const c = controls.current;
    if (!c) return;
    c.object.position.set(0, SIZE * 1.15, 0.01);
    c.target.set(0, 0, 0);
    c.update();
  };

  return (
    <div className="app" style={{ background: style.background }}>
      <Canvas camera={{ position: [95, 90, 95], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={[style.background]} />
        <hemisphereLight args={['#ffffff', '#8a8072', 1.1]} />
        <directionalLight position={[40, 60, 20]} intensity={1.6} />
        <Landscape
          land={land}
          strokes={strokes}
          items={items}
          flow={flow}
          vortices={vortices}
          style={style}
          tool={tool}
          showScatter={showScatter}
          showParticles={showParticles}
          showArrows={arrows || chapter === 'flow'}
          highlightPaths={chapter === 'path'}
          particleCount={particleCount}
          onStroke={(raw) => {
            const path = smoothPath(raw, 1);
            if (path.length > 2) setStrokes((s) => [...s, { kind: tool === 'road' ? 'road' : 'river', path }]);
          }}
          onVortex={(x, z, clockwise) => setVortices((v) => [...v, { x, z, strength: clockwise ? -4 : 4 }])}
        />
        <OrbitControls
          ref={controls}
          makeDefault
          maxPolarAngle={Math.PI * 0.49}
          minDistance={20}
          maxDistance={220}
          // In drawing modes the left button draws, so orbiting moves to the right button.
          mouseButtons={{ LEFT: tool === 'look' ? MOUSE.ROTATE : undefined, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        />
      </Canvas>

      <aside className="panel">
        <header>
          <h1>{t('title')}</h1>
          <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中' : 'EN'}</button>
        </header>
        <p className="dim">{t('subtitle')}</p>

        <div className="row tabs">
          {CHAPTERS.map((c) => (
            <button key={c} className={c === chapter ? 'on' : ''} onClick={() => setChapter(c)}>{t(`chapter.${c}` as Key)}</button>
          ))}
        </div>
        <p className="about">{t(`about.${chapter}` as Key)}</p>

        <h2>{t('tools')}</h2>
        <div className="row tabs">
          {TOOLS.map((k) => (
            <button key={k} className={k === tool ? 'on' : ''} onClick={() => setTool(k)}>{t(`tool.${k}` as Key)}</button>
          ))}
        </div>
        <p className="dim">{t(hint)}</p>
        <div className="row">
          <button onClick={() => setStrokes((s) => s.slice(0, -1))}>{t('undo')}</button>
          <button onClick={() => { setStrokes([]); setVortices([]); }}>{t('clear')}</button>
          <button onClick={() => { const next = seed + 1; setSeed(next); setStrokes([starterRiver(next)]); setVortices([]); }}>{t('seed')}</button>
          <button onClick={topView}>{t('topView')}</button>
        </div>

        <h2>{t('style')}</h2>
        <div className="row tabs">
          {(['ink', 'qinglv'] as StyleId[]).map((s) => (
            <button key={s} className={s === styleId ? 'on' : ''} onClick={() => setStyleId(s)}>{t(`style.${s}` as Key)}</button>
          ))}
        </div>

        {(chapter === 'scatter' || chapter === 'all' || chapter === 'path') && (
          <>
            <h2>{t('layers')} <span className="dim">· {placed} {t('stats')}</span></h2>
            <div className="row checks">
              {SPECIES.map((s) => (
                <label key={s}>
                  <input type="checkbox" checked={layers[s]} onChange={() => setLayers((l) => ({ ...l, [s]: !l[s] }))} />
                  {t(`sp.${s}` as Key)} <span className="dim">{items[s].length}</span>
                </label>
              ))}
            </div>
            <Slider label={t('density')} value={density} min={0.1} max={1} step={0.05} onChange={setDensity} />
          </>
        )}

        {(chapter === 'flow' || chapter === 'all') && (
          <>
            <Slider label={t('current')} value={current} min={0} max={6} step={0.1} onChange={setCurrent} />
            <Slider label={t('wind')} value={wind} min={0} max={2} step={0.05} onChange={setWind} />
            <Slider label={t('windAngle')} value={windAngle} min={0} max={6.28} step={0.05} onChange={setWindAngle} />
            <Slider label={t('particles')} value={particleCount} min={500} max={12000} step={500} onChange={setParticleCount} />
            <label className="check">
              <input type="checkbox" checked={arrows || chapter === 'flow'} disabled={chapter === 'flow'} onChange={() => setArrows(!arrows)} />
              {t('arrows')}
            </label>
          </>
        )}
      </aside>
    </div>
  );
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
