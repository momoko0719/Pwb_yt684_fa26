import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DataTexture, RGBAFormat } from 'three';
import { getPalette, JADE_UI, PORCELAIN } from '../../core/palette';
import { PERSON_HEIGHT } from '../../core/scale';
import { applyPalette, createWorldUniforms, setSunDirection } from '../../core/shaders/uniforms';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { type PlantKind, type PlantKnobs, type PlantModel } from './plantModels';

export { PLANT_COLOURS } from './plantModels';

/** Bound sampler so grass/flower shaders never sample a null wind texture in atlas WebGL. */
const PREVIEW_WIND = (() => {
  const t = new DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

/** World uniforms for an atlas preview: a high, even sun so the plant's own colours read. */
export function previewUniforms() {
  const uniforms = createWorldUniforms();
  applyPalette(uniforms, getPalette('qinglv', 14));
  setSunDirection(uniforms, 0.6, 55); // azimuth rad, elevation deg
  uniforms.uAccent.value.set(PORCELAIN.coverFlower);
  uniforms.uRimColor.value.set(PORCELAIN.coverFlowerRim);
  uniforms.uMeadow.value.set(PORCELAIN.cover);
  uniforms.uWindField.value = PREVIEW_WIND;
  uniforms.uWindHalf.value = 0; // windAt falls back to WIND_DIR (no field sample)
  uniforms.uWind.value = 0.15;
  return uniforms;
}

/**
 * Every plant's atlas card, laid out as the creature's and the den's: the plant on the left,
 * growing step by step when played (an L-system plant generation by generation, the branches each
 * adds in leaf colour; grass and flowers in the order a clump is laid), one line saying what that
 * step did; on the right what it is, a few knobs that regrow it at once, anything the plant adds
 * (the shrub's colour ring), and "apply to island", which regrows every plant of the kind there.
 */
export function PlantEditor({ kind, model, seed, knobs, onKnobs, onNew, onBirth, onApply, applied, rule, facts, onLocate, extra }: {
  kind: PlantKind;
  model: PlantModel;
  seed: number;
  knobs: PlantKnobs;
  onKnobs: (k: PlantKnobs) => void;
  onNew: () => void;
  onBirth: () => void;
  onApply?: () => void;
  /** The island already grows these knobs. */
  applied?: boolean;
  /** Two or three plain sentences: how it grows, where. */
  rule: string;
  /** One line: height, crown, how many on the island. */
  facts: string;
  onLocate?: () => void;
  /** Below the knobs: what else this plant lets you turn. */
  extra?: ReactNode;
}) {
  const { t } = useLanguage();
  const shown = useDeferredValue(knobs);
  const growth = useMemo(() => model.grow(seed, shown), [model, seed, shown]);
  useEffect(() => () => growth.dispose(), [growth]);
  const last = growth.frames.length - 1;
  const [frame, setFrame] = useState(last);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setFrame(last); setPlaying(false); }, [kind, last]);
  useEffect(() => {
    if (!playing) return;
    if (frame >= last) { setPlaying(false); return; }
    const id = setTimeout(() => setFrame((s) => s + 1), model.stepMs);
    return () => clearTimeout(id);
  }, [playing, frame, last, model.stepMs]);
  const at = Math.min(frame, last);
  const { name, caption } = model.label(at, growth.frames.length, t, shown);

  const h = growth.height, crown = growth.spread;
  // A person stands beside the trees and shrubs; grass and flowers are framed close (a person would shrink them away).
  const view = model.person ? Math.max(h, crown * 0.75, PERSON_HEIGHT * 0.8) : Math.max(h, crown * 0.6);
  const look = model.person ? Math.max(h, PERSON_HEIGHT) * 0.42 : h * 0.45;

  const row = (key: string, min: number, max: number, step: number) => (
    <label key={key}>
      <span>{t(`plant.ctl.${key}` as StringKey)}</span>
      <span>{t(`plant.ctl.${key}.low` as StringKey)} — {t(`plant.ctl.${key}.high` as StringKey)}</span>
      <input type="range" min={min} max={max} step={step} value={knobs[key]} aria-label={t(`plant.ctl.${key}` as StringKey)}
        onChange={(e) => onKnobs({ ...knobs, [key]: Number(e.target.value) })} />
    </label>
  );
  const isTree = kind === 'parasol' || kind === 'weeping';

  return <div className="morph-panel plant-panel">
    <div className="morph-stage">
      <div className="fish-preview den-preview" aria-label="3D model">
        <Canvas key={kind} camera={{ position: [view * 1.85, model.person ? Math.max(h, PERSON_HEIGHT) * 0.6 : look + view * 0.6, view * 1.85], fov: 38, near: Math.min(0.05, h * 0.1) }}>
          <color attach="background" args={[JADE_UI.mist]} />
          <primitive object={growth.frames[at]} />
          {/* A person beside it for scale, and the ground. */}
          {model.person && <mesh position={[crown * 0.5 + Math.max(0.5, h * 0.15), PERSON_HEIGHT / 2, 0]}>
            <capsuleGeometry args={[0.16, PERSON_HEIGHT - 0.32, 4, 10]} />
            <meshBasicMaterial color={JADE_UI.inkDim} />
          </mesh>}
          <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[Math.max(crown, h, model.person ? 1.4 : 0) * 0.9, 48]} /><meshBasicMaterial color={JADE_UI.paper} /></mesh>
          <OrbitControls target={[0, look, 0]} enablePan={false} autoRotate autoRotateSpeed={0.5} minDistance={view * 0.5} maxDistance={view * 4} maxPolarAngle={1.5} />
        </Canvas>
      </div>
      <div className="plant-grow">
        <button type="button" className="resource-btn plant-play" aria-pressed={playing}
          onClick={() => { if (playing) setPlaying(false); else { setFrame(0); setPlaying(true); } }}>
          {playing ? t('plant.pause') : t('plant.play')}
        </button>
        <input type="range" min={0} max={last} step={1} value={at} aria-label={t(model.person ? 'plant.scrub' : 'plant.scrubBlades')}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }} />
        <span className="plant-stage-name">{name}</span>
      </div>
      <p className="plant-caption">{caption}</p>
    </div>
    <div className="morph-editor">
      <p className="plant-rule">{rule}</p>
      <p className="plant-facts">{facts}</p>
      <div className="morph-controls">
        {model.knobs.map((k) => row(k.key, k.min, k.max, k.step))}
      </div>
      {extra}
      <div className="morph-actions">
        <button type="button" className="resource-btn" onClick={onNew}>{t(isTree ? 'plant.new' : `plant.new.${kind}` as StringKey)}</button>
        <button type="button" className="resource-btn" onClick={onBirth}>{t('plant.birth')}</button>
        {onApply && <button type="button" className="resource-btn morph-save" onClick={onApply} disabled={applied} title={t(isTree ? 'plant.applyNote' : 'plant.applyNote.all')}>{applied ? t('plant.applied') : t('plant.apply')}</button>}
        {onLocate && <button type="button" className="resource-btn" onClick={onLocate}>{t('resources.locate')}</button>}
      </div>
      <p className="morph-note">{t(model.note)}</p>
    </div>
  </div>;
}
