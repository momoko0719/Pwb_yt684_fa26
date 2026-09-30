import { useRef, type PointerEvent } from 'react';
import { Components, createPlugin, useInputContext } from 'leva/plugin';
import { UI } from '../core/palette';

const { Row, Label } = Components;

interface SunArcInput {
  /** Named `hour`, not `value`: leva keeps only `.value` and would drop `describe`. */
  hour: number;
  /** Name shown next to the clock, e.g. the nearest time of day. */
  describe: (hour: number) => string;
}
type SunArcSettings = Pick<SunArcInput, 'describe'>;

// The sun travels an ellipse: dawn at the left horizon, noon at the top, dusk at the right, night below.
const W = 260;
const H = 96;
const CX = W / 2;
const CY = 50;
const RX = 112;
const RY = 38;

const angleOf = (hour: number) => (Math.PI * (hour - 6)) / 12;
const pointOf = (hour: number): [number, number] => [CX - RX * Math.cos(angleOf(hour)), CY - RY * Math.sin(angleOf(hour))];
const wrap = (hour: number) => ((hour % 24) + 24) % 24;

function arcPath(from: number, to: number) {
  const steps = 32;
  return Array.from({ length: steps + 1 }, (_, i) => pointOf(from + ((to - from) * i) / steps))
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('');
}

function SunArc() {
  const { label, value, onUpdate, settings } = useInputContext<{ value: number; settings: SunArcSettings; onUpdate: (v: number) => void }>();
  const svg = useRef<SVGSVGElement>(null);

  const drag = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'pointermove' && !(e.buttons & 1)) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const box = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;
    const angle = Math.atan2((CY - py) / RY, (CX - px) / RX);
    onUpdate(Math.round(wrap(6 + (angle * 12) / Math.PI) * 4) / 4);
  };

  const [sx, sy] = pointOf(value);
  const minutes = Math.round((value % 1) * 60).toString().padStart(2, '0');
  return (
    <Row>
      <Label>{label}</Label>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={drag} onPointerMove={drag}>
        <line x1={0} x2={W} y1={CY} y2={CY} stroke={UI.line} />
        <path d={arcPath(6, 18)} fill="none" stroke={UI.textDim} />
        <path d={arcPath(18, 30)} fill="none" stroke={UI.line} strokeDasharray="3 4" />
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = pointOf(h);
          return <circle key={h} cx={x} cy={y} r={2} fill={UI.textDim} />;
        })}
        <text x={CX} y={CY - 8} textAnchor="middle" fill={UI.text} fontSize={12}>
          {`${Math.floor(value)}:${minutes} · ${settings.describe(value)}`}
        </text>
        <circle cx={sx} cy={sy} r={7} fill={value >= 6 && value <= 18 ? UI.accent : UI.bg} stroke={UI.accent} />
      </svg>
    </Row>
  );
}

/** Continuous time of day as a draggable sun on its arc. */
export const sunArc = createPlugin<SunArcInput, number, SunArcSettings>({
  component: SunArc,
  normalize: ({ hour, describe }) => ({ value: hour, settings: { describe } }),
  sanitize: (v: number) => wrap(Number(v)),
});
