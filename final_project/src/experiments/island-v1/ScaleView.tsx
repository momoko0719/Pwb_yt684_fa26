import { useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Box3, Vector3, type Object3D } from 'three';
import type { IslandField } from '../../core/generators/island';
import { SCALE_VIEW } from '../../core/palette';
import { niceStep, PERSON_HEIGHT, SCALE_ORDER, SCALE_TARGET, withinTarget, type ScaleId } from '../../core/scale';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';

/** One measured kind of thing: its size range in metres right now. */
export interface ScaleRow {
  id: ScaleId;
  range: [number, number];
}

/** The scale bar's elements, filled in by the legend and updated every frame by the view. */
export interface ScaleBar {
  line: HTMLElement | null;
  label: HTMLElement | null;
}

/** What the scene knows without measuring meshes: sizes set by parameters. */
export interface KnownSizes {
  /** Lowest point of the island mesh (the tip of the longest hanging rock). */
  bottomY: number;
  pathWidth: number;
  fallWidth: number;
  grass: [number, number];
  flower: [number, number];
  /** Ranges from the generators: stream widths, forest pine, shrub and boulder heights. */
  stream: [number, number] | null;
  forest: [number, number] | null;
  shrub: [number, number] | null;
  boulder: [number, number] | null;
}

interface Measured {
  /** Axis-aligned boxes to draw, with what they are. */
  boxes: { id: ScaleId; min: Vector3; max: Vector3 }[];
  rows: ScaleRow[];
}

const REMEASURE = 0.5; // seconds between measurements while the view is on
const BAR_PIXELS = 110; // the scale bar aims for about this many pixels
const box = new Box3();

/** Grid steps and contour interval for an island: about a dozen minor cells across, 8 contours up the main peak. */
export function surveySteps(diameter: number, peak: number) {
  const minor = niceStep(diameter / 12);
  return { minor, major: minor * 10, contour: niceStep(Math.max(peak, 0.1) / 8) };
}

/** Widest distance across the island, from its outline. */
export function islandDiameter(field: IslandField): number {
  let widest = 0;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI;
    widest = Math.max(widest, field.rim(a) + field.rim(a + Math.PI));
  }
  return widest;
}

/**
 * The scale view inside the scene: every pine, pavilion and peak boxed and labelled with its real
 * height in metres, two 1.7 m figures (at the foot of the main peak and beside a pine) to read them
 * against, and a scale bar written into `bar` each frame. Boxes are measured from the meshes
 * themselves, so they show what is built, not what the parameters intend.
 */
