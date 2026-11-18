import { JADE_UI } from '../../core/palette';
import { growAntler, type Vec3 } from './creatureMorph';

/** A beam drawn flat, root at the lower left, curving up and back (as the horn does from the side). */
const BEAM: Vec3[] = Array.from({ length: 8 }, (_, i) => {
  const t = i / 7, u = 1 - t;
  // Quadratic: root (0, 0), bend (0.15, 0.62), tip (-0.1, 1).
  return { x: 2 * u * t * 0.15 + t * t * -0.1, y: 2 * u * t * 0.62 + t * t, z: 0 };
});

/**
 * The antler's rule beside its control (morph editor): the same `growAntler` the creature uses, run
 * on a flat beam, one panel per generation up to the chosen one; the newest tines in jade.
 */
export function AntlerRule({ generations, onPick }: { generations: number; onPick?: (g: 0 | 1 | 2 | 3) => void }) {
  const panel = (g: number) => {
    const segs = growAntler(BEAM, g, 0, 1);
    // Fit: x in [-0.45, 0.65], y in [0, 1.05] → a 64 × 70 box, y up.
    const X = (x: number) => 26 + x * 52, Y = (y: number) => 66 - y * 58;
    return <svg viewBox="0 0 64 72" aria-hidden="true">
      {segs.map((s, k) => <polyline key={k} points={s.points.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')} fill="none" strokeLinecap="round"
        stroke={s.gen === g && g > 0 ? JADE_UI.jadeDeep : JADE_UI.inkDim} strokeWidth={Math.max(0.8, s.width * 3.2)} />)}
      <text x="32" y="71" textAnchor="middle">{g}</text>
    </svg>;
  };
  // The same rule the creature grows by, one panel per generation: pick one by its drawing.
  return <div className="antler-rule">
    {([0, 1, 2, 3] as const).map((g) => <button key={g} type="button" aria-pressed={g === generations} aria-label={String(g)} onClick={() => onPick?.(g)}>{panel(g)}</button>)}
  </div>;
}
