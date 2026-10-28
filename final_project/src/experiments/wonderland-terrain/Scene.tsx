import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { button, useControls } from 'leva';
import { BufferAttribute, BufferGeometry, DataTexture, LinearFilter, NearestFilter, RGBAFormat, RedFormat, UnsignedByteType, Vector3 } from 'three';
import { BLOCKOUT, ZONE_DEBUG } from '../../core/palette';
import type { BasinMesh } from '../../core/terrain/basinMesh';
import { createBuiltMaterial } from '../../core/terrain/builtMaterial';
import { createFallMaterial } from '../../core/terrain/fallMaterial';
import { createFlowWaterMaterial, setImpacts } from '../../core/terrain/flowWater';
import type { UndersideMesh } from '../../core/terrain/undersideMesh';
import { sunElevation } from '../../core/params/scene';
import { SIZES } from '../../core/scale';
import { BASE_DEPTH } from '../../core/sdf/terraceField';
import { createTerrainMaterial, heightTexture, LOD_DEFAULTS, lightTexture, setTerrainCover, setTerrainFolds, setTerrainShrubGround, setTerrainZones, TerrainLod } from '../../core/terrain/cdlod';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { rimWall } from '../../core/terrain/rimWall';
import { createPorcelainMaterial } from '../../core/shaders/porcelain';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { REBUILD_DELAY, useSettled } from '../island-v1/controls';
import { buildCover, COVER_DEFAULTS, softCoverDensityBytes } from './cover';
import { COVER_SCALE, CoverGrass, type CoverLiveStats } from './CoverGrass';
import { FRAME_DEFAULTS } from './frame';
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
import { growWoods, siteKeepOuts, WOODS_LOD } from './woods';
import { ZONE_NAMES, type Zones } from './zones';
import { DwellingView, type DwellingStats } from './creature';
import { BODY, createDwelling, type Dwelling } from './dwelling';
import { FlowParticles } from './particles';
import { WATER_DEFAULTS, type Water, type WaterParams } from './water';

/**
 * Wonderland's ground drawn as a height map (core/terrain): the meadow and the range of peaks, from
 * the island's rules (ground.ts), baked in a worker; drawn with
 * continuous level of detail (cdlod.ts), lit from a baked light map. The terrace as three pools
 * (terrace.ts), their falls, the plunge pool and the streams (water.ts), the underside: meshes
 * generated from their rules. Where the parts lie comes from the seed (frame.ts).
 */
