import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { SHELTER_CAVITY } from './rockShelter';
import { shellGeometry, type ShellParams } from './rockShell';

/** Marching-cubes cells for the preview: coarser than the island's (80) so a slider answers at once. */
const PREVIEW_GRID = 48;

function DenModel({ seed, params, space }: { seed: number; params: ShellParams; space: boolean }) {
  const geometry = useMemo(() => shellGeometry(false, seed, params, 'weather', PREVIEW_GRID), [seed, params]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const C = SHELTER_CAVITY;
  return <group position={[0.5, 0, -0.15]}>
    <mesh geometry={geometry}><meshStandardMaterial color={PORCELAIN.shelterSlab} roughness={0.85} /></mesh>
    {/* The ground the den stands in (its base is buried 0.22 m). */}
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.22, 0]}><circleGeometry args={[5.5, 48]} /><meshStandardMaterial color={JADE_UI.paper} roughness={1} /></mesh>
    {space && <mesh position={[(C.x0 + C.x1) / 2, (C.y0 + C.y1) / 2, (C.z0 + C.z1) / 2]}>
      <boxGeometry args={[C.x1 - C.x0, C.y1 - C.y0, C.z1 - C.z0]} />
      <meshBasicMaterial color={JADE_UI.seal} transparent opacity={0.12} depthWrite={false} />
      <Edges color={JADE_UI.seal} />
    </mesh>}
  </group>;
}

/**
 * The den's editor (atlas), laid out as the creature's: the model on the left, the knobs on the
 * right; every knob rebuilds the model at once. "Space" shows the box of air the creature uses,
 * which every rule keeps clear.
 */
export function DenEditor({ seed, params, onParams, onNew, onBirth, targets, onSave, saved }: { seed: number; params: ShellParams; onParams: (p: ShellParams) => void; onNew: () => void; onBirth: () => void; targets?: { names: string[]; index: number; onPick: (i: number) => void }; onSave?: () => void; saved?: boolean }) {
  const { t } = useLanguage();
  const [space, setSpace] = useState(false);
  const shown = useDeferredValue(params);
  const row = (key: keyof ShellParams, min: number, max: number, stepBy: number) => (
    <label key={key}>
      <span>{t(`den.ctl.${key}` as StringKey)}</span>
      <span>{t(`den.ctl.${key}.low` as StringKey)} — {t(`den.ctl.${key}.high` as StringKey)}</span>
      <input type="range" min={min} max={max} step={stepBy} value={params[key]} aria-label={t(`den.ctl.${key}` as StringKey)} onChange={(e) => onParams({ ...params, [key]: Number(e.target.value) })} />
    </label>
  );
  return <div className="morph-panel">
    <div className="morph-stage">
      <div className="fish-preview den-preview" aria-label="3D model">
        <Canvas camera={{ position: [8.6, 3.6, 2.6], fov: 38 }}>
          <color attach="background" args={[JADE_UI.mist]} />
          <hemisphereLight args={[0xffffff, 0x8a9690, 1.1]} />
          <directionalLight position={[4, 7, 3]} intensity={1.8} />
          <DenModel seed={seed} params={shown} space={space} />
          <OrbitControls target={[0, 1.4, 0]} enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={1.45} />
        </Canvas>
      </div>
      <div className="morph-stage-tools">
        <button type="button" className="resource-btn" aria-pressed={space} onClick={() => setSpace((s) => !s)}>{t('den.space')}</button>
        <span>{t('fish.drag')}</span>
      </div>
    </div>
    <div className="morph-editor">
      {targets && targets.names.length > 1 && <div className="morph-choice morph-target"><span>{t('form.target')}</span><div className="morph-segments">
        {targets.names.map((n, i) => <button key={n} type="button" aria-pressed={i === targets.index} onClick={() => targets.onPick(i)}>{n}</button>)}
      </div></div>}
      <div className="morph-controls">
        {row('size', 0, 1, 0.01)}
        {row('lumps', 0, 6, 1)}
        {row('lumpSize', 0, 1, 0.01)}
        {row('swell', 0, 1, 0.01)}
        {row('weather', 0, 1, 0.01)}
      </div>
      <div className="morph-actions">
        {onSave && targets ? <button type="button" className="resource-btn morph-save" onClick={onSave} disabled={saved} title={t('form.saveNote')}>{saved ? t('form.saved') : t('form.save').replace('{n}', targets.names[targets.index])}</button> : <>
          <button type="button" className="resource-btn" onClick={onNew}>{t('fish.new')}</button>
          <button type="button" className="resource-btn" onClick={onBirth}>{t('fish.birth')}</button>
        </>}
      </div>
    </div>
  </div>;
}
