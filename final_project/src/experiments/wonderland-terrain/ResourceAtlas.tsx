import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AmbientLight, BoxGeometry, CapsuleGeometry, Color, DataTexture, DirectionalLight, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, RGBAFormat, Scene, WebGLRenderer, type Object3D,
} from 'three';
import { expandPine, GROWN_PINE_HEIGHT, interpretPine, pineGeometry } from '../../core/generators/pine';
import { formatSizeBox, type ResourceCategory, type ResourceDef, type SizeBox } from '../../core/resources/types';
import { PERSON_HEIGHT } from '../../core/scale';
import { PORCELAIN } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { getPalette } from '../../core/palette';
import { createFlowerGeometry, createFlowerMaterial } from '../../core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../../core/shaders/grass';
import { createPineMaterial } from '../../core/shaders/pine';
import { createPropMaterial } from '../../core/shaders/prop';
import { applyPalette, createWorldUniforms, setSunDirection } from '../../core/shaders/uniforms';
import { COVER_NEAR as COVER } from './CoverGrass';
import { makeShrubPreviewGeometry, shrubToneColors } from './ShrubPatches';
import type { ShrubTone } from './shrubs';
import { steleGeometry } from './stele';
import { wonderlandResourceList, type IslandResourceMap } from './resourceCatalog';

const CATS: ResourceCategory[] = ['vegetation', 'creatures', 'props', 'terrain'];

const FALLBACK_NAME: Record<string, { en: string; zh: string }> = {
  shrub: { en: 'Low shrub', zh: '低灌丛' },
  grass: { en: 'Grass', zh: '草' },
  flower: { en: 'Flower', zh: '花' },
  pine: { en: 'Pine', zh: '松' },
  creature: { en: 'Dwelling creature', zh: '栖居生灵' },
  person: { en: 'Person', zh: '人' },
  stele: { en: 'Stele', zh: '石碑' },
  island: { en: 'Island', zh: '岛屿' },
  peak: { en: 'Main peak', zh: '主峰' },
  pool: { en: 'Pool', zh: '水池' },
  shrubPenglai: { en: 'Penglai shrub', zh: '蓬莱灌丛' },
};

function nameOf(def: ResourceDef, language: string, t: (k: StringKey) => string): string {
  const key = `resources.item.${def.nameKey}` as StringKey;
  const label = t(key);
  if (label !== key) return label;
  const fb = FALLBACK_NAME[def.nameKey];
  return fb ? (language === 'zh' ? fb.zh : fb.en) : def.id;
}

function makeClumpBlades(n: number, seed: number, rMax: number, y = 0) {
  const offset = new Float32Array(n * 3);
  const shape = new Float32Array(n * 4);
  let s = (seed >>> 0) || 1;
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * rMax;
    offset[i * 3] = Math.cos(a) * r;
    offset[i * 3 + 1] = y;
    offset[i * 3 + 2] = Math.sin(a) * r;
    shape[i * 4] = a + (rng() - 0.5) * 0.6;
    shape[i * 4 + 1] = 0.7 + 0.5 * rng();
    shape[i * 4 + 2] = 0.3 + 0.6 * rng();
    shape[i * 4 + 3] = rng();
  }
  return { offset, shape, count: n };
}

function fitCamera(cam: PerspectiveCamera, h: number, width: number, aspect: number) {
  // Frame by moving the camera only — never non-uniform scale on the subject.
  const dist = Math.max(h * 2.35, width * 1.6, 1.6);
  cam.aspect = aspect;
  cam.near = 0.05;
  cam.far = Math.max(80, dist * 8);
  cam.position.set(dist * 0.72, Math.max(h * 0.5, 0.45), dist);
  cam.lookAt(0, h * 0.32, 0);
  cam.updateProjectionMatrix();
}

