import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AmbientLight, BoxGeometry, CapsuleGeometry, Color, DirectionalLight, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderer, type Object3D,
} from 'three';
import { expandPine, GROWN_PINE_HEIGHT, interpretPine, pineGeometry } from '../../core/generators/pine';
import { BROADLEAF, growBroadleaf } from './broadleaf';
import { PlantEditor, PLANT_COLOURS, previewUniforms } from './PlantEditor';
import { isPlantBirth, plantModels, type PlantKind, type PlantKnobs } from './plantModels';
import { ShrubMix } from './ShrubMix';
import { shrubMix } from './shrubs';
import { type ResourceCategory, type ResourceDef, type SizeBox } from '../../core/resources/types';
import { PERSON_HEIGHT } from '../../core/scale';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { CreatureMorphPreview, DEFAULT_CREATURE_SEED, MorphThumb } from './CreatureMorphPreview';
import { birthAxes, type MorphAxes } from './creatureMorph';
import { createRng } from '../../core/rng';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { createFlowerGeometry, createFlowerMaterial } from '../../core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../../core/shaders/grass';
import { createPineMaterial } from '../../core/shaders/pine';
import { createPropMaterial } from '../../core/shaders/prop';
import { COVER_NEAR as COVER } from './CoverGrass';
import { makeShrubPreviewGeometry, shrubToneColors } from './ShrubPatches';
import type { ShrubTone } from './shrubs';
import { steleGeometry } from './stele';
import { wonderlandResourceList, type IslandResourceMap } from './resourceCatalog';
import type { DwellingStats } from './creature';
import type { StreamFishData } from './streamFish';
import { FishPreview } from './FishSchool';
import { FishEditor } from './FishGrowth';
import { DenEditor, DenThumb } from './DenEditor';
import { birthShell, type ShellParams } from './rockShell';
import { dwellerForm } from './dwellerNames';
import { formFromSeed, type FishForm } from './fishForm';

// The terrain & water page is gone (owner, 2026-11-21): it had nothing to show but a locate.
const CATS: ResourceCategory[] = ['vegetation', 'creatures', 'props'];
/** Cards that open as a full editor (the model left, knobs right). */
const PLANT_IDS: Record<string, PlantKind> = {
  'wonderland-shrub': 'shrub', 'wonderland-grass': 'grass', 'wonderland-flower': 'flower',
  'wonderland-pine': 'pine', 'wonderland-parasol': 'parasol', 'wonderland-weeping': 'weeping',
};
/** Every plant opens the same editor (PlantEditor), as the creature, the fish and the den do theirs. */
const EDITORS = new Set(['wonderland-creature', 'wonderland-stream-fish', 'wonderland-den', ...Object.keys(PLANT_IDS)]);
const plantKind = (id?: string | null): PlantKind | null => (id ? PLANT_IDS[id] ?? null : null);

