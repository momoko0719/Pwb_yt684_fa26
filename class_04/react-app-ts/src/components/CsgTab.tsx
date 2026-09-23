import { useMemo } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import InfoTip from './InfoTip';
import VoxelViewport from './VoxelViewport';
import {
  evalPrimitive, combineSDF,
  type PrimitiveKind, type CsgOp,
} from '../lib/sdf';
import { createVolume } from '../lib/volume';
import { meshMarchingCubes } from '../lib/meshMarchingCubes';
import { useStudioConfig } from '../studio/StudioConfigContext';

const OPS: CsgOp[] = ['union', 'intersect', 'subtract', 'smoothUnion', 'shell'];
const PRIMS: PrimitiveKind[] = ['sphere', 'box', 'torus', 'cylinder'];

export default function CsgTab() {
  const { t, showJargon } = useI18n();
  const c = t.csg;
  const { config, patch } = useStudioConfig();
  const { shapeA: a, shapeB: b, op, smoothK, thickness, wireframe } = config.csg;
  const resolution = 36;

  const setCsg = (partial: Partial<typeof config.csg>) => {
    patch({ csg: { ...config.csg, ...partial } });
  };

  const mesh = useMemo(() => {
    const vol = createVolume(resolution, (x, y, z) => {
      const pa = { x: x + 0.22, y, z };
      const pb = { x: x - 0.22, y: y + 0.08, z: z + 0.05 };
      const da = evalPrimitive(a, pa);
      const db = evalPrimitive(b, pb);
      return -combineSDF(da, db, op, smoothK, thickness);
    });
    return meshMarchingCubes(vol, resolution, 0);
  }, [a, b, op, smoothK, thickness]);

  const opMeta = c.ops[op];

  return (
    <div className="tab-layout">
      <aside className="side-panel">
        <p className="station-eyebrow">Station 2</p>
        <h2 className="panel-title">{c.title}</h2>
        {showJargon && <p className="jargon-line">{t.shared.jargonTag}: {c.jargon}</p>}
        <p className="panel-hint">{c.hint}</p>
        <p className="try-this">{c.tryThis}</p>

        <div className="field-group">
          <span className="field-label">{c.shapeA}</span>
          <div className="chip-row">
            {PRIMS.map(p => (
              <button key={p} type="button" className={`chip ${a === p ? 'active' : ''}`}
                onClick={() => setCsg({ shapeA: p })}>{c.primitives[p]}</button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <span className="field-label">{c.shapeB}</span>
          <div className="chip-row">
            {PRIMS.map(p => (
              <button key={p} type="button" className={`chip ${b === p ? 'active' : ''}`}
                onClick={() => setCsg({ shapeB: p })}>{c.primitives[p]}</button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <span className="field-label">
            {c.operation}
            <InfoTip title={opMeta.label} text={`${opMeta.use}${showJargon ? ` · ${opMeta.jargon} · ${opMeta.formula}` : ''}`} />
          </span>
          <div className="op-list">
            {OPS.map(key => {
              const m = c.ops[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`op-card ${op === key ? 'active' : ''}`}
                  onClick={() => setCsg({ op: key })}
                >
                  <span className="op-name">{m.label}</span>
                  {showJargon && <code className="op-formula">{m.jargon} · {m.formula}</code>}
                  <span className="op-use">{m.use}</span>
                </button>
              );
            })}
          </div>
        </div>

        {op === 'smoothUnion' && (
          <label className="slider-row">
            <span>{c.smoothK} <strong>{smoothK.toFixed(2)}</strong></span>
            <input type="range" min={0.05} max={0.6} step={0.01} value={smoothK}
              onChange={e => setCsg({ smoothK: Number(e.target.value) })} />
          </label>
        )}
        {op === 'shell' && (
          <label className="slider-row">
            <span>{c.thickness} <strong>{thickness.toFixed(2)}</strong></span>
            <input type="range" min={0.03} max={0.25} step={0.01} value={thickness}
              onChange={e => setCsg({ thickness: Number(e.target.value) })} />
          </label>
        )}

        <label className="check-row">
          <input type="checkbox" checked={wireframe}
            onChange={e => setCsg({ wireframe: e.target.checked })} />
          {t.shared.wireframe}
        </label>

        <div className="callout">
          <strong>{opMeta.label}</strong>
          <p>{opMeta.use}</p>
          {showJargon && (
            <p className="jargon-line">{t.shared.jargonTag}: {opMeta.jargon} · <code>{opMeta.formula}</code></p>
          )}
        </div>
      </aside>

      <div className="viewport-wrap">
        <VoxelViewport mesh={mesh} wireframe={wireframe} color="#a67c52" cameraPos={[2.2, 1.5, 2.6]} />
        <div className="viewport-hint">{t.shared.dragOrbit}</div>
      </div>
    </div>
  );
}
