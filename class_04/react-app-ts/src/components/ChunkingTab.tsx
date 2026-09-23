import { useMemo } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import InfoTip from './InfoTip';
import { useStudioConfig } from '../studio/StudioConfigContext';

export default function ChunkingTab() {
  const { t, showJargon } = useI18n();
  const c = t.chunking;
  const { config, patch } = useStudioConfig();
  const { worldEdge, chunkEdge, radius } = config.chunking;

  const setChunk = (partial: Partial<typeof config.chunking>) => {
    patch({ chunking: { ...config.chunking, ...partial } });
  };

  const stats = useMemo(() => {
    const total = worldEdge ** 3;
    const side = 2 * radius + 1;
    const loadedChunks = side * side * side;
    const loadedVoxels = loadedChunks * (chunkEdge ** 3);
    const chunksAlong = Math.max(1, Math.ceil(worldEdge / chunkEdge));
    return { total, loadedChunks, loadedVoxels, chunksAlong };
  }, [worldEdge, chunkEdge, radius]);

  const ratio = stats.total > 0 ? (stats.loadedVoxels / stats.total) * 100 : 0;

  return (
    <div className="tab-layout chunking-layout">
      <aside className="side-panel">
        <p className="station-eyebrow">Station 4</p>
        <h2 className="panel-title">{c.title}</h2>
        {showJargon && <p className="jargon-line">{t.shared.jargonTag}: {c.jargon}</p>}
        <p className="panel-hint">{c.hint}</p>
        <p className="try-this">{c.tryThis}</p>

        <label className="slider-row">
          <span>{c.worldSize} <strong>{worldEdge}</strong></span>
          <input type="range" min={64} max={512} step={32} value={worldEdge}
            onChange={e => setChunk({ worldEdge: Number(e.target.value) })} />
        </label>
        <label className="slider-row">
          <span>{c.chunkSize} <strong>{chunkEdge}</strong></span>
          <input type="range" min={8} max={64} step={8} value={chunkEdge}
            onChange={e => setChunk({ chunkEdge: Number(e.target.value) })} />
        </label>
        <label className="slider-row">
          <span>View radius <strong>{radius}</strong></span>
          <input type="range" min={1} max={4} step={1} value={radius}
            onChange={e => setChunk({ radius: Number(e.target.value) })} />
        </label>

        <div className="cost-cards">
          <div className="cost-card bad">
            <span className="cost-label">{c.without}</span>
            <span className="cost-big">{stats.total.toLocaleString()}</span>
            <span className="cost-unit">{c.voxels}</span>
          </div>
          <div className="cost-card good">
            <span className="cost-label">{c.with}</span>
            <span className="cost-big">{stats.loadedVoxels.toLocaleString()}</span>
            <span className="cost-unit">
              {c.loaded}: {stats.loadedChunks} · {ratio.toFixed(1)}%
            </span>
          </div>
        </div>

        <ul className="explain-list">
          {c.explain.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        <h3 className="param-heading">
          {c.cavesTitle}
          <InfoTip text="Easy methods answer “clay or air?” at one point. Harder ones follow paths or ask neighbors." />
        </h3>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Method</th><th>Look</th><th>Easy?</th><th>Cost</th><th>Control</th>
              </tr>
            </thead>
            <tbody>
              {c.caves.map(row => (
                <tr key={row.method}>
                  <td>{row.method}</td>
                  <td>{row.look}</td>
                  <td>{row.eval}</td>
                  <td>{row.cost}</td>
                  <td>{row.control}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>

      <div className="chunk-viz">
        <ChunkGrid
          chunksAlong={Math.min(stats.chunksAlong, 16)}
          radius={radius}
          chunkEdge={chunkEdge}
        />
        <p className="chunk-viz-caption">
          Grid = kiln tiles · Glow = firing near you · World ≈ {stats.chunksAlong}×{stats.chunksAlong} tiles
        </p>
      </div>
    </div>
  );
}

function ChunkGrid({
  chunksAlong, radius, chunkEdge,
}: {
  chunksAlong: number; radius: number; chunkEdge: number;
}) {
  const n = Math.min(chunksAlong, 12);
  const center = Math.floor(n / 2);
  const cells = [];
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const dx = Math.abs(x - center);
      const dz = Math.abs(z - center);
      const loaded = Math.max(dx, dz) <= radius;
      const isPlayer = x === center && z === center;
      cells.push(
        <div
          key={`${x}-${z}`}
          className={`chunk-cell ${loaded ? 'loaded' : ''} ${isPlayer ? 'player' : ''}`}
          title={isPlayer ? 'You' : loaded ? 'Firing' : 'Cold'}
        />,
      );
    }
  }
  return (
    <div className="chunk-stage">
      <div className="chunk-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {cells}
      </div>
      <div className="chunk-legend">
        <span><i className="lg player" /> You</span>
        <span><i className="lg loaded" /> Firing ({chunkEdge}³)</span>
        <span><i className="lg" /> Cold</span>
      </div>
    </div>
  );
}