/** Bound sampler so grass/flower shaders never sample a null wind texture in atlas WebGL. */
const PREVIEW_WIND = (() => {
  const t = new DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

function previewUniforms() {
  const uniforms = createWorldUniforms();
  applyPalette(uniforms, getPalette('qinglv', 14));
  setSunDirection(uniforms, 0.6, 55); // azimuth rad, elevation deg — high key for readable plant colour
  // Match island flower accents on porcelain.
  uniforms.uAccent.value.set(PORCELAIN.coverFlower);
  uniforms.uRimColor.value.set(PORCELAIN.coverFlowerRim);
  uniforms.uMeadow.value.set(PORCELAIN.cover);
  // Heart ochre reads through the accent mix in the flower shader.
  uniforms.uWindField.value = PREVIEW_WIND;
  uniforms.uWindHalf.value = 0; // windAt falls back to WIND_DIR (no field sample)
  uniforms.uWind.value = 0.15; // quiet sway — still initializes the uniform
  return uniforms;
}

function buildSubject(def: ResourceDef, sampleSeed: number, toneOverride?: ShrubTone): { object: Object3D; size: SizeBox; dispose: () => void; metrics?: string } {
  const uniforms = previewUniforms();
  if (def.preview === 'shrub') {
    const variant = sampleSeed % 3;
    const tone = (toneOverride ?? (sampleSeed % 10 < 8 ? 0 : sampleSeed % 10 === 8 ? 1 : 2)) as ShrubTone;
    const h = 0.55 + 0.05 * (sampleSeed % 7);
    const w = 1.35 + 0.05 * (sampleSeed % 5);
    const { geometry, metrics, disposeExtra } = makeShrubPreviewGeometry(variant, tone);
    const mat = createPineMaterial(uniforms);
    const [hi, lo] = shrubToneColors(tone);
    (mat.uniforms.uNeedle.value as Color).set(hi);
    (mat.uniforms.uNeedleShade.value as Color).set(lo);
    (mat.uniforms.uBark.value as Color).set(PORCELAIN.pineBark);
    mat.uniforms.uSnow.value = 0;
    const mesh = new Mesh(geometry, mat);
    mesh.scale.set(h * w, h, h * w);
    return {
      object: mesh,
      size: { height: [h, h], width: [h * w, h * w] },
      metrics: `叶 ${metrics.worldLeafL.toFixed(3)}×${metrics.worldLeafW.toFixed(3)} m · 冠幅 ${metrics.crownWidth.toFixed(2)} m`,
      dispose: () => { geometry.dispose(); mat.dispose(); disposeExtra?.(); },
    };
  }
  if (def.preview === 'pine') {
    const seed = 9000 + (sampleSeed % 97);
    const geom = pineGeometry(interpretPine(expandPine(seed), seed), 0, seed);
    const mat = createPineMaterial(uniforms);
    (mat.uniforms.uNeedle.value as Color).set(PORCELAIN.pineNeedle);
    (mat.uniforms.uNeedleShade.value as Color).set(PORCELAIN.pineNeedleShade);
    (mat.uniforms.uBark.value as Color).set(PORCELAIN.pineBark);
    const h = 8 + (sampleSeed % 5);
    const mesh = new Mesh(geom, mat);
    mesh.scale.setScalar(h / GROWN_PINE_HEIGHT);
    return { object: mesh, size: { height: [h, h], width: [h * 0.45, h * 0.45] }, dispose: () => { geom.dispose(); mat.dispose(); } };
  }
  if (def.preview === 'grass') {
    // One clump — island grass shader; preview uses real bladeH (camera frames close, no Y squash).
    const blades = makeClumpBlades(16, sampleSeed, COVER.clumpR);
    const geom = createGrassGeometry(blades);
    const mat = createGrassMaterial(uniforms);
    mat.uniforms.uBladeHeight.value = COVER.bladeH;
    mat.uniforms.uFadeNear.value = 500;
    mat.uniforms.uFadeFar.value = 600;
    mat.uniforms.uVisibility.value = 1;
    (mat.uniforms.uMeadow.value as Color).set(PORCELAIN.cover);
    const mesh = new Mesh(geom, mat);
    // Slight XZ widen only for silhouette readability in the small frame (height stays real metres).
    mesh.scale.set(1.35, 1, 1.35);
    return {
      object: mesh,
      size: { height: [COVER.bladeH, COVER.bladeH], width: [COVER.clumpR * 2.2, COVER.clumpR * 2.2] },
      dispose: () => { geom.dispose(); mat.dispose(); },
    };
  }
  if (def.preview === 'flower') {
    const heads = makeClumpBlades(7, sampleSeed + 3, COVER.flowerR);
    const geom = createFlowerGeometry(heads);
    const mat = createFlowerMaterial(uniforms);
    mat.uniforms.uStemHeight.value = COVER.stemH;
    mat.uniforms.uHeadSize.value = COVER.head * 1.15;
    mat.uniforms.uFadeNear.value = 500;
    mat.uniforms.uFadeFar.value = 600;
    mat.uniforms.uVisibility.value = 1;
    mat.uniforms.uBloom.value = 1;
    const mesh = new Mesh(geom, mat);
    const h = COVER.stemH + COVER.head;
    return {
      object: mesh,
      size: { height: [h, h], width: [COVER.flowerR * 2.2, COVER.flowerR * 2.2] },
      dispose: () => { geom.dispose(); mat.dispose(); },
    };
  }
  if (def.preview === 'stele') {
    const geom = steleGeometry(sampleSeed);
    const mat = createPropMaterial(uniforms, PORCELAIN.crease);
    return { object: new Mesh(geom, mat), size: def.config, dispose: () => { geom.dispose(); mat.dispose(); } };
  }
  if (def.preview === 'person') {
    const mat = new MeshStandardMaterial({ color: '#c4b8a8' });
    const mesh = new Mesh(new CapsuleGeometry(0.14, PERSON_HEIGHT - 0.28, 4, 8), mat);
    mesh.position.y = PERSON_HEIGHT / 2;
    return { object: mesh, size: { height: [PERSON_HEIGHT, PERSON_HEIGHT] }, dispose: () => { mesh.geometry.dispose(); mat.dispose(); } };
  }
  return { object: new Group(), size: def.config, dispose: () => {} };
}

function addPerson(group: Group) {
  const mat = new MeshStandardMaterial({ color: '#c4b8a8' });
  const mesh = new Mesh(new CapsuleGeometry(0.12, PERSON_HEIGHT - 0.24, 4, 8), mat);
  mesh.position.set(0.55, PERSON_HEIGHT / 2, 0);
  group.add(mesh);
  return () => { mesh.geometry.dispose(); mat.dispose(); };
}

function addMetreRuler(group: Group, h: number) {
  const mat = new MeshBasicMaterial({ color: '#3a3630' });
  const bar = new Mesh(new BoxGeometry(1, 0.012, 0.012), mat);
  bar.position.set(0, 0.006, Math.max(h * 0.35, 0.35));
  group.add(bar);
  const tick = new Mesh(new BoxGeometry(0.012, 0.05, 0.012), mat);
  tick.position.set(-0.5, 0.025, bar.position.z);
  group.add(tick);
  const tick2 = tick.clone();
  tick2.position.x = 0.5;
  group.add(tick2);
  return () => {
    bar.geometry.dispose();
    tick.geometry.dispose();
    (tick2.geometry as BoxGeometry).dispose();
    mat.dispose();
  };
}

/**
 * Standalone WebGL preview. Camera aspect tracks the host box (ResizeObserver).
 * Framing moves the camera only — subject keeps real proportions.
 */
function DetailPreview({ def, sampleSeed, personRef, shrubTone }: { def: ResourceDef; sampleSeed: number; personRef: boolean; shrubTone: ShrubTone }) {
  const host = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<string | null>(null);
  useEffect(() => {
    if (!def.preview || !host.current) return;
    const subject = buildSubject(def, sampleSeed, def.preview === 'shrub' ? shrubTone : undefined);
    setMetrics(subject.metrics ?? null);
    const plantH = subject.size.height?.[1] ?? 1;
    const plantW = subject.size.width?.[1] ?? plantH * 0.5;
    // Person-in-frame must NOT inflate grass/flower framing — blades vanish when camera fits 1.7 m.
    const frameOnPlant = def.preview === 'grass' || def.preview === 'flower';
    const h = frameOnPlant ? plantH : Math.max(plantH, personRef ? PERSON_HEIGHT : 0);
    const width = frameOnPlant ? plantW : Math.max(plantW, personRef ? 0.4 : 0);
    const scene = new Scene();
    // Neutral mid-grey: pale plants stay visible (not washed on cream).
    // Darker neutral for pale cover plants (do not darken island materials).
    scene.background = new Color(frameOnPlant ? '#4e4c48' : '#d8e0e2');
    scene.add(new AmbientLight(0xffffff, frameOnPlant ? 0.55 : 0.75));
    const key = new DirectionalLight(0xffffff, frameOnPlant ? 1.55 : 1.25);
    key.position.set(2, 5, 3);
    scene.add(key);
    const pivot = new Group();
    pivot.add(subject.object);
    let disposePerson: (() => void) | undefined;
    // Scale reference beside clump only when it fits the frame without pushing the camera back.
    if (personRef && def.preview !== 'person' && !frameOnPlant) disposePerson = addPerson(pivot);
    const disposeRuler = addMetreRuler(pivot, Math.max(h, frameOnPlant ? 1 : h));
    scene.add(pivot);
    const cam = new PerspectiveCamera(35, 1, 0.05, 80);
    // Grass/flower: close low eye so thin blades read; height stays real (camera only).
    if (frameOnPlant) {
      const dist = Math.max(plantH * 2.0, plantW * 1.15, 0.48);
      cam.position.set(dist * 0.95, Math.max(plantH * 0.5, 0.18), dist * 0.9);
      cam.lookAt(0, plantH * 0.42, 0);
    }
    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(1);
    const el = host.current;
    el.replaceChildren(renderer.domElement);
    renderer.domElement.className = 'resource-preview-canvas';

    const syncSize = () => {
      const w = Math.max(el.clientWidth, 1);
      const ht = Math.max(el.clientHeight, 1);
      renderer.setSize(w, ht, false);
      if (def.preview === 'grass' || def.preview === 'flower') {
        cam.aspect = w / ht;
        cam.updateProjectionMatrix();
      } else {
        fitCamera(cam, h, width, w / ht);
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(el);

    let drag = false, lastX = 0, raf = 0;
    const onDown = (e: PointerEvent) => { drag = true; lastX = e.clientX; };
    const onUp = () => { drag = false; };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      pivot.rotation.y += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    const tick = () => {
      if (!drag) pivot.rotation.y += 0.004;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      disposePerson?.();
      disposeRuler();
      subject.dispose();
      renderer.dispose();
      if (host.current) host.current.replaceChildren();
    };
  }, [def, sampleSeed, personRef, shrubTone]);
  if (!def.preview) return null;
  return (
    <>
      <div ref={host} className="resource-preview-host" />
      {metrics && <p className="resource-muted">{metrics}</p>}
    </>
  );
}

/** Offscreen WebGL → data URL. Bump THUMB_VER when framing/materials change so old white covers die. */
const THUMB_VER = 'v6';
const thumbUrlCache = new Map<string, string>();
/** One shared context — creating a renderer per card exhausts WebGL and blanks the detail preview. */
let sharedThumbRenderer: WebGLRenderer | null = null;
function thumbRenderer(): WebGLRenderer {
  if (!sharedThumbRenderer) {
    sharedThumbRenderer = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    sharedThumbRenderer.setPixelRatio(1);
  }
  return sharedThumbRenderer;
}

function renderThumbDataUrl(def: ResourceDef): string | null {
  const key = `${THUMB_VER}:${def.preview ?? def.id}`;
  const hit = thumbUrlCache.get(key);
  if (hit) return hit;
  if (!def.preview) return null;
  try {
    const subject = buildSubject(def, 11, 0);
    const scene = new Scene();
    scene.background = new Color(def.preview === 'grass' || def.preview === 'flower' ? '#4e4c48' : '#ebe6dc');
    scene.add(new AmbientLight(0xffffff, def.preview === 'grass' || def.preview === 'flower' ? 0.55 : 0.85));
    const keyL = new DirectionalLight(0xffffff, def.preview === 'grass' || def.preview === 'flower' ? 1.55 : 1.2);
    keyL.position.set(2, 4, 3);
    scene.add(keyL);
    scene.add(subject.object);
    const hh = subject.size.height?.[1] ?? 1;
    const ww = subject.size.width?.[1] ?? hh * 0.5;
    const w = 160, h = 120;
    const cam = new PerspectiveCamera(35, w / h, 0.05, 80);
    if (def.preview === 'grass' || def.preview === 'flower') {
      const dist = Math.max(hh * 2.0, ww * 1.2, 0.5);
      cam.position.set(dist * 0.95, Math.max(hh * 0.5, 0.16), dist * 0.9);
      cam.lookAt(0, hh * 0.4, 0);
      cam.updateProjectionMatrix();
    } else {
      fitCamera(cam, hh, ww, w / h);
    }
    const renderer = thumbRenderer();
    renderer.setSize(w, h, false);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    subject.dispose();
    thumbUrlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

function Thumb({ def }: { def: ResourceDef }) {
  const cacheKey = def.preview ? `${THUMB_VER}:${def.preview}` : '';
  const [url, setUrl] = useState<string | null>(() => (cacheKey ? thumbUrlCache.get(cacheKey) ?? null : null));
  useEffect(() => {
    if (!def.preview) {
      setUrl(null);
      return;
    }
    const cached = thumbUrlCache.get(`${THUMB_VER}:${def.preview}`);
    if (cached) { setUrl(cached); return; }
    const id = requestAnimationFrame(() => setUrl(renderThumbDataUrl(def)));
    return () => cancelAnimationFrame(id);
  }, [def]);
  if (!url) {
    return (
      <div className="resource-thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 11, color: '#5a5348' }}>
        {def.preview ? '…' : (def.category === 'creatures' ? '场景定位' : '定位')}
      </div>
    );
  }
  return <img src={url} width={160} height={120} className="resource-thumb" alt="" />;
}

function countLabel(live: IslandResourceMap[string] | undefined, t: (k: StringKey) => string): string {
  if (!live) return '—';
  if (live.loadedCount != null) {
    const anchors = live.islandAnchors == null
      ? t('resources.countUntracked')
      : `${t('resources.countAnchors')}: ${live.islandAnchors}`;
    return `${t('resources.countLoaded')}: ${live.loadedCount} · ${anchors}`;
  }
  return `${live.count}`;
}

function islandSizeText(live: IslandResourceMap[string] | undefined, t: (k: StringKey) => string): string {
  if (!live) return t('resources.none');
  // Grass/flower: config-scale is known even when nothing is loaded near the camera.
  if (live.loadedCount != null) {
    const box = formatSizeBox(live.islandSize, t('resources.metre'));
    return box === '—' ? t('resources.countUntracked') : `${box} (${t('resources.countLoaded')}: ${live.loadedCount})`;
  }
  if (live.count <= 0) return t('resources.none');
  return formatSizeBox(live.islandSize, t('resources.metre'));
}

export interface ResourceAtlasProps {
  open: boolean;
  onClose: () => void;
  island: IslandResourceMap;
  onLocate: (pos: { x: number; y: number; z: number }) => void;
}

export function ResourceAtlas({ open, onClose, island, onLocate }: ResourceAtlasProps) {
  const { language, t } = useLanguage();
  const list = useMemo(() => wonderlandResourceList(), []);
  const [cat, setCat] = useState<ResourceCategory>('vegetation');
  const [sel, setSel] = useState<string | null>(null);
  const [sampleSeed, setSampleSeed] = useState(1);
  const [personRef, setPersonRef] = useState(true);
  const [shrubTone, setShrubTone] = useState<ShrubTone>(0);
  const def = list.find((r) => r.id === sel) ?? null;
  const live = def ? island[def.id] : undefined;
  const hasPreview = !!def?.preview;

  useEffect(() => { if (!open) setSel(null); }, [open]);
  if (!open) return null;

  const cards = list.filter((r) => r.category === cat);

  return (
    <div className="resource-atlas" role="dialog" aria-label={t('resources.title')}>
      <div className="resource-atlas-bar">
        <strong>{t('resources.title')}</strong>
        <button type="button" className="resource-btn" onClick={onClose}>{t('resources.close')}</button>
      </div>
      <div className="resource-cats">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            className={`resource-cat${cat === c ? ' on' : ''}`}
            onClick={() => { setCat(c); setSel(null); }}
          >
            {t(`resources.cat.${c}` as StringKey)}
          </button>
        ))}
      </div>
      <div className="resource-body">
        <div className="resource-cards">
          {cards.map((r) => {
            const liveR = island[r.id];
            return (
              <button
                key={r.id}
                type="button"
                className={`resource-card${sel === r.id ? ' on' : ''}`}
                onClick={() => { setSel(r.id); setSampleSeed((s) => s + 1); }}
              >
                <Thumb def={r} />
                <div className="resource-card-text">
                  <div className="resource-card-name">{nameOf(r, language, t)}</div>
                  <div className="resource-card-size">{formatSizeBox(r.config, t('resources.metre'))}</div>
                  <div className="resource-card-count">{t('resources.count')}: {countLabel(liveR, t)}</div>
                </div>
              </button>
            );
          })}
          {cards.length === 0 && <p className="resource-muted">—</p>}
        </div>
        {def && (
          <div className="resource-detail">
            <h3>{nameOf(def, language, t)}</h3>
            <p><b>{t('resources.sizeRange')}</b> {formatSizeBox(def.config, t('resources.metre'))}</p>
            {hasPreview && (
              <p><b>{t('resources.sampleSize')}</b> {formatSizeBox(sampleSize(def, sampleSeed), t('resources.metre'))}</p>
            )}
            <p><b>{t('resources.islandSize')}</b> {islandSizeText(live, t)}</p>
            <p><b>{t('resources.count')}</b> {countLabel(live, t)}</p>
            {def.variants != null && <p><b>{t('resources.variants')}</b> {def.variants}</p>}
            <p><b>{t('resources.rule')}</b> {language === 'zh' ? def.ruleZh : def.ruleEn}</p>
            {(def.noteEn || def.noteZh) && (
              <p className="resource-muted">{language === 'zh' ? def.noteZh : def.noteEn}</p>
            )}
            <div className="resource-preview-wrap">
              {hasPreview ? (
                <DetailPreview def={def} sampleSeed={sampleSeed} personRef={personRef && def.preview !== 'person'} shrubTone={shrubTone} />
              ) : (
                <p className="resource-muted">
                  {language === 'zh'
                    ? '暂无独立模型预览。请用「定位」看岛上真实实例（不用代理圆锥或白方块）。'
                    : 'No stand-alone preview. Use Locate for the live island instance (no proxy mesh).'}
                </p>
              )}
              <div className="resource-preview-tools">
                {hasPreview && (
                  <>
                    <label>
                      <input type="checkbox" checked={personRef} onChange={(e) => setPersonRef(e.target.checked)} />
                      {' '}{t('resources.personRef')}
                    </label>
                    {def.preview === 'shrub' && (
                      <label>
                        {language === 'zh' ? '色相' : 'Tone'}{' '}
                        <select value={shrubTone} onChange={(e) => setShrubTone(Number(e.target.value) as ShrubTone)}>
                          <option value={0}>暖灰橄榄绿</option>
                          <option value={1}>赭黄</option>
                          <option value={2}>暗铁红</option>
                        </select>
                      </label>
                    )}
                    <button type="button" className="resource-btn" onClick={() => setSampleSeed((s) => s + 17)}>
                      {t('resources.resample')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="resource-btn"
                  disabled={!live?.locate}
                  onClick={() => live?.locate && onLocate(live.locate)}
                >
                  {t('resources.locate')}
                </button>
              </div>
              {hasPreview && (
                <p className="resource-muted">{t('resources.rotate')} · 1 {t('resources.metre')}</p>
              )}
              {live?.note && <p className="resource-muted">{live.note}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function sampleSize(def: ResourceDef, seed: number): SizeBox {
  const r = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0xffffffff;
  const pick = (range?: [number, number]): [number, number] | undefined => {
    if (!range) return undefined;
    const v = range[0] + (range[1] - range[0]) * r;
    return [v, v];
  };
  return { height: pick(def.config.height), width: pick(def.config.width), depth: pick(def.config.depth) };
}
