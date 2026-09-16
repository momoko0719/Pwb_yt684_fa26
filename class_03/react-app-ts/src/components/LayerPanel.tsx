import { v4 as uuid } from 'uuid';
import LayerCard from './LayerCard';
import type { NoiseLayer } from '../types';

interface Props {
  layers: NoiseLayer[];
  onChange: (id: string, patch: Partial<NoiseLayer>) => void;
  onAdd: (layer: NoiseLayer) => void;
  onRemove: (id: string) => void;
  onReorder: (layers: NoiseLayer[]) => void;
}

export function makeDefaultLayer(name = 'Layer', overrides?: Partial<NoiseLayer>): NoiseLayer {
  return {
    id:           uuid(),
    name,
    enabled:      true,
    expanded:     true,
    noiseType:    'perlin',
    scale:        2.0,
    octaves:      4,
    persistence:  0.5,
    lacunarity:   2.0,
    offsetX:      0,
    offsetY:      0,
    opacity:      1.0,
    blendMode:    'add',
    shapingFn:    'linear',
    shapingParam: 2.0,
    ...overrides,
  };
}

function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

export default function LayerPanel({ layers, onChange, onAdd, onRemove, onReorder }: Props) {
  const handleMoveUp = (id: string) => {
    const i = layers.findIndex(l => l.id === id);
    onReorder(moveItem(layers, i, -1));
  };
  const handleMoveDown = (id: string) => {
    const i = layers.findIndex(l => l.id === id);
    onReorder(moveItem(layers, i, 1));
  };

  return (
    <div className="layer-panel">
      <div className="panel-title-row">
        <span className="panel-title">Layers</span>
        <button
          className="add-layer-btn"
          onClick={() => onAdd(makeDefaultLayer(`Layer ${layers.length + 1}`))}
        >
          + Add Layer
        </button>
      </div>

      {layers.length === 0 && (
        <p className="empty-hint">No layers yet. Add one to start.</p>
      )}

      <div className="layer-list">
        {layers.map((layer, i) => (
          <LayerCard
            key={layer.id}
            layer={layer}
            index={i}
            onChange={onChange}
            onRemove={onRemove}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            isFirst={i === 0}
            isLast={i === layers.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
