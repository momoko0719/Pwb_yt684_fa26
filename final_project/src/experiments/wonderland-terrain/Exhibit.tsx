import { useEffect, useId, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { nearestTimeOfDay, TIME_HOURS, TIMES_OF_DAY } from '../../core/palette';
import type { Corner } from './corner';
import type { Frame } from './frame';
import type { HeightGrid } from '../../core/terrain/heightGrid';

/** White Jade's camera bookmarks and single settings panel. */
export const CHAPTERS = ['arrival', 'mountains', 'water', 'life'] as const;
export type Chapter = (typeof CHAPTERS)[number];
export interface View { from: [number, number, number]; to: [number, number, number] }

/**
 * Each chapter's view, by rule from the island as built (no coordinates by hand): its frame (the
 * range's back and the basin), the plunge pool, the creature's corner. `above` is the ground (or a
 * plate's top) under a point.
 */
export function chapterViews(frame: Frame, plunge: { x: number; z: number }, corner: Corner | null, above: (x: number, z: number) => number): Record<Chapter, View> {
  const [ux, uz] = frame.u, [vx, vz] = frame.v;
  const at = (x: number, z: number, up: number): [number, number, number] => [x, Math.max(above(x, z), 0) + up, z];
  // Arrival: the whole island from in front of the pass and to one side, as one comes from the clouds.
  const side = 0.7;
  const fx = -ux * Math.cos(side) + vx * Math.sin(side), fz = -uz * Math.cos(side) + vz * Math.sin(side);
  // Look at the middle of the basin and the range, not the world origin. ChapterCamera then
  // sets the distance from the window, so this length is only the approach direction.
  const mx = (frame.basin[0] + frame.rangeCentre[0]) / 2;
  const mz = (frame.basin[1] + frame.rangeCentre[1]) / 2;
  const arrival: View = { from: [mx + fx * 800, 18 + 440, mz + fz * 800], to: [mx, 18, mz] };
  // Mountains: from over the front of the terrace, looking back into the ring of peaks.
  const [bx, bz] = frame.basin, [rx, rz] = frame.rangeCentre;
  const mountains: View = { from: at(bx - ux * 160 + vx * 70, bz - uz * 160 + vz * 70, 95), to: at(rx + ux * 40, rz + uz * 40, 35) };
  // Water: the plunge pool from in front and to the side, the falls and the terrace behind it.
  const water: View = { from: at(plunge.x - ux * 18 + vx * 13, plunge.z - uz * 18 + vz * 13, 11), to: [plunge.x, Math.max(above(plunge.x, plunge.z), 0) + 0.5, plunge.z] };
  const life = corner ? corner.homeView : water;
  return { arrival, mountains, water, life };
}

const MOVE = 2.4;
const VIEW_FOV = 40 * Math.PI / 180;

export interface IslandBox {
  minX: number; maxX: number; minZ: number; maxZ: number;
  minY: number; maxY: number;
  /** Sampled visible mesh vertices, including the lowest hanging point. */
  points: Float32Array;
}

/** Bounds from the generated rim and underside rather than a guessed wall depth. */
export function boxFromRim(rim: Float32Array, underside: Float32Array, grid: HeightGrid, wallBottom: number, falls: Float32Array[] = []): IslandBox {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  const points: number[] = [];
  const add = (x: number, y: number, z: number, sample: boolean) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (sample) points.push(x, y, z);
  };
  for (let i = 0; i < rim.length; i += 3) {
    const x = rim[i], z = rim[i + 1], y = rim[i + 2];
    add(x, y, z, true);
    add(x, wallBottom, z, true);
  }
  let lowest: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < underside.length; i += 3) {
    const x = underside[i], y = underside[i + 1], z = underside[i + 2];
    if (y < lowest[1]) lowest = [x, y, z];
    add(x, y, z, i % 90 === 0);
  }
  points.push(...lowest);
  for (const fall of falls) for (let i = 0; i < fall.length; i += 3) {
    add(fall[i], fall[i + 1], fall[i + 2], i % 30 === 0);
  }
  let highest: [number, number, number] = [0, -Infinity, 0];
  const centre = (grid.size - 1) / 2;
  for (let j = 0; j < grid.size; j++) for (let i = 0; i < grid.size; i++) {
    const k = (j * grid.size + i) * 4, y = grid.data[k];
    if (grid.data[k + 3] > 0 || !Number.isFinite(y)) continue;
    const x = (i - centre) * grid.texel, z = (j - centre) * grid.texel;
    if (y > highest[1]) highest = [x, y, z];
    if (i % 8 === 0 && j % 8 === 0) add(x, y, z, true);
  }
  if (Number.isFinite(highest[1])) add(...highest, true);
  return { minX, maxX, minZ, maxZ, minY, maxY, points: new Float32Array(points) };
}

