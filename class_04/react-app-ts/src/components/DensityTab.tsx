import { useMemo } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import InfoTip from './InfoTip';
import VoxelViewport from './VoxelViewport';
import { sampleDensity, SHAPE_ORDER, type DensityShape } from '../lib/density';
import { createVolume } from '../lib/volume';
import { meshCulled } from '../lib/meshCulled';
import { useStudioConfig } from '../studio/StudioConfigContext';

export default function DensityTab() {
  const { t, showJargon } = useI18n();
  const d = t.density;
  const { config, patch } = useStudioConfig();
  const { shape, params, resolution, threshold, wireframe } = config.density;

  const setDensity = (partial: Partial<typeof config.density>) => {
    patch({ density: { ...config.density, ...partial } });
  };

  const mesh = useMemo(() => {
    const vol = createVolume(resolution, (x, y, z) => sampleDensity(shape, x, y, z, params));
    return meshCulled(vol, resolution, threshold);
  }, [shape, params, resolution, threshold]);

  const meta = d.shapes[shape];

  return (
    <div className="tab-layout">
      <aside className="side-panel">
        <p className="station-eyebrow">Station 1</p>
        <h2 className="panel-title">{d.title}</h2>
        {showJargon && <p className="jargon-line">{t.shared.jargonTag}: {d.jargon}</p>}
        <p className="panel-hint">{d.hint}</p>
        <p className="try-this">{d.tryThis}</p>

        <div className="shape-grid">
          {SHAPE_ORDER.map(key => {
            const m = d.shapes[key];
            return (
              <button
                key={key}
                type="button"
                className={`shape-tile ${shape === key ? 'active' : ''}`}
                onClick={() => setDensity({ shape: key as DensityShape })}
              >
                <span className="shape-label">{m.label}</span>
                <span className="shape-gives">{m.gives}</span>
                {showJargon && <span className="shape-jargon">{m.jargon}</span>}
                <span className="shape-info" onClick={e => e.stopPropagation()}>
                  <InfoTip title={m.label} text={`${m.desc}${showJargon ? ` (${m.jargon})` : ''}`} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="param-block">
          <h3 className="param-heading">{d.params}</h3>
          <label className="slider-row">
            <span>{d.resolution} <strong>{resolution}³</strong></span>
            <input type="range" min={16} max={40} step={2} value={resolution}
              onChange={e => setDensity({ resolution: Number(e.target.value) })} />
          </label>
          <label className="slider-row">
            <span>{d.threshold} <strong>{threshold.toFixed(2)}</strong></span>
            <input type="range" min={-0.4} max={0.4} step={0.02} value={threshold}
              onChange={e => setDensity({ threshold: Number(e.target.value) })} />
          </label>
          <label className="slider-row">
            <span>{d.scale} <strong>{params.scale.toFixed(1)}</strong></span>
            <input type="range" min={0.8} max={5} step={0.1} value={params.scale}
              onChange={e => setDensity({ params: { ...params, scale: Number(e.target.value) } })} />
          </label>
          <label className="slider-row">
            <span>{d.height} <strong>{params.height.toFixed(2)}</strong></span>
            <input type="range" min={0.1} max={0.7} step={0.02} value={params.height}
              onChange={e => setDensity({ params: { ...params, height: Number(e.target.value) } })} />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={wireframe}
              onChange={e => setDensity({ wireframe: e.target.checked })} />
            {t.shared.wireframe}
          </label>
        </div>

        <div className="callout">
          <strong>{meta.label}</strong>
          <p>{meta.desc}</p>
          <p className="callout-apply"><em>{t.shared.apply}:</em> {meta.gives}</p>
          {showJargon && <p className="jargon-line">{t.shared.jargonTag}: {meta.jargon}</p>}
        </div>
      </aside>

      <div className="viewport-wrap">
        <VoxelViewport mesh={mesh} wireframe={wireframe} color="#b08968" />
        <div className="viewport-hint">{t.shared.dragOrbit}</div>
      </div>
    </div>
  );
}
