/**
 * ShapingSelector
 * Row of clickable tiles — each shows an SVG preview of the transfer
 * curve (input 0→1 on X, output 0→1 on Y) plus a short label and info button.
 */
import type { ShapingFn } from '../types';
import { SHAPING_META } from '../types';
import { applyShaping } from '../lib/shaping';
import InfoBtn from './InfoBtn';

const SHAPING_ORDER: ShapingFn[] = [
  'linear', 'smoothstep', 'power', 'abs', 'billow', 'ridged', 'terrace',
];

const CURVE_SIZE = 38;
const POINTS = 32;

/** Build an SVG polyline `points` string for a given shaping function. */
function buildPoints(fn: ShapingFn, param: number): string {
  return Array.from({ length: POINTS }, (_, i) => {
    const t  = i / (POINTS - 1);
    const y  = applyShaping(t, fn, param);
    const px = (t * CURVE_SIZE).toFixed(1);
    const py = ((1 - y) * CURVE_SIZE).toFixed(1);
    return `${px},${py}`;
  }).join(' ');
}

function ShapingTile({
  fn, param, selected, onSelect,
}: {
  fn: ShapingFn; param: number; selected: boolean; onSelect: () => void;
}) {

  return (
    <div className={`shaping-tile ${selected ? 'shaping-tile-selected' : ''}`} onClick={onSelect}>
      <svg
        width={CURVE_SIZE}
        height={CURVE_SIZE}
        viewBox={`0 0 ${CURVE_SIZE} ${CURVE_SIZE}`}
        className="shaping-curve"
        aria-hidden="true"
      >
        {/* Grid lines */}
        <line x1="0" y1={CURVE_SIZE / 2} x2={CURVE_SIZE} y2={CURVE_SIZE / 2} stroke="var(--border)" strokeWidth="0.5" />
        <line x1={CURVE_SIZE / 2} y1="0" x2={CURVE_SIZE / 2} y2={CURVE_SIZE} stroke="var(--border)" strokeWidth="0.5" />
        {/* Diagonal reference */}
        <line x1="0" y1={CURVE_SIZE} x2={CURVE_SIZE} y2="0" stroke="var(--text-dim)" strokeWidth="0.5" strokeDasharray="2 2" />
        {/* Transfer curve */}
        <polyline
          points={buildPoints(fn, param)}
          fill="none"
          stroke={selected ? 'var(--accent)' : 'var(--text)'}
          strokeWidth={selected ? '2' : '1.5'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="shaping-tile-footer">
        <span className="shaping-tile-label">{SHAPING_META[fn].label}</span>
        <span onClick={e => e.stopPropagation()}>
          <InfoBtn title={SHAPING_META[fn].label} text={SHAPING_META[fn].description} />
        </span>
      </div>
    </div>
  );
}

interface Props {
  value: ShapingFn;
  param: number;
  onChange: (fn: ShapingFn) => void;
  onParamChange: (v: number) => void;
}

export default function ShapingSelector({ value, param, onChange, onParamChange }: Props) {
  return (
    <div className="shaping-selector">
      <span className="selector-label">Output Shape</span>
      <div className="shaping-tile-row">
        {SHAPING_ORDER.map(fn => (
          <ShapingTile
            key={fn}
            fn={fn}
            param={param}
            selected={value === fn}
            onSelect={() => onChange(fn)}
          />
        ))}
      </div>

      {/* Param slider only visible for power and terrace */}
      {(value === 'power' || value === 'terrace') && (
        <div className="ctrl-row" style={{ marginTop: 8 }}>
          <div className="ctrl-header">
            <span className="ctrl-label">
              {value === 'power' ? 'Exponent' : 'Steps'}
            </span>
            <span className="ctrl-value">
              {value === 'power' ? param.toFixed(1) : Math.round(param)}
            </span>
          </div>
          <input
            type="range" className="slider"
            min={value === 'power' ? 0.1 : 1}
            max={value === 'power' ? 6 : 10}
            step={value === 'power' ? 0.1 : 1}
            value={param}
            onChange={e => onParamChange(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}