/**
 * Fit sampled visible geometry, including the full underside, to the actual canvas safe area.
 */
export function frameIsland(approach: View, box: IslandBox, width: number, height: number): View {
  const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
  const lookY = box.minY + (box.maxY - box.minY) * 0.42;
  let dx = approach.from[0] - approach.to[0], dz = approach.from[2] - approach.to[2];
  const h = Math.hypot(dx, dz) || 1;
  dx /= h; dz /= h;
  const aspect = width / Math.max(height, 1);
  const tanV = Math.tan(VIEW_FOV / 2), tanH = tanV * aspect;
  const elevation = 0.36;
  const length = Math.hypot(1, elevation), ux = dx / length, uy = elevation / length, uz = dz / length;
  const rx = dz, rz = -dx;
  const upx = -uy * dx, upy = 1 / length, upz = -uy * dz;
  const left = Math.max(70, width * 0.055), right = width - Math.max(30, width * 0.045);
  const top = Math.max(36, height * 0.07), bottom = height - Math.max(38, height * 0.07);
  const centerNdc = (left + right) / width - 1 + 0.055;
  const fits = (d: number) => {
    const shift = d * tanH * centerNdc;
    for (let i = 0; i < box.points.length; i += 3) {
      const x = box.points[i] - cx, y = box.points[i + 1] - lookY, z = box.points[i + 2] - cz;
      const depth = d - x * ux - y * uy - z * uz;
      if (depth <= 0) return false;
      const sx = (1 + (x * rx + z * rz + shift) / (depth * tanH)) * width / 2;
      const sy = (1 - (x * upx + y * upy + z * upz) / (depth * tanV)) * height / 2;
      if (sx < left || sx > right || sy < top || sy > bottom) return false;
    }
    return true;
  };
  let lo = 50, hi = 4000;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  // The rim wall has a broad front face; give that silhouette room beyond the sampled vertices.
  const dist = hi * 1.16;
  const shift = dist * tanH * centerNdc;
  return {
    from: [cx + ux * dist - rx * shift, lookY + uy * dist, cz + uz * dist - rz * shift],
    to: [cx - rx * shift, lookY, cz - rz * shift],
  };
}

/** Eases the camera to the chosen chapter's view; `go` changes whenever a chapter is chosen (even the same one again). */
const LIFE_OFFSET = new Vector3(-7.5, 4.4, 8.2);

