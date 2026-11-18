import { useEffect, useRef, useState } from 'react';
import { AmbientLight, Color, DirectionalLight, Group, Mesh, OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { useLanguage } from '../../i18n/LanguageContext';
import { AntlerRule } from './AntlerRule';
import { birthAxes, resolveMorph, type CreatureMorph, type MorphAxes } from './creatureMorph';
import { buildMorphGroup, disposeMorphGroup } from './creatureMorphMesh';
import { buildRigOverlay, buildRiggedCreature } from './creatureRig';

export const DEFAULT_CREATURE_SEED = 11;

interface MorphViewProps {
  worldSeed: number;
  creatureSeed: number;
  axes: MorphAxes;
  onAxes: (axes: MorphAxes) => void;
  onRandom: () => void;
  onRestore: () => void;
  birth: MorphAxes;
  /** Which island creature this edits (its name each), and picking another. */
  targets?: { names: string[]; index: number; onPick: (i: number) => void };
  /** Save these axes to that creature (it changes on the island at once, and stays after a reload). */
  onSave?: () => void;
  saved?: boolean;
}

function mountFigure(host: HTMLElement, width: number, height: number, worldSeed: number, creatureSeed: number, axes: MorphAxes, interactive: boolean) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  host.appendChild(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color('#e7eeec');
  scene.add(new AmbientLight(0xffffff, 0.82));
  const sun = new DirectionalLight(0xfff4e5, 1.15);
  sun.position.set(2.4, 3.2, 2.2);
  scene.add(sun);
  const fill = new DirectionalLight(0xd5e4e1, 0.45);
  fill.position.set(-2, 1.4, -1);
  scene.add(fill);
  const camera = new PerspectiveCamera(38, width / Math.max(height, 1), 0.05, 30);
  camera.position.set(interactive ? 1.7 : 1.9, interactive ? 1.35 : 1.4, interactive ? 2.8 : 3.0);
  camera.lookAt(0.18, 0.9, 0);
  const pivot = new Group();
  pivot.rotation.y = 0.55;
  scene.add(pivot);
  let figure = new Group();
  const draw = (nextAxes: MorphAxes, nextSeed: number, showSkeleton = false) => {
    disposeMorphGroup(figure);
    pivot.remove(figure);
    const morphology = resolveMorph({ worldSeed, creatureSeed: nextSeed, axes: nextAxes }).figure;
    figure = buildRiggedCreature(morphology);
    if (showSkeleton) {
      figure.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) { material.transparent = true; material.opacity = 0.28; material.depthWrite = false; }
      });
      figure.add(buildRigOverlay(morphology));
    }
    pivot.add(figure);
    renderer.render(scene, camera);
  };
  draw(axes, creatureSeed);
  let drag: number | null = null;
  const onDown = (event: PointerEvent) => { drag = event.clientX; host.setPointerCapture(event.pointerId); };
  const onMove = (event: PointerEvent) => {
    if (drag === null) return;
    pivot.rotation.y += (event.clientX - drag) * 0.01;
    drag = event.clientX;
    renderer.render(scene, camera);
  };
  const onUp = () => { drag = null; };
  if (interactive) {
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
  }
  return {
    redraw(nextAxes: MorphAxes, nextSeed: number, showSkeleton = false) { draw(nextAxes, nextSeed, showSkeleton); },
    resize(nextWidth: number, nextHeight: number) {
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / Math.max(nextHeight, 1);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    dispose() {
      if (interactive) {
        host.removeEventListener('pointerdown', onDown);
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerup', onUp);
      }
      disposeMorphGroup(figure);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

/** The catalog card cover, redrawn from the morph the detail is showing. */
export function MorphThumb({ worldSeed, creatureSeed, axes }: { worldSeed: number; creatureSeed: number; axes: MorphAxes }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<ReturnType<typeof mountFigure> | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const width = Math.max(el.clientWidth, 160);
    view.current = mountFigure(el, width, Math.round(width * 0.75), worldSeed, creatureSeed, axes, false);
    return () => { view.current?.dispose(); view.current = null; };
    // The renderer is created once; later morphs go through redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { view.current?.redraw(axes, creatureSeed); }, [axes, creatureSeed, worldSeed]);
  return <div ref={host} className="resource-thumb creature-thumb" />;
}

export function CreatureMorphPreview({ worldSeed, creatureSeed, axes, onAxes, onRandom, onRestore, birth, targets, onSave, saved }: MorphViewProps) {
  const { language, t } = useLanguage();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<ReturnType<typeof mountFigure> | null>(null);
  const zh = language === 'zh';
  const { morph } = resolveMorph({ worldSeed, creatureSeed, axes });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const width = Math.max(el.clientWidth, 280);
    view.current = mountFigure(el, width, Math.max(el.clientHeight, 240), worldSeed, creatureSeed, axes, true);
    const observer = new ResizeObserver(() => view.current?.resize(Math.max(el.clientWidth, 280), Math.max(el.clientHeight, 240)));
    observer.observe(el);
    return () => { observer.disconnect(); view.current?.dispose(); view.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { view.current?.redraw(axes, creatureSeed, showSkeleton); }, [axes, creatureSeed, worldSeed, showSkeleton]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const api = {
      morph,
      birth,
      setAxes: onAxes,
      random: onRandom,
      restore: onRestore,
    };
    (window as unknown as { guixuMorph?: typeof api }).guixuMorph = api;
  }, [morph, birth, onAxes, onRandom, onRestore]);
  const row = (key: 'bulk' | 'depth' | 'stature' | 'crown', name: string, low: string, high: string) => (
    <label>
      <span>{name}</span>
      <span>{low} — {high}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={axes[key]}
        aria-label={name}
        onChange={(event) => onAxes({ ...axes, [key]: Number(event.target.value) })}
      />
    </label>
  );
  return (
    <div className="morph-panel">
      <div className="morph-stage">
        <div ref={host} className="resource-preview-host" />
        <div className="morph-stage-tools">
          <button type="button" className="resource-btn" aria-pressed={showSkeleton} onClick={() => setShowSkeleton((shown) => !shown)}>
            {zh ? (showSkeleton ? '隐藏骨架' : '骨架') : (showSkeleton ? 'Hide rig' : 'Rig')}
          </button>
          <span>{zh ? '拖动旋转' : 'Drag to turn'}</span>
        </div>
      </div>
      <div className="morph-editor">
        {targets && targets.names.length > 1 && <div className="morph-choice morph-target"><span>{t('form.target')}</span><div className="morph-segments">
          {targets.names.map((n, i) => <button key={n} type="button" aria-pressed={i === targets.index} onClick={() => targets.onPick(i)}>{n}</button>)}
        </div></div>}
        <div className="morph-controls">
          <div className="morph-choice"><span>{zh ? '角型' : 'Horns'}</span><div className="morph-segments">
            {(['single', 'paired'] as const).map((type) => <button key={type} type="button" aria-pressed={axes.hornType === type} onClick={() => onAxes({ ...axes, hornType: type })}>{zh ? (type === 'single' ? '独角' : '双角') : (type === 'single' ? 'Single' : 'Paired')}</button>)}
          </div></div>
          {row('bulk', t('morph.bulk'), t('morph.bulk.low'), t('morph.bulk.high'))}
          {row('depth', t('morph.depth'), t('morph.depth.low'), t('morph.depth.high'))}
          {row('stature', t('morph.stature'), t('morph.stature.low'), t('morph.stature.high'))}
          <div className="morph-choice"><span title={t('morph.antlerRule').replace('{s}', '56')}>{t('morph.branches')}</span>
            <AntlerRule generations={axes.branches} onPick={(g) => onAxes({ ...axes, branches: g })} />
          </div>
          {row('crown', t('morph.crown'), t('morph.crown.low'), t('morph.crown.high'))}
        </div>
        {onSave && targets ? <div className="morph-actions">
          <button type="button" className="resource-btn morph-save" onClick={onSave} disabled={saved} title={t('form.saveNote')}>{saved ? t('form.saved') : t('form.save').replace('{n}', targets.names[targets.index])}</button>
        </div> : <div className="morph-actions">
          <button type="button" className="resource-btn" onClick={onRandom}>{zh ? '生成新形态' : 'New form'}</button>
          <button type="button" className="resource-btn" onClick={onRestore}>{zh ? '恢复出生形态' : 'Birth form'}</button>
        </div>}
      </div>
    </div>
  );
}

const SHEET: { axes: MorphAxes }[] = [
  { axes: { bulk: 0, depth: 0, stature: 1, crown: 0.45, hornType: 'paired', branches: 2 } },
  { axes: { bulk: 1, depth: 1, stature: 0.35, crown: 0.25, hornType: 'paired', branches: 2 } },
  { axes: { bulk: 0.45, depth: 0.5, stature: 0.5, crown: 0, hornType: 'single', branches: 1 } },
  { axes: { bulk: 0.45, depth: 0.5, stature: 0.5, crown: 1, hornType: 'paired', branches: 3 } },
  { axes: { bulk: 0.5, depth: 0.5, stature: 0.5, crown: 0.5, hornType: 'single', branches: 0 } },
  { axes: { bulk: 0.72, depth: 0.75, stature: 0.62, crown: 0.7, hornType: 'paired', branches: 3 } },
];

/** Black side views at one scale. Only when the page is opened with ?morphSheet=1. */
export function MorphSheet() {
  const host = useRef<HTMLDivElement>(null);
  const on = new URLSearchParams(window.location.search).has('morphSheet');
  useEffect(() => {
    const el = host.current;
    if (!on || !el) return;
    const width = 1440, height = 420;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    el.appendChild(renderer.domElement);
    const scene = new Scene();
    scene.background = new Color('#f4f1ea');
    scene.add(new AmbientLight(0xffffff, 1));
    const camera = new OrthographicCamera(-8.4, 8.4, 1.7, -0.4, 0.1, 20);
    camera.position.set(0, 0.9, 8);
    camera.lookAt(0, 0.9, 0);
    const groups: Group[] = [];
    SHEET.forEach((item, index) => {
      const { figure } = resolveMorph({ worldSeed: 684, creatureSeed: 18421, axes: item.axes });
      const group = buildMorphGroup(figure, true);
      group.position.x = -6.25 + index * 2.5;
      group.rotation.y = 0;
      scene.add(group);
      groups.push(group);
    });
    renderer.render(scene, camera);
    return () => {
      groups.forEach(disposeMorphGroup);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [on]);
  if (!on) return null;
  return <div ref={host} className="morph-sheet" />;
}

export function sameBirth(seed: number): boolean {
  const a = birthAxes(seed);
  const b = birthAxes(seed);
  return a.bulk === b.bulk && a.depth === b.depth && a.stature === b.stature && a.crown === b.crown && a.hornType === b.hornType && a.branches === b.branches;
}

export type { CreatureMorph };