export function ScaleView({ field, known, onMeasure, bar }: {
  field: IslandField;
  known: KnownSizes;
  onMeasure: (rows: ScaleRow[]) => void;
  bar: RefObject<ScaleBar>;
}) {
  const { t } = useLanguage();
  const scene = useThree((s) => s.scene);
  const [measured, setMeasured] = useState<Measured>({ boxes: [], rows: [] });
  const last = useRef({ at: -Infinity, key: '' });

  // Peaks come from the field: the main one first, then the spires.
  const peaks = useMemo(() => field.peaks.map((q, i) => {
    const top = field.top(q.x, q.z) ?? 0;
    const lift = field.lift(q.x, q.z);
    return { id: (i === 0 ? 'mainPeak' : 'spire') as ScaleId, min: new Vector3(q.x - q.radius, top - lift, q.z - q.radius), max: new Vector3(q.x + q.radius, top, q.z + q.radius) };
  }), [field]);

  const measure = () => {
    const found: { id: ScaleId; min: Vector3; max: Vector3 }[] = [];
    scene.traverse((o: Object3D) => {
      const id = o.userData.scaleId as ScaleId | undefined;
      if (!id || !o.visible) return;
      box.setFromObject(o);
      found.push({ id, min: box.min.clone(), max: box.max.clone() });
    });
    const boxes = [...peaks, ...found];
    const heights = (id: ScaleId) => boxes.filter((b) => b.id === id).map((b) => b.max.y - b.min.y);
    const span = (values: number[]): [number, number] | null => (values.length ? [Math.min(...values), Math.max(...values)] : null);
    const rows: ScaleRow[] = [];
    const add = (id: ScaleId, range: [number, number] | null) => { if (range) rows.push({ id, range }); };
    const across = islandDiameter(field);
    add('island', [across, across]);
    add('mainPeak', span(heights('mainPeak')));
    add('spire', span(heights('spire')));
    add('cliff', [field.rimY - known.bottomY, field.rimY - known.bottomY]);
    add('lake', span(field.pools.filter((q) => q.lake).map((q) => 2 * q.radius * 0.8)));
    add('pool', span(field.pools.filter((q) => !q.lake).map((q) => 2 * q.radius)));
    add('stream', known.stream);
    add('fall', [known.fallWidth, known.fallWidth * 3]);
    add('pine', span(heights('pine')));
    add('forest', known.forest);
    add('shrub', known.shrub);
    add('boulder', known.boulder);
    add('pavilion', span(heights('pavilion')));
    add('path', [known.pathWidth, known.pathWidth]);
    add('grass', known.grass);
    add('flower', known.flower);
    add('person', [PERSON_HEIGHT, PERSON_HEIGHT]);
    rows.sort((a, b) => SCALE_ORDER.indexOf(a.id) - SCALE_ORDER.indexOf(b.id));
    return { boxes, rows };
  };

  const center = useMemo(() => new Vector3(0, field.top(0, 0) ?? 0, 0), [field]);
  useFrame(({ clock, camera, size }) => {
    // Re-measure now and then: pines regrow with the island, pavilions appear when paths are drawn.
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
    // Scale bar, true at the depth of the island's centre: pixels per metre there, rounded to a nice length.
    const fov = 'fov' in camera ? (camera.fov as number) : 40;
    const perMetre = size.height / (2 * camera.position.distanceTo(center) * Math.tan((fov * Math.PI) / 360));
    const metres = niceStep(BAR_PIXELS / perMetre);
    if (bar.current?.line) bar.current.line.style.width = `${Math.round(metres * perMetre)}px`;
    if (bar.current?.label) bar.current.label.textContent = `${metres} m`;
  });

  // Two figures: at the foot of the main peak (toward the island's centre), and beside the pine
  // nearest the centre.
  const figures = useMemo(() => {
    const spots: Vector3[] = [];
    const main = field.peaks[0];
    if (main) {
      const d = Math.hypot(main.x, main.z) || 1;
      const dx = main.x ? -main.x / d : 1, dz = main.z ? -main.z / d : 0;
      for (let k = 1; k <= 3; k++) {
        const x = main.x + dx * main.radius * (0.9 + 0.2 * k), z = main.z + dz * main.radius * (0.9 + 0.2 * k);
        const y = field.top(x, z);
        if (y !== null) { spots.push(new Vector3(x, y, z)); break; }
      }
    }
    const pine = measured.boxes.filter((b) => b.id === 'pine').sort((a, b) => Math.hypot(a.min.x, a.min.z) - Math.hypot(b.min.x, b.min.z))[0];
    if (pine) {
      const x = pine.max.x + 0.6, z = (pine.min.z + pine.max.z) / 2;
      const y = field.top(x, z);
      if (y !== null) spots.push(new Vector3(x, y, z));
    }
    return spots;
  }, [field, measured.boxes]);

  const label = (id: ScaleId) => t(`scale.row.${id}` as StringKey);
  return (
    <group>
      {measured.boxes.map((b, i) => {
        const size = b.max.clone().sub(b.min);
        const mid = b.min.clone().add(b.max).multiplyScalar(0.5);
        return (
          <group key={i}>
            <mesh position={mid}>
              <boxGeometry args={[size.x, size.y, size.z]} />
              <meshBasicMaterial color={SCALE_VIEW.box} wireframe transparent opacity={0.55} />
            </mesh>
            <Html position={[mid.x, b.max.y, mid.z]} center className="scale-tag" zIndexRange={[5, 0]}>
              {label(b.id)} {size.y.toFixed(1)} m
            </Html>
          </group>
        );
      })}
      {figures.map((p, i) => (
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
            {label('person')} {PERSON_HEIGHT} m
          </Html>
        </group>
      ))}
    </group>
  );
}

/**
 * The legend: every kind of thing, its size now, its target, and both as a share of the main peak
 * (the ratio that has to read right). Sizes outside the target are marked in cinnabar.
 */
export function ScaleLegend({ rows, steps, bar }: {
  rows: ScaleRow[];
  steps: { minor: number; major: number; contour: number };
  bar: RefObject<ScaleBar>;
}) {
  const { t } = useLanguage();
  const peakNow = rows.find((r) => r.id === 'mainPeak')?.range[1] ?? 1;
  const peakTarget = mean(SCALE_TARGET.mainPeak.range);
  const fmt = ([lo, hi]: [number, number]) => (Math.abs(hi - lo) < 0.05 * Math.max(hi, 0.01) ? num(hi) : `${num(lo)}–${num(hi)}`);
  const share = (x: number, of: number) => {
    const pct = (100 * x) / of;
    return `${pct >= 10 ? Math.round(pct) : pct.toFixed(pct >= 1 ? 1 : 2)}%`;
  };
  const [open, setOpen] = useState(true);
  return (
    <div className="scale-legend">
      <button type="button" className="scale-head" onClick={() => setOpen(!open)} aria-expanded={open}>{t('scale.title')} {open ? '▾' : '▸'}</button>
      {open && <table>
        <thead>
          <tr><th />{(['scale.now', 'scale.target', 'scale.shareNow', 'scale.shareTarget'] as const).map((k) => <th key={k}>{t(k)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fit = withinTarget(r.id, r.range);
            const target = SCALE_TARGET[r.id].range;
            return (
              <tr key={r.id}>
                <td>{t(`scale.row.${r.id}` as StringKey)}</td>
                <td className={fit === 'ok' ? '' : 'off'}>{fmt(r.range)}{fit === 'small' ? ' ↓' : fit === 'large' ? ' ↑' : ''}</td>
                <td>{fmt(target)}</td>
                <td>{r.id === 'island' ? '' : share(r.range[1], peakNow)}</td>
                <td>{r.id === 'island' ? '' : share(mean(target), peakTarget)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>}
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

const mean = ([a, b]: [number, number]) => (a + b) / 2;
const num = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/0$/, '').replace(/\.0$/, ''));