export function ChapterCamera({ views, chapter, go, animRef, box, creature, followLife, orbitInteracting, followGate }: { views: Record<Chapter, View> | null; chapter: Chapter; go: number; animRef: MutableRefObject<boolean>; box: IslandBox | null; creature: MutableRefObject<{ pose: { x: number; y: number; z: number } } | null>; followLife: boolean; orbitInteracting: MutableRefObject<boolean>; /** Closed at once (before React re-renders) when the camera is sent elsewhere, so following cannot pull it back in between. */ followGate?: MutableRefObject<boolean> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const move = useRef<{ p0: Vector3; t0: Vector3; p1: Vector3; t1: Vector3; t: number } | null>(null);
  const lifeFlight = useRef<{ p0: Vector3; t0: Vector3; t: number } | null>(null);
  const lifeAim = useRef(new Vector3());
  const lifeOffset = useRef(LIFE_OFFSET.clone());
  const wasInteracting = useRef(false);
  const latest = useRef(views);
  latest.current = views;
  const ready = views !== null;
  const to = useRef(new Vector3());
  const from = useRef(new Vector3());
  useEffect(() => {
    const vs = latest.current;
    if (!vs || !controls) { move.current = null; lifeFlight.current = null; return; }
    if (chapter === 'life') {
      move.current = null;
      if (followLife && creature.current) {
        const p = creature.current.pose;
        lifeAim.current.set(p.x, p.y + 1.15, p.z);
        lifeOffset.current.copy(LIFE_OFFSET);
        wasInteracting.current = false;
        lifeFlight.current = { p0: camera.position.clone(), t0: controls.target.clone(), t: 0 };
        animRef.current = true;
      } else lifeFlight.current = null;
      return;
    }
    lifeFlight.current = null;
    const raw = vs[chapter];
    const v = chapter === 'arrival' && box ? frameIsland(raw, box, size.width, size.height) : raw;
    move.current = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new Vector3(...v.from), t1: new Vector3(...v.to), t: go === 0 ? 1 : 0 };
    animRef.current = true;
  }, [ready, chapter, go, camera, controls, animRef, size.width, size.height, box, followLife, creature]);
  useFrame((_, dt) => {
    if (chapter === 'life' && followLife && (followGate?.current ?? true) && creature.current && controls) {
      const p = creature.current.pose;
      to.current.set(p.x, p.y + 1.15, p.z);
      if (lifeFlight.current && orbitInteracting.current) {
        lifeOffset.current.subVectors(camera.position, controls.target);
        lifeFlight.current = null;
        animRef.current = false;
      }
      const flight = lifeFlight.current;
      if (flight) {
        // The destination is read every frame, so walking never sends us to a stale home point.
        flight.t = Math.min(1, flight.t + Math.min(dt, 0.08) / MOVE);
        const t = flight.t, e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        from.current.copy(to.current).add(LIFE_OFFSET);
        camera.position.lerpVectors(flight.p0, from.current, e);
        controls.target.lerpVectors(flight.t0, to.current, e);
        lifeAim.current.copy(to.current);
        if (t === 1) { lifeFlight.current = null; animRef.current = false; }
      } else {
        // A user rotation changes the orbit offset, not the followed subject. While dragging,
        // preserve OrbitControls' own camera movement and shift its pivot with the creature.
        const previousAim = lifeAim.current.clone();
        lifeAim.current.lerp(to.current, 1 - Math.exp(-Math.min(dt, 0.08) * 9));
        if (orbitInteracting.current) {
          const delta = lifeAim.current.clone().sub(previousAim);
          controls.target.add(delta);
          camera.position.add(delta);
          wasInteracting.current = true;
        } else {
          if (wasInteracting.current) {
            lifeOffset.current.subVectors(camera.position, controls.target);
            wasInteracting.current = false;
          }
          controls.target.copy(lifeAim.current);
          camera.position.copy(lifeAim.current).add(lifeOffset.current);
        }
        animRef.current = false;
      }
      controls.update();
      return;
    }
    const m = move.current;
    if (!m || !controls) return;
    m.t = Math.min(m.t + dt / MOVE, 1);
    const e = m.t < 0.5 ? 4 * m.t ** 3 : 1 - (-2 * m.t + 2) ** 3 / 2;
    camera.position.lerpVectors(m.p0, m.p1, e);
    controls.target.lerpVectors(m.t0, m.t1, e);
    controls.update();
    if (m.t >= 1) { move.current = null; animRef.current = false; }
  });
  return null;
}

/** One line of seed, day and what the creature is doing. It sits on the camera rail, not over the island. */
export function ExhibitStatus({ seed, day, doing }: { seed: number; day: number | null; doing: string | null }) {
  const { t } = useLanguage();
  return (
    <p className="exhibit-status">
      <span>{t('exhibit.seed')} {seed}</span>
      {day !== null && <span>{t('exhibit.day').replace('{n}', String(day))}</span>}
      {doing && <span>{doing}</span>}
    </p>
  );
}

