import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import NoiseCanvas2D   from './components/NoiseCanvas2D';
import Terrain3D       from './components/Terrain3D';
import LayerPanel, { makeDefaultLayer } from './components/LayerPanel';
import SimulationPanel from './components/SimulationPanel';
import BottomTimeline  from './components/BottomTimeline';
import { computeNoiseMap } from './lib/computeMap';
import { runErosionStep, DEFAULT_EROSION } from './lib/erosion';
import type { ErosionSettings } from './lib/erosion';
import type { NoiseLayer, GlobalSettings, ViewMode, ColorMode } from './types';
import './App.css';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: GlobalSettings = {
  resolution:  128,
  heightScale: 2.0,
  wireframe:   false,
  colorMode:   'terrain',
};

const INITIAL_LAYERS: NoiseLayer[] = [
  makeDefaultLayer('Base Terrain', {
    noiseType: 'perlin', scale: 2, octaves: 5,
    persistence: 0.5, lacunarity: 2, opacity: 1, blendMode: 'add',
  }),
  makeDefaultLayer('Detail', {
    noiseType: 'perlin', scale: 6, octaves: 3,
    persistence: 0.4, lacunarity: 2.2, opacity: 0.35, blendMode: 'add',
    shapingFn: 'power', shapingParam: 1.6, expanded: false,
  }),
];