const FALLBACK_NAME: Record<string, { en: string; zh: string }> = {
  shrub: { en: 'Low shrub', zh: '低灌丛' },
  grass: { en: 'Grass', zh: '草' },
  flower: { en: 'Flower', zh: '花' },
  pine: { en: 'Pine', zh: '松' },
  parasol: { en: 'Parasol tree', zh: '伞冠树' },
  weeping: { en: 'Weeping tree', zh: '垂枝树' },
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

function buildSubject(def: ResourceDef, sampleSeed: number, toneOverride?: ShrubTone): { object: Object3D; size: SizeBox; dispose: () => void } {
  const uniforms = previewUniforms();
  if (def.preview === 'shrub') {
    const variant = sampleSeed % 3;
    const tone = (toneOverride ?? (sampleSeed % 10 < 8 ? 0 : sampleSeed % 10 === 8 ? 1 : 2)) as ShrubTone;
    const h = 0.55 + 0.05 * (sampleSeed % 7);
    const w = 1.35 + 0.05 * (sampleSeed % 5);
    const { geometry, disposeExtra } = makeShrubPreviewGeometry(variant, tone);
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
  if (def.preview === 'parasol' || def.preview === 'weeping') {
    // The tree grown by its own L-system (broadleaf.ts), at a real height from its range.
    const kind = def.preview;
    const tree = growBroadleaf(kind, 1 + (sampleSeed % 97));
    const mat = createPineMaterial(uniforms);
    (mat.uniforms.uNeedle.value as Color).set(PLANT_COLOURS[kind][0]);
    (mat.uniforms.uNeedleShade.value as Color).set(PLANT_COLOURS[kind][1]);
    (mat.uniforms.uBark.value as Color).set(PORCELAIN.broadleafBark);
    const [lo, hi] = BROADLEAF[kind].height;
    const h = lo + (hi - lo) * ((sampleSeed % 5) / 4);
    const mesh = new Mesh(tree.geometry, mat);
    mesh.scale.setScalar(h);
    const w = +(tree.spread * h).toFixed(1);
    return {
      object: mesh,
      size: { height: [h, h], width: [w, w] },
      dispose: () => { tree.geometry.dispose(); mat.dispose(); },
    };
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
function DetailPreview({ def, sampleSeed, personRef }: { def: ResourceDef; sampleSeed: number; personRef: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!def.preview || !host.current) return;
    const subject = buildSubject(def, sampleSeed);
    const plantH = subject.size.height?.[1] ?? 1;
    const plantW = subject.size.width?.[1] ?? plantH * 0.5;
    // Person-in-frame must NOT inflate grass/flower framing — blades vanish when camera fits 1.7 m.
    const frameOnPlant = def.preview === 'grass' || def.preview === 'flower';
    const h = frameOnPlant ? plantH : Math.max(plantH, personRef ? PERSON_HEIGHT : 0);
    const width = frameOnPlant ? plantW : Math.max(plantW, personRef ? 0.4 : 0);
    const scene = new Scene();
    // Every atlas picture stands on the same mist (owner, 2026-11-21: one look for every card).
    scene.background = new Color(JADE_UI.mist);
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
  }, [def, sampleSeed, personRef]);
  if (!def.preview) return null;
  return <div ref={host} className="resource-preview-host" />;
}

/** Offscreen WebGL → data URL. Bump THUMB_VER when framing/materials change so old white covers die. */
const THUMB_VER = 'v7';
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
    scene.background = new Color(JADE_UI.mist);
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

function Thumb({ def, morph, fish, den }: { def: ResourceDef; morph?: { worldSeed: number; creatureSeed: number; axes: MorphAxes }; fish?: StreamFishData | null; den?: { seed: number; params: ShellParams } | null }) {
  const { t } = useLanguage();
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
  if (def.id === 'wonderland-creature' && morph) return <MorphThumb worldSeed={morph.worldSeed} creatureSeed={morph.creatureSeed} axes={morph.axes} />;
  if (def.id === 'wonderland-stream-fish' && fish) return <FishPreview fish={fish} compact />;
  if (def.id === 'wonderland-den' && den) return <DenThumb seed={den.seed} params={den.params} />;
  if (!url) {
    const terrainMark = def.id === 'wonderland-island'
      ? <><path d="M13 51c21-9 52-9 77 0l-7 12c-23 8-48 8-63 0z" /><path d="m20 49 15-18 10 7 15-25 19 33" /><path d="M24 65c18 7 43 7 55 0" /></>
      : def.id === 'wonderland-peak'
        ? <><path d="m13 66 22-35 9 12 17-29 27 52z" /><path d="m54 26 7-12 11 18" /></>
        : def.id === 'wonderland-pool'
          ? <><path d="M13 41c12-11 24-10 34-6 11 4 20-6 34-1 9 3 12 10 7 17-5 9-22 10-36 7-13-3-26 5-37-1-9-5-10-11-2-16z" /><path d="M24 47c14-6 28 4 43-3" /></>
          : null;
    return (
      <div className="resource-thumb resource-thumb-mark">
        {terrainMark
          ? <svg viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{terrainMark}</svg>
          : def.preview ? '…' : t('resources.locate')}
      </div>
    );
  }
  return <img src={url} width={160} height={120} className="resource-thumb" alt="" />;
}

const num = (v: number) => String(+v.toFixed(v < 1 ? 2 : v < 10 ? 1 : 0));
const span = (r?: [number, number]) => (!r ? null : Math.abs(r[1] - r[0]) < 1e-6 ? num(r[0]) : `${num(r[0])}–${num(r[1])}`);
/** "7–9 m tall · 8–11 m across · 37 on the island": measured on the island when it has any, else as configured. */
function factsLine(def: ResourceDef, live: IslandResourceMap[string] | undefined, t: (k: StringKey) => string): string {
  const box = live && live.count > 0 && live.loadedCount == null ? { ...def.config, ...live.islandSize } : def.config;
  const h = span(box.height), w = span(box.width);
  const parts = [h && t('plant.h').replace('{h}', h), w && t('plant.w').replace('{w}', w)];
  if (live && live.loadedCount == null) parts.push(t('plant.n').replace('{n}', String(live.count)));
  return parts.filter(Boolean).join(' · ');
}

export interface ResourceAtlasProps {
  open: boolean;
  onClose: () => void;
  island: IslandResourceMap;
  onLocate: (pos: { x: number; y: number; z: number }) => void;
  /** Open this card. Only the creature is wired from a click in the world. */
  worldSeed?: number;
  focusId?: string | null;
  /** True when the card was opened by clicking the live creature. */
  picked?: boolean;
  activity?: string | null;
  day?: number | null;
  creatureStats?: DwellingStats | null;
  fish?: StreamFishData | null;
  /** The whole school (the fish entry's school panel). */
  fishSchool?: StreamFishData[];
  /** The island's den's form seed (its editor starts from it). */
  denSeed?: number | null;
  /** The island's creatures (each a target of the form editor): name, form now, form at birth. */
  dwellers?: { name: string; axes: MorphAxes; birth: MorphAxes }[];
  onSaveForm?: (i: number, axes: MorphAxes) => void;
  /** The island's dens: name, seed, knobs now and at birth. */
  dens?: { name: string; seed: number; params: ShellParams; birth: ShellParams }[];
  onSaveDen?: (i: number, params: ShellParams) => void;
  /** Which creature the editor opens on (the one whose card was open). */
  lifeIndex?: number;
  onShowDebug?: () => void;
  /** The knobs the island's plants grow with, per kind (none: their own). */
  plantKnobs?: Partial<Record<PlantKind, PlantKnobs>>;
  onApplyPlant?: (kind: PlantKind, knobs: PlantKnobs) => void;
  /** Each shrub patch's colour roll (the colour ring counts the island's patches under a mix). */
  shrubRolls?: number[];
}

export function ResourceAtlas({ open, onClose, island, onLocate, worldSeed = 0, focusId = null, fish, fishSchool, denSeed = null, dwellers, onSaveForm, dens, onSaveDen, lifeIndex = 0, plantKnobs, onApplyPlant, shrubRolls }: ResourceAtlasProps) {
  const { language, t } = useLanguage();
  const list = useMemo(() => wonderlandResourceList().filter((item) => item.id !== 'person' && item.id !== 'wonderland-stele' && item.category !== 'terrain'), []);
  const [cat, setCat] = useState<ResourceCategory>('vegetation');
  const [sel, setSel] = useState<string | null>(null);
  const [sampleSeed, setSampleSeed] = useState(1);
  const [personRef, setPersonRef] = useState(true);
  const [creatureSeed, setCreatureSeed] = useState(DEFAULT_CREATURE_SEED);
  const birth = useMemo(() => birthAxes(creatureSeed), [creatureSeed]);
  const [morphAxes, setMorphAxes] = useState<MorphAxes>(() => birthAxes(DEFAULT_CREATURE_SEED));
  // The fish entry's preview form (sliders) and the growth step on show; back to the live fish when it changes.
  const birthForm = (f: StreamFishData): FishForm => ({ seed: f.seed, length: f.length, depth: f.depth, fork: f.fork, marks: f.marks, fin: f.fin });
  const [fishEdit, setFishEdit] = useState<FishForm | null>(null);
  const fishRoll = useRef(0);
  useEffect(() => { setFishEdit(null); }, [fish]);
  const fishShown: FishForm | null = fishEdit ?? (fish ? birthForm(fish) : null);
  // The den entry's preview: a seed and its knobs; back to the island's den when that changes.
  const [denEdit, setDenEdit] = useState<{ seed: number; params: ShellParams } | null>(null);
  useEffect(() => { setDenEdit(null); }, [denSeed]);
  // Which creature / den the editors work on; they start from its form now, and save to it.
  const [editing, setEditing] = useState(0);
  const [denEditing, setDenEditing] = useState(0);
  useEffect(() => { if (open) setEditing(Math.min(lifeIndex, (dwellers?.length ?? 1) - 1)); }, [open, lifeIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = dwellers?.[editing];
  const targetKey = target ? JSON.stringify(target.axes) : '';
  useEffect(() => { if (target) setMorphAxes(target.axes); }, [targetKey, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const denTarget = dens?.[denEditing];
  const denKey = denTarget ? JSON.stringify(denTarget.params) : '';
  useEffect(() => { setDenEdit(null); }, [denKey, denEditing]);
  const denShown = denEdit ?? (denTarget ? { seed: denTarget.seed, params: denTarget.params } : denSeed != null ? { seed: denSeed, params: birthShell(denSeed) } : null);
  const sameAxes = (a?: MorphAxes, b?: MorphAxes) => !!a && !!b && (Object.keys(a) as (keyof MorphAxes)[]).every((k) => a[k] === b[k]);
  const seenSeed = useRef(creatureSeed);
  useEffect(() => {
    if (seenSeed.current === creatureSeed) return;
    seenSeed.current = creatureSeed;
    setMorphAxes(birth);
  }, [birth, creatureSeed]);
  const roll = useRef(1);
  // The plant editor: the knobs on show (from the island's, until turned) and the sample plant's seed.
  const models = useMemo(() => plantModels(previewUniforms), []);
  const [plantEdit, setPlantEdit] = useState<Partial<Record<PlantKind, PlantKnobs>>>({});
  const [plantSeed, setPlantSeed] = useState(1);
  const plantKey = JSON.stringify(plantKnobs ?? {});
  useEffect(() => { setPlantEdit({}); }, [plantKey]);
  const islandKnobs = (k: PlantKind) => ({ ...models[k].birth(), ...plantKnobs?.[k] });
  const knobsOf = (k: PlantKind) => plantEdit[k] ?? islandKnobs(k);
  const def = list.find((r) => r.id === sel) ?? null;
  const live = def ? island[def.id] : undefined;
  const hasPreview = !!def?.preview;

  useEffect(() => { if (!open) setSel(null); }, [open]);
  useEffect(() => {
    if (!list.some((item) => item.category === cat)) setCat(list[0]?.category ?? 'vegetation');
  }, [list, cat]);
  useEffect(() => {
    if (!open || !focusId) return;
    const found = list.find((r) => r.id === focusId);
    if (!found) return;
    setCat(found.category);
    setSel(found.id);
  }, [open, focusId, list]);
  if (!open) return null;

  const cats = CATS.filter((c) => list.some((item) => item.category === c));
  const cards = list.filter((r) => r.category === cat);

  return (
    <div className={`resource-atlas${def ? ' has-detail' : ''}${def && EDITORS.has(def.id) ? ' creature-editor' : ''}`} role="dialog" aria-label={t('resources.title')}>
      <div className="resource-atlas-bar">
        <strong>{def && EDITORS.has(def.id) ? nameOf(def, language, t) : t('resources.title')}</strong>
        <button type="button" className="resource-btn" onClick={onClose}>{t('resources.close')}</button>
      </div>
      <div className="resource-cats">
        {cats.map((c) => (
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
                <Thumb def={r} morph={r.id === 'wonderland-creature' ? { worldSeed, creatureSeed, axes: morphAxes } : undefined} fish={fish} den={denShown} />
                <div className="resource-card-text">
                  <div className="resource-card-name">{nameOf(r, language, t)}</div>
                  <div className="resource-card-size">{factsLine(r, liveR, t)}</div>
                </div>
              </button>
            );
          })}
          {cards.length === 0 && <p className="resource-muted">—</p>}
        </div>
        {def && (
          <div className="resource-detail">
            {!EDITORS.has(def.id) && <>
              <h3>{nameOf(def, language, t)}</h3>
              <p>{language === 'zh' ? def.ruleZh : def.ruleEn}</p>
              <p className="resource-muted">{factsLine(def, live, t)}</p>
            </>}
            <div className="resource-preview-wrap">
              {plantKind(def.id) ? (() => {
                const kind = plantKind(def.id)!, model = models[kind], knobs = knobsOf(kind);
                const setKnobs = (k: PlantKnobs) => setPlantEdit((e) => ({ ...e, [kind]: k }));
                return <PlantEditor kind={kind} model={model} seed={plantSeed} knobs={knobs}
                  onKnobs={setKnobs}
                  onNew={() => setPlantSeed((x) => x + 1)}
                  onBirth={() => setPlantEdit((e) => ({ ...e, [kind]: model.birth() }))}
                  onApply={onApplyPlant ? () => onApplyPlant(kind, knobs) : undefined}
                  applied={isPlantBirth(model, plantKnobs?.[kind]) ? isPlantBirth(model, knobs) : JSON.stringify(knobs) === JSON.stringify(islandKnobs(kind))}
                  rule={language === 'zh' ? def.ruleZh : def.ruleEn}
                  facts={factsLine(def, live, t)}
                  onLocate={live?.locate ? () => onLocate(live.locate!) : undefined}
                  extra={kind === 'shrub' ? <ShrubMix mix={shrubMix(knobs)} rolls={shrubRolls}
                    onMix={(olive, ochre) => setKnobs({ ...knobs, mixOlive: olive, mixOchre: ochre })} /> : undefined} />;
              })() : def.id === 'wonderland-creature' ? (
                <CreatureMorphPreview
                  worldSeed={worldSeed}
                  creatureSeed={creatureSeed}
                  axes={morphAxes}
                  birth={birth}
                  onAxes={setMorphAxes}
                  onRandom={() => {
                    roll.current += 1;
                    const next = 1 + Math.floor(createRng(creatureSeed + roll.current * 997)() * 999983);
                    if (target) setMorphAxes(dwellerForm(next, 0));
                    else setCreatureSeed(next);
                  }}
                  onRestore={() => setMorphAxes(target ? target.birth : birth)}
                  targets={dwellers && onSaveForm ? { names: dwellers.map((w) => w.name), index: editing, onPick: setEditing } : undefined}
                  onSave={dwellers && onSaveForm ? () => onSaveForm(editing, morphAxes) : undefined}
                  saved={sameAxes(morphAxes, target?.axes)}
                />
              ) : hasPreview ? (
                <DetailPreview def={def} sampleSeed={sampleSeed} personRef={personRef && def.preview !== 'person'} />
              ) : def.id === 'wonderland-den' && denShown ? (
                <DenEditor seed={denShown.seed} params={denShown.params} onParams={(p) => setDenEdit({ seed: denShown.seed, params: p })}
                  onNew={() => { const next = 1 + Math.floor(createRng(denShown.seed * 7 + roll.current++ * 13)() * 999983); setDenEdit({ seed: denShown.seed, params: birthShell(next) }); }}
                  onBirth={() => setDenEdit(denTarget ? { seed: denTarget.seed, params: denTarget.birth } : null)}
                  targets={dens && onSaveDen ? { names: dens.map((x) => x.name), index: denEditing, onPick: setDenEditing } : undefined}
                  onSave={dens && onSaveDen ? () => onSaveDen(denEditing, denShown.params) : undefined}
                  saved={!denEdit} />
              ) : def.id === 'wonderland-stream-fish' && fish && fishShown ? (
                <FishEditor form={fishShown} onForm={setFishEdit} school={fishSchool}
                  onNew={() => { fishRoll.current += 1; setFishEdit(formFromSeed(1 + Math.floor(createRng(fish.seed + fishRoll.current * 997)() * 999983))); }}
                  onBirth={() => setFishEdit(null)} />
              ) : (
                <p className="resource-muted">{t('resources.noPreview')}</p>
              )}
              <div className="resource-preview-tools">
                {hasPreview && !EDITORS.has(def.id) && (
                  <>
                    <label>
                      <input type="checkbox" checked={personRef} onChange={(e) => setPersonRef(e.target.checked)} />
                      {' '}{t('resources.personRef')}
                    </label>
                    <button type="button" className="resource-btn" onClick={() => setSampleSeed((s) => s + 17)}>
                      {t('resources.resample')}
                    </button>
                  </>
                )}
                {/* The creature and its den are found by their card (and its next arrow), not here. */}
                {!EDITORS.has(def.id) && <button
                  type="button"
                  className="resource-btn"
                  disabled={!live?.locate}
                  onClick={() => live?.locate && onLocate(live.locate)}
                >
                  {t('resources.locate')}
                </button>}
              </div>
              {hasPreview && !EDITORS.has(def.id) && <p className="resource-muted">{t('resources.rotate')}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
