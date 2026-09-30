import { Components, createPlugin, useInputContext } from 'leva/plugin';
import { UI } from '../core/palette';

const { Row, Label } = Components;

type Points = [number, number][];

interface CurveInput {
  /** Named `current`, not `value`: leva keeps only `.value` and would drop the range and the curve. */
  current: number;
  min: number;
  max: number;
  step: number;
  /** The curve this value produces, as points in 0..1 with y up. */
  shape: (value: number) => Points;
}
type CurveSettings = Omit<CurveInput, 'current'>;

const W = 160;
const H = 44;

function Curve() {
  const { label, value, onUpdate, settings } = useInputContext<{ value: number; settings: CurveSettings; onUpdate: (v: number) => void }>();
  const { min, max, step, shape } = settings;
  const path = shape(value)
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W).toFixed(1)},${((1 - y) * (H - 4) + 2).toFixed(1)}`)
    .join('');
  return (
    <Row input>
      <Label>{label}</Label>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke={UI.line} />
          <path d={path} fill="none" stroke={UI.accent} strokeWidth={1.5} />
        </svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onUpdate(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: UI.accent }} />
          <span style={{ color: UI.text, fontSize: 11, minWidth: 28, textAlign: 'right' }}>{value}</span>
        </div>
      </div>
    </Row>
  );
}

/** A number slider with a live plot of the curve it controls. */
export const curve = createPlugin<CurveInput, number, CurveSettings>({
  component: Curve,
  normalize: ({ current, ...settings }) => ({ value: current, settings }),
  sanitize: (v: number, { min, max, step }: CurveSettings) =>
    Math.min(max, Math.max(min, Math.round(Number(v) / step) * step)),
});
