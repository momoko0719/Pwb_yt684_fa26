import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { button, useControls } from 'leva';
import { BufferAttribute, BufferGeometry, DataTexture, NearestFilter, RedFormat, UnsignedByteType, type Vector3 } from 'three';
import { BLOCKOUT } from '../../core/palette';
import type { BasinMesh } from '../../core/terrain/basinMesh';
import { createBuiltMaterial } from '../../core/terrain/builtMaterial';
import { createFallMaterial } from '../../core/terrain/fallMaterial';
import { createFlowWaterMaterial, setImpacts } from '../../core/terrain/flowWater';
import type { UndersideMesh } from '../../core/terrain/undersideMesh';
import { sunElevation } from '../../core/params/scene';
import { SIZES } from '../../core/scale';
import { BASE_DEPTH } from '../../core/sdf/terraceField';
import { createTerrainMaterial, heightTexture, LOD_DEFAULTS, lightTexture, setTerrainZones, TerrainLod } from '../../core/terrain/cdlod';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { rimWall } from '../../core/terrain/rimWall';
import { createPorcelainMaterial } from '../../core/shaders/porcelain';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { REBUILD_DELAY, useSettled } from '../island-v1/controls';
import { FRAME_DEFAULTS } from './frame';
import { groundRules, type GroundParams } from './ground';
import { SEED } from './layout';
import { RANGE } from './range';
import { FrameRate, StatsPanel, SUN_AZIMUTH, TERRAIN_DPR, useHour, World } from './world';
import { UNDERSIDE_DEFAULTS, type FromTerrain, type ToTerrain, type UndersideParams } from './terrain.worker';
import { TERRACE_DEFAULTS, type OutletNode, type PoolNode, type TerraceParams } from './terrace';
import { CornerBlocks, cornerObstacles, createIslandPineMaterial, planCorner, type Corner } from './corner';
import Vegetation from '../island-v1/Vegetation';
import type { Plant } from '../../core/generators/forest';
import { growWoods, siteKeepOuts, TREE_CLEARANCE, WOODS_LOD } from './woods';
import type { Zones } from './zones';
import { DwellingView, type DwellingStats } from './creature';
import { createDwelling, type Dwelling } from './dwelling';
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
  const view = useControls('View', {
    stats: { value: true, ...text('blockStats') },
    wire: { value: false, ...text('lodWire') },
    lod: { value: LOD_DEFAULTS.range, min: 45, max: 240, step: 5, ...text('lodRange') },
    particles: { value: false, ...text('waterParticles') },
    zones: { value: false, ...text('zones') },
  }, [language]);
  const island = useControls('Island', {
    seed: { value: SEED, min: 0, max: 9999, step: 1, ...text('islandSeed') },
  }, [language]);
  const layout = useControls('Layout', {
    turn: { value: Math.round((FRAME_DEFAULTS.spread * 180) / Math.PI), min: 0, max: 40, step: 1, ...text('layoutTurn') },
    variation: { value: FRAME_DEFAULTS.variation, min: 0, max: 1, step: 0.05, ...text('layoutVariation') },
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
  }, [language]);
  const flow = useControls('Water', {
    flow: { value: WATER_DEFAULTS.flow, min: 0.2, max: 20, step: 0.1, ...text('waterFlow') },
    streams: { value: WATER_DEFAULTS.streams, min: 0, max: 5, step: 1, ...text('waterStreams') },
    fan: { value: WATER_DEFAULTS.fan, min: 0.2, max: 1.5, step: 0.05, ...text('waterFan') },
    meander: { value: WATER_DEFAULTS.meander, min: 0, max: 14, step: 0.5, ...text('waterMeander') },
  }, [language]);
  const under = useControls('Underside', {
    depth: { value: UNDERSIDE_DEFAULTS.depth, min: 30, max: 200, step: 5, ...text('underDepth') },
    rocks: { value: UNDERSIDE_DEFAULTS.rocks, min: 1, max: 6, step: 1, ...text('underRocks') },
  }, [language]);
  // 栖居成玉: a creature's days near the plunge pool (dwelling.ts), and the jade they leave.
  const dwellCalls = useRef({ reset: () => {}, look: () => {}, lookHome: () => {}, lookClose: () => {} });
  const dwell = useControls('Dwelling', {
    run: { value: true, ...text('dwellRun') },
    speed: { value: 30, options: { '1×': 1, '10×': 10, '30×': 30, '100×': 100 }, ...text('dwellSpeed') },
    home: { value: 0, options: { [`${t('dwell.home')} A`]: 0, [`${t('dwell.home')} B`]: 1, [`${t('dwell.home')} C`]: 2 }, ...text('dwellHome') },
    show: { value: false, ...text('dwellShow') },
  }, [language]);
  useControls('Dwelling', () => ({
    [t('leva.dwellReset')]: button(() => dwellCalls.current.reset()),
    [t('leva.dwellLook')]: button(() => dwellCalls.current.look()),
    [t('leva.dwellLookHome')]: button(() => dwellCalls.current.lookHome()),
    [t('leva.dwellLookClose')]: button(() => dwellCalls.current.lookClose()),
  }), [language]);
  const [dwellStats, setDwellStats] = useState<DwellingStats | null>(null);
  const hour = useHour();
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
  const [ground, setGround] = useState<{ grid: HeightGrid; rim: Float32Array; terrace: BasinMesh[]; tops: number[]; pools: PoolNode[]; outlets: OutletNode[]; water: Water; zones: Zones; underside: UndersideMesh; ms: number } | null>(null);
  const [light, setLight] = useState<{ light: Uint8Array; size: number; ms: number } | null>(null);
  useEffect(() => {
    const w = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<FromTerrain>) => {
      const m = e.data;
      if (m.type === 'ground' && m.id === asked.current.ground) setGround({ grid: m.grid, rim: m.rim, terrace: m.terrace, tops: m.tops, pools: m.pools, outlets: m.outlets, water: m.water, zones: m.zones, underside: m.underside, ms: m.ms });
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
  const dwelling = useMemo<Dwelling | null>(() => (ground ? createDwelling({ grid: ground.grid, water: ground.water, terrace: groundRules(params).plate(0), seed: params.seed }) : null), [ground, params]);
  useEffect(() => {
    if (!dwelling) return;
    dwelling.home = Math.min(dwell.home, dwelling.sites.homes.length - 1);
  }, [dwelling, dwell.home]);
  // The woods (woods.ts): groves and lone pines where the zones say trees take, kept off the
  // creature's home, stands and ways.
  const woods = useMemo(() => (ground ? growWoods(ground.zones, ground.grid, params.seed, dwelling ? siteKeepOuts(dwelling.sites) : []) : null), [ground, params, dwelling]);
  const trees = useMemo<Plant[]>(() => (woods ? [...woods.trees, ...woods.lone] : []), [woods]);
  // Its corner (corner.tsx): a few trees by its home, a stone to watch it drink from, the view;
  // what stands there is in its way too, as are the woods' trees on its ground.
  const corner = useMemo(() => {
    if (!dwelling) return null;
    dwelling.home = Math.min(dwell.home, dwelling.sites.homes.length - 1);
    dwelling.setObstacles([]);
    const c = planCorner(dwelling);
    const { x0, z0, size } = dwelling.sites.region;
    const mine = trees.filter((t) => t.x > x0 - 2 && t.z > z0 - 2 && t.x < x0 + size + 2 && t.z < z0 + size + 2);
    dwelling.setObstacles([...cornerObstacles(c), ...mine.map((t) => ({ x: t.x, z: t.z, r: TREE_CLEARANCE }))]);
    return c;
  }, [dwelling, dwell.home, trees]);

  const [drawn, setDrawn] = useState({ patches: 0, triangles: 0 });

  return (
    <>
      {/* flat: no tone mapping, as Penglai: every material, built-in or our own, writes its colour in sRGB (without it the built-in ones went through ACES and ours did not). */}
      <Canvas flat dpr={TERRAIN_DPR} camera={{ position: [-430, 300, 380], fov: 40, near: 0.5, far: 5000 }}>
        {/* For the creature's figure (the built parts light themselves). */}
        <hemisphereLight args={[BLOCKOUT.skyLight, BLOCKOUT.groundLight, 1.6]} />
        <directionalLight position={[-300, 400, 200]} intensity={1.6} />
        <World hour={hour} clouds={-BASE_DEPTH - underside.depth - 50}>
          {(uniforms) => ground && above && (
            <Ground uniforms={uniforms} grid={ground.grid} rim={ground.rim} terrace={ground.terrace} water={ground.water} underside={ground.underside} above={above} light={light} lod={view.lod} wire={view.wire} marker={view.particles} onDrawn={setDrawn} trees={trees} zones={ground.zones} showZones={view.zones} seed={params.seed}
              dwelling={dwelling && { sim: dwelling, corner, seed: params.seed, run: dwell.run, speed: dwell.speed, show: dwell.show, calls: dwellCalls.current, onStats: setDwellStats }} />
          )}
        </World>
        {corner && <CornerCamera corner={corner} calls={dwellCalls.current} />}
        {view.particles && ground && <FlowParticles pools={ground.pools} outlets={ground.outlets} water={ground.water} grid={ground.grid} />}
        <FrameRate />
        <OrbitControls makeDefault target={[-20, 10, 0]} enableDamping maxDistance={2500} />
      </Canvas>
      {view.stats && (
        <StatsPanel
          title={t('terrain.title')}
          rows={[
            [t('terrain.patches'), `${drawn.patches}`],
            [t('terrain.triangles'), `${(drawn.triangles / 1000).toFixed(0)} k`],
            [t('terrain.ground'), ground ? `${(ground.ms / 1000).toFixed(2)} s` : '…'],
            [t('terrain.light'), light ? `${(light.ms / 1000).toFixed(2)} s` : '…'],
            [t('terrain.trees'), woods ? `${woods.trees.length} + ${woods.lone.length}` : '…'],
            ...(dwellStats ? [
              [t('dwell.doing'), `${t(`dwell.${dwellStats.activity}` as StringKey)} · ${dwell.run ? `×${dwell.speed}` : t('dwell.paused')}`],
              [t('dwell.cycles'), `${dwellStats.cycles} · ${(dwellStats.time / 3600).toFixed(1)} h`],
            ] as [string, string][] : []),
          ]}
        />
      )}
    </>
  );
}

const CLEARANCE = SIZES.camera.clearance; // metres the camera keeps above the ground
const NONE: Plant[] = [];

/** The ground: its patches (CDLOD), the island's side, the terrace's pools; the camera kept above it. */
function Ground({ uniforms, grid, rim, terrace, water: flowing, underside, above, light, lod, wire, marker, onDrawn, dwelling, trees, zones, showZones, seed }: {
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
  zones: Zones;
  showZones: boolean;
  seed: number;
  /** The creature and the jade it leaves (creature.tsx), and the panel's handles on it. */
  dwelling: { sim: Dwelling; corner: Corner | null; seed: number; run: boolean; speed: number; show: boolean; calls: { reset: () => void; look: () => void }; onStats: (s: DwellingStats) => void } | null;
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
  // The zones as a texture of indices (one byte a cell), for the debug view.
  const zoneMap = useMemo(() => {
    const t = new DataTexture(zones.zone, zones.nx, zones.nz, RedFormat, UnsignedByteType);
    t.magFilter = t.minFilter = NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [zones]);
  useEffect(() => () => zoneMap.dispose(), [zoneMap]);
  useEffect(() => {
    setTerrainZones(material, showZones ? { texture: zoneMap, x0: zones.x0, z0: zones.z0, size: zones.nx * zones.cell } : null);
  }, [material, zoneMap, zones, showZones]);

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

  const terrain = useMemo(() => new TerrainLod(material, grid, { ...LOD_DEFAULTS, range: lod }), [material, grid, lod]);
  useEffect(() => () => terrain.dispose(), [terrain]);
  const wall = useMemo(() => rimWall(rim, -BASE_DEPTH), [rim]);
  useEffect(() => () => wall.dispose(), [wall]);

  const told = useRef(0);
  useFrame(({ camera, controls, clock }) => {
    // Neither the camera nor what it orbits goes under the ground.
    const keep = (p: Vector3, clearance: number) => {
      p.y = Math.max(p.y, above(p.x, p.z) + clearance);
    };
    keep(camera.position, CLEARANCE);
    const target = (controls as unknown as { target?: Vector3 } | null)?.target;
    if (target) keep(target, 0.5);
    camera.updateMatrixWorld();
    const patches = terrain.update(camera);
    if (clock.elapsedTime - told.current > 0.5) {
      told.current = clock.elapsedTime;
      onDrawn({ patches, triangles: terrain.triangles });
    }
  });
  return (
    <>
      <primitive object={terrain.group} />
      <mesh geometry={wall} material={side} />
      {pools.map(({ block, sheet }, k) => (
        <group key={k}>
          <mesh geometry={block} material={built} />
          <mesh geometry={sheet} material={water} renderOrder={1} />
        </group>
      ))}
      <mesh geometry={streams.under} material={side} />
      {streams.sheets.map((g, k) => <mesh key={`w${k}`} geometry={g} material={runoff} renderOrder={1} />)}
      {streams.falls.map((g, k) => <mesh key={`s${k}`} geometry={g} material={falling} renderOrder={3} />)}
      <Vegetation trees={trees} shrubs={NONE} boulders={NONE} seed={seed} pineMaterial={pines} uniforms={uniforms} lod={WOODS_LOD} />
      {dwelling?.corner && <CornerBlocks corner={dwelling.corner} uniforms={uniforms} groundAt={dwelling.sim.groundAt} seed={dwelling.seed} />}
      {dwelling && <DwellingView dwelling={dwelling.sim} ground={material} run={dwelling.run} speed={dwelling.speed} show={dwelling.show} calls={dwelling.calls} onStats={dwelling.onStats} />}
    </>
  );
}

/** The panel's views (corner.tsx): the corner, the home (a middle view), close to where it lies. */
function CornerCamera({ corner, calls }: { corner: Corner; calls: { look: () => void; lookHome: () => void; lookClose: () => void } }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  useEffect(() => {
    const go = (view: Corner['view']) => () => {
      camera.position.set(...view.from);
      controls?.target.set(...view.to);
      controls?.update();
    };
    calls.look = go(corner.view);
    calls.lookHome = go(corner.homeView);
    calls.lookClose = go(corner.closeView);
  }, [calls, corner, camera, controls]);
  return null;
}
