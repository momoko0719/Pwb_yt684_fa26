import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useLang, type Key } from './i18n';
import { ForestScene, PAPER, TreeScene, type ForestStats, type View } from './Scenes';
import { buildIsland, plantForest, VARIANTS } from './world/island';
import { buildTree, LODS, type TreeColors } from './world/lod';
import { expand, interpret, parseRules, type TurtleParams } from './world/lsystem';
import { PRESET_IDS, PRESETS, type PresetId } from './world/presets';

type Mode = 'tree' | 'forest';

/** Grammar text → strings per generation → skeleton → one mesh per LOD. */
function grow(axiom: string, rulesText: string, generations: number, params: TurtleParams, colors: TreeColors, seed: number) {
  const { rules, error } = parseRules(rulesText);
  const strings = expand({ axiom, rules }, generations, seed);
  const buds = new Set(rules.map((r) => r.from).filter((c) => c !== 'F' && c !== 'L'));
  const skeleton = interpret(strings[strings.length - 1], buds, params, seed);
  const meshes = LODS.map((lod) => buildTree(skeleton, lod, colors, seed));
  return { strings, skeleton, meshes, error };
}

export default function Pines() {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>('tree');
  const [presetId, setPresetId] = useState<PresetId>('pine');
  const preset = PRESETS[presetId];
  const [axiom, setAxiom] = useState(preset.axiom);
  const [rulesText, setRulesText] = useState(preset.rules);
  const [generations, setGenerations] = useState(preset.generations);
  const [params, setParams] = useState<TurtleParams>(preset.params);
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState<View>(0);

  const [treeCount, setTreeCount] = useState(1200);
  const [lodOn, setLodOn] = useState(true);
  const [tint, setTint] = useState(false);
  const [near, setNear] = useState(150);
  const [far, setFar] = useState(220);
  const [stats, setStats] = useState<ForestStats>({ fps: 0, triangles: 0, perLod: [0, 0, 0] });

  const choosePreset = (id: PresetId) => {
    const p = PRESETS[id];
    setPresetId(id);
    setAxiom(p.axiom);
    setRulesText(p.rules);
    setGenerations(p.generations);
    setParams(p.params);
  };
  const setParam = (k: keyof TurtleParams) => (v: number) => setParams((p) => ({ ...p, [k]: v }));

  const tree = useMemo(() => grow(axiom, rulesText, generations, params, preset.colors, seed), [axiom, rulesText, generations, params, preset, seed]);
  useEffect(() => () => tree.meshes.forEach((m) => m.geometry.dispose()), [tree]);

  // The forest uses the current grammar, in a few seeded variants so neighbours differ.
  const island = useMemo(() => buildIsland(7), []);
  const spots = useMemo(() => plantForest(island, treeCount, 7), [island, treeCount]);
  const forestMeshes = useMemo(() => {
    if (mode !== 'forest') return null;
    const src = preset.forest ? { axiom, rulesText, generations, params, colors: preset.colors } : { ...PRESETS.pine, rulesText: PRESETS.pine.rules };
    return Array.from({ length: VARIANTS }, (_, v) => grow(src.axiom, src.rulesText, src.generations, src.params, src.colors, seed + v * 101).meshes);
  }, [mode, axiom, rulesText, generations, params, preset, seed]);
  useEffect(() => () => forestMeshes?.flat().forEach((m) => m.geometry.dispose()), [forestMeshes]);

  const last = tree.strings[tree.strings.length - 1];

  return (
    <div className="app" style={{ background: PAPER }}>
      <Canvas
        key={mode}
        camera={mode === 'tree' ? { position: [14, 9, 14], fov: 40 } : { position: [60, 130, 200], fov: 45, far: 3000 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[PAPER]} />
        {mode === 'forest' && <fog attach="fog" args={[PAPER, 180, 520]} />}
        <hemisphereLight args={['#ffffff', '#8a8072', 1.3]} />
        <directionalLight position={[30, 60, 20]} intensity={1.5} />
        {mode === 'tree' ? (
          <TreeScene meshes={tree.meshes} view={view} vine={presetId === 'vine'} frameKey={`${presetId}-${view === 'compare'}`} />
        ) : (
          forestMeshes && (
            <ForestScene island={island} spots={spots} meshes={forestMeshes} lodOn={lodOn} tint={tint} near={near} far={far} onStats={setStats} />
          )
        )}
        <OrbitControls makeDefault maxPolarAngle={Math.PI * 0.49} maxDistance={mode === 'tree' ? 80 : 600} />
      </Canvas>

      <aside className="panel">
        <header>
          <h1>{t('title')}</h1>
        </header>
        <p className="dim">{t('subtitle')}</p>

        <div className="row tabs">
          {(['tree', 'forest'] as Mode[]).map((m) => (
            <button key={m} className={m === mode ? 'on' : ''} onClick={() => setMode(m)}>{t(`mode.${m}` as Key)}</button>
          ))}
        </div>
        <p className="about">{t(`about.${mode}` as Key)}</p>

        <div className="row tabs">
          {PRESET_IDS.map((id) => (
            <button key={id} className={id === presetId ? 'on' : ''} onClick={() => choosePreset(id)}>{t(`preset.${id}` as Key)}</button>
          ))}
        </div>

        {mode === 'tree' ? (
          <>
            <h2>{t('grammar')}</h2>
            <label className="field">
              <span>{t('axiom')}</span>
              <input value={axiom} onChange={(e) => setAxiom(e.target.value)} spellCheck={false} />
            </label>
            <label className="field">
              <span>{t('rules')}</span>
              <textarea value={rulesText} rows={Math.max(3, rulesText.split('\n').length)} onChange={(e) => setRulesText(e.target.value)} spellCheck={false} />
            </label>
            {tree.error && <p className="error">{t('ruleError')} {tree.error}</p>}
            <p className="dim mono small">{t('symbols')}</p>

            <h2>{t('shape')}</h2>
            <Slider label={t('generations')} value={generations} min={0} max={presetId === 'classic' ? 6 : 14} step={1} onChange={setGenerations} />
            <Slider label={t('angle')} value={params.angle} min={5} max={110} step={0.5} onChange={setParam('angle')} />
            <Slider label={t('lengthDecay')} value={params.lengthDecay} min={0.4} max={1.1} step={0.01} onChange={setParam('lengthDecay')} />
            <Slider label={t('widthDecay')} value={params.widthDecay} min={0.3} max={1} step={0.01} onChange={setParam('widthDecay')} />
            <Slider label={t('gravity')} value={params.gravity} min={-0.3} max={0.8} step={0.01} onChange={setParam('gravity')} />
            <Slider label={t('jitter')} value={params.jitter} min={0} max={1} step={0.01} onChange={setParam('jitter')} />
            <div className="row">
              <button onClick={() => setSeed((s) => s + 1)}>{t('newSeed')} · {seed}</button>
            </div>

            <h2>{t('view')}</h2>
            <div className="row tabs">
              {([0, 1, 2, 'compare'] as View[]).map((v) => (
                <button key={v} className={v === view ? 'on' : ''} onClick={() => setView(v)}>{t(`view.${v}` as Key)}</button>
              ))}
            </div>
            <p className="mono small">
              {tree.skeleton.segments.length} {t('segments')} · {tree.skeleton.leaves.length} {t('leaves')}
              <br />
              {tree.meshes.map((m, i) => `LOD${i} ${m.triangles.toLocaleString()}`).join(' · ')} {t('tris')}
            </p>

            <h2>{t('growth')}</h2>
            <ol className="growth mono small" start={0}>
              {tree.strings.map((s, g) => (
                <li key={g}>
                  <span className="dim">{s.length.toLocaleString()} {t('chars')}</span> {s.length > 90 ? `${s.slice(0, 90)}…` : s}
                </li>
              ))}
            </ol>
            <p className="dim small">{last.length >= 200_000 ? '⚠ 200,000+' : ''}</p>
          </>
        ) : (
          <>
            {!preset.forest && <p className="dim small">{t('forestNote')}</p>}
            <h2>LOD</h2>
            <Slider label={t('trees')} value={treeCount} min={100} max={3000} step={100} onChange={setTreeCount} />
            <Slider label={t('near')} value={near} min={10} max={200} step={5} onChange={(v) => { setNear(v); setFar((f) => Math.max(f, v + 5)); }} />
            <Slider label={t('far')} value={far} min={20} max={400} step={5} onChange={(v) => { setFar(v); setNear((n) => Math.min(n, v - 5)); }} />
            <label className="check"><input type="checkbox" checked={lodOn} onChange={() => setLodOn(!lodOn)} />{t('lodOn')}</label>
            <label className="check"><input type="checkbox" checked={tint} onChange={() => setTint(!tint)} />{t('tint')}</label>
            <div className="stats mono">
              <div><b>{stats.fps}</b> {t('fps')}</div>
              <div><b>{stats.triangles.toLocaleString()}</b> {t('drawn')}</div>
              <div>
                {stats.perLod.map((n, i) => (
                  <span key={i} className={`lod lod${i}`}>LOD{i} {n}</span>
                ))}
              </div>
            </div>
            <p className="dim small">{t('hint')}</p>
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
