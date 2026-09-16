import { useState } from 'react';
import NoiseTypeSelector from './NoiseTypeSelector';
import ShapingSelector   from './ShapingSelector';
import InfoBtn           from './InfoBtn';
import type { NoiseLayer, BlendMode } from '../types';
import { BLEND_META } from '../types';

interface Props {
  layer: NoiseLayer;
  index: number;
  onChange: (id: string, patch: Partial<NoiseLayer>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

// ─── Shared slider ────────────────────────────────────────────────────────────

function Slider({
  label, hint, min, max, step = 0.01, value, unit = '', onChange,
}: {
  label: string; hint?: string;
  min: number; max: number; step?: number;
  value: number; unit?: string;
  onChange: (v: number) => void;
}) {
  const display = step < 1 ? value.toFixed(2) : String(Math.round(value));
  return (
    <div className="ctrl-row">
      <div className="ctrl-header">
        <span className="ctrl-label">{label}</span>
        <span className="ctrl-value">{display}{unit}</span>
      </div>
      {hint && <p className="ctrl-hint">{hint}</p>}
      <input
        type="range" className="slider"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ─── Blend mode chips ─────────────────────────────────────────────────────────

function BlendChips({
  value, onChange,
}: {
  value: BlendMode; onChange: (v: BlendMode) => void;
}) {
  const modes: BlendMode[] = ['add', 'multiply', 'subtract', 'max'];

  return (
    <div className="ctrl-row">
      <div className="ctrl-header">
        <span className="ctrl-label">
          Blend Mode
          <InfoBtn
            title="Blend Modes"
            text={modes.map(m => `${BLEND_META[m].label}: ${BLEND_META[m].description}`).join(' | ')}
          />
        </span>
      </div>
      <div className="blend-chips">
        {modes.map(m => (
          <button
            key={m}
            className={`blend-chip ${value === m ? 'blend-chip-active' : ''}`}
            title={BLEND_META[m].description}
            onClick={() => onChange(m)}
          >
            {BLEND_META[m].label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Layer card ───────────────────────────────────────────────────────────────

export default function LayerCard({
  layer, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof NoiseLayer>(key: K, v: NoiseLayer[K]) =>
    onChange(layer.id, { [key]: v } as Partial<NoiseLayer>);

  return (
    <div className={`layer-card ${layer.enabled ? '' : 'layer-disabled'}`}>

      {/* ── Header ── */}
      <div className="layer-header">
        <button
          className="layer-toggle"
          title={layer.enabled ? 'Disable' : 'Enable'}
          onClick={() => set('enabled', !layer.enabled)}
        >
          <span className={`dot ${layer.enabled ? 'dot-on' : 'dot-off'}`} />
        </button>

        <span className="layer-index">#{index + 1}</span>

        <input
          className="layer-name-input"
          value={layer.name}
          onChange={e => set('name', e.target.value)}
          aria-label="Layer name"
        />

        <div className="layer-actions">
          <button className="icon-btn" title="Move up"   onClick={() => onMoveUp(layer.id)}   disabled={isFirst}>↑</button>
          <button className="icon-btn" title="Move down" onClick={() => onMoveDown(layer.id)} disabled={isLast}>↓</button>
          <button className="icon-btn" title={layer.expanded ? 'Collapse' : 'Expand'} onClick={() => set('expanded', !layer.expanded)}>
            {layer.expanded ? '▲' : '▼'}
          </button>
          <button className="icon-btn remove-btn" title="Remove" onClick={() => onRemove(layer.id)}>✕</button>
        </div>
      </div>

      {/* ── Body ── */}
      {layer.expanded && (
        <div className="layer-body">

          {/* 1 ── Noise type visual selector */}
          <NoiseTypeSelector
            value={layer.noiseType}
            onChange={v => set('noiseType', v)}
          />

          {/* 2 ── Core parameters (beginner-friendly labels) */}
          <div className="ctrl-group-label">Pattern Controls</div>

          <Slider
            label="Zoom" unit="×"
            min={0.1} max={10} step={0.1} value={layer.scale}
            hint="How zoomed-in the pattern is. Low = big smooth blobs, high = tight fine detail."
            onChange={v => set('scale', v)}
          />
          <Slider
            label="Detail Levels"
            min={1} max={8} step={1} value={layer.octaves}
            hint="How many layers of detail are stacked on top of each other."
            onChange={v => set('octaves', v)}
          />
          <Slider
            label="Roughness"
            min={0.1} max={1.0} step={0.01} value={layer.persistence}
            hint="How strong each detail level is. Low = smooth; high = rough and noisy."
            onChange={v => set('persistence', v)}
          />

          {/* 3 ── Shaping visual selector */}
          <ShapingSelector
            value={layer.shapingFn}
            param={layer.shapingParam}
            onChange={v => set('shapingFn', v)}
            onParamChange={v => set('shapingParam', v)}
          />

          {/* 4 ── Blend */}
          <div className="ctrl-group-label">Layer Blend</div>
          <BlendChips value={layer.blendMode} onChange={v => set('blendMode', v)} />
          <Slider
            label="Opacity"
            min={0} max={1} step={0.01} value={layer.opacity}
            onChange={v => set('opacity', v)}
          />

          {/* 5 ── Advanced (collapsed by default) */}
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(s => !s)}
          >
            {showAdvanced ? '▲' : '▶'} Advanced
          </button>

          {showAdvanced && (
            <div className="advanced-section">
              <Slider
                label="Detail Gap"
                min={1.0} max={4.0} step={0.1} value={layer.lacunarity}
                hint="How much the frequency multiplies each level. 2.0 = each level is twice as fine."
                onChange={v => set('lacunarity', v)}
              />
              <Slider
                label="Offset X"
                min={0} max={10} step={0.1} value={layer.offsetX}
                hint="Slides the noise pattern horizontally to sample a different region."
                onChange={v => set('offsetX', v)}
              />
              <Slider
                label="Offset Y"
                min={0} max={10} step={0.1} value={layer.offsetY}
                hint="Slides the noise pattern vertically."
                onChange={v => set('offsetY', v)}
              />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
