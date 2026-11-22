import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { button, levaStore, useControls } from 'leva';
import { BufferAttribute, BufferGeometry, DataTexture, LinearFilter, NearestFilter, RGBAFormat, RedFormat, UnsignedByteType, PerspectiveCamera, Vector3, Vector4 } from 'three';
import { BLOCKOUT, nearestTimeOfDay } from '../../core/palette';
import type { BasinMesh } from '../../core/terrain/basinMesh';
import { createBuiltMaterial, setBuiltFalls } from '../../core/terrain/builtMaterial';
import { createFallMaterial } from '../../core/terrain/fallMaterial';
import { createFlowWaterMaterial, setImpacts } from '../../core/terrain/flowWater';
import type { UndersideMesh } from '../../core/terrain/undersideMesh';
import { sunElevation } from '../../core/params/scene';
import { SIZES } from '../../core/scale';
import { BASE_DEPTH } from '../../core/sdf/terraceField';
import { createTerrainMaterial, heightTexture, LOD_DEFAULTS, lightTexture, farScale, setTerrainCover, softLight, setTerrainFarStyle, setTerrainFolds, setTerrainShrubGround, setTerrainView, setTerrainZones, TerrainLod } from '../../core/terrain/cdlod';
import { LayersButton, LayersLegend, LayersPanel, NO_LAYERS, type Layers } from './LayersPanel';
import { RelationLayer, SchoolLayer, SitesLayer, WaterGraphLayer } from './layers3d';
import { WALKABLE_SLOPE } from './dwelling';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { rimWall } from '../../core/terrain/rimWall';
import { ValleyMist } from './ValleyMist';
import { TimeDial } from './TimeDial';
import { createPorcelainMaterial, setPorcelainFar } from '../../core/shaders/porcelain';
import { setWindField, windTexture, type WorldUniforms } from '../../core/shaders/uniforms';
import type { WindField } from '../../core/generators/wind';
import { createRng } from '../../core/rng';
import { useLanguage } from '../../i18n/LanguageContext';
import { useStudio } from '../../pages/studio';
import type { StringKey } from '../../i18n/strings';
import { REBUILD_DELAY, useSettled } from '../island-v1/controls';
import { buildCover, COVER_DEFAULTS, softCoverDensityBytes } from './cover';
import { COVER_SCALE, CoverGrass, type CoverLiveStats } from './CoverGrass';
import { FRAME_DEFAULTS } from './frame';
import { chapterViews, ChapterCamera, CameraRail, SettingsDrawer, IslandLoading, boxFromRim, type Chapter, type DebugToggles, type SettingSection, type SettingControl } from './Exhibit';
import { groundRules, type GroundParams } from './ground';
import { ISLAND, SEED } from './layout';
import { RANGE } from './range';
import { DEFAULT_SCALE_SHOW, WonderlandScaleLegend, WonderlandScaleView, wonderlandSurveySteps, type ScaleBar, type ScaleRow } from './ScaleView';
import { STELE } from './stele';
import { blurField, buildSurfaceBlend } from './surfaceBlend';
import { ROCK_FOLD_MIX, type RockFolds } from './rockFolds';
import { growShrubs, type ShrubField } from './shrubs';
import { ShrubPatches } from './ShrubPatches';
import { ResourceAtlas } from './ResourceAtlas';
import { MorphSheet } from './CreatureMorphPreview';
import type { IslandResourceMap } from './resourceCatalog';
import OrbitFocus from './OrbitFocus';
import OrbitNavDiag, { EMPTY_NAV_DIAG, type NavDiagSnapshot } from './OrbitNavDiag';
import OrbitPivotRescue from './OrbitPivotRescue';
import WonderlandWalk, { WONDER_WALK_CANVAS, WONDER_WALK_SPEED } from './Walk';
import WalkMinimap, { type WalkMapMark, type WalkMapPose } from './WalkMinimap';
import { WONDER_BROWSE } from './wonderlandWalk';
import { FrameRate, StatsPanel, SUN_AZIMUTH, TERRAIN_DPR, useHour, World } from './world';
import { UNDERSIDE_DEFAULTS, type FromTerrain, type ToTerrain, type UndersideParams } from './terrain.worker';
import { TERRACE_DEFAULTS, type OutletNode, type PoolNode, type TerraceParams } from './terrace';
import { CornerBlocks, createIslandPineMaterial, type Corner } from './corner';
import { HabitatStones } from './HabitatStoneMeshes';
import { placeHabitat, type HabitatLayout } from './habitatStones';
import { RockShelter } from './RockShelterMesh';
import { placeShelter, type ShelterPlan } from './rockShelter';
import Vegetation from '../island-v1/Vegetation';
import type { Plant } from '../../core/generators/forest';
import { growBroadleaves, growWoods, siteKeepOuts, WOODS_LOD } from './woods';
import { Broadleaves } from './Broadleaves';
import { BROADLEAF } from './broadleaf';
import type { PlantKind, PlantKnobs } from './plantModels';
import { plantZones, type Zones } from './zones';
import { CompanionView, DwellingView, type Antlers, type CreatureReadout, type DwellingStats } from './creature';
import { dwellerForm, dwellerNames } from './dwellerNames';
import { birthShell, type ShellParams } from './rockShell';
import { birthAxes, resolveMorph, type MorphAxes } from './creatureMorph';
import { BODY, createDwelling, type Dwelling } from './dwelling';
import { FlowParticles } from './particles';
import { islandWind } from './islandWind';
import { WindStreaks } from './WindStreaks';
import { PhotoPass, type PhotoShot } from './PhotoPass';
import { PhotoMode } from './PhotoMode';
import type { PhotoFilter } from './photoFilters';
import { pickGate, setWorldPointer } from './worldPointer';
import { jadeRevealSites } from './jadeReveal';
import { WATER_DEFAULTS, type Water, type WaterParams } from './water';
import { createBrookSchool, createStreamFish, type StreamFishData } from './streamFish';
import { StreamFish } from './FishSchool';
import { CreatureStatusDock, FishStatusDock } from './CreatureStatusDock';
import { IslandNavigator } from './IslandNavigator';
import { Tour, tourWasSeen, type TourSeen, type TourStep } from './Tour';
import type { RestPlace } from './dwelling';

// Reproducible developer entry point: ?islandSeed=5676#/atlas/wonderland-terrain.
const seedParam = new URLSearchParams(window.location.search).get('islandSeed');
const requestedSeed = Number(seedParam);
const INITIAL_SEED = seedParam !== null && Number.isInteger(requestedSeed) && requestedSeed >= 0 && requestedSeed <= 9999 ? requestedSeed : SEED;
const NAV_PROBE = new URLSearchParams(window.location.search).has('navProbe');
const JADE_PROBE = import.meta.env.DEV && new URLSearchParams(window.location.search).has('jadeProbe');

/**
 * Wonderland's ground drawn as a height map (core/terrain): the meadow and the range of peaks, from
 * the island's rules (ground.ts), baked in a worker; drawn with
 * continuous level of detail (cdlod.ts), lit from a baked light map. The terrace as three pools
 * (terrace.ts), their falls, the plunge pool and the streams (water.ts), the underside: meshes
 * generated from their rules. Where the parts lie comes from the seed (frame.ts).
 */
/** The knobs an island is built from (the worker's input). */
type Built = { params: GroundParams; terrace: TerraceParams; water: WaterParams; underside: UndersideParams };