export default function Scene() {
  const { language, t } = useLanguage();
  const text = (key: string) => ({ label: t(`leva.${key}` as StringKey), hint: t(`hint.${key}` as StringKey) });
  const [atlasOpen, setAtlasOpen] = useState(false);
  const atlasCam = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  const locateRef = useRef<((p: { x: number; y: number; z: number }) => void) | null>(null);
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
    shrubs: { value: true, ...text('shrubs') },
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
    [t('leva.resources')]: button(() => setAtlasOpen(true)),
  }, [language]);
  const showZones = view.envView === 'zones';
  const coverDebug = view.envView === 'density';
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
  }, { collapsed: true }, [language]);
  const [navDiag, setNavDiag] = useState<NavDiagSnapshot>(EMPTY_NAV_DIAG);
  const coverBuildMsRef = useRef(0);
  const focusAnimRef = useRef(false);
  const floorFlagsRef = useRef({ cam: false, target: false });
  const island = useControls('Island', {
    seed: { value: SEED, min: 0, max: 9999, step: 1, ...text('islandSeed') },
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
    speed: { value: 10, options: { '1×': 1, '10×': 10, '30×': 30, '100×': 100 }, ...text('dwellSpeed') },
    home: { value: 0, options: { [`${t('dwell.home')} A`]: 0, [`${t('dwell.home')} B`]: 1, [`${t('dwell.home')} C`]: 2 }, ...text('dwellHome') },
    show: { value: false, ...text('dwellShow') },
  }, [language]);
  useControls('Dwelling', () => ({
    [t('leva.dwellReset')]: button(() => dwellCalls.current.reset()),
    [t('leva.dwellLookOverview')]: button(() => dwellCalls.current.lookOverview()),
    [t('leva.dwellLook')]: button(() => dwellCalls.current.look()),
  }), [language, t]);
  const [dwellStats, setDwellStats] = useState<DwellingStats | null>(null);
  const [coverLive, setCoverLive] = useState<CoverLiveStats | null>(null);
  const [scaleRows, setScaleRows] = useState<ScaleRow[]>([]);
  const [scaleShow, setScaleShow] = useState(DEFAULT_SCALE_SHOW);
  const scaleBar = useRef<ScaleBar>({ line: null, label: null });
  const hour = useHour();
  const coverAmount = view.grass;
  const key = useSettled(JSON.stringify({ range, pools, flow, under, island, layout }), REBUILD_DELAY);
  const { params, terrace, water, underside } = useMemo<{ params: GroundParams; terrace: TerraceParams; water: WaterParams; underside: UndersideParams }>(() => {
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
  const [ground, setGround] = useState<{ grid: HeightGrid; rim: Float32Array; terrace: BasinMesh[]; tops: number[]; pools: PoolNode[]; outlets: OutletNode[]; water: Water; zones: Zones; folds: RockFolds; underside: UndersideMesh; ms: number } | null>(null);
  const [light, setLight] = useState<{ light: Uint8Array; size: number; ms: number } | null>(null);
  useEffect(() => {
    const w = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<FromTerrain>) => {
      const m = e.data;
      if (m.type === 'ground' && m.id === asked.current.ground) setGround({ grid: m.grid, rim: m.rim, terrace: m.terrace, tops: m.tops, pools: m.pools, outlets: m.outlets, water: m.water, zones: m.zones, folds: m.folds, underside: m.underside, ms: m.ms });
      if (m.type === 'light' && m.id === asked.current.light) setLight({ light: m.light, size: m.size, ms: m.ms });
    };
    worker.current = w;
    return () => { w.terminate(); worker.current = null; };
  }, []);
  useEffect(() => {
    const id = ++asked.current.ground;
    worker.current?.postMessage({ type: 'ground', id, params, terrace, water, underside } satisfies ToTerrain);
  }, [params, terrace, water, underside]);
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
  const dwelling = useMemo<Dwelling | null>(() => (ground ? createDwelling({ grid: ground.grid, water: ground.water, terrace: groundRules(params).plate(0), seed: params.seed, zones: ground.zones }) : null), [ground, params]);
  useEffect(() => {
    if (!dwelling) return;
    dwelling.home = Math.min(dwell.home, dwelling.sites.homes.length - 1);
  }, [dwelling, dwell.home]);
  // The woods (woods.ts): groves and lone pines where the zones say trees take, kept off the
  // creature's home, stands and ways.
  const woods = useMemo(() => (ground ? growWoods(ground.zones, ground.grid, params.seed, dwelling ? siteKeepOuts(dwelling.sites) : []) : null), [ground, params, dwelling]);
  const trees = useMemo<Plant[]>(() => (woods ? [...woods.trees, ...woods.lone] : []), [woods]);
  // Low shrubs in patches (shrubs.ts), off the creature's dwelling ground (not its obstacles yet).
  const shrubs = useMemo(() => (ground ? growShrubs(ground.zones, ground.grid, ground.folds, params.seed, trees, dwelling ? [dwelling.sites.region] : []) : null), [ground, params, trees, dwelling]);
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
      trees,
      shrubs: (shrubs?.plants ?? []).map((p) => ({ x: p.x, z: p.z, r: p.height * p.width * 0.5 })),
      pose: { x: dwelling.pose.x, z: dwelling.pose.z },
    });
    const shelter = placeShelter({ dwelling, obstacles: layout.obstacles, seed: params.seed });
    if (shelter.plan) {
      dwelling.setRestPlace({ bed: shelter.plan.bed, mouth: shelter.plan.mouth });
      dwelling.setObstacles(shelter.plan.obstacles);
    } else dwelling.setRestPlace(null);
    // First time this dwelling exists: lie in the bed. Changing home does not teleport.
    if (shelterBoot.current !== dwelling) {
      shelterBoot.current = dwelling;
      dwelling.reset();
    }
    return { layout, shelter };
  }, [dwelling, dwell.home, trees, shrubs, ground, params.seed]);
  const corner = habitat?.layout.corner ?? null;

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
    return {
      peakHeight: params.range.top,
      forest,
      grass: COVER_SCALE.grass,
      flower: COVER_SCALE.flower,
      steleHeight: STELE.height,
      poolAcross,
      terraceGroup,
      rangeMassif,
    };
  }, [trees, params.range.top, params.range.reach, ground]);
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
      map['wonderland-creature'] = {
        count: 1,
        islandSize: { height: [standH, standH], width: [bodyW, bodyW], depth: [bodyL, bodyL] },
        locate: home
          ? { x: home.x, y: sampleGrid(ground.grid, home.x, home.z) + standH * 0.5, z: home.z }
          : { x: corner.stone.x, y: sy + 1, z: corner.stone.z },
        note: '本岛仅 1 只；尺寸为形体实测（站立），非配置区间。',
      };
      // Stele hidden in live scene this pass — atlas asset kept; no locate.
      map['wonderland-stele'] = {
        count: 0,
        islandSize: { height: [STELE.height, STELE.height], width: [STELE.face, STELE.face], depth: [STELE.thick, STELE.thick] },
        locate: null,
      };
    } else {
      map['wonderland-creature'] = { count: 0, islandSize: {}, locate: null };
      map['wonderland-stele'] = { count: 0, islandSize: {}, locate: null };
    }
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
  }, [shrubs, trees, coverLive, dwelling, dwell.home, corner, ground, params.range.top, scaleKnown.poolAcross]);

  const closeAtlas = useCallback(() => {
    setAtlasOpen(false);
    // Restore orbit camera saved when the atlas opened.
    locateRef.current?.({ x: Number.NaN, y: Number.NaN, z: Number.NaN });
  }, []);

  return (
    <>
      {/* flat: no tone mapping, as Penglai: every material, built-in or our own, writes its colour in sRGB (without it the built-in ones went through ACES and ours did not). */}
      <Canvas className={WONDER_WALK_CANVAS} flat gl={{ localClippingEnabled: true }} dpr={TERRAIN_DPR} camera={{ position: [-430, 300, 380], fov: 40, near: 0.5, far: 5000 }}>
        <AtlasCameraBridge open={atlasOpen} saved={atlasCam} locateRef={locateRef} />
        {/* For the creature's figure (the built parts light themselves). */}
        <hemisphereLight args={[BLOCKOUT.skyLight, BLOCKOUT.groundLight, 1.6]} />
        <directionalLight position={[-300, 400, 200]} intensity={1.6} />
        <World hour={hour} clouds={-BASE_DEPTH - underside.depth - 50}>
          {(uniforms) => ground && above && (
            <Ground uniforms={uniforms} grid={ground.grid} rim={ground.rim} terrace={ground.terrace} water={ground.water} underside={ground.underside} above={above} light={light} lod={view.lod} wire={debug.wire} marker={debug.particles} onDrawn={setDrawn} trees={trees} zones={ground.zones} folds={ground.folds} rock={rock} shrubs={view.shrubs ? shrubs : null} showZones={showZones} cover={cover} coverDebug={coverDebug} coverAmount={coverAmount} seed={params.seed} onCoverStats={onCoverStats} walking={view.walk} coverBuildMsRef={coverBuildMsRef} floorFlagsRef={floorFlagsRef}
              dwelling={dwelling && habitat && { sim: dwelling, corner, stones: habitat.layout, shelter: habitat.shelter.plan, cut: false, seed: params.seed, run: dwell.run, speed: dwell.speed, show: dwell.show, calls: dwellCalls.current, onStats: setDwellStats }} />
          )}
        </World>
        {view.scale && !view.walk && (
          <WonderlandScaleView known={scaleKnown} anchors={scaleAnchors} onMeasure={setScaleRows} bar={scaleBar as RefObject<ScaleBar>} show={scaleShow} />
        )}
        {corner && dwelling && !view.walk && (
          <CornerCamera corner={corner} drink={dwelling.sites.drink} calls={dwellCalls.current} />
        )}
        {debug.particles && ground && <FlowParticles pools={ground.pools} outlets={ground.outlets} water={ground.water} grid={ground.grid} />}
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
      </Canvas>
      <ResourceAtlas
        open={atlasOpen}
        onClose={closeAtlas}
        island={islandResources}
        onLocate={(p) => locateRef.current?.(p)}
      />
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
            [t('terrain.trees'), woods ? `${woods.trees.length} + ${woods.lone.length}` : '…'],
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
      {showZones && <ZoneLegend t={t} />}
      {coverDebug && <CoverLegend t={t} />}
      {view.scale && (
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

/** Legend for View → Zones: colour swatches with zone names (en/zh via strings). */
function ZoneLegend({ t }: { t: (k: StringKey) => string }) {
  const entries = ZONE_NAMES.map((id, i) => ({ id, color: ZONE_DEBUG[i] })).filter((e) => e.id !== 'outside');
  return (
    <div className="zone-legend" aria-label={t('zones.legendTitle')}>
      <div className="zone-legend-title">{t('zones.legendTitle')}</div>
      {entries.map((e) => (
        <div key={e.id} className="zone-legend-row">
          <span className="zone-legend-swatch" style={{ background: e.color }} />
          <span>{t(`zones.${e.id}` as StringKey)}</span>
        </div>
      ))}
    </div>
  );
}

/** Legend for View → Cover suitability (same density texture the terrain samples). */
function CoverLegend({ t }: { t: (k: StringKey) => string }) {
  // Heatmap reads softCoverDensityBytes (final density), not raw suit — labels match that.
  return (
    <div className="zone-legend cover-legend" aria-label={t('cover.legendTitle')}>
      <div className="zone-legend-title">{t('cover.legendTitle')}</div>
      <div className="zone-legend-row">
        <span className="zone-legend-swatch" style={{ background: '#1f1a1a' }} />
        <span>{t('cover.legendBare')}</span>
      </div>
      <div className="zone-legend-row">
        <span className="zone-legend-swatch" style={{ background: '#40bf59' }} />
        <span>{t('cover.legendDensity')}</span>
      </div>
      <div className="zone-legend-row">
        <span className="zone-legend-swatch" style={{ background: '#8c5933' }} />
        <span>{t('cover.legendTrample')}</span>
      </div>
    </div>
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
  locateRef: React.MutableRefObject<((p: { x: number; y: number; z: number }) => void) | null>;
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
      const dir = new Vector3().subVectors(camera.position, controls.target).setLength(Math.max(8, camera.position.distanceTo(controls.target) * 0.35));
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
function Ground({ uniforms, grid, rim, terrace, water: flowing, underside, above, light, lod, wire, marker, onDrawn, dwelling, trees, zones, showZones, cover, coverDebug, coverAmount, seed, onCoverStats, walking = false, coverBuildMsRef, floorFlagsRef , folds, rock, shrubs}: {
  uniforms: WorldUniforms;
  grid: HeightGrid;
  rim: Float32Array;
  terrace: BasinMesh[];
  water: Water;
  underside: UndersideMesh;
  above: (x: number, z: number) => number;
  light: { light: Uint8Array; size: number } | null;
  lod: number;
  wire: boolean;
  /** Red bands riding down the falls with the water (the debug view: they must run down). */
  marker: boolean;
  onDrawn: (d: { patches: number; triangles: number }) => void;
  /** The woods' trees (groves and lone pines), drawn with Penglai's instanced levels of detail. */
  trees: Plant[];
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
  /** The creature and the jade it leaves (creature.tsx), and the panel's handles on it. */
  dwelling: { sim: Dwelling; corner: Corner | null; stones: HabitatLayout | null; shelter: ShelterPlan | null; cut: boolean; seed: number; run: boolean; speed: number; show: boolean; calls: { reset: () => void; look: () => void }; onStats: (s: DwellingStats) => void } | null;
}) {
  const material = useMemo(() => createTerrainMaterial(uniforms), [uniforms]);
  const side = useMemo(() => createPorcelainMaterial(uniforms), [uniforms]);
  const built = useMemo(() => createBuiltMaterial(uniforms), [uniforms]);
  // The pools' water (its depth per vertex, over the plates' floors), and the water below the
  // terrace (its depth per pixel, over the ground's height map).
  const water = useMemo(() => createFlowWaterMaterial(uniforms), [uniforms]);
  const runoff = useMemo(() => createFlowWaterMaterial(uniforms, { ground: true }), [uniforms]);
  const falling = useMemo(() => createFallMaterial(uniforms), [uniforms]);
  useEffect(() => () => { material.dispose(); side.dispose(); built.dispose(); water.dispose(); runoff.dispose(); falling.dispose(); }, [material, side, built, water, runoff, falling]);
  // Where water lands stirs the water there (the same places, flows and drops as the falls').
  useEffect(() => { setImpacts(water, flowing.impacts); setImpacts(runoff, flowing.impacts); }, [water, runoff, flowing]);
  useEffect(() => { falling.uniforms.uMarker.value = marker ? 1 : 0; }, [falling, marker]);
  useEffect(() => { material.wireframe = wire; }, [material, wire]);
  const pines = useMemo(() => createIslandPineMaterial(uniforms), [uniforms]);
  useEffect(() => () => pines.dispose(), [pines]);
  // Zone labels: Nearest (discrete). Soft surface RGBA: Linear (~10 m blend). Moisture: Linear.
  const zoneMap = useMemo(() => {
    const t = new DataTexture(zones.zone, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [zones]);
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
  useEffect(() => () => lit.dispose(), [lit]);
  useEffect(() => {
    for (const m of [material, built]) {
      const u = m.uniforms;
      if (u.uHeight) u.uHeight.value = heights;
      u.uLight.value = lit;
      u.uSize.value = grid.size;
      u.uTexel.value = grid.texel;
    }
    runoff.uniforms.uHeight.value = heights;
    runoff.uniforms.uSize.value = grid.size;
    runoff.uniforms.uTexel.value = grid.texel;
  }, [material, built, runoff, heights, lit, grid]);
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
  useFrame(({ camera, controls, clock }) => {
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
        camera.position.y = gy + camClear;
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
      {/* Rim + underside: skip Orbit pick (they sit far below / aside and glued the pivot). */}
      <mesh geometry={wall} material={side} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />
      {pools.map(({ block, sheet }, k) => (
        <group key={k}>
          <mesh geometry={block} material={built} />
          <mesh geometry={sheet} material={water} renderOrder={1} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />
        </group>
      ))}
      <mesh geometry={streams.under} material={side} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />
      {streams.sheets.map((g, k) => <mesh key={`w${k}`} geometry={g} material={runoff} renderOrder={1} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />)}
      {streams.falls.map((g, k) => <mesh key={`s${k}`} geometry={g} material={falling} renderOrder={3} raycast={noOrbitHit} userData={{ orbitIgnore: true }} />)}
      {shrubs && <ShrubPatches plants={shrubs.plants} uniforms={uniforms} />}
      <Vegetation trees={trees} shrubs={NONE} boulders={NONE} seed={seed} pineMaterial={pines} uniforms={uniforms} lod={WOODS_LOD} />
      {cover && <CoverGrass cover={cover} grid={grid} uniforms={uniforms} seed={seed} map={dwelling?.sim.map ?? null} amount={coverAmount} walking={walking} onStats={onCoverStats} buildMsRef={coverBuildMsRef} />}
      {dwelling?.corner && <CornerBlocks corner={dwelling.corner} uniforms={uniforms} groundAt={dwelling.sim.groundAt} seed={dwelling.seed} />}
      {dwelling?.stones && <HabitatStones layout={dwelling.stones} uniforms={uniforms} dwelling={dwelling.sim} />}
      {dwelling?.shelter && <RockShelter plan={dwelling.shelter} cut={dwelling.cut} uniforms={uniforms} />}
      {dwelling && <DwellingView dwelling={dwelling.sim} ground={material} run={dwelling.run} speed={dwelling.speed} show={dwelling.show} calls={dwelling.calls} onStats={dwelling.onStats} />}
    </>
  );
}

/** Default overview (matches the Canvas camera). */
const OVERVIEW: Corner['view'] = { from: [-430, 300, 380], to: [0, 20, 0] };

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
