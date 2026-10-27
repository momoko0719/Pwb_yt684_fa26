import { useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Box3, Vector3, type Object3D } from 'three';
import { SCALE_VIEW } from '../../core/palette';
import { niceStep, PERSON_HEIGHT, SCALE_TARGET, type ScaleId } from '../../core/scale';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { ISLAND } from './layout';
import { STELE, WATCH_BASE } from './stele';
import type { ScaleBar } from '../island-v1/ScaleView';

export type { ScaleBar };
export { surveySteps } from '../island-v1/ScaleView';

/** Wonderland scale row — may be a shared ScaleId or a local kind (stele / watchBase / groups). */
export type WonderlandScaleKey = ScaleId | 'stele' | 'watchBase' | 'terraceGroup' | 'rangeMassif';

export interface ScaleRow {
  id: WonderlandScaleKey;
  range: [number, number];
  /** When null, show as reference only (no red ↑↓). */
  target: [number, number] | null;
}

/**
 * Wonderland metre targets (design judgement in layout.ts / wonderland.md).
 * Penglai 800–1200 island / 2–12 boulder are **not** applied here.
 */
export const WONDERLAND_SCALE_TARGET: Partial<Record<WonderlandScaleKey, [number, number]>> = {
  island: [500, 600],
  mainPeak: [100, 150],
  pine: SCALE_TARGET.pine.range,
  forest: SCALE_TARGET.forest.range,
  shrub: [0.4, 1.2], // wonderland-terrain/shrubs.ts SHRUB_HEIGHT — shared with resource atlas
  grass: [0.1, 0.35],
  flower: [0.2, 0.45],
  person: [PERSON_HEIGHT, PERSON_HEIGHT],
  stele: [STELE.height * 0.9, STELE.height * 1.1],
  watchBase: [0.2, 0.55], // height of the low seat
  pool: [8, 40],
  terraceGroup: [40, 120], // across the stacked pools as a group
  rangeMassif: [180, 320], // across the main range mass
};

export interface WonderlandKnown {
  peakHeight: number;
  forest: [number, number] | null;
  grass: [number, number];
  flower: [number, number];
  steleHeight: number;
  poolAcross?: number;
  /** Whole terrace stack: [across, height] metres from generated pools. */
  terraceGroup?: { across: number; height: number; center: Vector3; size: Vector3 };
  /** Main range mass: [across, height] from generation. */
  rangeMassif?: { across: number; height: number; center: Vector3; size: Vector3 };
}

type ScaleGroup = 'mass' | 'landmarks' | 'vegetation' | 'person';

const GROUP_OF: Partial<Record<WonderlandScaleKey, ScaleGroup>> = {
  island: 'mass',
  mainPeak: 'mass',
  rangeMassif: 'mass',
  terraceGroup: 'mass',
  pool: 'mass',
  pine: 'vegetation',
  forest: 'vegetation',
  grass: 'vegetation',
  flower: 'vegetation',
  stele: 'landmarks',
  watchBase: 'landmarks',
  person: 'person',
};

interface Measured {
  boxes: { id: WonderlandScaleKey; min: Vector3; max: Vector3; labelH: number; group: ScaleGroup }[];
  rows: ScaleRow[];
}

const REMEASURE = 0.5;
const BAR_PIXELS = 110;
const box = new Box3();
const ORDER: WonderlandScaleKey[] = [
  'island', 'rangeMassif', 'mainPeak', 'terraceGroup', 'pool',
  'pine', 'forest', 'watchBase', 'stele', 'grass', 'flower', 'person',
];

function labelKey(id: WonderlandScaleKey): StringKey {
  if (id === 'stele') return 'scale.row.stele' as StringKey;
  if (id === 'watchBase') return 'scale.row.watchBase' as StringKey;
  if (id === 'terraceGroup') return 'scale.row.terraceGroup' as StringKey;
  if (id === 'rangeMassif') return 'scale.row.rangeMassif' as StringKey;
  return `scale.row.${id}` as StringKey;
}

/**
 * Penglai Scale System operations (boxes, person figures, metre bar) with Wonderland targets.
 * Off by default. Group anchors for terrace + range; category visibility — not every object boxed.
 */