const MAX_EROSION_STEPS = 60;
const EROSION_INTERVAL_MS = 900; // ms between simulation ticks

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Noise state ──────────────────────────────────────────────────
  const [layers,   setLayers]   = useState<NoiseLayer[]>(INITIAL_LAYERS);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');

  const noiseMap = useMemo(
    () => computeNoiseMap(layers, settings.resolution),
    [layers, settings.resolution]
  );

  // ── Erosion simulation state ──────────────────────────────────────
  const [erosionSettings, setErosionSettings] = useState<ErosionSettings>(DEFAULT_EROSION);
  const erosionHistRef = useRef<Float32Array[]>([]); // history (refs avoid stale closures)
  const [erosionStep,  setErosionStep]  = useState(-1);   // -1 = base noise
  const [histLen,      setHistLen]      = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const erosionSettingsRef = useRef(erosionSettings);
  erosionSettingsRef.current = erosionSettings;

  // When layers / resolution changes → reset erosion
  useEffect(() => {
    erosionHistRef.current = [];
    setErosionStep(-1);
    setHistLen(0);
    setIsPlaying(false);
  }, [noiseMap]);

  // One erosion tick
  const runTick = useCallback(() => {
    const hist = erosionHistRef.current;
    if (hist.length >= MAX_EROSION_STEPS) { setIsPlaying(false); return; }
    const source = hist.length > 0 ? hist[hist.length - 1] : noiseMap;
    const next   = runErosionStep(source, settings.resolution, erosionSettingsRef.current);
    hist.push(next);
    const newLen  = hist.length;
    setHistLen(newLen);
    setErosionStep(newLen - 1); // always jump to latest
  }, [noiseMap, settings.resolution]);

  // Play interval
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(runTick, EROSION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, runTick]);

  // Displayed map: base noise OR eroded snapshot at chosen step
  const displayMap = useMemo(() => {
    if (erosionStep >= 0 && erosionHistRef.current[erosionStep]) {
      return erosionHistRef.current[erosionStep];
    }
    return noiseMap;
  // histLen is used to re-trigger memo when history changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiseMap, erosionStep, histLen]);

  // ── Explore / fly mode ────────────────────────────────────────────
  const [exploreMode,  setExploreMode]  = useState(false);
  const [flySpeed,     setFlySpeed]     = useState(0.08);
  const [pointerLocked, setPointerLocked] = useState(false);

  // ── Global keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.code) {
        case 'Tab':
          e.preventDefault();
          setViewMode(v => v === '2d' ? '3d' : '2d');
          break;
        case 'Space':
          e.preventDefault();
          setIsPlaying(p => !p);
          break;
        case 'KeyF':
          setSettings(s => ({ ...s, wireframe: !s.wireframe }));
          break;
        case 'KeyG':
          setExploreMode(e => !e);
          break;
        case 'KeyR':
          // Reset erosion
          erosionHistRef.current = [];
          setErosionStep(-1);
          setHistLen(0);
          setIsPlaying(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Layer handlers ────────────────────────────────────────────────
  const handleLayerChange = (id: string, patch: Partial<NoiseLayer>) =>
    setLayers(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  const handleLayerAdd    = (layer: NoiseLayer) => setLayers(ls => [...ls, layer]);
  const handleLayerRemove = (id: string) => setLayers(ls => ls.filter(l => l.id !== id));
  const handleReorder     = (next: NoiseLayer[]) => setLayers(next);

  const setSetting = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) =>
    setSettings(s => ({ ...s, [key]: value }));

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="header-dot" />
          <h1 className="site-title">Noise Explorer</h1>
          <span className="header-tag">class_03</span>
        </div>

        {/* 2D / 3D toggle */}
        <div className="view-toggle" role="group" aria-label="View mode">
          <button className={`toggle-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => setViewMode('2d')}>
            2D Map
          </button>
          <button className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>
            3D Terrain
          </button>
        </div>

        {/* Explore mode toggle (3D only) */}
        {viewMode === '3d' && (
          <button
            className={`explore-btn ${exploreMode ? 'active' : ''}`}
            onClick={() => setExploreMode(e => !e)}
            title="Toggle explore mode — WASD / Arrow keys to fly through the landscape (G)"
          >
            {exploreMode ? '🧭 Explore ON' : '🧭 Explore'}
          </button>
        )}

        <span className="header-meta">Design 4197-6197 · Ella Tao</span>
      </header>

      {/* ── Main ── */}
      <main className="main">

        {/* ── Viewport ── */}
        <div className="viewport">
          {viewMode === '2d'
            ? <NoiseCanvas2D noiseMap={displayMap} resolution={settings.resolution} colorMode={settings.colorMode} />
            : <Terrain3D
                noiseMap={displayMap}
                resolution={settings.resolution}
                heightScale={settings.heightScale}
                wireframe={settings.wireframe}
                colorMode={settings.colorMode}
                exploreMode={exploreMode}
                flySpeed={flySpeed}
                onLockChange={setPointerLocked}
              />
          }

          {/* Explore mode — "click to lock" overlay (shown until pointer is locked) */}
          {viewMode === '3d' && exploreMode && !pointerLocked && (
            <div className="explore-overlay">
              <div className="explore-overlay-card">
                <p className="explore-overlay-title">🧭 Explore Mode</p>
                <p className="explore-overlay-sub">Click anywhere on the canvas to start</p>
                <div className="explore-key-grid">
                  <span className="key-badge">W</span><span>Forward</span>
                  <span className="key-badge">S</span><span>Backward</span>
                  <span className="key-badge">A</span><span>Left</span>
                  <span className="key-badge">D</span><span>Right</span>
                  <span className="key-badge">Q</span><span>Up</span>
                  <span className="key-badge">E</span><span>Down</span>
                  <span className="key-badge">Esc</span><span>Exit explore</span>
                </div>
                <p className="explore-overlay-tip">Mouse controls your view direction</p>
              </div>
            </div>
          )}

          {/* Bottom timeline (erosion) */}
          <BottomTimeline
            step={erosionStep}
            histLen={histLen}
            isPlaying={isPlaying}
            droplets={erosionSettings.dropletsPerStep}
            onPlay={()  => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onReset={() => {
              erosionHistRef.current = [];
              setErosionStep(-1);
              setHistLen(0);
              setIsPlaying(false);
            }}
            onScrub={s => { setIsPlaying(false); setErosionStep(s); }}
          />

          {/* Keyboard hint strip */}
          <div className="canvas-hint">
            {viewMode === '3d' && !exploreMode && 'Left drag · orbit  |  Scroll · zoom  |  '}
            {viewMode === '3d' &&  exploreMode && pointerLocked && 'WASD · move  |  Mouse · look  |  Esc · exit  |  '}
            Tab · 2D/3D &nbsp;·&nbsp; Space · erosion &nbsp;·&nbsp; F · wireframe &nbsp;·&nbsp; G · explore
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-inner">

            {/* 1. Erosion simulation (explainer + params only — timeline is at bottom) */}
            <section className="sidebar-section">
              <SimulationPanel
                settings={erosionSettings}
                onSettings={patch => setErosionSettings(s => ({ ...s, ...patch }))}
              />
            </section>

            {/* 2. Global terrain settings */}
            <section className="sidebar-section">
              <h3 className="section-title">Terrain Settings</h3>

              <div className="ctrl-row">
                <div className="ctrl-header">
                  <span className="ctrl-label">Resolution</span>
                  <span className="ctrl-value">{settings.resolution}²</span>
                </div>
                <p className="ctrl-hint">Higher = more detail, slower simulation.</p>
                <input type="range" className="slider" min={16} max={256} step={16}
                  value={settings.resolution}
                  onChange={e => setSetting('resolution', Number(e.target.value))} />
              </div>

              {viewMode === '3d' && (
                <div className="ctrl-row">
                  <div className="ctrl-header">
                    <span className="ctrl-label">Height Scale</span>
                    <span className="ctrl-value">{settings.heightScale.toFixed(1)}×</span>
                  </div>
                  <p className="ctrl-hint">Vertical exaggeration — like stretching the terrain upward.</p>
                  <input type="range" className="slider" min={0} max={5} step={0.1}
                    value={settings.heightScale}
                    onChange={e => setSetting('heightScale', Number(e.target.value))} />
                </div>
              )}

              {viewMode === '3d' && exploreMode && (
                <div className="ctrl-row">
                  <div className="ctrl-header">
                    <span className="ctrl-label">Fly Speed</span>
                    <span className="ctrl-value">{flySpeed.toFixed(2)}</span>
                  </div>
                  <p className="ctrl-hint">How fast WASD / Arrow keys move the camera.</p>
                  <input type="range" className="slider" min={0.01} max={0.4} step={0.01}
                    value={flySpeed}
                    onChange={e => setFlySpeed(Number(e.target.value))} />
                </div>
              )}

              <div className="ctrl-row">
                <div className="ctrl-header">
                  <span className="ctrl-label">Color Mode</span>
                </div>
                <select className="select" value={settings.colorMode}
                  onChange={e => setSetting('colorMode', e.target.value as ColorMode)}>
                  <option value="grayscale">Grayscale — raw height values</option>
                  <option value="terrain">Terrain — water → forest → snow</option>
                  <option value="heatmap">Heatmap — blue (low) → red (high)</option>
                </select>
              </div>

              {viewMode === '3d' && (
                <label className="checkbox-row">
                  <input type="checkbox" checked={settings.wireframe}
                    onChange={e => setSetting('wireframe', e.target.checked)} />
                  <span>Wireframe <span className="shortcut-badge">F</span></span>
                </label>
              )}
            </section>

            {/* 3. Noise layers */}
            <section className="sidebar-section">
              <LayerPanel
                layers={layers}
                onChange={handleLayerChange}
                onAdd={handleLayerAdd}
                onRemove={handleLayerRemove}
                onReorder={handleReorder}
              />
            </section>

          </div>
        </aside>
      </main>
    </div>
  );
}
