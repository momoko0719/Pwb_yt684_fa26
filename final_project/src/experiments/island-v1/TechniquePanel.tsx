import { useEffect, useMemo, useRef, useState } from 'react';
import { islandStages, SLOPE_CLASS, type Stage } from '../../core/generators/islandStages';
import { getPalette, UI, type WorldPalette } from '../../core/palette';
import type { IslandPreset } from '../../core/params/scene';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import type { ExperimentMeta } from '../registry';
import meta from './meta.json';

const TECHNIQUES = (meta as ExperimentMeta).techniqueMap ?? [];
const MAP_SIZE = 96;

/** Toggle button plus a side panel walking through each generator step with its live 2D map. */
export default function TechniquePanel({ island, surface, scene }: IslandPreset) {
  const { t } = useLanguage();
  const k = (key: string) => t(key as StringKey);
  const [open, setOpen] = useState(false);
  const stages = useMemo(
    () => (open ? islandStages(island, surface.meadowLine, MAP_SIZE) : []),
    [open, island, surface.meadowLine],
  );
  const palette = getPalette(scene.theme, scene.hour);

  return (
    <>
      <button type="button" className="technique-toggle" onClick={() => setOpen(!open)}>
        {k(open ? 'technique.close' : 'technique.open')}
      </button>
      {open && (
        <aside className="technique-panel">
          <p className="dim">{k('technique.intro')}</p>
          {TECHNIQUES.map((entry, i) => {
            const maps = (entry.stages ?? []).map((id) => stages.find((s) => s.id === id)).filter((s) => s !== undefined);
            return (
              <section key={entry.id} className="technique-card">
                <header>
                  <span className="technique-step">{i + 1}</span>
                  <h3>{k(`tech.${entry.id}.title`)}</h3>
                  <span className="technique-source">{k(`technique.${entry.derived ? 'derived' : 'source'}.${entry.source}`)}</span>
                </header>
                {maps.length === 1 && <StageMap stage={maps[0]} palette={palette} />}
                {maps.length > 1 && (
                  <div className="technique-maps">
                    {maps.map((stage) => (
                      <figure key={stage.id}>
                        <StageMap stage={stage} palette={palette} />
                        <figcaption>{k(`technique.stage.${stage.id}`)}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {(['what', 'where', 'how'] as const).map((part) => (
                  <p key={part}>
                    <span className="technique-label">{k(`technique.${part}`)}</span> {k(`tech.${entry.id}.${part}`)}
                  </p>
                ))}
                {entry.params.length > 0 && (
                  <p className="dim">{k('technique.params')}: {entry.params.map((p) => k(`leva.${p}`)).join(' · ')}</p>
                )}
              </section>
            );
          })}
        </aside>
      )}
    </>
  );
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Grayscale from ink to paper; the slope map uses the terrain's own meadow and rock colors. */
function StageMap({ stage, palette }: { stage: Stage; palette: WorldPalette }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(stage.size, stage.size);
    const ink = rgb(UI.bg);
    const paper = rgb(UI.text);
    const classes = new Map<number, number[]>([
      [SLOPE_CLASS.meadow, rgb(palette.meadow)],
      [SLOPE_CLASS.rock, rgb(palette.rock)],
      [SLOPE_CLASS.face, rgb(palette.rockFace)],
    ]);
    stage.values.forEach((v, i) => {
      if (Number.isNaN(v)) return;
      const c = stage.id === 'slope'
        ? classes.get(v)!
        : ink.map((a, j) => a + (paper[j] - a) * Math.min(Math.max(v, 0), 1));
      image.data.set([...c, 255], i * 4);
    });
    ctx.putImageData(image, 0, 0);
  }, [stage, palette]);
  return <canvas ref={canvas} width={stage.size} height={stage.size} />;
}