export function WonderlandScaleView({ known, anchors, onMeasure, bar, show }: {
  known: WonderlandKnown;
  anchors: Vector3[];
  onMeasure: (rows: ScaleRow[]) => void;
  bar: RefObject<ScaleBar>;
  /** Which categories draw wire boxes (legend toggles). */
  show: Record<ScaleGroup, boolean>;
}) {
  const { t } = useLanguage();
  const scene = useThree((s) => s.scene);
  const [measured, setMeasured] = useState<Measured>({ boxes: [], rows: [] });
  const last = useRef({ at: -Infinity, key: '' });
  const center = useMemo(() => new Vector3(0, known.peakHeight * 0.15, 0), [known.peakHeight]);

  const measure = () => {
    const found: Measured['boxes'] = [];
    // Landmark objects only (stele / watch / pine) — not every blade/pool.
    scene.traverse((o: Object3D) => {
      if (!o.visible) return;
      const kind = (o.userData.scaleKind ?? o.userData.scaleId) as WonderlandScaleKey | undefined;
      if (!kind || kind === 'grass' || kind === 'flower') return;
      if (kind !== 'stele' && kind !== 'watchBase' && kind !== 'pine') return;
      box.setFromObject(o);
      found.push({
        id: kind, min: box.min.clone(), max: box.max.clone(),
        labelH: box.max.y - box.min.y, group: GROUP_OF[kind] ?? 'landmarks',
      });
    });
    // One group box each for terrace stack + main range (actual generated extents).
    if (known.terraceGroup) {
      const g = known.terraceGroup;
      const half = g.size.clone().multiplyScalar(0.5);
      found.push({
        id: 'terraceGroup',
        min: g.center.clone().sub(half),
        max: g.center.clone().add(half),
        labelH: g.height,
        group: 'mass',
      });
    }
    if (known.rangeMassif) {
      const g = known.rangeMassif;
      const half = g.size.clone().multiplyScalar(0.5);
      found.push({
        id: 'rangeMassif',
        min: g.center.clone().sub(half),
        max: g.center.clone().add(half),
        labelH: g.height,
        group: 'mass',
      });
    }
    const heights = (id: WonderlandScaleKey) => found.filter((b) => b.id === id).map((b) => b.labelH);
    const span = (values: number[]): [number, number] | null => (values.length ? [Math.min(...values), Math.max(...values)] : null);
    const rows: ScaleRow[] = [];
    const add = (id: WonderlandScaleKey, range: [number, number] | null) => {
      if (!range) return;
      rows.push({ id, range, target: WONDERLAND_SCALE_TARGET[id] ?? null });
    };
    const across = Math.max(ISLAND.across, ISLAND.deep);
    add('island', [across, across]);
    if (known.rangeMassif) add('rangeMassif', [known.rangeMassif.across, known.rangeMassif.height]);
    add('mainPeak', [known.peakHeight, known.peakHeight]);
    if (known.terraceGroup) add('terraceGroup', [known.terraceGroup.across, known.terraceGroup.height]);
    add('pine', span(heights('pine')));
    add('forest', known.forest);
    add('watchBase', span(heights('watchBase')) ?? [WATCH_BASE.rise, WATCH_BASE.rise + 0.35]);
    add('stele', span(heights('stele')) ?? [known.steleHeight, known.steleHeight]);
    if (known.poolAcross) add('pool', [known.poolAcross, known.poolAcross]);
    add('grass', known.grass);
    add('flower', known.flower);
    add('person', [PERSON_HEIGHT, PERSON_HEIGHT]);
    rows.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    return { boxes: found, rows };
  };

  useFrame(({ clock, camera, size }) => {
    if (clock.elapsedTime - last.current.at > REMEASURE) {
      last.current.at = clock.elapsedTime;
      const next = measure();
      const key = JSON.stringify(next.rows) + next.boxes.length;
      if (key !== last.current.key) {
        last.current.key = key;
        setMeasured(next);
        onMeasure(next.rows);
      }
    }
    const fov = 'fov' in camera ? (camera.fov as number) : 40;
    const perMetre = size.height / (2 * camera.position.distanceTo(center) * Math.tan((fov * Math.PI) / 360));
    const metres = niceStep(BAR_PIXELS / perMetre);
    if (bar.current?.line) bar.current.line.style.width = `${Math.round(metres * perMetre)}px`;
    if (bar.current?.label) bar.current.label.textContent = `${metres} m`;
  });

  return (
    <group>
      {measured.boxes.filter((b) => show[b.group]).map((b, i) => {
        const size = b.max.clone().sub(b.min);
        const mid = b.min.clone().add(b.max).multiplyScalar(0.5);
        const label = b.id === 'terraceGroup' || b.id === 'rangeMassif'
          ? `${t(labelKey(b.id))} ${size.x.toFixed(0)}×${size.y.toFixed(0)}×${size.z.toFixed(0)} m`
          : `${t(labelKey(b.id))} ${b.labelH.toFixed(2)} m`;
        return (
          <group key={i}>
            <mesh position={mid}>
              <boxGeometry args={[size.x, size.y, size.z]} />
              <meshBasicMaterial color={SCALE_VIEW.box} wireframe transparent opacity={0.55} />
            </mesh>
            <Html position={[mid.x, b.max.y, mid.z]} center className="scale-tag" zIndexRange={[5, 0]}>
              {label}
            </Html>
          </group>
        );
      })}
      {show.person && anchors.map((p, i) => (
        <group key={`f${i}`} position={p}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.2, 0.25, 1.2, 8]} />
            <meshBasicMaterial color={SCALE_VIEW.person} />
          </mesh>
          <mesh position={[0, PERSON_HEIGHT - 0.14, 0]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshBasicMaterial color={SCALE_VIEW.person} />
          </mesh>
          <Html position={[0, PERSON_HEIGHT + 0.4, 0]} center className="scale-tag person" zIndexRange={[5, 0]}>
            {t('scale.row.person')} {PERSON_HEIGHT} m
          </Html>
        </group>
      ))}
    </group>
  );
}

