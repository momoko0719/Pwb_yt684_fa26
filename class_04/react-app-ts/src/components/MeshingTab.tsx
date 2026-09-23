import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import InfoTip from './InfoTip';
import VoxelViewport from './VoxelViewport';
import { sampleDensity, DEFAULT_DENSITY } from '../lib/density';
import { createVolume } from '../lib/volume';
import { meshCulled } from '../lib/meshCulled';
import { meshMarchingCubes } from '../lib/meshMarchingCubes';
import { useStudioConfig } from '../studio/StudioConfigContext';
import type { MeshMethod } from '../lib/studioConfig';

export default function MeshingTab() {
  const { t, showJargon } = useI18n();
  const m = t.meshing;
  const { config, patch } = useStudioConfig();
  const { method, resolution, wireframe } = config.meshing;
  const [showCompare, setShowCompare] = useState(false);

  const setMeshing = (partial: Partial<typeof config.meshing>) => {
    patch({ meshing: { ...config.meshing, ...partial } });
  };

  const { mesh, ms } = useMemo(() => {
    const t0 = performance.now();
    const vol = createVolume(resolution, (x, y, z) =>
      sampleDensity('islands', x, y, z, { ...DEFAULT_DENSITY, scale: 2.4, islandBand: 0.42 }),
    );
    const mesh = method === 'culled'
      ? meshCulled(vol, resolution, 0)
      : meshMarchingCubes(vol, resolution, 0);
    return { mesh, ms: performance.now() - t0 };
  }, [method, resolution]);

  const meta = m.methods[method];

  return (
    <div className="tab-layout">
      <aside className="side-panel">
        <p className="station-eyebrow">Station 3</p>
        <h2 className="panel-title">{m.title}</h2>
        {showJargon && <p className="jargon-line">{t.shared.jargonTag}: {m.jargon}</p>}
        <p className="panel-hint">{m.hint}</p>
        <p className="try-this">{m.tryThis}</p>

        <div className="field-group">
          <span className="field-label">{m.method}</span>
          <div className="method-toggle">
            {(['culled', 'marching'] as MeshMethod[]).map(key => (
              <button
                key={key}
                type="button"
                className={`method-btn ${method === key ? 'active' : ''}`}
                onClick={() => setMeshing({ method: key })}
              >
                <span>{m.methods[key].label}</span>
                {showJargon && <small>{m.methods[key].jargon}</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat">
            <span className="stat-label">{m.faceCount}</span>
            <span className="stat-value">{mesh.triangleCount.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{m.timeMs}</span>
            <span className="stat-value">{ms.toFixed(1)} ms</span>
          </div>
        </div>

        <div className="callout">
          <strong>{meta.label}</strong>
          <p>{meta.why}</p>
          {showJargon && <p className="jargon-line">{t.shared.jargonTag}: {meta.jargon}</p>}
        </div>

        <label className="slider-row">
          <span>Grid <strong>{resolution}³</strong></span>
          <input type="range" min={16} max={36} step={2} value={resolution}
            onChange={e => setMeshing({ resolution: Number(e.target.value) })} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={wireframe}
            onChange={e => setMeshing({ wireframe: e.target.checked })} />
          {t.shared.wireframe}
        </label>

        <button type="button" className="linkish" onClick={() => setShowCompare(s => !s)}>
          {showCompare ? '▾' : '▸'} {m.compareTitle}
        </button>
        {showCompare && (
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Method</th><th>Look</th><th>Faces</th><th>Sharp</th><th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {m.compare.map(row => (
                  <tr key={row.method}>
                    <td>
                      {row.method}
                      <InfoTip text={row.note} title={row.method} />
                    </td>
                    <td>{row.look}</td>
                    <td>{row.faces}</td>
                    <td>{row.sharp}</td>
                    <td>{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </aside>

      <div className="viewport-wrap">
        <VoxelViewport
          mesh={mesh}
          wireframe={wireframe}
          color={method === 'culled' ? '#9a7b5a' : '#c4a484'}
        />
        <div className="viewport-hint">{t.shared.dragOrbit}</div>
      </div>
    </div>
  );
}
