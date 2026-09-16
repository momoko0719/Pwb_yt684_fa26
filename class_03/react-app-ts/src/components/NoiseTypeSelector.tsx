/**
 * NoiseTypeSelector
 * Visual 2×2 grid — each tile shows a live mini canvas preview of
 * the noise pattern, its name, and an info button.
 */
import { useEffect, useRef } from 'react';
import type { NoiseType } from '../types';
import { NOISE_META } from '../types';
import { createNoiseFunctions, fbm } from '../lib/noise';
import InfoBtn from './InfoBtn';

const fns = createNoiseFunctions(42);

// Fixed preview parameters per type — chosen to look representative
const PREVIEW_FN: Record<NoiseType, (x: number, y: number) => number> = {
  perlin:   (x, y) => fbm(x * 2.5, y * 2.5, fns.perlin,   4, 0.5, 2.0),
  value:    (x, y) => fbm(x * 2.5, y * 2.5, fns.value,    3, 0.6, 2.0),
  worley:   (x, y) => fns.worley(x * 4, y * 4),
  cellular: (x, y) => fns.cellular(x * 5, y * 5),
};

const NOISE_ORDER: NoiseType[] = ['perlin', 'value', 'worley', 'cellular'];
const PREVIEW_SIZE = 52;

function NoiseTile({
  type, selected, onSelect,
}: {
  type: NoiseType; selected: boolean; onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render preview once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;

    const imgData = ctx.createImageData(PREVIEW_SIZE, PREVIEW_SIZE);
    const fn = PREVIEW_FN[type];

    for (let yi = 0; yi < PREVIEW_SIZE; yi++) {
      for (let xi = 0; xi < PREVIEW_SIZE; xi++) {
        const raw = fn(xi / PREVIEW_SIZE, yi / PREVIEW_SIZE);
        const g   = Math.round(Math.max(0, Math.min(1, (raw + 1) / 2)) * 255);
        const i   = (yi * PREVIEW_SIZE + xi) * 4;
        imgData.data[i] = g; imgData.data[i + 1] = g;
        imgData.data[i + 2] = g; imgData.data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [type]);

  return (
    <div className={`noise-tile ${selected ? 'noise-tile-selected' : ''}`} onClick={onSelect}>
      <canvas
        ref={canvasRef}
        className="noise-tile-canvas"
        aria-hidden="true"
      />
      <div className="noise-tile-footer">
        <span className="noise-tile-label">{NOISE_META[type].label}</span>
        <span onClick={e => e.stopPropagation()}>
          <InfoBtn title={NOISE_META[type].label} text={NOISE_META[type].description} />
        </span>
      </div>
    </div>
  );
}

interface Props {
  value: NoiseType;
  onChange: (v: NoiseType) => void;
}

export default function NoiseTypeSelector({ value, onChange }: Props) {
  return (
    <div className="noise-type-selector">
      <span className="selector-label">Noise Type</span>
      <div className="noise-tile-grid">
        {NOISE_ORDER.map(type => (
          <NoiseTile
            key={type}
            type={type}
            selected={value === type}
            onSelect={() => onChange(type)}
          />
        ))}
      </div>
    </div>
  );
}