const mean = ([a, b]: [number, number]) => (a + b) / 2;
const num = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/0$/, '').replace(/\.0$/, ''));
const fmt = ([lo, hi]: [number, number]) => (Math.abs(hi - lo) < 0.05 * Math.max(hi, 0.01) ? num(hi) : `${num(lo)}–${num(hi)}`);

function fitTarget(range: [number, number], target: [number, number] | null): 'ok' | 'small' | 'large' | 'ref' {
  if (!target) return 'ref';
  if (range[1] < target[0] * 0.85) return 'small';
  if (range[0] > target[1] * 1.15) return 'large';
  return 'ok';
}

/** Wonderland legend: Penglai ops (table + bar), Wonderland targets; category box toggles. */
export function WonderlandScaleLegend({ rows, steps, bar, show, onShow }: {
  rows: ScaleRow[];
  steps: { minor: number; major: number; contour: number };
  bar: RefObject<ScaleBar>;
  show: Record<ScaleGroup, boolean>;
  onShow: (next: Record<ScaleGroup, boolean>) => void;
}) {
  const { t } = useLanguage();
  const peakNow = rows.find((r) => r.id === 'mainPeak')?.range[1] ?? 1;
  const peakTarget = mean(WONDERLAND_SCALE_TARGET.mainPeak ?? [100, 150]);
  const [open, setOpen] = useState(true);
  const share = (x: number, of: number) => {
    const pct = (100 * x) / of;
    return `${pct >= 10 ? Math.round(pct) : pct.toFixed(pct >= 1 ? 1 : 2)}%`;
  };
  const groups: { id: ScaleGroup; key: StringKey }[] = [
    { id: 'mass', key: 'scale.group.mass' as StringKey },
    { id: 'landmarks', key: 'scale.group.landmarks' as StringKey },
    { id: 'vegetation', key: 'scale.group.vegetation' as StringKey },
    { id: 'person', key: 'scale.group.person' as StringKey },
  ];
  return (
    <div className="scale-legend">
      <button type="button" className="scale-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {t('scale.title')} {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div className="scale-groups" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', margin: '0.35rem 0 0.5rem', fontSize: '0.78rem' }}>
            {groups.map((g) => (
              <label key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={show[g.id]}
                  onChange={(e) => onShow({ ...show, [g.id]: e.target.checked })}
                />
                {t(g.key)}
              </label>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th />
                {(['scale.now', 'scale.target', 'scale.shareNow', 'scale.shareTarget'] as const).map((k) => (
                  <th key={k}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fit = fitTarget(r.range, r.target);
                return (
                  <tr key={String(r.id)}>
                    <td>{t(labelKey(r.id))}</td>
                    <td className={fit === 'ok' || fit === 'ref' ? '' : 'off'}>
                      {fmt(r.range)}
                      {fit === 'small' ? ' ↓' : fit === 'large' ? ' ↑' : ''}
                    </td>
                    <td>{r.target ? fmt(r.target) : t('scale.refOnly')}</td>
                    <td>{r.id === 'island' ? '' : share(r.range[1], peakNow)}</td>
                    <td>{r.id === 'island' || !r.target ? '' : share(mean(r.target), peakTarget)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <div className="scale-foot">
        <span>{t('scale.grid')} {steps.minor} / {steps.major} m · {t('scale.contour')} {steps.contour} m</span>
        <span className="scale-bar">
          <span ref={(el) => { if (bar.current) bar.current.line = el; }} className="scale-bar-line" />
          <span ref={(el) => { if (bar.current) bar.current.label = el; }} />
        </span>
      </div>
    </div>
  );
}

export function wonderlandSurveySteps(peak: number) {
  const diameter = Math.max(ISLAND.across, ISLAND.deep);
  const minor = niceStep(diameter / 12);
  return { minor, major: minor * 10, contour: niceStep(Math.max(peak, 0.1) / 8) };
}

export { PERSON_HEIGHT };

export type { ScaleGroup };
export const DEFAULT_SCALE_SHOW: Record<ScaleGroup, boolean> = {
  mass: true,
  landmarks: true,
  vegetation: false,
  person: true,
};
