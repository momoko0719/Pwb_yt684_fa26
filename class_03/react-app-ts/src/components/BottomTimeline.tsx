/**
 * BottomTimeline.tsx
 * ──────────────────
 * Floating video-player-style timeline bar, centred at the bottom of the viewport.
 * Shows the erosion simulation progress and lets you scrub back through history.
 *
 *  ⏮ Reset  ▶ Play  [━━━━━━━━●━━━━━━━━━] Step 5 / 20  💧
 *  ↑ Base noise                      Latest ↑
 */

interface Props {
  step: number;       // current position in history (-1 = base noise)
  histLen: number;    // total snapshots stored
  isPlaying: boolean;
  droplets: number;   // dropletsPerStep setting (for display)
  onPlay:   () => void;
  onPause:  () => void;
  onReset:  () => void;
  onScrub:  (step: number) => void;
}

export default function BottomTimeline({
  step, histLen, isPlaying, droplets,
  onPlay, onPause, onReset, onScrub,
}: Props) {
  const totalSteps = Math.max(histLen, 0);
  const atBase     = step < 0;
  const percent    = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0;

  // Label: base noise OR "Step N / Total — Xk droplets"
  const stepLabel = atBase
    ? 'No erosion yet — press ▶ to start'
    : `Step ${step + 1} / ${totalSteps} · ${((step + 1) * droplets / 1000).toFixed(0)}k droplets simulated`;

  return (
    <div className="bottom-timeline" role="region" aria-label="Erosion simulation timeline">

      {/* Left: transport buttons */}
      <div className="btl-transport">
        <button
          className="btl-btn btl-reset"
          title="Reset — go back to base noise (R)"
          onClick={onReset}
          disabled={atBase && !isPlaying}
        >
          ⏮
        </button>

        <button
          className={`btl-btn btl-play ${isPlaying ? 'playing' : ''}`}
          title={isPlaying ? 'Pause (Space)' : 'Run erosion (Space)'}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* Centre: scrubber */}
      <div className="btl-scrubber">
        <span className="btl-end-label">Base</span>
        <div className="btl-track">
          <div className="btl-fill" style={{ width: `${percent}%` }} />
          <input
            type="range"
            className="slider btl-range"
            min={-1}
            max={Math.max(0, totalSteps - 1)}
            step={1}
            value={step}
            disabled={totalSteps === 0}
            onChange={e => { onScrub(Number(e.target.value)); }}
            title="Drag to scrub through erosion history"
          />
        </div>
        <span className="btl-end-label">Now</span>
      </div>

      {/* Right: info */}
      <div className="btl-info">
        <span className={`btl-status ${isPlaying ? 'running' : ''}`}>
          {isPlaying ? '💧 Eroding…' : '💧 Erosion'}
        </span>
        <span className="btl-step-label">{stepLabel}</span>
      </div>

    </div>
  );
}
