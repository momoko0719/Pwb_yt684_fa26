import { useLanguage } from '../../i18n/LanguageContext';

/** Where the visitor is in drawing a path: pick a start, pick an end, watch it laid, then again. */
export type PathStage = 'start' | 'end' | 'laying' | 'built' | 'done' | 'fail';

/**
 * Drawing paths. A prompt at the top guides the visitor step by step (the island opens on it); the
 * bar at the bottom left turns the tool off (to look around freely) or clears the drawn paths.
 */
export default function PathTool({ drawing, stage, onToggle, onClear }: { drawing: boolean; stage: PathStage; onToggle: () => void; onClear: () => void }) {
  const { t } = useLanguage();
  const step = stage === 'start' || stage === 'built' || stage === 'done' || stage === 'fail' ? 1 : stage === 'end' ? 2 : 3;
  return (
    <>
      {drawing && (
        <div className="path-prompt" key={stage}>
          <span className="path-steps">
            {[1, 2, 3].map((n) => (
              <i key={n} className={n === step ? 'on' : n < step ? 'past' : ''} />
            ))}
          </span>
          <span>{t(`path.${stage}`)}</span>
          {(stage === 'start' || stage === 'end') && <span className="path-pulse" aria-hidden />}
        </div>
      )}
      <div className="tool-bar">
        <button type="button" className={drawing ? 'on' : ''} onClick={onToggle}>{t('path.draw')}</button>
        <button type="button" onClick={onClear}>{t('path.clear')}</button>
      </div>
    </>
  );
}