/** Camera bookmarks, stacked on the left. The current one is marked. These are not time. */
export function CameraRail({ chapter, onChapter, children }: { chapter: Chapter; onChapter: (c: Chapter) => void; children?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <nav className="exhibit-cameras" aria-label={t('exhibit.cameras')}>
      {children}
      {CHAPTERS.map((c) => (
        <button
          key={c}
          type="button"
          className={c === chapter ? 'active' : ''}
          aria-current={c === chapter ? 'true' : undefined}
          aria-label={t(`exhibit.${c}` as StringKey)}
          title={t(`exhibit.${c}.caption` as StringKey)}
          onClick={() => onChapter(c)}
        >
          <CameraIcon name={c} />
          <span className="exhibit-camera-copy">{t(`exhibit.${c}` as StringKey)}</span>
        </button>
      ))}
    </nav>
  );
}

function CameraIcon({ name }: { name: Chapter }) {
  const shapes: Record<Chapter, ReactNode> = {
    arrival: <><circle cx="12" cy="12" r="8" /><path d="M4 14c3-4 5-4 8-2s5 2 8-2" /></>,
    mountains: <path d="m2 19 6-11 3 5 3-8 8 14H2Z" />,
    water: <><path d="M2 10c3-3 5 3 8 0s5-3 8 0 3 1 4 0M2 16c3-3 5 3 8 0s5-3 8 0 3 1 4 0" /></>,
    // A small deer (the jade dweller): body, neck up to the head, two branched antlers, four legs.
    life: <path d="M4.5 12.2c0-1.2 1-1.9 2.4-1.9h6.3l2-3.6M15.2 6.7h2.5l1.3 1.5-2 .6M4.5 12.2v1.4c0 .9.7 1.5 1.6 1.5h7.3c.9 0 1.5-.7 1.5-1.6v-3.2M6.4 15.1V20M8.8 15.1V20M12 15.1V20M14.4 14.6V20M4.5 12.2 3.2 11M15.8 6.6l-1.3-3M15.2 5.2l-1.7-.5M17.2 6.7l.9-3.1M17.8 5l1.8-.6" />,
  };
  return <svg className="exhibit-camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

export interface DebugToggles {
  skeleton: boolean;
  feet: boolean;
  state: boolean;
  route: boolean;
  contact: boolean;
  drink: boolean;
  rest: boolean;
}

export interface SettingControl {
  label: string;
  value: boolean | number | string;
  onChange: (value: boolean | number | string) => void;
  kind?: 'range' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  hint?: string;
}

export interface SettingSection { id?: string; title: string; controls: SettingControl[]; advanced?: boolean }

/** One visitor-facing panel. Leva still owns the underlying parameters but is not shown here. */
export function SettingsDrawer({ open, onOpen, run, onRun, speed, onSpeed, onAnother, onReset, debug, onDebug, sections, onResources, onCreature, hour, onHour, activity, trips }: {
  open: boolean;
  onOpen: (open: boolean) => void;
  run: boolean;
  onRun: (run: boolean) => void;
  speed: number;
  onSpeed: (speed: number) => void;
  onAnother: () => void;
  onReset: () => void;
  debug: DebugToggles;
  onDebug: (key: keyof DebugToggles, on: boolean) => void;
  sections: SettingSection[];
  onResources: () => void;
  onCreature: () => void;
  hour: number;
  onHour: (hour: number) => void;
  activity: string | null;
  trips: number | null;
}) {
  const { t } = useLanguage();
  const byId = (id: string) => sections.find((section) => section.id === id);
  return (
    <div className="exhibit-settings">
      <button
        type="button"
        className="exhibit-gear"
        aria-expanded={open}
        aria-label={t('exhibit.settings')}
        title={t('exhibit.settings')}
        onClick={() => onOpen(!open)}
      >
        <GearIcon />
      </button>
      {open && (
        <aside className="exhibit-drawer" aria-label={t('exhibit.settings')}>
          <header className="exhibit-drawer-header">
            <div><small>{t('exhibit.panelEyebrow')}</small><h2>{t('exhibit.settings')}</h2></div>
            <button type="button" className="exhibit-close" aria-label={t('exhibit.close')} onClick={() => onOpen(false)}>×</button>
          </header>
          <div className="exhibit-drawer-body">
            <section className="exhibit-panel-section">
              <h3>{t('exhibit.explore')}</h3>
              <div className="exhibit-panel-actions">
                <button type="button" onClick={onResources}>{t('exhibit.resources')}</button>
                <button type="button" onClick={onCreature}>{t('exhibit.creatureCard')}</button>
                <button type="button" onClick={onAnother}>{t('exhibit.another')}</button>
                <button type="button" onClick={onReset}>{t('leva.dwellReset')}</button>
              </div>
              <div className="exhibit-control-list">{(byId('explore')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
            </section>
            <section className="exhibit-panel-section">
              <h3>{t('exhibit.groupLook')}</h3>
              <div className="exhibit-control-list">{(byId('plants')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
              <SunTimes hour={hour} onHour={onHour} />
            </section>
            {/* Life: time and what it leaves, in one place (was two: run creature, creature debug). */}
            <section className="exhibit-panel-section">
              <h3>{t('exhibit.groupLife')}</h3>
              <SettingRow control={{ label: t('exhibit.run'), value: run, onChange: (v) => onRun(Boolean(v)) }} />
              <div className="exhibit-speed"><span>{t('exhibit.creatureSpeed')}</span><div>{[1, 10, 30].map((s) => <button type="button" key={s} className={s === speed ? 'active' : ''} onClick={() => onSpeed(s)}>{s}×</button>)}</div></div>
              {activity && <p className="exhibit-creature-now">{trips !== null ? `${t('exhibit.day').replace('{n}', String(trips + 1))} · ` : ''}{activity}{trips !== null ? ` · ${t('exhibit.returns').replace('{n}', String(trips))}` : ''}</p>}
              <h4>{t('exhibit.groupTraces')}</h4>
              <div className="exhibit-control-list">
                <SettingRow control={{ label: t('exhibit.pathNow'), value: debug.route, onChange: (v) => onDebug('route', Boolean(v)) }} />
                <SettingRow control={{ label: t('exhibit.prints'), value: debug.contact, onChange: (v) => onDebug('contact', Boolean(v)), hint: t('exhibit.printsHint') }} />
                <SettingRow control={{ label: t('exhibit.debugFeet'), value: debug.feet, onChange: (v) => onDebug('feet', Boolean(v)), hint: t('exhibit.printsHint') }} />
              </div>
              <h4>{t('exhibit.groupGoals')}</h4>
              <div className="exhibit-control-list">
                <SettingRow control={{ label: t('exhibit.dbg.state'), value: debug.state, onChange: (v) => onDebug('state', Boolean(v)) }} />
                <SettingRow control={{ label: t('exhibit.dbg.drink'), value: debug.drink, onChange: (v) => onDebug('drink', Boolean(v)) }} />
                <SettingRow control={{ label: t('exhibit.debugRest'), value: debug.rest, onChange: (v) => onDebug('rest', Boolean(v)) }} />
              </div>
            </section>
            <details className="exhibit-panel-section">
              <summary>{t('exhibit.groupShape')}<span aria-hidden="true">›</span></summary>
              <h4>{t('exhibit.groupMountain')}</h4>
              <div className="exhibit-control-list">{(byId('mountain')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
              <h4>{t('exhibit.groupWater')}</h4>
              <div className="exhibit-control-list">{(byId('water')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
              <h4>{t('exhibit.groupKeel')}</h4>
              <div className="exhibit-control-list">{(byId('keel')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
            </details>
            <details className="exhibit-panel-section exhibit-debug-section">
              <summary>{t('exhibit.groupMore')}<span aria-hidden="true">›</span></summary>
              <div className="exhibit-control-list">{(byId('dev')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
              <div className="exhibit-control-list">{(byId('quality')?.controls ?? []).map((control) => <SettingRow key={control.label} control={control} />)}</div>
            </details>
          </div>
        </aside>
      )}
    </div>
  );
}

function SettingRow({ control }: { control: SettingControl }) {
  const id = useId();
  if (typeof control.value === 'boolean') return <label className="exhibit-setting-row exhibit-setting-toggle"><span title={control.hint}>{control.label}</span><input type="checkbox" checked={control.value} onChange={(e) => control.onChange(e.target.checked)} /></label>;
  if (control.kind === 'select') return <label className="exhibit-setting-row"><span title={control.hint}>{control.label}</span><select value={control.value} onChange={(e) => control.onChange(control.options?.find((o) => String(o.value) === e.target.value)?.value ?? e.target.value)}>{control.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  if (control.kind === 'range') return <div className="exhibit-setting-range"><label htmlFor={id} title={control.hint}>{control.label}<output>{Number(control.value).toFixed(control.step && control.step < 1 ? 2 : 0)}</output></label><input id={id} type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={(e) => control.onChange(Number(e.target.value))} /></div>;
  return <label className="exhibit-setting-row"><span title={control.hint}>{control.label}</span><input type="number" value={control.value} onChange={(e) => control.onChange(Number(e.target.value))} /></label>;
}

/** After Life's flight, keep the same offset from the one creature. `id` is reserved for more than one. */
export function CreatureFollow({ id, active, pose, animRef }: { id: string; active: boolean; pose: { x: number; y: number; z: number }; animRef: MutableRefObject<boolean> }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const offset = useRef<Vector3 | null>(null);
  useFrame(() => {
    if (!active || !controls || id !== 'wonderland-creature') return;
    if (animRef.current) { offset.current = null; return; }
    if (!offset.current) offset.current = camera.position.clone().sub(controls.target);
    controls.target.set(pose.x, pose.y + 1.1, pose.z);
    camera.position.copy(controls.target).add(offset.current);
    controls.update();
  });
  return null;
}

export function IslandLoading({ phase, percent, step, failed, onRetry }: { phase: 'ground' | 'frame'; percent: number; step: string; failed: boolean; onRetry: () => void }) {
  const { t, language } = useLanguage();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const steps: Record<string, [string, string]> = {
    ground: ['塑造地形', 'Shaping terrain'], terrace: ['生成梯池', 'Building pools'], water: ['生成水系', 'Routing water'],
    habitat: ['生成栖息地', 'Growing habitat'], underside: ['生成岛底', 'Forming underside'],
    light: ['计算光照', 'Baking light'], frame: ['绘制首帧', 'Drawing first frame'],
  };
  return (
    <div className="exhibit-loading" role="status">
      <div className="exhibit-loading-card">
        <span className={failed ? 'exhibit-loading-error' : 'exhibit-spinner'} aria-hidden="true">{failed ? '!' : ''}</span>
        <p>{failed ? t('exhibit.loadFail') : phase === 'ground' ? t('exhibit.loadingGround') : t('exhibit.loadingFrame')}</p>
        {!failed && <>
          <strong className="exhibit-loading-percent">{value}%</strong>
          <progress className="exhibit-loading-progress" value={value} max={100} aria-label={t('exhibit.loadingGround')} />
          <small className="exhibit-loading-step">{steps[step]?.[language === 'zh' ? 0 : 1] ?? step}</small>
        </>}
        {failed && <button type="button" onClick={onRetry}>{t('exhibit.retry')}</button>}
      </div>
    </div>
  );
}

function SunTimes({ hour, onHour }: { hour: number; onHour: (hour: number) => void }) {
  const { t } = useLanguage();
  const now = nearestTimeOfDay(hour);
  const hh = Math.floor(TIME_HOURS[now]).toString().padStart(2, '0');
  return (
    <div className="exhibit-sun">
      <span>{t('exhibit.sunClock')} · {hh}:00</span>
      <div role="group" aria-label={t('exhibit.sunClock')}>
        {TIMES_OF_DAY.map((id) => (
          <button type="button" key={id} className={id === now ? 'active' : ''} onClick={() => onHour(TIME_HOURS[id])}>{t(`option.${id}` as StringKey)}</button>
        ))}
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.22-1.13.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.44.32.68.22l2.39-.96c.5.41 1.04.72 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.5-.22 1.04-.53 1.63-.94l2.39.96c.24.1.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
    </svg>
  );
}