export default function Scene() {
  const { language, t } = useLanguage();
  const text = (key: string) => ({ label: t(`leva.${key}` as StringKey), hint: t(`hint.${key}` as StringKey) });
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasFocus, setAtlasFocus] = useState<string | null>(null);
  const [atlasPicked, setAtlasPicked] = useState(false);
  const atlasCam = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  const locateRef = useRef<((p: { x: number; y: number; z: number; distance?: number }) => void) | null>(null);
  const view = useControls('View', {
    stats: { value: false, ...text('blockStats') },
    lod: { value: LOD_DEFAULTS.range, min: 45, max: 240, step: 5, ...text('lodRange') },
    grass: { value: COVER_DEFAULTS.amount, min: 0, max: 1, step: 0.05, ...text('grassAmount') },
    // Exclusive env overlays (was Zones + Cover suitability). Heatmap = soft density, not suit.
    envView: {
      value: 'normal' as 'normal' | 'zones' | 'density',
      options: {
        [t('leva.envNormal')]: 'normal',
        [t('leva.envZones')]: 'zones',
        [t('leva.envDensity')]: 'density',
      },
      ...text('envView'),
    },
    scale: { value: false, ...text('scaleView') },
    shrubAmount: { value: 1, min: 0, max: 1, step: 0.05, ...text('shrubAmount') },
    walk: { value: false, ...text('walk') },
    walkSpeed: {
      value: WONDER_WALK_SPEED,
      min: 1.0,
      max: 6,
      step: 0.1,
      render: (get) => get('View.walk'),
      ...text('walkSpeed'),
    },
  }, [language]);
  // Separate folder so the button does not widen View's inferred value types.
  useControls('View', {
    [t('leva.resources')]: button(() => { setAtlasFocus(null); setAtlasPicked(false); setAtlasOpen(true); }),
  }, [language]);
  // Layers (LayersPanel.tsx): views that reveal the rules; Settings change the island.
  const [layers, setLayers] = useState<Layers>(NO_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const showZones = layers.surface === 'zones';
  const coverDebug = layers.surface === 'density';
  const showScale = view.scale || layers.scale;
  const [walkLocked, setWalkLocked] = useState(false);
  const [walkHint, setWalkHint] = useState({ mode: 'browse', mps: WONDER_BROWSE.browse });
  const [walkPose, setWalkPose] = useState<WalkMapPose | null>(null);
  useEffect(() => { if (!view.walk) setWalkPose(null); }, [view.walk]);
  const orbitRestore = useRef({ pos: new Vector3(-430, 300, 380), target: new Vector3(-20, 10, 0) });
  // Initial orbit aim only — live target lives on OrbitControls; Walk exit restores via OrbitRestoreCapture.
  const orbitTargetInit = useRef<[number, number, number]>([-20, 10, 0]).current;
  const debug = useControls('Debug', {
    wire: { value: false, ...text('lodWire') },
    particles: { value: false, ...text('waterParticles') },
  }, { collapsed: true }, [language]);
  // Dev-only entry (not in common Debug) — keep for pivot / cover rebuild triage.
  const dev = useControls(t('leva.devFolder'), {
    navDiag: { value: false, ...text('navDiag') },
    // Far-view detail (docs/plan-2026-11-19-far-view.md): what the ground and air gain when zoomed out.
    farStyle: { value: 1, options: { Off: 0, Detail: 1 } },
    // The solid clouds beside the island (Cumulus.tsx).
    farNear: { value: 130, min: 0, max: 400, step: 10 },
    farFar: { value: 380, min: 20, max: 1200, step: 10 },
  }, { collapsed: true }, [language]);
  const [navDiag, setNavDiag] = useState<NavDiagSnapshot>(EMPTY_NAV_DIAG);
  // Every panel in frosted glass, like the time dial (index.css body.ui-glass; the owner's pick, round 11).
  useEffect(() => { document.body.classList.add('ui-glass'); return () => document.body.classList.remove('ui-glass'); }, []);
  const coverBuildMsRef = useRef(0);
  const focusAnimRef = useRef(false);
  const floorFlagsRef = useRef({ cam: false, target: false });
  const island = useControls('Island', {
    seed: { value: INITIAL_SEED, min: 0, max: 9999, step: 1, ...text('islandSeed') },
  }, [language]);
  const layout = useControls(t('leva.advancedFolder'), {
    turn: { value: Math.round((FRAME_DEFAULTS.spread * 180) / Math.PI), min: 0, max: 40, step: 1, ...text('layoutTurn') },
    variation: { value: FRAME_DEFAULTS.variation, min: 0, max: 1, step: 0.05, ...text('layoutVariation') },
  }, { collapsed: true }, [language]);
  // The rock's folds (rockFolds.ts): colour only, so not in the rebuild key.
  const rock = useControls(t('leva.advancedFolder'), {
    folds: { value: true, ...text('rockFolds') },
    foldMix: { value: ROCK_FOLD_MIX, min: 0, max: 1, step: 0.01, ...text('rockFoldMix') },
    foldView: {
      value: 'off',
      options: language === 'zh'
        ? { '关闭': 'off', '山体范围': 'mountain', '6m／18m山褶': 'folds', '横坡宽凹': 'wide', '区域选择 gate': 'gate', '最终染色权重': 'final' }
        : { 'Off': 'off', 'Mountain mask': 'mountain', 'Folds 6m/18m': 'folds', 'Cross-slope hollow': 'wide', 'Region gate': 'gate', 'Final tint weight': 'final' },
      ...text('rockFoldDebug'),
    },
  }, { collapsed: true }, [language]);
  const range = useControls('Range', {
    top: { value: RANGE.top, min: 40, max: 160, step: 1, ...text('rangeTop') },
    foot: { value: RANGE.foot, min: 10, max: 80, step: 1, ...text('rangeFoot') },
    reach: { value: RANGE.reach, min: 60, max: 150, step: 1, ...text('rangeReach') },
    spacing: { value: RANGE.spacing, min: 7, max: 20, step: 0.5, ...text('rangeSpacing') },
    spurs: { value: RANGE.spurs[1], min: 0, max: 4, step: 1, ...text('rangeSpurs') },
    gully: { value: RANGE.gullyDepth, min: 0, max: 12, step: 0.5, ...text('rangeGully') },
  }, { collapsed: true }, [language]);
  const pools = useControls('Terrace', {
    rim: { value: TERRACE_DEFAULTS.rim, min: 1, max: 8, step: 0.5, ...text('terraceRim') },
  }, { collapsed: true }, [language]);
  const flow = useControls('Water', {
    flow: { value: WATER_DEFAULTS.flow, min: 0.2, max: 20, step: 0.1, ...text('waterFlow') },
    streams: { value: WATER_DEFAULTS.streams, min: 0, max: 5, step: 1, ...text('waterStreams') },
    fan: { value: WATER_DEFAULTS.fan, min: 0.2, max: 1.5, step: 0.05, ...text('waterFan') },
    meander: { value: WATER_DEFAULTS.meander, min: 0, max: 14, step: 0.5, ...text('waterMeander') },
  }, { collapsed: true }, [language]);
  const under = useControls('Underside', {
    depth: { value: UNDERSIDE_DEFAULTS.depth, min: 30, max: 200, step: 5, ...text('underDepth') },
    rocks: { value: UNDERSIDE_DEFAULTS.rocks, min: 1, max: 6, step: 1, ...text('underRocks') },
  }, { collapsed: true }, [language]);
  // 栖居成玉: a creature's days in a dry-land region (dwelling.ts), and the jade they leave.
  const dwellCalls = useRef({
    reset: () => {}, lookOverview: () => {}, lookArea: () => {}, look: () => {}, lookHome: () => {}, lookClose: () => {},
  });
  const dwell = useControls('Dwelling', {
    run: { value: true, ...text('dwellRun') },
    speed: { value: 1, options: { '1×': 1, '10×': 10, '30×': 30, '100×': 100 }, ...text('dwellSpeed') },
    home: { value: 0, options: { [`${t('dwell.home')} A`]: 0, [`${t('dwell.home')} B`]: 1, [`${t('dwell.home')} C`]: 2 }, ...text('dwellHome') },
    show: { value: false, ...text('dwellShow') },
    dbgSkeleton: { value: false, label: t('exhibit.dbg.skeleton') },
    dbgFeet: { value: false, label: t('exhibit.dbg.feet') },
    dbgState: { value: false, label: t('exhibit.dbg.state') },
    dbgRoute: { value: false, label: t('exhibit.dbg.route') },
    dbgDrink: { value: false, label: t('exhibit.dbg.drink') },
    dbgRest: { value: false, label: t('exhibit.dbg.rest') },
  }, [language]);
  useControls('Dwelling', () => ({
    [t('leva.dwellReset')]: button(() => dwellCalls.current.reset()),
    [t('leva.dwellLookOverview')]: button(() => dwellCalls.current.lookOverview()),
    [t('leva.dwellLook')]: button(() => dwellCalls.current.look()),
  }), [language, t]);
  const [dwellStats, setDwellStats] = useState<DwellingStats | null>(null);
  const [readout, setReadout] = useState<CreatureReadout | null>(null);
  // The exhibit (Exhibit.tsx): its chapter (and a count of choices, so choosing the same one flies
  // there again), its drawer, the landscape-only view.
  const { exhibit } = useStudio();
  const [chapter, setChapter] = useState<Chapter>('arrival');
  const [chapterGo, setChapterGo] = useState(0);
  // The camera (PhotoMode.tsx): out or not, its filter, and a shot asked of the next frame.
  const [photo, setPhoto] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>('none');
  const shootRef = useRef<((shot: PhotoShot) => void) | null>(null);
  useEffect(() => { document.body.classList.toggle('photo-on', photo); return () => document.body.classList.remove('photo-on'); }, [photo]);
  const [drawer, setDrawer] = useState(false);
  const [followLife, setFollowLife] = useState(false);
  // Follows `followLife`, but can be closed at once by a map or atlas jump (ChapterCamera reads it each frame).
  const followGate = useRef(false);
  followGate.current = followLife;
  const [statusOpen, setStatusOpen] = useState(false);
  const lifeOrbitInteracting = useRef(false);
  const creatureRef = useRef<{ pose: { x: number; y: number; z: number }; restPlace?: RestPlace | null } | null>(null);
  const chooseChapter = (c: Chapter) => { setWorldPointer(null); setChapter(c); setChapterGo((g) => g + 1); setFollowLife(c === 'life'); if (c === 'life') setStatusOpen(true); };
  useEffect(() => { if (view.walk) setFollowLife(false); }, [view.walk]);
  const [coverLive, setCoverLive] = useState<CoverLiveStats | null>(null);
  const [scaleRows, setScaleRows] = useState<ScaleRow[]>([]);
  const [scaleShow, setScaleShow] = useState(DEFAULT_SCALE_SHOW);
  const scaleBar = useRef<ScaleBar>({ line: null, label: null });
  const hour = useHour();
  const coverAmount = view.grass;
  const key = useSettled(JSON.stringify({ range, pools, flow, under, island, layout }), REBUILD_DELAY);
  // What the knobs ask for now; the island on screen keeps what it was built with (`built`) until the new one is ready.
  const asking = useMemo<Built>(() => {
    const { range: r, pools: q, flow: w, under: u, island: i, layout: l } = JSON.parse(key) as { range: typeof range; pools: typeof pools; flow: typeof flow; under: typeof under; island: typeof island; layout: typeof layout };
    return {
      water: { ...w },
      underside: { ...u },
      params: {
        seed: i.seed,
        range: { ...RANGE, top: r.top, foot: r.foot, reach: r.reach, spacing: r.spacing, spurs: [Math.max(r.spurs - 1, 0), r.spurs], gullyDepth: r.gully },
        frame: { ...FRAME_DEFAULTS, spread: (l.turn * Math.PI) / 180, variation: l.variation },
      },
      terrace: { ...TERRACE_DEFAULTS, rim: q.rim },
    };
  }, [key]);

  // The worker (made in an effect, so React's mount-unmount-mount check gets a live one).
  const worker = useRef<Worker | null>(null);
  const asked = useRef({ ground: 0, light: 0 });
  const [ground, setGround] = useState<{ built: Built; grid: HeightGrid; rim: Float32Array; terrace: BasinMesh[]; tops: number[]; pools: PoolNode[]; outlets: OutletNode[]; water: Water; zones: Zones; folds: RockFolds; underside: UndersideMesh; ms: number } | null>(null);
  const { params, underside } = ground?.built ?? asking;
  const [light, setLight] = useState<{ light: Uint8Array; size: number; ms: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  // The newcomer's walk round the controls (Tour.tsx): opens by itself on a first visit, once shown.
  const [tour, setTour] = useState(false);
  const [tourSeen, setTourSeen] = useState<TourSeen>({});
  const markTour = useCallback((k: TourStep) => setTourSeen((s) => (s[k] ? s : { ...s, [k]: true })), []);
  const openTour = () => { setTourSeen({}); setTour(true); };
  useEffect(() => { if (exhibit && shown && !tourWasSeen()) openTour(); }, [exhibit, shown]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (layersOpen) markTour('layers'); }, [layersOpen, markTour]);
  useEffect(() => { if (atlasOpen) markTour('atlas'); }, [atlasOpen, markTour]);
  const [loadProgress, setLoadProgress] = useState({ percent: 0, step: 'ground' });
  const [showComplete, setShowComplete] = useState(false);
  useEffect(() => {
    if (!shown) return;
    setShowComplete(true);
    const timer = window.setTimeout(() => setShowComplete(false), 350);
    return () => window.clearTimeout(timer);
  }, [shown]);
  const attachWorker = (w: Worker) => {
    w.onerror = () => setLoadError('worker');
    w.onmessage = (e: MessageEvent<FromTerrain>) => {
      const m = e.data;
      if (m.type === 'progress') {
        if (m.step === 'light' ? m.id === asked.current.light : m.id === asked.current.ground)
          setLoadProgress((previous) => ({ percent: Math.max(previous.percent, m.percent), step: m.step }));
        return;
      }
      if (m.type === 'ground' && m.id === asked.current.ground) {
        builtSeed.current = askedSeed.current;
        setReshaping(false);
        setGround({ built: askedBuilt.current ?? asking, grid: m.grid, rim: m.rim, terrace: m.terrace, tops: m.tops, pools: m.pools, outlets: m.outlets, water: m.water, zones: m.zones, folds: m.folds, underside: m.underside, ms: m.ms });
        setLoadProgress({ percent: 86, step: 'light' });
      }
      if (m.type === 'light' && m.id === asked.current.light) {
        setLight({ light: m.light, size: m.size, ms: m.ms });
        setLoadProgress({ percent: 97, step: 'frame' });
      }
    };
    worker.current = w;
  };
  useEffect(() => {
    const w = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
    attachWorker(w);
    return () => { w.terminate(); worker.current = null; };
  }, []);
  // The first island, and another island (a new seed), load behind the loading screen. Once in,
  // reshaping the same island keeps it where it is (camera, creatures) until the new one is ready,
  // with a small note in the corner: the visitor's journey is not cut off by a reload.
  const builtSeed = useRef<number | null>(null);
  const askedSeed = useRef<number | null>(null);
  const askedBuilt = useRef<Built | null>(null);
  const [reshaping, setReshaping] = useState(false);
  useEffect(() => {
    const soft = builtSeed.current !== null && builtSeed.current === asking.params.seed;
    setLoadProgress({ percent: 0, step: 'ground' });
    setLoadError(null);
    if (soft) setReshaping(true);
    else {
      setGround(null);
      setShown(false);
      setShowComplete(false);
      setReshaping(false);
    }
    askedSeed.current = asking.params.seed;
    askedBuilt.current = asking;
    const id = ++asked.current.ground;
    worker.current?.postMessage({ type: 'ground', id, ...asking } satisfies ToTerrain);
  }, [asking]);
  // What the camera keeps above: the ground, and on the terrace each plate's top.
  const above = useMemo(() => {
    if (!ground) return null;
    const plates = groundRules(params).plate;
    const outlines = ground.tops.map((_, k) => plates(k));
    return (x: number, z: number) => {
      if (sampleGrid(ground.grid, x, z, 3) > 0) return -Infinity;
      let h = sampleGrid(ground.grid, x, z);
      outlines.forEach((o, k) => { if (o(x, z) < 0) h = Math.max(h, ground.tops[k]); });
      return h;
    };
  }, [ground, params]);
  // The light follows the ground and the sun (the same direction World gives the shaders).
  useEffect(() => {
    if (!ground) return;
    const el = (Math.max(sunElevation(hour), 5) * Math.PI) / 180;
    const sun: [number, number, number] = [Math.cos(SUN_AZIMUTH) * Math.cos(el), Math.sin(el), Math.sin(SUN_AZIMUTH) * Math.cos(el)];
    const id = ++asked.current.light;
    worker.current?.postMessage({ type: 'light', id, sun } satisfies ToTerrain);
  }, [ground, hour]);

  // The dwelling, on the island as built (its sites found by rule); started afresh with the island.
  // One world for every creature: they share its obstacles (each other's dens) and its contact map.
  const dwellWorld = useMemo(() => (ground ? { grid: ground.grid, water: ground.water, terrace: groundRules(params).plate(0), seed: params.seed, zones: ground.zones } : null), [ground, params]);
  const dwelling = useMemo<Dwelling | null>(() => (dwellWorld ? createDwelling(dwellWorld) : null), [dwellWorld]);
  // The second creature (docs/plan-2026-11-18-school-herd.md): its own home, den and grazing.
  const dwelling2 = useMemo<Dwelling | null>(() => (
    dwellWorld && dwelling && dwelling.sites.homes.length > 1 ? createDwelling(dwellWorld, { id: 1, sites: dwelling.sites, map: dwelling.map, home: 1 }) : null
  ), [dwellWorld, dwelling]);
  const [lifeIndex, setLifeIndex] = useState(0);
  // What the visitor saved in the atlas for this island (kept in the browser, per island seed):
  // a creature's form, a den's knobs. Absent: the seed's own.
  const [saved, setSaved] = useState<SavedIsland>(() => loadSaved(params.seed));
  useEffect(() => { setSaved(loadSaved(params.seed)); }, [params.seed]);
  const keep = (next: SavedIsland) => { setSaved(next); storeSaved(params.seed, next); };
  // Who each one is (dwellerNames.ts): a seeded name from the jade list, and its whole form
  // (build, belly, height, antlers): the saved one, or the one it was born with.
  const who = useMemo(() => {
    const names = dwellerNames(params.seed, 2);
    return [0, 1].map((i) => {
      const birth = dwellerForm(params.seed, i);
      return { nameIndex: names[i], birth, antlers: saved.forms[i] ?? birth };
    });
  }, [params.seed, saved.forms]);
  // The sim's head and neck follow the form (a saved form changes it at once, no restart).
  useEffect(() => { dwelling?.setForm(who[0].antlers as MorphAxes); dwelling2?.setForm(who[1].antlers as MorphAxes); }, [dwelling, dwelling2, who]);
  const [dwellStats2, setDwellStats2] = useState<DwellingStats | null>(null);
  const fish = useMemo(() => ground ? createStreamFish(params.seed, ground.water, ground.grid) : [], [ground, params.seed]);
  // The brook school (streamFish.ts): in the stream by the dwellers' drinking place, wary of them.
  const brook = useMemo(() => ground && dwelling ? createBrookSchool(params.seed, ground.water, ground.grid, [dwelling.sites.drink.water[0], dwelling.sites.drink.water[2]]) : [], [ground, dwelling, params.seed]);
  const [selectedFish, setSelectedFish] = useState<StreamFishData | null>(null);
  const [fishCard, setFishCard] = useState(false);
  useEffect(() => { setSelectedFish(null); setFishCard(false); }, [fish]);
  useEffect(() => {
    if (!dwelling) return;
    dwelling.home = Math.min(dwell.home, dwelling.sites.homes.length - 1);
  }, [dwelling, dwell.home]);
  // The woods (woods.ts): groves where the zones say trees take, kept off the
  // creature's home, stands and ways.
  const woods = useMemo(() => (ground ? growWoods(ground.zones, ground.grid, params.seed, dwelling ? siteKeepOuts(dwelling.sites) : []) : null), [ground, params, dwelling]);
  const trees = useMemo<Plant[]>(() => (woods ? woods.trees : []), [woods]);
  // The broadleaf trees (round 11): parasol trees at the woodland's edge, weeping trees by water, clear of the pines.
  const broad = useMemo(() => (ground && woods ? growBroadleaves(ground.zones, ground.grid, params.seed, trees, dwelling ? siteKeepOuts(dwelling.sites) : [], { parasol: BROADLEAF.parasol.height, weeping: BROADLEAF.weeping.height }) : null), [ground, woods, trees, params, dwelling]);
  /** Every standing tree, pine or broadleaf: what shrubs and stones keep clear of. */
  const standing = useMemo<Plant[]>(() => (broad ? [...trees, ...broad.parasol, ...broad.weeping] : trees), [trees, broad]);
  // Low shrubs in patches (shrubs.ts), off the creature's dwelling ground (not its obstacles yet).
  const shrubShown = useSettled(String(view.shrubAmount), 280);
  const shrubs = useMemo(() => (ground && Number(shrubShown) > 0 ? growShrubs(ground.zones, ground.grid, ground.folds, params.seed, standing, dwelling ? [dwelling.sites.region] : [], Number(shrubShown)) : null), [ground, params, standing, dwelling, shrubShown]);
  const cover = useMemo(() => (ground ? buildCover(ground.zones, ground.grid, params.seed, coverAmount) : null), [ground, params, coverAmount]);
  // Corner pines, then shore stones, then one shelter for the current home.
  // Switching A/B/C rebuilds the shelter. It does not append, and it does not move the home anchor.
  const shelterBoot = useRef<Dwelling | null>(null);
  const habitat = useMemo(() => {
    if (!dwelling || !ground) return null;
    dwelling.home = Math.min(dwell.home, dwelling.sites.homes.length - 1);
    const layout = placeHabitat({
      seed: params.seed,
      dwelling,
      zones: ground.zones,
      trees: standing,
      shrubs: (shrubs?.plants ?? []).map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 })),
      pose: { x: dwelling.pose.x, z: dwelling.pose.z },
    });
    const shelter = placeShelter({ dwelling, obstacles: layout.obstacles, seed: params.seed, shell: saved.dens[0] });
    if (shelter.plan) {
      dwelling.setRestPlace({ bed: shelter.plan.bed, mouth: shelter.plan.mouth });
      dwelling.setObstacles(shelter.plan.obstacles);
    } else dwelling.setRestPlace(null);
    let shelter2: ReturnType<typeof placeShelter> | null = null;
    if (dwelling2) {
      // Its home: the first of the others where a den fits (else the first of them, without a den).
      const homes = [1, 0, 2].filter((h) => h !== dwelling.home && h < dwelling.sites.homes.length);
      for (const h of homes) {
        dwelling2.home = h;
        shelter2 = placeShelter({ dwelling: dwelling2, obstacles: shelter.plan?.obstacles ?? layout.obstacles, seed: params.seed, shell: saved.dens[1] });
        if (shelter2.plan) break;
      }
      if (!shelter2?.plan) dwelling2.home = homes[0] ?? 1;
      shelter2 ??= { plan: null, skip: 'no home' };
      if (shelter2.plan) {
        dwelling2.setRestPlace({ bed: shelter2.plan.bed, mouth: shelter2.plan.mouth });
        dwelling2.setObstacles(shelter2.plan.obstacles);
      } else dwelling2.setRestPlace(null);
      dwelling.companions = [dwelling2];
      dwelling2.companions = [dwelling];
    }
    // First time this dwelling exists: lie in the bed. Changing home does not teleport.
    if (shelterBoot.current !== dwelling) {
      shelterBoot.current = dwelling;
      dwelling.reset();
      dwelling2?.reset();
    }
    return { layout, shelter, shelter2 };
  }, [dwelling, dwelling2, dwell.home, standing, shrubs, ground, params.seed, saved.dens]);
  useEffect(() => {
    if (!dwelling || !cover || !habitat) return;
    const graze = (dw: Dwelling) => {
    const home = dw.sites.homes[dw.home];
    let best: { x: number; z: number; facing: number; gx: number; gz: number; score: number } | null = null;
    for (let i = 0; i < 64; i++) {
      const angle = i * 2.399963229728653 + params.seed * 0.013;
      const range = 4 + (i % 9) * 1.7;
      const x = home.x + Math.cos(angle) * range, z = home.z + Math.sin(angle) * range;
      const facing = angle + Math.PI;
      const gx = x + Math.cos(facing) * 0.95, gz = z + Math.sin(facing) * 0.95;
      if (!dw.dry(x, z) || !dw.dry(gx, gz)) continue;
      const score = cover.suitAt(gx, gz) * cover.patchAt(gx, gz) - range * 0.004;
      if (score > 0.18 && (!best || score > best.score)) best = { x, z, facing, gx, gz, score };
    }
    dw.setGrazing(best ? { x: best.gx, z: best.gz, radius: 2.6, biomass: 1, version: 0, stand: { x: best.x, z: best.z, facing: best.facing } } : null);
    };
    graze(dwelling);
    if (dwelling2) graze(dwelling2);
  }, [dwelling, dwelling2, cover, habitat, params.seed]);
  const corner = habitat?.layout.corner ?? null;
  // Each chapter's view, by rule from the island as built.
  const views = useMemo(() => (ground && above ? chapterViews(groundRules(params).frame, ground.water.plunge, corner, above) : null), [ground, above, params, corner]);
  const heights = useMemo<[number, number] | null>(() => (ground ? [ground.grid.bottom, ground.grid.top] : null), [ground]);
  // The island's wind (islandWind.ts): the grass and flowers lean with it; the wind layer shows it.
  const wind = useMemo(() => (ground ? islandWind(ground.grid, params.seed) : null), [ground, params.seed]);
  const islandBox = useMemo(() => (ground ? boxFromRim(ground.rim, ground.underside.positions, ground.grid, -BASE_DEPTH, ground.water.falls.map((fall) => fall.positions)) : null), [ground]);

  const scaleKnown = useMemo(() => {
    const heights = trees.map((p) => p.height);
    const forest: [number, number] | null = heights.length
      ? [Math.min(...heights), Math.max(...heights)]
      : null;
    // Terrace group: union of generated basin meshes (actual stack across / height).
    let terraceGroup: { across: number; height: number; center: Vector3; size: Vector3 } | undefined;
    if (ground?.terrace.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const b of ground.terrace) {
        const p = b.positions;
        for (let i = 0; i < p.length; i += 3) {
          minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
          minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
          minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
        }
      }
      if (Number.isFinite(minX)) {
        const size = new Vector3(maxX - minX, maxY - minY, maxZ - minZ);
        terraceGroup = {
          across: Math.max(size.x, size.z),
          height: size.y,
          center: new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
          size,
        };
      }
    }
    // Main range mass: east arc footprint × peak height (design axes; height from params).
    const rangeAcross = Math.max(ISLAND.across * 0.55, params.range.reach * 1.6);
    const rangeDepth = Math.max(ISLAND.deep * 0.35, 90);
    const rangeMassif = {
      across: rangeAcross,
      height: params.range.top,
      center: new Vector3(ISLAND.across * 0.12, params.range.top * 0.45, 0),
      size: new Vector3(rangeAcross, params.range.top, rangeDepth),
    };
    const poolAcross = terraceGroup ? terraceGroup.across * 0.35 : undefined;
    // The lives and dens (docs/plan-2026-11-18-school-herd.md): measured from what is built.
    const crowns = who.map((w) => resolveMorph({ worldSeed: 684, creatureSeed: 11, axes: { ...birthAxes(11), ...w.antlers } }).morph.crownHeight).slice(0, dwelling2 ? 2 : 1);
    const spanOf = (v: number[]): [number, number] | undefined => (v.length ? [Math.min(...v), Math.max(...v)] : undefined);
    const dwellers = dwelling ? spanOf(crowns) : undefined;
    const streamlings = spanOf(fish.map((f) => f.length));
    const dens = spanOf([habitat?.shelter.plan?.exterior.height, habitat?.shelter2?.plan?.exterior.height].filter((h): h is number => h != null));
    const shrubHeights = spanOf((shrubs?.plants ?? []).map((p) => p.height));
    return {
      peakHeight: params.range.top,
      forest,
      grass: COVER_SCALE.grass,
      flower: COVER_SCALE.flower,
      steleHeight: STELE.height,
      poolAcross,
      dwellers, streamlings, dens, shrubs: shrubHeights,
      terraceGroup,
      rangeMassif,
    };
  }, [trees, params.range.top, params.range.reach, ground, who, dwelling, dwelling2, fish, habitat, shrubs]);
  const scaleAnchors = useMemo(() => {
    if (!corner || !ground) return [] as Vector3[];
    const { x, z } = corner.stone;
    const y = sampleGrid(ground.grid, x, z);
    const spots = [new Vector3(x + 1.2, y, z + 0.4)];
    const pine = corner.pines[0];
    if (pine) spots.push(new Vector3(pine.x + 1.1, sampleGrid(ground.grid, pine.x, pine.z), pine.z));
    return spots;
  }, [corner, ground]);
  const scaleSteps = useMemo(() => wonderlandSurveySteps(params.range.top), [params.range.top]);
  const onCoverStats = useCallback((s: CoverLiveStats) => setCoverLive(s), []);

  const [drawn, setDrawn] = useState({ patches: 0, triangles: 0 });

  const islandResources = useMemo<IslandResourceMap>(() => {
    if (!ground) return {};
    const map: IslandResourceMap = {};
    if (shrubs && shrubs.plants.length) {
      const hs = shrubs.plants.map((p) => p.height);
      const ws = shrubs.plants.map((p) => p.height * p.width);
      const p0 = shrubs.plants[0];
      map['wonderland-shrub'] = {
        count: shrubs.plants.length,
        islandSize: { height: [Math.min(...hs), Math.max(...hs)], width: [Math.min(...ws), Math.max(...ws)] },
        locate: { x: p0.x, y: p0.y + p0.height * 0.5, z: p0.z },
      };
    } else {
      map['wonderland-shrub'] = { count: 0, islandSize: {}, locate: null };
    }
    for (const kind of ['parasol', 'weeping'] as const) {
      const list = broad?.[kind] ?? [];
      const hs = list.map((p) => p.height), p0 = list[0];
      map[`wonderland-${kind}`] = list.length
        ? { count: list.length, islandSize: { height: [Math.min(...hs), Math.max(...hs)] }, locate: { x: p0.x, y: p0.y + p0.height * 0.5, z: p0.z } }
        : { count: 0, islandSize: {}, locate: null };
    }
    if (trees.length) {
      const hs = trees.map((p) => p.height);
      const p0 = trees[0];
      map['wonderland-pine'] = {
        count: trees.length,
        islandSize: { height: [Math.min(...hs), Math.max(...hs)] },
        locate: { x: p0.x, y: p0.y + p0.height * 0.4, z: p0.z },
      };
    } else {
      map['wonderland-pine'] = { count: 0, islandSize: {}, locate: null };
    }
    map['wonderland-grass'] = {
      count: coverLive?.grassClumps ?? 0,
      loadedCount: coverLive?.grassBlades ?? 0,
      islandAnchors: null,
      islandSize: { height: COVER_SCALE.grass },
      locate: coverLive && coverLive.grassBlades > 0 && ground
        ? { x: coverLive.focus.x, y: sampleGrid(ground.grid, coverLive.focus.x, coverLive.focus.z) + 0.3, z: coverLive.focus.z }
        : null,
      note: 'Loaded near camera (blades/clumps). Island-wide clump total not tracked.',
    };
    map['wonderland-flower'] = {
      count: coverLive?.flowerClumps ?? 0,
      loadedCount: coverLive?.flowerHeads ?? 0,
      islandAnchors: null,
      islandSize: { height: COVER_SCALE.flower },
      locate: coverLive?.flowerAt[0]
        ? { x: coverLive.flowerAt[0].x, y: coverLive.flowerAt[0].y + 0.2, z: coverLive.flowerAt[0].z }
        : null,
      note: 'Loaded near camera. Island-wide flower anchors not tracked.',
    };
    if (dwelling && corner && ground) {
      const sy = sampleGrid(ground.grid, corner.stone.x, corner.stone.z);
      // One creature on this island — report the measured BODY size as a single value, not a fake range.
      const standH = BODY.torso.stand + BODY.torso.up;
      const bodyL = BODY.torso.along * 2 + BODY.head.front;
      const bodyW = BODY.torso.across * 2;
      const home = dwelling.sites.homes[Math.min(dwell.home, dwelling.sites.homes.length - 1)];
        {
        const den = habitat?.shelter.plan;
        map['wonderland-den'] = den
          ? { count: 1, islandSize: { width: [den.exterior.across, den.exterior.across], depth: [den.exterior.along, den.exterior.along], height: [den.exterior.height, den.exterior.height] }, locate: { x: den.bed.x, y: den.originY + 1.5, z: den.bed.z } }
          : { count: 0, islandSize: {}, locate: null };
      }
    map['wonderland-creature'] = {
        count: dwelling2 ? 2 : 1,
        islandSize: { height: [standH, standH], width: [bodyW, bodyW], depth: [bodyL, bodyL] },
        locate: home
          ? { x: home.x, y: sampleGrid(ground.grid, home.x, home.z) + standH * 0.5, z: home.z }
          : { x: corner.stone.x, y: sy + 1, z: corner.stone.z },
        noteEn: dwelling2 ? 'Two creatures on this island (A and B): the same rules, each with its own home and den. Dimensions measure the standing body.' : 'One creature on this island. Island dimensions measure its standing body, rather than a configured range.',
        noteZh: dwelling2 ? '本岛 2 只（甲、乙），同一套规则，各有家与岩窝；尺寸为形体实测（站立）。' : '本岛仅 1 只；尺寸为形体实测（站立），非配置区间。',
      };
      // Stele hidden in live scene this pass — atlas asset kept; no locate.
      map['wonderland-stele'] = {
        count: 0,
        islandSize: { height: [STELE.height, STELE.height], width: [STELE.face, STELE.face], depth: [STELE.thick, STELE.thick] },
        locate: null,
      };
    } else {
      map['wonderland-creature'] = { count: 0, islandSize: {}, locate: null };
      map['wonderland-den'] = { count: 0, islandSize: {}, locate: null };
      map['wonderland-stele'] = { count: 0, islandSize: {}, locate: null };
    }
    const locatedFish = selectedFish ?? fish[0];
    const allFish = [...fish, ...brook];
    map['wonderland-stream-fish'] = { count: allFish.length, islandSize: allFish.length ? { depth: [Math.min(...allFish.map((f) => f.length)), Math.max(...allFish.map((f) => f.length))] } : {}, locate: locatedFish ? { x: locatedFish.now.x, y: locatedFish.y, z: locatedFish.now.z } : null };
    map.person = { count: 0, islandSize: { height: [SIZES.person.height, SIZES.person.height] }, locate: null };
    map['wonderland-island'] = {
      count: 1,
      islandSize: { width: [ISLAND.across, ISLAND.across], depth: [ISLAND.deep, ISLAND.deep] },
      locate: { x: 0, y: params.range.top * 0.3, z: 0 },
    };
    map['wonderland-peak'] = {
      count: 1,
      islandSize: { height: [params.range.top, params.range.top] },
      locate: { x: ISLAND.across * 0.12, y: params.range.top * 0.6, z: 0 },
    };
    const pools = ground?.pools?.length ?? 0;
    const p0 = ground?.pools?.[0];
    map['wonderland-pool'] = {
      count: pools,
      islandSize: scaleKnown.poolAcross
        ? { width: [scaleKnown.poolAcross * 0.5, scaleKnown.poolAcross] }
        : { width: [8, 40] },
      locate: p0 ? { x: p0.centre[0], y: p0.level + 2, z: p0.centre[1] } : null,
    };
    return map;
  }, [shrubs, trees, coverLive, dwelling, dwelling2, dwell.home, corner, ground, params.range.top, scaleKnown.poolAcross, fish, brook, selectedFish]);

  // On to the next creature: its card, and the camera pans to it (Life follows it).
  const nextCreature = () => {
    setLifeIndex((i) => (i + 1) % (dwelling2 ? 2 : 1));
    // Always through the chapter: it flies the camera to the one now shown (from any view, or from the other creature).
    followGate.current = true;
    chooseChapter('life');
  };
  // Clicking a creature: its card, and the camera goes to it (the card alone was often open already,
  // so the click seemed to do nothing; owner, 2026-11-22). The card gives a small nod either way.
  const pickCreature = useCallback((i = 0) => {
    setLifeIndex(i);
    setFishCard(false);
    setStatusOpen(true);
    markTour('creature');
    followGate.current = true;
    setChapter('life'); setFollowLife(true); setChapterGo((g) => g + 1);
    requestAnimationFrame(() => document.querySelector('.creature-status-dock')?.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' }));
  }, [markTour]);
  const pickResource = useCallback((id: string) => {
    setWorldPointer(null);
    setAtlasFocus(id);
    setAtlasPicked(true);
    setAtlasOpen(true);
  }, []);
  const setCreatureDebug = (key: keyof DebugToggles, on: boolean) => {
    const path: Record<keyof DebugToggles, string> = {
      skeleton: 'Dwelling.dbgSkeleton',
      feet: 'Dwelling.dbgFeet',
      state: 'Dwelling.dbgState',
      route: 'Dwelling.dbgRoute',
      contact: 'Dwelling.show',
      drink: 'Dwelling.dbgDrink',
      rest: 'Dwelling.dbgRest',
    };
    levaStore.setValueAtPath(path[key], on, true);
  };
  const showCreatureDebug = () => {
    (['feet', 'state', 'route', 'contact', 'drink', 'rest'] as const).forEach((key) => setCreatureDebug(key, false));
    setCreatureDebug('skeleton', true);
    setAtlasOpen(false);
    locateRef.current?.({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
    chooseChapter('life');
  };
  const closeAtlas = useCallback(() => {
    setAtlasOpen(false);
    // Restore orbit camera saved when the atlas opened.
    locateRef.current?.({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }, []);

  const change = (path: string, value: boolean | number | string) => levaStore.setValueAtPath(path, value, true);
  const row = (label: string, path: string, value: boolean | number | string, extras: Partial<SettingControl> = {}): SettingControl => ({ label, value, onChange: (v) => change(path, v), ...extras });
  const slider = (label: string, path: string, value: number, min: number, max: number, step: number): SettingControl => row(label, path, value, { kind: 'range', min, max, step });
  const settingsSections: SettingSection[] = [
    { id: 'explore', title: t('exhibit.explore'), controls: [
      row(t('leva.walk'), 'View.walk', view.walk),
      ...(view.walk ? [slider(t('leva.walkSpeed'), 'View.walkSpeed', view.walkSpeed, 1, 6, 0.1)] : []),
    ] },
    { id: 'mountain', title: t('exhibit.groupMountain'), controls: [
      slider(t('leva.layoutTurn'), `${t('leva.advancedFolder')}.turn`, layout.turn, 0, 40, 1),
      slider(t('leva.layoutVariation'), `${t('leva.advancedFolder')}.variation`, layout.variation, 0, 1, 0.05),
      row(t('leva.rockFolds'), `${t('leva.advancedFolder')}.folds`, rock.folds),
      slider(t('leva.rockFoldMix'), `${t('leva.advancedFolder')}.foldMix`, rock.foldMix, 0, 1, 0.01),
      slider(t('leva.rangeTop'), 'Range.top', range.top, 40, 160, 1),
      slider(t('leva.rangeFoot'), 'Range.foot', range.foot, 10, 80, 1),
      slider(t('leva.rangeReach'), 'Range.reach', range.reach, 60, 150, 1),
      slider(t('leva.rangeSpacing'), 'Range.spacing', range.spacing, 7, 20, 0.5),
      slider(t('leva.rangeSpurs'), 'Range.spurs', range.spurs, 0, 4, 1),
      slider(t('leva.rangeGully'), 'Range.gully', range.gully, 0, 12, 0.5),
    ] },
    { id: 'water', title: t('exhibit.groupWater'), controls: [
      slider(t('leva.terraceRim'), 'Terrace.rim', pools.rim, 1, 8, 0.5),
      slider(t('leva.waterFlow'), 'Water.flow', flow.flow, 0.2, 20, 0.1),
      slider(t('leva.waterStreams'), 'Water.streams', flow.streams, 0, 5, 1),
      slider(t('leva.waterFan'), 'Water.fan', flow.fan, 0.2, 1.5, 0.05),
      slider(t('leva.waterMeander'), 'Water.meander', flow.meander, 0, 14, 0.5),
    ] },
    { id: 'keel', title: t('exhibit.groupKeel'), controls: [
      slider(t('leva.underDepth'), 'Underside.depth', under.depth, 30, 200, 5),
      slider(t('leva.underRocks'), 'Underside.rocks', under.rocks, 1, 6, 1),
    ] },
    { id: 'plants', title: t('exhibit.groupPlants'), controls: [
      slider(t('leva.shrubAmount'), 'View.shrubAmount', view.shrubAmount, 0, 1, 0.05),
      slider(t('leva.grassAmount'), 'View.grass', view.grass, 0, 1, 0.05),
    ] },
    { id: 'quality', title: t('exhibit.groupQuality'), controls: [
      slider(t('leva.lodRange'), 'View.lod', view.lod, 45, 240, 5),
      row(t('leva.blockStats'), 'View.stats', view.stats),
    ] },
    { id: 'dev', title: t('exhibit.groupDev'), controls: [
      row(t('leva.islandSeed'), 'Island.seed', island.seed, { min: 0, max: 9999 }),
      row(t('leva.rockFoldDebug'), `${t('leva.advancedFolder')}.foldView`, rock.foldView, { kind: 'select', options: [
        { label: 'Off', value: 'off' }, { label: 'Mountain', value: 'mountain' }, { label: 'Folds', value: 'folds' }, { label: 'Hollow', value: 'wide' }, { label: 'Region', value: 'gate' }, { label: 'Final', value: 'final' },
      ] }),
      row(t('leva.farStyle'), `${t('leva.devFolder')}.farStyle`, dev.farStyle, { kind: 'select', options: [
        { label: t('far.off'), value: 0 }, { label: t('far.detail'), value: 1 },
      ] }),
      row(t('leva.lodWire'), 'Debug.wire', debug.wire),
    ] },
  ];

  // The camera follows the creature whose card is open.
  creatureRef.current = lifeIndex === 1 && dwelling2 ? dwelling2 : dwelling;
  const retryLoad = () => {
    setLoadError(null);
    setLoadProgress({ percent: 0, step: 'ground' });
    setShowComplete(false);
    setGround(null);
    setShown(false);
    setReshaping(false);
    builtSeed.current = null;
    askedSeed.current = asking.params.seed;
    askedBuilt.current = asking;
    worker.current?.terminate();
    const w = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
    attachWorker(w);
    const id = ++asked.current.ground;
    w.postMessage({ type: 'ground', id, ...asking } satisfies ToTerrain);
  };

  return (
    <>
      {/* flat: no tone mapping, as Penglai: every material, built-in or our own, writes its colour in sRGB (without it the built-in ones went through ACES and ours did not). */}
      <Canvas className={WONDER_WALK_CANVAS} flat gl={{ localClippingEnabled: true }} dpr={TERRAIN_DPR} camera={{ position: [-430, 300, 380], fov: 40, near: 0.5, far: 5000 }}>
        <RevealFirstFrame ready={!!ground && !!above} onReady={() => setShown(true)} />
        <AtlasCameraBridge open={atlasOpen} saved={atlasCam} locateRef={locateRef} />
        {/* For the creature's figure (the built parts light themselves). */}
        <hemisphereLight args={[BLOCKOUT.skyLight, BLOCKOUT.groundLight, 1.6]} />
        <directionalLight position={[-300, 400, 200]} intensity={1.6} />
        <World hour={hour} seed={params.seed} clouds={-BASE_DEPTH - underside.depth - 50} islandBox={islandBox} arrival={views?.arrival ?? null} air={dev.farStyle === 1} cloudParts={layers.clouds}>
          {(uniforms) => ground && above && (
            <Ground uniforms={uniforms} wind={wind} grid={ground.grid} rim={ground.rim} terrace={ground.terrace} poolNodes={ground.pools} outlets={ground.outlets} water={ground.water} underside={ground.underside} above={above} light={light} lod={view.lod} wire={debug.wire} marker={debug.particles || layers.flow} onDrawn={setDrawn} trees={trees} broad={broad} broadKnobs={saved.plants} zones={ground.zones} folds={ground.folds} rock={layers.surface === 'folds' ? { ...rock, foldView: 'folds' } : rock} groundView={layers.surface === 'height' ? 1 : layers.surface === 'slope' ? 2 : 0} heightRange={heights} farStyle={[dev.farStyle, dev.farNear, dev.farFar]} shrubs={shrubs} showZones={showZones} cover={cover} coverDebug={coverDebug} coverAmount={coverAmount} seed={params.seed} onCoverStats={onCoverStats} walking={view.walk} coverBuildMsRef={coverBuildMsRef} floorFlagsRef={floorFlagsRef} lifeGoal={creatureRef} prewarmLife={chapter === 'life' && followLife} coverFlightRef={focusAnimRef}
              onPickResource={exhibit ? (id) => { if (pickGate.open) pickResource(id); } : undefined}
              fish={fish}
              brook={brook}
              onPickFish={exhibit ? (f) => { if (!pickGate.open) return; setSelectedFish(f); setStatusOpen(false); setFishCard(true); } : undefined}
              dwelling={dwelling && habitat && { sim: dwelling, corner, stones: habitat.layout, shelter: habitat.shelter.plan, cut: false, seed: params.seed, run: dwell.run, speed: dwell.speed, show: dwell.show || layers.prints, debug: { skeleton: dwell.dbgSkeleton, feet: dwell.dbgFeet || layers.feet, state: dwell.dbgState || layers.goals, route: dwell.dbgRoute || layers.traces, drink: dwell.dbgDrink || layers.goals, rest: dwell.dbgRest || layers.goals }, selecting: exhibit, onSelect: () => { if (pickGate.open) pickCreature(0); }, antlers: who[0].antlers, calls: dwellCalls.current, onStats: setDwellStats, onReadout: setReadout, companion: dwelling2 ? { sim: dwelling2, shelter: habitat.shelter2?.plan ?? null, onSelect: () => { if (pickGate.open) pickCreature(1); }, onStats: setDwellStats2, antlers: who[1].antlers } : null }} />
          )}
        </World>
        {showScale && !view.walk && (
          <WonderlandScaleView known={scaleKnown} anchors={scaleAnchors} onMeasure={setScaleRows} bar={scaleBar as RefObject<ScaleBar>} show={scaleShow} />
        )}
        {corner && dwelling && !view.walk && (
          <CornerCamera corner={corner} drink={dwelling.sites.drink} calls={dwellCalls.current} />
        )}
        {layers.wind && ground && wind && <WindStreaks wind={wind} grid={ground.grid} seed={params.seed} />}
        {(debug.particles || layers.flow) && ground && <FlowParticles pools={ground.pools} outlets={ground.outlets} water={ground.water} grid={ground.grid} />}
        {ground && layers.waterGraph && <WaterGraphLayer pools={ground.pools} outlets={ground.outlets} water={ground.water} />}
        {ground && layers.sites && dwelling && habitat && <SitesLayer grid={ground.grid} dwellings={dwelling2 ? [dwelling, dwelling2] : [dwelling]} names={who.map((w) => t(`dweller.name.${w.nameIndex}` as StringKey))} />}
        {layers.relations && dwelling && dwelling2 && <RelationLayer dwellings={[dwelling, dwelling2]} />}
        {layers.school && fish.length > 0 && <SchoolLayer fish={fish} />}
        <FrameRate />
        {!view.walk && (
          <OrbitControls
            makeDefault
            target={orbitTargetInit}
            enableDamping
            dampingFactor={0.06}
            zoomToCursor
            screenSpacePanning
            minDistance={3}
            maxDistance={2500}
            maxPolarAngle={Math.PI * 0.6}
            zoomSpeed={1.15}
            panSpeed={1.1}
            rotateSpeed={0.85}
            onStart={() => { lifeOrbitInteracting.current = true; markTour('view'); }}
            onEnd={() => { lifeOrbitInteracting.current = false; }}
          />
        )}
        {!view.walk && above && <OrbitFocus enabled above={above} animRef={focusAnimRef} />}
        {!view.walk && above && ground && (
          <OrbitPivotRescue enabled grid={ground.grid} above={above} minDistance={3} />
        )}
        {!view.walk && above && dev.navDiag && (
          <OrbitNavDiag
            enabled
            above={above}
            minDistance={3}
            coverBuildMsRef={coverBuildMsRef}
            focusAnimRef={focusAnimRef}
            floorFlagsRef={floorFlagsRef}
            onUpdate={setNavDiag}
          />
        )}
        {view.walk && ground && (
          <WonderlandWalk
            world={{ grid: ground.grid, water: ground.water, terrace: groundRules(params).plate(0), seed: params.seed, zones: ground.zones }}
            zones={ground.zones}
            speed={view.walkSpeed}
            restore={orbitRestore}
            near={dwelling ? dwelling.sites.homes[Math.min(dwell.home, dwelling.sites.homes.length - 1)] : null}
            onLockChange={setWalkLocked}
            onSpeedHint={setWalkHint}
            onPose={setWalkPose}
          />
        )}
        <OrbitRestoreCapture restore={orbitRestore} active={!view.walk} />
        {photo && <PhotoPass filter={photoFilter} shoot={shootRef} />}
        {photo && <KeyPan />}
        <PickGate closed={photo} />
        {exhibit && !view.walk && <ChapterCamera views={views} chapter={chapter} go={chapterGo} animRef={focusAnimRef} box={islandBox} creature={creatureRef} followLife={followLife} orbitInteracting={lifeOrbitInteracting} followGate={followGate} ground={above} />}
      </Canvas>
      {exhibit && !view.walk && (
        <>
          {shown && !loadError && !photo && <CameraRail chapter={chapter} onChapter={(c) => { markTour('chapters'); chooseChapter(c); }} onPhoto={() => { markTour('photo'); setPhoto(true); setLayersOpen(false); setDrawer(false); setStatusOpen(false); setFishCard(false); }} />}
          {shown && !loadError && photo && <PhotoMode filter={photoFilter} onFilter={setPhotoFilter} onShoot={(take) => { shootRef.current = take; }} onClose={() => setPhoto(false)}
            when={`${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60) % 60).padStart(2, '0')} ${t(`option.${nearestTimeOfDay(hour)}` as StringKey)}`} hourName={t(`option.${nearestTimeOfDay(hour)}` as StringKey)} />}
          {shown && reshaping && !loadError && <div className="island-reshaping" role="status"><span aria-hidden="true" />{t('exhibit.reshaping')} {Math.round(loadProgress.percent)}%</div>}
          {(!shown || showComplete || loadError) && <IslandLoading phase={ground ? 'frame' : 'ground'} percent={shown ? 100 : loadProgress.percent} step={loadProgress.step} failed={!!loadError} onRetry={retryLoad} />}
        </>
      )}
      {exhibit && shown && !loadError && !view.walk && !drawer && !photo && (
        <div className="layers-dock">
          <LayersButton open={layersOpen} count={(layers.surface !== 'normal' ? 1 : 0) + Object.entries(layers).filter(([k, v]) => k !== 'surface' && v === true).length} onOpen={(o) => { setLayersOpen(o); if (o) setDrawer(false); }} />
          {layersOpen && <LayersPanel layers={layers} onChange={setLayers} onClose={() => setLayersOpen(false)} onClear={() => setLayers(NO_LAYERS)} />}
        </div>
      )}
      {exhibit && shown && !loadError && !photo && (
        <SettingsDrawer
          open={drawer}
          onOpen={(o) => { setDrawer(o); if (o) setLayersOpen(false); }}
          run={dwell.run}
          onRun={(on) => levaStore.setValueAtPath('Dwelling.run', on, true)}
          speed={dwell.speed}
          onSpeed={(v) => levaStore.setValueAtPath('Dwelling.speed', v, true)}
          onAnother={() => levaStore.setValueAtPath('Island.seed', Math.floor(createRng(params.seed + 1)() * 9999), true)}
          onReset={() => { dwellCalls.current.reset(); dwelling2?.reset(); }}
          sections={settingsSections}
          onResources={() => { setDrawer(false); setAtlasFocus(null); setAtlasPicked(false); setAtlasOpen(true); }}
          onTour={() => { setDrawer(false); openTour(); }}
          debug={{
            skeleton: dwell.dbgSkeleton, feet: dwell.dbgFeet, state: dwell.dbgState, route: dwell.dbgRoute,
            contact: dwell.show, drink: dwell.dbgDrink, rest: dwell.dbgRest,
          }}
          onDebug={setCreatureDebug}
          activity={dwellStats ? t(`dwell.${dwellStats.activity}` as StringKey) : null}
          trips={dwellStats ? dwellStats.cycles : null}
        />
      )}
      {exhibit && shown && !loadError && !view.walk && !atlasOpen && <TimeDial hour={hour} onHour={(value) => { markTour('time'); levaStore.setValueAtPath('Light.hour', value, true); }} speed={dwell.speed} onSpeed={(v) => { markTour('time'); levaStore.setValueAtPath('Dwelling.speed', v, true); }} />}
      {exhibit && shown && !loadError && !view.walk && !atlasOpen && !photo && statusOpen && dwellStats && <CreatureStatusDock stats={lifeIndex === 1 && dwellStats2 ? dwellStats2 : dwellStats} who={(() => { const dw = lifeIndex === 1 && dwelling2 ? dwelling2 : dwelling; const w = who[lifeIndex === 1 && dwelling2 ? 1 : 0]; return dw ? { name: t(`dweller.name.${w.nameIndex}` as StringKey), gloss: t(`dweller.gloss.${w.nameIndex}` as StringKey), traits: dw.traits, antlers: w.antlers } : undefined; })()} onNext={dwelling2 ? nextCreature : undefined} onClose={() => setStatusOpen(false)} onForm={() => { markTour('creature'); setAtlasFocus('wonderland-creature'); setAtlasPicked(true); setAtlasOpen(true); }} />}
      {exhibit && shown && !loadError && !view.walk && !atlasOpen && !photo && fishCard && selectedFish && !statusOpen && <FishStatusDock fish={selectedFish} onClose={() => setFishCard(false)} onForm={() => pickResource('wonderland-stream-fish')} />}
      {exhibit && shown && !loadError && !view.walk && !atlasOpen && !photo && ground && above && <IslandNavigator grid={ground.grid} mask={ground.water.mask} rim={ground.rim} fish={fish} plunge={ground.water.plunge} creatures={[dwelling?.pose, dwelling2?.pose].filter((p): p is NonNullable<typeof p> => !!p)} creatureName={(i) => t(`dweller.name.${who[i].nameIndex}` as StringKey)} onCreature={(i) => { setFishCard(false); setLifeIndex(i); followGate.current = true; chooseChapter('life'); markTour('creature'); }} onGo={(x, z) => { const y = above(x, z); if (Number.isFinite(y)) { followGate.current = false; setFollowLife(false); locateRef.current?.({ x, y: y + 2, z, distance: 28 }); } }} onFish={(f) => { setSelectedFish(f); setStatusOpen(false); setFishCard(true); followGate.current = false; setFollowLife(false); locateRef.current?.({ x: f.now.x, y: f.y, z: f.now.z, distance: 3.5 }); }} />}
      <ResourceAtlas
        open={atlasOpen}
        onClose={closeAtlas}
        island={islandResources}
        onLocate={(p) => { followGate.current = false; setFollowLife(false); locateRef.current?.(p); }}
        worldSeed={params.seed}
        focusId={atlasFocus}
        picked={atlasPicked}
        activity={dwellStats ? t(`dwell.${dwellStats.activity}` as StringKey) : null}
        day={dwellStats ? dwellStats.cycles : null}
        creatureStats={dwellStats}
        fish={selectedFish ?? fish[0] ?? null}
        fishSchool={fish}
        denSeed={habitat?.shelter.plan?.formSeed ?? null}
        lifeIndex={lifeIndex}
        dwellers={dwelling ? who.slice(0, dwelling2 ? 2 : 1).map((w) => ({ name: t(`dweller.name.${w.nameIndex}` as StringKey), axes: w.antlers as MorphAxes, birth: w.birth })) : undefined}
        onSaveForm={(i, axes) => keep({ ...saved, forms: { ...saved.forms, [i]: axes } })}
        dens={habitat ? [habitat.shelter.plan, habitat.shelter2?.plan ?? null].flatMap((pl, i) => (pl ? [{ name: t('den.of').replace('{n}', t(`dweller.name.${who[i].nameIndex}` as StringKey)), seed: pl.formSeed, params: pl.shell ?? birthShell(pl.formSeed), birth: birthShell(pl.formSeed) }] : [])) : undefined}
        onSaveDen={(i, p) => keep({ ...saved, dens: { ...saved.dens, [i]: p } })}
        plantKnobs={saved.plants}
        shrubRolls={shrubs?.patches.map((p) => p.roll)}
        onApplyPlant={(kind, k) => keep({ ...saved, plants: { ...saved.plants, [kind]: k } })}
        onShowDebug={showCreatureDebug}
      />
      <MorphSheet />
      <Tour open={tour && exhibit && shown && !view.walk} seen={tourSeen} following={chapter === 'life' && followLife} onClose={() => setTour(false)} />
      {exhibit && readout && (dwell.dbgSkeleton || dwell.dbgFeet || dwell.dbgState || dwell.dbgRoute || dwell.show || dwell.dbgDrink || dwell.dbgRest) && (
        <CreatureLegend t={t} readout={readout} flags={{ skeleton: dwell.dbgSkeleton, feet: dwell.dbgFeet, state: dwell.dbgState, route: dwell.dbgRoute, contact: dwell.show, drink: dwell.dbgDrink, rest: dwell.dbgRest }} />
      )}
      {view.walk && (
        <p className="walk-hint">
          {walkLocked
            ? `${t('walk.moving')} · ${walkHint.mps.toFixed(1)} m/s`
            : `${t('walk.click')} · ${t('walk.returnOrbit')}`}
        </p>
      )}
      {view.walk && ground && walkPose && (
        <WalkMinimap
          pose={walkPose}
          extent={((ground.grid.size - 1) * ground.grid.texel) / 2}
          label={t('walk.minimap')}
          marks={([
            ...(dwelling?.sites.homes.map((h): WalkMapMark => ({ x: h.x, z: h.z, kind: 'home' })) ?? []),
            ...(dwelling ? [{ x: dwelling.sites.drink.x, z: dwelling.sites.drink.z, kind: 'drink' as const }] : []),
          ])}
        />
      )}
      {view.stats && (
        <StatsPanel
          title={t('terrain.title')}
          rows={[
            [t('terrain.patches'), `${drawn.patches}`],
            [t('terrain.triangles'), `${(drawn.triangles / 1000).toFixed(0)} k`],
            [t('terrain.ground'), ground ? `${(ground.ms / 1000).toFixed(2)} s` : '…'],
            [t('terrain.trees'), woods ? `${woods.trees.length}${broad ? ` · ${broad.parasol.length} + ${broad.weeping.length}` : ''}` : '…'],
            [t('terrain.shrubs'), shrubs ? `${shrubs.patches.length} · ${shrubs.plants.length}` : '…'],
            ...(coverLive ? [
              [t('cover.blades'), `${coverLive.grassBlades}${coverLive.pipe.nearBlades ? '' : ' · far'}`],
            ] as [string, string][] : []),
            ...(dwellStats ? [
              [t('dwell.doing'), `${t(`dwell.${dwellStats.activity}` as StringKey)} · ${
                dwell.run ? `×${dwell.speed}` : t('dwell.paused')
              }`],
            ] as [string, string][] : []),
          ]}
        />
      )}
      {exhibit && shown && !view.walk && !photo && <LayersLegend layers={layers} heights={heights} />}
      {showScale && (
        <WonderlandScaleLegend
          rows={scaleRows}
          steps={scaleSteps}
          bar={scaleBar as RefObject<ScaleBar>}
          show={scaleShow}
          onShow={setScaleShow}
        />
      )}
      {dev.navDiag && !view.walk && (
        <div className="nav-diag" aria-label={t('navDiag.title')}>
          <div className="scale-head">{t('navDiag.title')}</div>
          <table>
            <tbody>
              <tr><td>cam</td><td>{`${navDiag.cam.x}, ${navDiag.cam.y}, ${navDiag.cam.z}`}</td></tr>
              <tr><td>target</td><td>{`${navDiag.target.x}, ${navDiag.target.y}, ${navDiag.target.z}`}</td></tr>
              <tr><td>cam↔target</td><td>{navDiag.camTargetDist} m</td></tr>
              <tr><td>hit</td><td>{navDiag.hitName} · {navDiag.hitDist} m</td></tr>
              <tr><td>hit pt</td><td>{navDiag.hit ? `${navDiag.hit.x}, ${navDiag.hit.y}, ${navDiag.hit.z}` : '—'}</td></tr>
              <tr><td>wheel Δ</td><td>{navDiag.wheelDelta}</td></tr>
              <tr><td>cam Δ</td><td>{navDiag.camDelta} m</td></tr>
              <tr><td>minDist</td><td>{navDiag.minDistanceHit ? 'HIT' : 'ok'}</td></tr>
              <tr><td>floor</td><td>{`cam ${navDiag.floorClampCam ? 'Y' : 'n'} · tgt ${navDiag.floorClampTarget ? 'Y' : 'n'}`}</td></tr>
              <tr><td>focusAnim</td><td>{navDiag.focusAnim ? 'Y' : 'n'}</td></tr>
              <tr><td>cover ms</td><td>{navDiag.coverBuildMs}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}



const CLEARANCE = SIZES.camera.clearance; // metres the camera keeps above the ground
const NONE: Plant[] = [];

/**
 * Saves orbit camera when the resource atlas opens; restores on close (NaN sentinel).
 * Locate moves the orbit aim to a real island instance without reseeding.
 */
function AtlasCameraBridge({ open, saved, locateRef }: {
  open: boolean;
  saved: React.MutableRefObject<{ pos: Vector3; target: Vector3 } | null>;
  locateRef: React.MutableRefObject<((p: { x: number; y: number; z: number; distance?: number }) => void) | null>;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update?: () => void } | null;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && controls?.target) {
      saved.current = { pos: camera.position.clone(), target: controls.target.clone() };
    }
    wasOpen.current = open;
  }, [open, camera, controls, saved]);
  useEffect(() => {
    locateRef.current = (p) => {
      if (!controls?.target) return;
      if (Number.isNaN(p.x) && saved.current) {
        camera.position.copy(saved.current.pos);
        controls.target.copy(saved.current.target);
        controls.update?.();
        return;
      }
      controls.target.set(p.x, p.y, p.z);
      const dir = p.distance != null
        ? new Vector3(1, p.distance <= 10 ? .45 : .8, 1).normalize().multiplyScalar(p.distance)
        : new Vector3().subVectors(camera.position, controls.target).setLength(p.distance ?? Math.max(8, camera.position.distanceTo(controls.target) * 0.35));
      camera.position.copy(controls.target).add(dir.lengthSq() > 1 ? dir : new Vector3(6, 4, 8));
      controls.update?.();
    };
    return () => { locateRef.current = null; };
  }, [camera, controls, locateRef, saved]);
  return null;
}

/** Keep orbit camera + target so Walk can restore them when toggled off. */
function OrbitRestoreCapture({ restore, active }: { restore: React.MutableRefObject<{ pos: Vector3; target: Vector3 }>; active: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update?: () => void } | null;
  const wasActive = useRef(active);
  useFrame(() => {
    if (active) {
      restore.current.pos.copy(camera.position);
      if (controls?.target) restore.current.target.copy(controls.target);
      // Just returned from Walk: put orbit aim back where it was.
      if (!wasActive.current && controls?.target) {
        camera.position.copy(restore.current.pos);
        controls.target.copy(restore.current.target);
        controls.update?.();
      }
    }
    wasActive.current = active;
  });
  return null;
}

/** The ground: its patches (CDLOD), the island's side, the terrace's pools; the camera kept above it. */
function Ground({ groundView = 0, heightRange = null, farStyle = [0, 60, 260], uniforms, wind = null, grid, rim, terrace, poolNodes, outlets, water: flowing, underside, above, light, lod, wire, marker, onDrawn, dwelling, trees, broad = null, broadKnobs, zones, showZones, cover, coverDebug, coverAmount, seed, onCoverStats, walking = false, coverBuildMsRef, floorFlagsRef, lifeGoal, prewarmLife, coverFlightRef, folds, rock, shrubs, onPickResource, fish, brook, onPickFish}: {
  /** The layers' ground view: 0 off, 1 height, 2 slope. */
  groundView?: 0 | 1 | 2;
  heightRange?: [number, number] | null;
  /** Far-view study: style, near, far (metres). */
  farStyle?: [number, number, number];
  uniforms: WorldUniforms;
  /** The island's wind field, for the grass and flower shaders. */
  wind?: WindField | null;
  grid: HeightGrid;
  rim: Float32Array;
  terrace: BasinMesh[];
  poolNodes: PoolNode[];
  outlets: OutletNode[];
  water: Water;
  underside: UndersideMesh;
  above: (x: number, z: number) => number;
  light: { light: Uint8Array; size: number } | null;
  lod: number;
  wire: boolean;
  /** Red bands riding down the falls with the water (the debug view: they must run down). */
  marker: boolean;
  onDrawn: (d: { patches: number; triangles: number }) => void;
  onPickResource?: (id: string) => void;
  fish: StreamFishData[];
  /** The brook school, wary of the dwellers. */
  brook?: StreamFishData[];
  onPickFish?: (fish: StreamFishData) => void;
  /** The woods' trees (the groves), drawn with Penglai's instanced levels of detail. */
  trees: Plant[];
  /** The broadleaf trees (parasol at the woodland's edge, weeping by water). */
  broad?: { parasol: Plant[]; weeping: Plant[] } | null;
  /** The plant knobs saved from the atlas ("apply to island"), per kind. */
  broadKnobs?: Partial<Record<PlantKind, PlantKnobs>>;
  /** The island's zones, and whether to colour the ground by them (debug). */
  /** The mountains' folds (rockFolds.ts) and the panel's rock settings. */
  folds: RockFolds;
  rock: { folds: boolean; foldMix: number; foldView: string };
  /** Low shrub patches (shrubs.ts), or null when off. */
  shrubs: ShrubField | null;
  zones: Zones;
  showZones: boolean;
  cover: ReturnType<typeof buildCover> | null;
  coverDebug: boolean;
  coverAmount: number;
  seed: number;
  onCoverStats: (s: CoverLiveStats) => void;
  /** First-person Walk: skip orbit ground-clamp that fights zoomToCursor. */
  walking?: boolean;
  coverBuildMsRef?: { current: number };
  floorFlagsRef?: { current: { cam: boolean; target: boolean } };
  lifeGoal?: { current: { pose: { x: number; z: number } } | null };
  prewarmLife?: boolean;
  coverFlightRef?: { current: boolean };
  /** The creature and the jade it leaves (creature.tsx), and the panel's handles on it. */
  dwelling: { sim: Dwelling; corner: Corner | null; stones: HabitatLayout | null; shelter: ShelterPlan | null; cut: boolean; seed: number; run: boolean; speed: number; show: boolean; debug: { skeleton: boolean; feet: boolean; state: boolean; route: boolean; drink: boolean; rest: boolean }; selecting: boolean; onSelect: () => void; calls: { reset: () => void; look: () => void }; onStats: (s: DwellingStats) => void; onReadout: (r: CreatureReadout) => void; antlers: Antlers; companion: { sim: Dwelling; shelter: ShelterPlan | null; onSelect: () => void; onStats: (s: DwellingStats) => void; antlers: Antlers } | null } | null;
}) {
  useEffect(() => {
    if (!wind) return;
    const texture = windTexture(wind);
    setWindField(uniforms, wind, texture);
    return () => { uniforms.uWindHalf.value = 0; texture.dispose(); };
  }, [uniforms, wind]);
  const material = useMemo(() => createTerrainMaterial(uniforms), [uniforms]);
  const side = useMemo(() => createPorcelainMaterial(uniforms), [uniforms]);
  const built = useMemo(() => createBuiltMaterial(uniforms), [uniforms]);
  const jadeSites = useMemo(() => jadeRevealSites(poolNodes, outlets, flowing), [poolNodes, outlets, flowing]);
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __jadeSites?: typeof jadeSites }).__jadeSites = jadeSites;
      (window as unknown as { __jadeShaders?: { material: typeof material; built: typeof built } }).__jadeShaders = { material, built };
    }
    for (const shader of [material, built]) {
      shader.uniforms.uJadeReveal.value = jadeSites ? 1 : 0;
      if (jadeSites) {
        shader.uniforms.uJadePool.value = { x: jadeSites.pool[0], y: jadeSites.pool[1] };
        shader.uniforms.uJadeBend.value = { x: jadeSites.bend[0], y: jadeSites.bend[1] };
        if (shader.uniforms.uJadePoolY) shader.uniforms.uJadePoolY.value = jadeSites.poolY;
        if (shader.uniforms.uJadeTangent) shader.uniforms.uJadeTangent.value = { x: jadeSites.tangent[0], y: jadeSites.tangent[1] };
      }
    }
  }, [material, built, jadeSites]);
  // The pools' water (its depth per vertex, over the plates' floors), and the water below the
  // terrace (its depth per pixel, over the ground's height map).
  const water = useMemo(() => createFlowWaterMaterial(uniforms), [uniforms]);
  const runoff = useMemo(() => createFlowWaterMaterial(uniforms, { ground: true }), [uniforms]);
  const falling = useMemo(() => createFallMaterial(uniforms), [uniforms]);
  useEffect(() => () => { material.dispose(); side.dispose(); built.dispose(); water.dispose(); runoff.dispose(); falling.dispose(); }, [material, side, built, water, runoff, falling]);
  // Where water lands stirs the water there (the same places, flows and drops as the falls').
  useEffect(() => { setImpacts(water, flowing.impacts); setImpacts(runoff, flowing.impacts); }, [water, runoff, flowing]);
  // The falls stain the walls they run down (builtMaterial.ts: travertine, amber, a wet foot).
  useEffect(() => { setBuiltFalls(built, flowing.falls, grid.bottom); }, [built, flowing, grid]);
  useEffect(() => { falling.uniforms.uMarker.value = marker ? 1 : 0; }, [falling, marker]);
  useEffect(() => { material.wireframe = wire; }, [material, wire]);
  const pines = useMemo(() => createIslandPineMaterial(uniforms), [uniforms]);
  useEffect(() => () => pines.dispose(), [pines]);
  // Zone labels: Nearest (discrete). Soft surface RGBA: Linear (~10 m blend). Moisture: Linear.
  // Shown as the zones layer, the planting map (what grows where) instead of the zone ids; the
  // live ground only reads the zone ids when that layer is off (cdlod.ts), so one texture serves.
  const zoneMap = useMemo(() => {
    const t = new DataTexture(showZones ? plantZones(zones) : zones.zone, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [zones, showZones]);
  const moistureMap = useMemo(() => {
    const data = new Uint8Array(zones.moisture.length);
    for (let i = 0; i < zones.moisture.length; i++) data[i] = Math.round(Math.min(zones.moisture[i], 1) * 255);
    const t = new DataTexture(data, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [zones]);
  const groveMap = useMemo(() => {
    // Blurred over 8 m: grove strength is 0 outside woodland cells and jumps inside them, so the
    // litter tint drew the 2 m cells as a staircase.
    const soft = blurField(Float32Array.from(zones.grove), zones.nx, zones.nz, zones.cell, 8);
    const data = new Uint8Array(soft.length);
    for (let i = 0; i < soft.length; i++) data[i] = Math.round(Math.min(soft[i], 1) * 255);
    const t = new DataTexture(data, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [zones]);
  // The mountains' folds: RGBA on the height grid's texels, read with the light map's uv.
  const foldMap = useMemo(() => {
    const t = new DataTexture(folds.rgba, folds.size, folds.size, RGBAFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [folds]);
  useEffect(() => () => foldMap.dispose(), [foldMap]);
  useEffect(() => {
    const view = rock.foldView === 'mountain' ? 1
      : rock.foldView === 'folds' ? 2
        : rock.foldView === 'wide' ? 3
          : rock.foldView === 'gate' ? 4
            : rock.foldView === 'final' ? 5 : 0;
    setTerrainFolds(material, rock.folds || view > 0 ? foldMap : null, rock.folds ? rock.foldMix : 0, view);
  }, [material, foldMap, rock.folds, rock.foldMix, rock.foldView]);
  useEffect(() => { setTerrainFarStyle(material, farStyle[0], farStyle[1], farStyle[2]); }, [material, farStyle[0], farStyle[1], farStyle[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  // The same detail on the island's sides and underside, from its lowest point up to the rim.
  const sideRange = useMemo(() => { let lo = -BASE_DEPTH; for (let i = 1; i < underside.positions.length; i += 3) lo = Math.min(lo, underside.positions[i]); return [lo, grid.bottom] as const; }, [underside, grid]);
  useEffect(() => { setPorcelainFar(side, farStyle[0], farStyle[1], farStyle[2], sideRange[0], sideRange[1]); }, [side, sideRange, farStyle[0], farStyle[1], farStyle[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  // The layers' height and slope views (LayersPanel.tsx).
  useEffect(() => { setTerrainView(material, groundView, heightRange ?? [grid.bottom, grid.top], WALKABLE_SLOPE); }, [material, groundView, heightRange, grid]);
  // The ground under shrub patches: bytes on the zone grid.
  const shrubMap = useMemo(() => {
    if (!shrubs) return null;
    const t = new DataTexture(shrubs.ground, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [shrubs, zones]);
  useEffect(() => () => shrubMap?.dispose(), [shrubMap]);
  useEffect(() => { setTerrainShrubGround(material, shrubMap); }, [material, shrubMap]);
  const bankSource = useMemo(() => ({ grid, mask: flowing.mask }), [grid, flowing]);
  // The water's paint mask (water.ts: blurred ~5 m out from the water's edge) on the zones' cells,
  // blurred again over 6 m: the strip up the banks the ground keeps bare (cdlod.ts).
  const bankMap = useMemo(() => {
    const wet = new Float32Array(zones.zone.length);
    const { grid: g, mask } = bankSource;
    for (let j = 0; j < zones.nz; j++) for (let i = 0; i < zones.nx; i++) {
      const x = zones.x0 + (i + 0.5) * zones.cell, z = zones.z0 + (j + 0.5) * zones.cell;
      const gi = Math.round(x / g.texel + (g.size - 1) / 2), gj = Math.round(z / g.texel + (g.size - 1) / 2);
      if (gi >= 0 && gj >= 0 && gi < g.size && gj < g.size && mask[gj * g.size + gi] > 0) wet[j * zones.nx + i] = 1;
    }
    blurField(wet, zones.nx, zones.nz, zones.cell, 6);
    const data = new Uint8Array(wet.length);
    for (let i = 0; i < wet.length; i++) data[i] = Math.round(wet[i] * 255);
    const t = new DataTexture(data, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [zones, bankSource]);
  const surfaceMap = useMemo(() => {
    const blend = buildSurfaceBlend(zones, seed);
    const t = new DataTexture(blend.rgba, blend.nx, blend.nz, RGBAFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [zones, seed]);
  useEffect(() => () => { zoneMap.dispose(); moistureMap.dispose(); groveMap.dispose(); bankMap.dispose(); surfaceMap.dispose(); }, [zoneMap, moistureMap, groveMap, bankMap, surfaceMap]);
  useEffect(() => {
    setTerrainZones(material, {
      texture: zoneMap,
      moisture: moistureMap,
      grove: groveMap,
      bank: bankMap,
      surface: surfaceMap,
      x0: zones.x0,
      z0: zones.z0,
      size: zones.nx * zones.cell,
    }, showZones);
  }, [material, zoneMap, moistureMap, groveMap, bankMap, surfaceMap, zones, showZones]);
  const coverMap = useMemo(() => {
    if (!cover) return null;
    // Soft metre-scale edges for far tint (blade sampling still uses sharp density).
    const data = softCoverDensityBytes(cover, 6);
    const t = new DataTexture(data, cover.nx, cover.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [cover]);
  useEffect(() => () => coverMap?.dispose(), [coverMap]);
  useEffect(() => {
    setTerrainCover(material, cover && coverMap
      ? { texture: coverMap, x0: cover.x0, z0: cover.z0, size: cover.nx * cover.cell }
      : null, coverDebug);
  }, [material, cover, coverMap, coverDebug]);

  const heights = useMemo(() => heightTexture(grid), [grid]);
  // Until the light is baked: open sky, full sun.
  const lit = useMemo(() => (light && light.size === grid.size ? lightTexture(light.light, light.size) : lightTexture(new Uint8Array([255, 255, 255, 255]), 1)), [light, grid]);
  useEffect(() => () => heights.dispose(), [heights]);
  // The far view's copy, blurred ~25 m: soft shadow edges from afar (cdlod.ts softLight).
  const litSoft = useMemo(() => (light && light.size === grid.size ? softLight(light.light, light.size, grid.texel) : lightTexture(new Uint8Array([255, 255, 255, 255]), 1)), [light, grid]);
  useEffect(() => () => lit.dispose(), [lit]);
  useEffect(() => () => litSoft.dispose(), [litSoft]);
  useEffect(() => {
    for (const m of [material, built]) {
      const u = m.uniforms;
      if (u.uHeight) u.uHeight.value = heights;
      u.uLight.value = lit;
      if (u.uLightSoft) u.uLightSoft.value = litSoft;
      u.uSize.value = grid.size;
      u.uTexel.value = grid.texel;
    }
    runoff.uniforms.uHeight.value = heights;
    runoff.uniforms.uSize.value = grid.size;
    runoff.uniforms.uTexel.value = grid.texel;
  }, [material, built, runoff, heights, lit, litSoft, grid]);
  // The terrace's blocks and their water.
  const pools = useMemo(() => terrace.map((b) => {
    const block = new BufferGeometry();
    block.setAttribute('position', new BufferAttribute(b.positions, 3));
    block.setAttribute('normal', new BufferAttribute(b.normals, 3));
    block.setAttribute('aOcclusion', new BufferAttribute(b.occlusion, 1));
    block.setIndex(new BufferAttribute(b.indices, 1));
    block.computeBoundingSphere();
    const sheet = new BufferGeometry();
    sheet.setAttribute('position', new BufferAttribute(b.water.positions, 3));
    sheet.setAttribute('aDepth', new BufferAttribute(b.water.depths, 1));
    sheet.setAttribute('aFlow', new BufferAttribute(b.water.flow, 2));
    sheet.setIndex(new BufferAttribute(b.water.indices, 1));
    sheet.computeBoundingSphere();
    return { block, sheet };
  }), [terrace]);
  useEffect(() => () => pools.forEach(({ block, sheet }) => { block.dispose(); sheet.dispose(); }), [pools]);
  // The falls, their foam, the plunge pool's and the streams' water, the underside.
  const streams = useMemo(() => {
    const falls = flowing.falls.map((f) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(f.positions, 3));
      g.setAttribute('aFlow', new BufferAttribute(f.flow, 4));
      g.setAttribute('aExtra', new BufferAttribute(f.extra, 3));
      g.setIndex(new BufferAttribute(f.indices, 1));
      g.computeBoundingSphere();
      return g;
    });
    const sheets = flowing.sheets.map((w) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(w.positions, 3));
      g.setAttribute('aDepth', new BufferAttribute(w.depths, 1));
      g.setAttribute('aFlow', new BufferAttribute(w.flow, 2));
      g.setIndex(new BufferAttribute(w.indices, 1));
      g.computeBoundingSphere();
      return g;
    });
    const under = new BufferGeometry();
    under.setAttribute('position', new BufferAttribute(underside.positions, 3));
    under.setAttribute('normal', new BufferAttribute(underside.normals, 3));
    under.setAttribute('aOcclusion', new BufferAttribute(underside.occlusion, 1));
    under.setIndex(new BufferAttribute(underside.indices, 1));
    under.computeBoundingSphere();
    return { falls, sheets, under };
  }, [flowing, underside]);
  useEffect(() => () => { [...streams.falls, ...streams.sheets, streams.under].forEach((g) => g.dispose()); }, [streams]);

  const terrain = useMemo(() => new TerrainLod(material, grid, { ...LOD_DEFAULTS, range: lod }, flowing.mask), [material, grid, lod, flowing.mask]);
  useEffect(() => () => terrain.dispose(), [terrain]);
  // Flange + top share RIM_JOIN (rimJoin.ts): same height/outline channels, overlapping keep band.
  const wall = useMemo(
    () => rimWall(
      rim,
      -BASE_DEPTH,
      undefined,
      (x, z) => sampleGrid(grid, x, z),
      (x, z) => sampleGrid(grid, x, z, 3),
    ),
    [rim, grid],
  );
  useEffect(() => () => wall.dispose(), [wall]);

  const told = useRef(0);
  useFrame(({ camera, controls, clock, size }) => {
    const scale = farScale((camera as PerspectiveCamera).fov ?? 40, size.height);
    material.uniforms.uFarScale.value = scale;
    side.uniforms.uFarScale.value = scale;
    const pasture = dwelling?.sim.grazing;
    (material.uniforms.uGrazing.value as Vector4).set(pasture?.x ?? 0, pasture?.z ?? 0, pasture?.radius ?? 0, pasture?.biomass ?? 1);
    // Orbit only: lift when truly below ground. Clearance shrinks as cam↔target closes so
    // zoomToCursor near shores/slopes is not constantly yanked (still never digs into stone).
    if (!walking) {
      const target = (controls as unknown as { target?: Vector3 } | null)?.target;
      const dist = target ? camera.position.distanceTo(target) : 80;
      // At ~3 m minDistance → ~0.55 m clearance; overview keeps full CLEARANCE (2 m).
      const camClear = Math.min(CLEARANCE, Math.max(0.55, dist * 0.09));
      const gy = above(camera.position.x, camera.position.z);
      let camClamped = false;
      if (Number.isFinite(gy) && camera.position.y < gy + camClear) {
        const lift = gy + camClear - camera.position.y;
        camera.position.y += lift;
        // Keep the OrbitControls pivot at the same relative height. Lifting only
        // the camera changes its spherical angle, so the next wheel update tilts
        // it back into the slope and creates a visible up/down correction loop.
        if (target) target.y += lift;
        camClamped = true;
      }
      let tgtClamped = false;
      if (target) {
        const ty = above(target.x, target.z);
        const glued = camera.position.distanceTo(target) < 4.2;
        // When pivot is glued to the camera (minDist stuck), do not keep yanking target up —
        // that fights OrbitPivotRescue. Only lift if deeply underground.
        const need = glued ? ty - 0.4 : ty + 0.12;
        if (Number.isFinite(ty) && target.y < need) {
          target.y = glued ? ty + 0.12 : need;
          tgtClamped = true;
        }
      }
      if (floorFlagsRef) floorFlagsRef.current = { cam: camClamped, target: tgtClamped };
      if (NAV_PROBE && target) {
        const probe = window as unknown as { __navProbe?: { at: number; cam: number[]; target: number[]; camClamped: boolean; tgtClamped: boolean }[] };
        const samples = probe.__navProbe ??= [];
        if (samples.length < 900) samples.push({ at: performance.now(), cam: camera.position.toArray(), target: target.toArray(), camClamped, tgtClamped });
      }
    }
    camera.updateMatrixWorld();
    const patches = terrain.update(camera);
    if (clock.elapsedTime - told.current > 0.5) {
      told.current = clock.elapsedTime;
      onDrawn({ patches, triangles: terrain.triangles });
    }
  });
  // Water/falls must not steal Orbit zoomToCursor — hit terrain under the shore instead.
  const noOrbitHit = () => {};
  return (
    <>
      <primitive object={terrain.group} />
      {JADE_PROBE && jadeSites && <>
        <mesh position={[jadeSites.pool[0], (poolNodes[0]?.level ?? 0) + 4, jadeSites.pool[1]]}><sphereGeometry args={[3, 10, 8]} /><meshBasicMaterial color="#ff00ff" depthTest={false} /></mesh>
        <mesh position={[jadeSites.bend[0], sampleGrid(grid, jadeSites.bend[0], jadeSites.bend[1]) + 4, jadeSites.bend[1]]}><sphereGeometry args={[3, 10, 8]} /><meshBasicMaterial color="#ff00ff" depthTest={false} /></mesh>
      </>}
      {/* Rim + underside: skip Orbit pick (they sit far below / aside and glued the pivot). */}
      <mesh geometry={wall} material={side} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />
      {pools.map(({ block, sheet }, k) => (
        <group key={k}>
          <mesh geometry={block} material={built}
            onPointerOver={onPickResource ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setWorldPointer('resource'); } : undefined}
            onPointerOut={onPickResource ? () => setWorldPointer(null) : undefined}
            onClick={onPickResource ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPickResource('wonderland-pool'); } : undefined} />
          <mesh geometry={sheet} material={water} renderOrder={1} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />
        </group>
      ))}
      <mesh geometry={streams.under} material={side} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />
      {streams.sheets.map((g, k) => <mesh key={`w${k}`} geometry={g} material={runoff} renderOrder={1} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />)}
      {streams.falls.map((g, k) => <mesh key={`s${k}`} geometry={g} material={falling} renderOrder={3} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />)}
      {farStyle[0] === 1 && <ValleyMist uniforms={uniforms} falls={flowing.falls} pools={poolNodes} plunge={flowing.plunge} floor={grid.bottom} seed={seed} range={[farStyle[1], farStyle[2]]} />}
      <StreamFish fish={fish} onPick={onPickFish} run={dwelling?.run ?? true} speed={dwelling?.speed ?? 1} />
      {brook && brook.length > 0 && <StreamFish fish={brook} onPick={onPickFish} run={dwelling?.run ?? true} speed={dwelling?.speed ?? 1} scarers={[dwelling?.sim ?? null, dwelling?.companion?.sim ?? null]} />}
      {shrubs && <ShrubPatches plants={shrubs.plants} uniforms={uniforms} knobs={broadKnobs?.shrub} onPick={onPickResource ? () => onPickResource('wonderland-shrub') : undefined} />}
      <Vegetation trees={trees} shrubs={NONE} boulders={NONE} seed={seed} pineMaterial={pines} uniforms={uniforms} lod={WOODS_LOD} pineKnobs={broadKnobs?.pine} onPickTree={onPickResource ? () => onPickResource('wonderland-pine') : undefined} onHoverTree={onPickResource ? (hover) => setWorldPointer(hover ? 'resource' : null) : undefined} />
      {broad && <Broadleaves parasol={broad.parasol} weeping={broad.weeping} knobs={broadKnobs} uniforms={uniforms} onPick={onPickResource ? (kind) => onPickResource(`wonderland-${kind}`) : undefined} onHover={onPickResource ? (hover) => setWorldPointer(hover ? 'resource' : null) : undefined} />}
      {cover && <CoverGrass cover={cover} grid={grid} uniforms={uniforms} seed={seed} grassKnobs={broadKnobs?.grass} flowerKnobs={broadKnobs?.flower} map={dwelling?.sim.map ?? null} grazing={dwelling?.sim.grazing} amount={coverAmount} walking={walking} onStats={onCoverStats} buildMsRef={coverBuildMsRef} lifeGoal={lifeGoal} prewarmLife={prewarmLife} flightRef={coverFlightRef} />}
      {dwelling?.corner && <CornerBlocks corner={dwelling.corner} uniforms={uniforms} groundAt={dwelling.sim.groundAt} seed={dwelling.seed} pineKnobs={broadKnobs?.pine} />}
      {dwelling?.stones && <HabitatStones layout={dwelling.stones} uniforms={uniforms} dwelling={dwelling.sim} />}
      {dwelling?.shelter && <RockShelter plan={dwelling.shelter} cut={dwelling.cut} uniforms={uniforms} onPick={onPickResource ? () => onPickResource('wonderland-den') : undefined} />}
      {dwelling && <DwellingView dwelling={dwelling.sim} ground={material} run={dwelling.run} speed={dwelling.speed} show={dwelling.show} debug={dwelling.debug} selecting={dwelling.selecting} onSelect={dwelling.onSelect} calls={dwelling.calls} onStats={dwelling.onStats} onReadout={dwelling.onReadout}  antlers={dwelling.antlers} />}
      {dwelling?.companion?.shelter && <RockShelter plan={dwelling.companion.shelter} cut={false} uniforms={uniforms} onPick={onPickResource ? () => onPickResource('wonderland-den') : undefined} />}
      {dwelling?.companion && <CompanionView dwelling={dwelling.companion.sim} run={dwelling.run} speed={dwelling.speed} selecting={dwelling.selecting} onSelect={dwelling.companion.onSelect} onStats={dwelling.companion.onStats} antlers={dwelling.companion.antlers} debug={dwelling.debug} />}
    </>
  );
}

function CreatureLegend({ t, readout, flags }: {
  t: (k: StringKey) => string;
  readout: CreatureReadout;
  flags: DebugToggles;
}) {
  const deg = Math.round((readout.heading * 180) / Math.PI);
  const moving = Math.hypot(readout.vx, readout.vz);
  return (
    <aside className="exhibit-legend" aria-label={t('exhibit.legendTitle')}>
      <div>{t('exhibit.legendTitle')}</div>
      {flags.state && (
        <div>
          {t(`dwell.${readout.activity}` as StringKey)} · {t(readout.goalKind === 'drink' ? 'exhibit.dbg.drink' : readout.goalKind === 'eat' ? 'dwell.eat' : 'exhibit.dbg.rest')}
          {' '}({readout.goalX.toFixed(1)}, {readout.goalZ.toFixed(1)}) m
          <br />
          {deg}° · {moving.toFixed(2)} m/s
        </div>
      )}
      {flags.skeleton && <div><i style={{ background: '#C47B2B' }} />{t('exhibit.legendJoints')}</div>}
      {flags.feet && <div><i style={{ background: '#1F6B4A' }} />{t('exhibit.legendDown')} · <i style={{ background: '#B8452F' }} />{t('exhibit.legendUp')} · {readout.planted.map((p) => t(p ? 'exhibit.legendDown' : 'exhibit.legendUp')).join(' · ')}</div>}
      {flags.route && <div><i style={{ background: '#2C6CB0' }} />{t('exhibit.dbg.route')}</div>}
      {flags.contact && <div><i style={{ background: '#8C3030' }} />{t('exhibit.legendContact')}</div>}
      {flags.drink && <div><i style={{ background: '#E0A85A' }} />{t('exhibit.legendMuzzle')}</div>}
      {flags.rest && <div><i style={{ background: '#5F877D' }} />{t('exhibit.legendHome')}</div>}
    </aside>
  );
}

/**
 * While the camera is out, the arrow keys pan the view (OrbitControls' own key panning), as the
 * right button or Shift-drag do: framing a picture wants left and right, not only round.
 */
function KeyPan() {
  const controls = useThree((s) => s.controls) as unknown as { listenToKeyEvents?: (el: HTMLElement | Window) => void; stopListenToKeyEvents?: () => void; keyPanSpeed?: number } | null;
  useEffect(() => {
    if (!controls?.listenToKeyEvents) return;
    controls.keyPanSpeed = 14;
    controls.listenToKeyEvents(window);
    return () => controls.stopListenToKeyEvents?.();
  }, [controls]);
  return null;
}

/** Metres from the camera to what it looks at beyond which nothing on the island answers a click. */
const PICK_NEAR = 220;

/** Opens and closes the pick gate (worldPointer.ts) each frame: shut while `closed` or seen from afar. */
function PickGate({ closed }: { closed: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;
  useFrame(({ camera }) => {
    const open = !closed && (!controls || camera.position.distanceTo(controls.target) < PICK_NEAR);
    if (open !== pickGate.open) { pickGate.open = open; if (!open) setWorldPointer(null); }
  });
  return null;
}

/** Default overview (matches the Canvas camera). */
const OVERVIEW: Corner['view'] = { from: [-430, 300, 380], to: [0, 20, 0] };

function RevealFirstFrame({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  const frames = useRef(0);
  useEffect(() => { frames.current = 0; }, [ready]);
  useFrame(() => {
    if (!ready) return;
    if (++frames.current === 2) onReady();
  });
  return null;
}

function CornerCamera({ corner, drink, calls }: {
  corner: Corner;
  drink: { x: number; z: number };
  calls: { lookOverview: () => void; lookArea: () => void; look: () => void; lookHome: () => void; lookClose: () => void };
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  useEffect(() => {
    const go = (view: Corner['view']) => () => {
      camera.position.set(...view.from);
      controls?.target.set(...view.to);
      controls?.update();
    };
    const [sx, , sz] = corner.view.from;
    const ux = drink.x - sx, uz = drink.z - sz, L = Math.hypot(ux, uz) || 1;
    const area: Corner['view'] = {
      from: [drink.x - (ux / L) * 140, 48, drink.z - (uz / L) * 140],
      to: [drink.x, 4, drink.z],
    };
    calls.lookOverview = go(OVERVIEW);
    calls.lookArea = go(area);
    calls.look = go(corner.view);
    calls.lookHome = go(corner.homeView);
    calls.lookClose = go(corner.closeView);
  }, [calls, corner, drink, camera, controls]);
  return null;
}

/** What the visitor saved for one island (form per creature id, den knobs per den id, tree knobs per kind). */
interface SavedIsland { forms: Record<number, MorphAxes>; dens: Record<number, ShellParams>; plants?: Partial<Record<PlantKind, PlantKnobs>> }
const savedKey = (seed: number) => `white-jade.saved.${seed}`;
/** Read from the browser; empty when absent, unreadable or blocked (the page works without it). */
function loadSaved(seed: number): SavedIsland {
  try {
    const raw = localStorage.getItem(savedKey(seed));
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') return { forms: v.forms ?? {}, dens: v.dens ?? {}, plants: v.plants ?? {} };
  } catch { /* storage blocked or bad data: the seed's own forms */ }
  return { forms: {}, dens: {} };
}
function storeSaved(seed: number, v: SavedIsland) {
  try { localStorage.setItem(savedKey(seed), JSON.stringify(v)); } catch { /* storage blocked: kept for this visit only */ }
}
