import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { FishPreview } from './FishSchool';
import { SchoolPanel } from './SchoolPanel';
import type { StreamFishData } from './streamFish';
import { FORM_RULES, SWIM, tailBeatHz, type FishForm } from './fishForm';

/**
 * The fish editor (atlas), laid out as the creature's: the model large on the left, the sliders on
 * the right; every slider changes the model at once. "Structure" draws how it was built on it.
 */
export function FishEditor({ form, onForm, onNew, onBirth, school }: { form: FishForm; onForm: (f: FishForm) => void; onNew: () => void; onBirth: () => void; school?: StreamFishData[] }) {
  const { t } = useLanguage();
  const [structure, setStructure] = useState(false);
  const ratio = form.depth / form.length;
  const row = (key: string, value: number, min: number, max: number, step: number, set: (v: number) => FishForm) => (
    <label key={key}>
      <span>{t(`fish.ctl.${key}` as StringKey)}</span>
      <span>{t(`fish.ctl.${key}.low` as StringKey)} — {t(`fish.ctl.${key}.high` as StringKey)}</span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={t(`fish.ctl.${key}` as StringKey)} onChange={(e) => onForm(set(Number(e.target.value)))} />
    </label>
  );
  const beat = tailBeatHz(form, form.length * (SWIM.cruise[0] + SWIM.cruise[1]) / 2);
  return <div className="morph-panel">
    <div className="morph-stage">
      <FishPreview fish={form} swim structure={structure} />
      <div className="morph-stage-tools">
        <button type="button" className="resource-btn" aria-pressed={structure} onClick={() => setStructure((s) => !s)}>{t('fish.structure')}</button>
        <span>{t('fish.drag')}</span>
      </div>
    </div>
    <div className="morph-editor">
      <div className="morph-controls">
        {row('length', form.length, FORM_RULES.length[0], FORM_RULES.length[1], 0.01, (v) => ({ ...form, length: v, depth: v * ratio }))}
        {row('depth', ratio, FORM_RULES.depthRatio[0], FORM_RULES.depthRatio[1], 0.005, (v) => ({ ...form, depth: form.length * v }))}
        {row('fork', form.fork, 0, 1, 0.01, (v) => ({ ...form, fork: v }))}
        {row('fin', form.fin, 0, 1, 0.01, (v) => ({ ...form, fin: v }))}
        {row('marks', form.marks, 0, 6, 1, (v) => ({ ...form, marks: Math.round(v) }))}
      </div>
      <p className="morph-readout">{Math.round(form.length * 100)} cm · {t('fish.beat').replace('{n}', beat.toFixed(1))}</p>
      <div className="morph-actions">
        <button type="button" className="resource-btn" onClick={onNew}>{t('fish.new')}</button>
        <button type="button" className="resource-btn" onClick={onBirth}>{t('fish.birth')}</button>
      </div>
      <span className="morph-note">{t('fish.previewNote')}</span>
      {school && school.length > 1 && <SchoolPanel school={school} />}
    </div>
  </div>;
}
