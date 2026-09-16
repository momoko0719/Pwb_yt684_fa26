/**
 * SimulationPanel.tsx  (sidebar section)
 * ────────────────────────────────────────
 * Contains only:
 *   1. What/Why explainer (collapsible, with visual diagram)
 *   2. Workflow hint (numbered steps)
 *   3. Advanced erosion parameter sliders
 *
 * The timeline / play controls live in BottomTimeline.tsx.
 */

import { useState } from 'react';
import type { ErosionSettings } from '../lib/erosion';

function Row({
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
      <input type="range" className="slider"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

// ─── What / Why explainer ────────────────────────────────────────────────────

function ErosionExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="explainer">
      <button className="explainer-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▶'} What is Hydraulic Erosion?
      </button>
      {open && (
        <div className="explainer-body">
          <div className="explainer-diagram">
            <div className="diagram-row">
              <span className="diagram-label">Raw noise</span>
              <span className="diagram-glyphs">▄▅▆▅▄▅▆▄▅▆▅▄</span>
            </div>
            <div className="diagram-arrow">↓ rain → streams → valleys carved</div>
            <div className="diagram-row">
              <span className="diagram-label">After erosion</span>
              <span className="diagram-glyphs">▁▂▅▆▅▂▁▂▅▆▅▂</span>
            </div>
          </div>

          <p className="explainer-text">
            <strong>Rain hits terrain → forms streams → streams carve valleys.</strong>
            <br />
            Each droplet rolls downhill, picks up soil on steep slopes, and deposits it
            where the ground flattens. Over thousands of droplets, peaks erode, valleys
            deepen, and natural river channels emerge — making terrain feel geologically real.
          </p>

          <p className="explainer-text">
            <strong>Without erosion:</strong> terrain looks bumpy in every direction.<br />
            <strong>With erosion:</strong> ridges shed water, valleys collect it — exactly
            like real mountain topography seen in satellite imagery.
          </p>

          <div className="explainer-legend">
            <span>🌧️ Rain</span><span>→</span>
            <span>🏞️ Streams</span><span>→</span>
            <span>⛰️ Carved terrain</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workflow hint ───────────────────────────────────────────────────────────

function WorkflowHint() {
  return (
    <ol className="workflow-hint">
      <li><span className="wf-num">1</span> Design noise with the <strong>Layers</strong> below</li>
      <li><span className="wf-num">2</span> Press <kbd>▶</kbd> in the timeline bar to start erosion</li>
      <li><span className="wf-num">3</span> Drag the <kbd>━</kbd> scrubber to compare stages</li>
      <li><span className="wf-num">4</span> Switch to <strong>Explore</strong> mode to fly through it</li>
    </ol>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface SimPanelProps {
  settings: ErosionSettings;
  onSettings: (patch: Partial<ErosionSettings>) => void;
}

export default function SimulationPanel({ settings, onSettings }: SimPanelProps) {
  const [showParams, setShowParams] = useState(false);
  const set = (patch: Partial<ErosionSettings>) => onSettings(patch);

  return (
    <div className="sim-panel">
      <div className="sim-title-row">
        <span className="sim-title">💧 Hydraulic Erosion</span>
      </div>

      <WorkflowHint />
      <ErosionExplainer />

      <button className="advanced-toggle" onClick={() => setShowParams(s => !s)}>
        {showParams ? '▲' : '▶'} Erosion Parameters
      </button>

      {showParams && (
        <div className="advanced-section">
          <Row label="Droplets / Step" min={500} max={10000} step={500}
            value={settings.dropletsPerStep} unit=""
            hint="More droplets = more erosion per step but slower to compute."
            onChange={v => set({ dropletsPerStep: v })} />
          <Row label="Inertia" min={0} max={0.9} step={0.01}
            value={settings.inertia}
            hint="How straight water flows. 0 = instant turns, 0.9 = straight rivers."
            onChange={v => set({ inertia: v })} />
          <Row label="Erosion Rate" min={0.01} max={0.9} step={0.01}
            value={settings.erosionRate}
            hint="How aggressively peaks are worn down per step."
            onChange={v => set({ erosionRate: v })} />
          <Row label="Deposit Rate" min={0.01} max={0.9} step={0.01}
            value={settings.depositionRate}
            hint="How fast sediment settles in valleys and plains."
            onChange={v => set({ depositionRate: v })} />
          <Row label="Evaporation" min={0.001} max={0.2} step={0.001}
            value={settings.evaporation}
            hint="How quickly droplets dry up. Higher = shorter stream paths."
            onChange={v => set({ evaporation: v })} />
          <Row label="Gravity" min={1} max={20} step={0.5}
            value={settings.gravity} unit="×"
            hint="How fast droplets accelerate on steep slopes."
            onChange={v => set({ gravity: v })} />
        </div>
      )}
    </div>
  );
}
