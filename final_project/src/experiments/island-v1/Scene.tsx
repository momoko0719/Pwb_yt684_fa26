import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, RGBAFormat, Vector3, type Camera } from 'three';
import { clearHeight } from '../../core/camera';
import { createIsland, createIslandField, flatGroundHeights, meadowLineHeight, SEAM_BAND } from '../../core/generators/island';
import { clearBlades, GRASS_RADIUS, grassSites, NO_SITES, placeFlowers, placeGrass } from '../../core/generators/grass';
import { PATH_WIDTH, pathMask, routePath, type IslandPath } from '../../core/generators/path';
import { pavilionSiteNear } from '../../core/generators/pavilion';
import type { IslandField } from '../../core/generators/island';
import { createPools } from '../../core/generators/pools';
import { createWaterfalls } from '../../core/generators/waterfall';
import { createWaterSystem } from '../../core/generators/water';
import { createLandCover } from '../../core/generators/cover';
import { placeBoulders, placeForest, placeShrubs } from '../../core/generators/forest';
import { createWindField } from '../../core/generators/wind';
import { getPalette, SEASON, SILK_UI } from '../../core/palette';
import { seasonAt, termOfDate } from '../../core/season';
import { SIZES, within } from '../../core/scale';
import type { IslandParams } from '../../core/params/island';
import { flowerPhase, sunElevation, type IslandPreset } from '../../core/params/scene';
import { applyPalette, createWorldUniforms, placeSunBehind, setSunDirection, setWindField, windTexture } from '../../core/shaders/uniforms';
import { createSkyMaterial } from '../../core/shaders/sky';
import { createTerrainMaterial } from '../../core/shaders/terrain';
import { createFlowerGeometry, createFlowerMaterial } from '../../core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../../core/shaders/grass';
import { createPineMaterial } from '../../core/shaders/pine';
import { createPoolMaterial } from '../../core/shaders/pool';
import { createWaterfallMaterial } from '../../core/shaders/waterfall';
import { createCloudSeaMaterial } from './cloudSea';
import { useIslandControls, type ViewParams } from './controls';
import { useLanguage } from '../../i18n/LanguageContext';
import Path, { layTime } from './Path';
import Pavilion from './Pavilion';
import PathTool, { type PathStage } from './PathTool';
import Pines from './Pines';
import SeasonBar from './SeasonBar';
import TechniquePanel from './TechniquePanel';
import WindTrails from './WindTrails';
import Walk, { WALK_CANVAS_CLASS } from './Walk';
import Vegetation from './Vegetation';
import { islandDiameter, ScaleLegend, ScaleView, surveySteps, type ScaleBar, type ScaleRow } from './ScaleView';

const CLOUD_GAP = 6; // metres between the lowest rock and the cloud sea, at least
const CLOUD_GAP_SHARE = 0.2; // and at least this fraction of the radius
const START_DISTANCE = 2.6; // the first view frames the whole island: this many island sizes away
const MAX_DISTANCE = 6; // the wheel can zoom out to this many island sizes
// Pixel ratio between 1 and 1.5: on a 2x (retina) screen this draws 44% fewer pixels, and the sky,
// cloud sea and terrain shaders run once per pixel. Measured: 4.9 ms a frame at 2x, 3.5 ms at 1.5x.
const MAX_DPR: [number, number] = [1, 1.5];
// About 35 degrees above the horizon: the meadow, pines and pools on top read, and the cliff still shows.
const START_DIRECTION = new Vector3(1, 1, 1).normalize();

const SEAL_MARK = SILK_UI.seal; // the picked start point: a small cinnabar marker
const LOOKOUT_CLEAR = 4; // metres cleared around the lookout for the pavilion
const MARKER_SIZE = 0.015; // the start marker is a sign for the visitor, not a thing on the island: sized to the island so it shows from afar
// The camera's far plane, and how the near plane follows the camera's height above the ground: close
// to the grass it must be small, far out it can grow, which keeps depth precise at every distance.
const FAR = 20000;
const NEAR_SHARE = 0.1;
const NEAR_RANGE: [number, number] = [0.1, 50];
// Single blades of grass show only when the camera is this close to the ground it looks at.
const GRASS_VIEW = 250;
const GRASS_MOVE = GRASS_RADIUS * 0.25; // regrow the grass disc once its focus has moved this far
const FOCUS_EVERY = 0.25; // seconds between focus checks

/** Blade height in metres at the grass-height slider's value (core/scale.ts: meadow grass up to ~20–30 cm). */
const bladeHeight = (grassHeight: number) => within(SIZES.grass.height, grassHeight);

/** The orbit target sits halfway between the summit and the lowest hanging rock. */
const orbitTarget = (island: IslandParams) => new Vector3(0, (island.peakHeight - island.undersideDepth) / 2, 0);

/** Half the island's extent: from the rim outward and from the summit down to the rock tips. */
const islandSize = (island: IslandParams) => Math.hypot(island.radius * 1.3, (island.peakHeight + island.undersideDepth) / 2);

export default function Scene() {
  const { island, surface, scene, view } = useIslandControls();
  const { t } = useLanguage();
  const [locked, setLocked] = useState(false);
  // The year of solar terms, 0..24; it opens on today's term.
  const [term, setTerm] = useState(() => termOfDate(new Date()));
  // Drawing paths: the tool is on or off, Clear bumps a key, the stage drives the hint.
  // The path tool is on from the start: the island opens by asking the visitor for two points.
  const [drawing, setDrawing] = useState(true);
  const [clearKey, setClearKey] = useState(0);
  const [stage, setStage] = useState<PathStage>('start');
  // Scale view: survey grid, measured boxes and figures, and the legend with the scale bar.
  const [scaleOn, setScaleOn] = useState(false);
  const [scaleRows, setScaleRows] = useState<ScaleRow[]>([]);
  const scaleBar = useRef<ScaleBar>({ line: null, label: null });
  const steps = useMemo(() => surveySteps(islandDiameter(createIslandField(island)), island.peakHeight), [island]);
  const target = useMemo(() => orbitTarget(island), [island]);
  const size = islandSize(island);
  // The first view, and where the orbit camera returns after a walk.
  const start = useMemo(() => target.clone().addScaledVector(START_DIRECTION, size * START_DISTANCE), [target, size]);
  return (
    <>
      <Canvas className={WALK_CANVAS_CLASS} flat dpr={MAX_DPR} camera={{ position: start.toArray(), fov: 40, near: 0.5, far: FAR }}>
        <World
          island={island} surface={surface} scene={scene} view={view} term={term} target={target} start={start} onLockChange={setLocked}
          drawing={drawing && !view.walk} clearKey={clearKey} onStage={setStage}
          scale={scaleOn ? { steps, onMeasure: setScaleRows, bar: scaleBar } : null}
        />
        {!view.walk && (
          <OrbitControls
            target={target}
            enableDamping
            // Wheel zoom goes toward what is under the cursor, so a 1 km island can be zoomed into
            // down to a single pine.
            zoomToCursor
            minDistance={3}
            maxDistance={Math.max(140, size * MAX_DISTANCE)}
            maxPolarAngle={Math.PI * 0.6}
          />
        )}
      </Canvas>
      {view.walk && <p className="walk-hint">{t(locked ? 'walk.moving' : 'walk.click')}</p>}
      <TechniquePanel island={island} surface={surface} scene={scene} />
      <SeasonBar term={term} onChange={setTerm} />
      {!view.walk && (
        <PathTool
          drawing={drawing}
          stage={stage}
          onToggle={() => { setDrawing(!drawing); setStage('start'); }}
          onClear={() => { setClearKey((k) => k + 1); setStage('start'); }}
          scaleOn={scaleOn}
          onScale={() => setScaleOn(!scaleOn)}
        />
      )}
      {scaleOn && <ScaleLegend rows={scaleRows} steps={steps} bar={scaleBar} />}
    </>
  );
}

interface WorldProps extends IslandPreset {
  view: ViewParams;
  term: number;
  drawing: boolean;
  clearKey: number;
  onStage: (stage: PathStage) => void;
  target: Vector3;
  start: Vector3;
  onLockChange: (locked: boolean) => void;
  /** The scale view, when on. */
  scale: { steps: ReturnType<typeof surveySteps>; onMeasure: (rows: ScaleRow[]) => void; bar: RefObject<ScaleBar> } | null;
}

function World({ island, surface, scene, view, term, target, start, onLockChange, drawing, clearKey, onStage, scale }: WorldProps) {
  const season = useMemo(() => seasonAt(term), [term]);
  const uniforms = useMemo(createWorldUniforms, []);
  const sky = useMemo(() => createSkyMaterial(uniforms), [uniforms]);
  const terrain = useMemo(() => createTerrainMaterial(uniforms), [uniforms]);
  const clouds = useMemo(() => createCloudSeaMaterial(uniforms), [uniforms]);
  const water = useMemo(() => createWaterfallMaterial(uniforms), [uniforms]);
  const geometry = useMemo(() => createIsland(island), [island]);
  const field = useMemo(() => createIslandField(island), [island]);
  const flatHeights = useMemo(() => flatGroundHeights(field, island), [field, island]);
  // Where the rain goes (flow accumulation): streams that run through the lake and the pools and
  // leave the rim as the falls; then what covers the ground, and the plants and stones on it.
  const drainage = useMemo(() => createWaterSystem(field, island), [field, island]);
  const cover = useMemo(() => createLandCover(field, island, drainage), [field, island, drainage]);
  const coverMap = useMemo(() => {
    const texture = new DataTexture(cover.data, cover.size, cover.size, RGBAFormat);
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }, [cover]);
  useEffect(() => {
    terrain.uniforms.uCover.value = coverMap;
    terrain.uniforms.uCoverHalf.value = cover.extent;
    return () => coverMap.dispose();
  }, [terrain, coverMap, cover]);
  const trees = useMemo(() => placeForest(field, island, cover), [field, island, cover]);
  const shrubs = useMemo(() => placeShrubs(field, island, cover), [field, island, cover]);
  const boulders = useMemo(() => placeBoulders(field, island, cover), [field, island, cover]);
  const dry = useCallback((x: number, z: number) => cover.at(x, z).water > 0.05, [cover]);
  const falls = useMemo(() => createWaterfalls(field, island, surface.fallCount, drainage.exits), [field, island, surface.fallCount, drainage]);
  const pools = useMemo(() => createPools(field), [field]);
  // The wind field (Class 06), shared with every shader through one small texture.
  const wind = useMemo(() => createWindField(field, island), [field, island]);
  const windMap = useMemo(() => windTexture(wind), [wind]);
  useEffect(() => {
    setWindField(uniforms, wind, windMap);
    return () => windMap.dispose();
  }, [uniforms, wind, windMap]);
  // Paths (Class 06). The visitor picks two points; the terrain picks the route. A path that ends
  // somewhere worth it (flat, with a view, not crowding another) gets a pavilion, which appears once
  // the stones reach it. Drawn paths belong to the island and the Clear key they were made under,
  // so a new island or Clear starts afresh.
  const marker = island.radius * MARKER_SIZE;
  const [drawn, setDrawn] = useState<{ of: IslandField; key: number; walks: Walk[] }>({ of: field, key: clearKey, walks: [] });
  const walks = useMemo(() => (drawn.of === field && drawn.key === clearKey ? drawn.walks : []), [drawn, field, clearKey]);
  const paths = useMemo(() => walks.map((w) => w.path), [walks]);
  const [pending, setPending] = useState<{ of: IslandField; key: number; at: [number, number] } | null>(null);
  const startPoint = pending && pending.of === field && pending.key === clearKey ? pending.at : null;
  const laidTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(laidTimer.current), []);

  const onTerrainClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!drawing || e.delta > 6) return; // a drag orbits the camera, it is not a pick
    e.stopPropagation();
    const at: [number, number] = [e.point.x, e.point.z];
    if (!startPoint) {
      setPending({ of: field, key: clearKey, at });
      onStage('end');
      return;
    }
    // The end snaps to the nearest spot worth a pavilion, if there is one close to the click.
    const others = walks.filter((w) => w.pavilion).map((w) => [w.path.lookout[0], w.path.lookout[2]] as [number, number]);
    const site = pavilionSiteNear(field, island, at[0], at[1], others);
    const route = routePath(field, island, startPoint, site ? [site[0], site[2]] : at, pathMask(paths, island, 0));
    setPending(null);
    if (!route) return onStage('fail');
    const pavilion = site !== null;
    setDrawn({ of: field, key: clearKey, walks: [...walks, { path: route, seed: island.seed * 1000 + walks.length + 1, pavilion }] });
    onStage('laying');
    clearTimeout(laidTimer.current);
    laidTimer.current = setTimeout(() => onStage(pavilion ? 'built' : 'done'), (layTime(route) + 0.4) * 1000);
  }, [drawing, startPoint, field, island, paths, walks, clearKey, onStage]);

  // Grass and flowers keep off every path and every pavilion.
  const avoid = useMemo(() => {
    const clearings = walks.filter((w) => w.pavilion).map((w) => [w.path.lookout[0], w.path.lookout[2], LOOKOUT_CLEAR] as [number, number, number]);
    const mask = pathMask(paths, island, 0.15, clearings);
    return (x: number, z: number) => mask.has(x, z);
  }, [walks, paths, island]);
  // Grass grows only in a disc around the ground the camera looks at (or the walker stands on), and
  // only when the camera is close enough for single blades to show; the meadow line and density
  // only filter the sites.
  const [focus, setFocus] = useState<{ of: IslandField; at: [number, number] } | null>(null);
  const sites = useMemo(() => (focus && focus.of === field ? grassSites(field, island, focus.at, cover) : NO_SITES), [focus, field, island, cover]);
  const lastFocus = useRef(-Infinity);  const grass = useMemo(
    () => createGrassGeometry(clearBlades(placeGrass(sites, meadowLineHeight(flatHeights, surface.meadowLine), surface.grassDensity), avoid)),
    [sites, flatHeights, surface.meadowLine, surface.grassDensity, avoid],
  );
  const grassMaterial = useMemo(() => createGrassMaterial(uniforms), [uniforms]);
  const flowers = useMemo(
    () => createFlowerGeometry(clearBlades(placeFlowers(sites, field, meadowLineHeight(flatHeights, surface.meadowLine), surface.flowerDensity), avoid)),
    [sites, field, flatHeights, surface.meadowLine, surface.flowerDensity, avoid],
  );
  const flowerMaterial = useMemo(() => createFlowerMaterial(uniforms), [uniforms]);
  const poolMaterial = useMemo(() => createPoolMaterial(uniforms), [uniforms]);
  const pineMaterial = useMemo(() => createPineMaterial(uniforms), [uniforms]);
  // The cloud sea sits below the lowest point the mesh actually reaches (the rim itself is below 0,
  // and the hanging rocks carry lumps past undersideDepth), with a gap that grows with the island.
  const cloudY = useMemo(() => {
    geometry.computeBoundingBox();
    return geometry.boundingBox!.min.y - Math.max(CLOUD_GAP, CLOUD_GAP_SHARE * island.radius);
  }, [geometry, island.radius]);

  // Scale view: the survey on the terrain, and the sizes set by parameters rather than meshes.
  useEffect(() => {
    terrain.uniforms.uSurvey.value = scale ? 1 : 0;
    if (scale) {
      terrain.uniforms.uGridMinor.value = scale.steps.minor;
      terrain.uniforms.uGridMajor.value = scale.steps.major;
      terrain.uniforms.uContour.value = scale.steps.contour;
    }
  }, [terrain, scale]);
  // A blade stands about 0.92 of its length (it bends); each blade and stem is 0.6..1.4 of the set height.
  const blade = bladeHeight(surface.grassHeight) * (0.45 + 0.55 * Math.max(season.green, 0.8 * season.gold));
  const known = useMemo(() => ({
    bottomY: cloudY + Math.max(CLOUD_GAP, CLOUD_GAP_SHARE * island.radius),
    pathWidth: PATH_WIDTH,
    fallWidth: SIZES.fall.width,
    grass: [blade * 0.6 * 0.92, blade * 1.4 * 0.92] as [number, number],
    flower: [SIZES.flower.stem * 0.6, SIZES.flower.stem * 1.4] as [number, number],
    stream: spanOf(drainage.streams.flat().map((q) => q.width)),
    forest: spanOf(trees.map((t) => t.height)),
    shrub: spanOf(shrubs.map((t) => t.height)),
    boulder: spanOf(boulders.map((t) => t.height)),
  }), [cloudY, island.radius, blade, drainage, trees, shrubs, boulders]);

  const walkSun = useRef(0);
  const skyRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => falls.dispose(), [falls]);
  useEffect(() => () => pools.dispose(), [pools]);
  useEffect(() => () => grass.dispose(), [grass]);
  useEffect(() => () => flowers.dispose(), [flowers]);

  useEffect(() => {
    // Grass is short in winter and early spring, full in summer, still tall but gold in autumn.
    const growth = 0.45 + 0.55 * Math.max(season.green, 0.8 * season.gold);
    grassMaterial.uniforms.uBladeHeight.value = bladeHeight(surface.grassHeight) * growth;
    flowerMaterial.uniforms.uStemHeight.value = SIZES.flower.stem;
    flowerMaterial.uniforms.uHeadSize.value = SIZES.flower.head;
    uniforms.uWind.value = scene.wind;
  }, [grassMaterial, flowerMaterial, uniforms, surface.grassHeight, scene.wind, season]);

  // The flowers open by day, fold at dusk and glow through the night, but only in their season.
  useEffect(() => {
    const { bloom, glow } = flowerPhase(scene.hour);
    flowerMaterial.uniforms.uBloom.value = bloom * season.bloom;
    flowerMaterial.uniforms.uGlow.value = glow * season.bloom;
  }, [flowerMaterial, scene.hour, season]);

  useEffect(() => {
    applyPalette(uniforms, getPalette(scene.theme, scene.hour));
    // The meadow through the year: straw when dry, the theme's green when grown, gold in autumn,
    // and half buried under snow in deep winter. Terrain and grass both read uMeadow.
    const meadow = uniforms.uMeadow.value as Color;
    const grown = new Color(SEASON.dry).lerp(meadow.clone(), season.green);
    meadow.copy(grown.lerp(new Color(SEASON.gold), season.gold).lerp(new Color(SEASON.snow), 0.55 * Math.max(season.snow - 0.5, 0) * 2));
    terrain.uniforms.uSnow.value = season.snow;
    pineMaterial.uniforms.uSnow.value = season.snow;
  }, [uniforms, terrain, pineMaterial, scene.theme, scene.hour, season]);

  useEffect(() => {
    clouds.uniforms.uCloudScale.value = island.radius / 31;
  }, [clouds, island.radius]);

  useEffect(() => {
    terrain.uniforms.uDepth.value = island.undersideDepth;
    terrain.uniforms.uGrassLine.value = meadowLineHeight(flatHeights, surface.meadowLine);
    terrain.uniforms.uRimY.value = field.rimY;
    terrain.uniforms.uSeamBand.value = SEAM_BAND * island.radius;
  }, [terrain, island.undersideDepth, island.radius, field, flatHeights, surface.meadowLine]);

  useFrame(({ camera, clock }) => {
    const elevation = Math.max(sunElevation(scene.hour) + season.sunShift, 2);
    // Orbiting, the sun stays behind the island; walking, it stays put, so turning around shows
    // the island backlit one way and front-lit the other.
    if (view.walk) setSunDirection(uniforms, walkSun.current, elevation);
    else {
      placeSunBehind(uniforms, camera.position, target, elevation);
      // Runs after the orbit controls: a camera that zoomed or orbited into the rock is lifted out.
      const y = clearHeight(field, camera.position.x, camera.position.y, camera.position.z);
      if (y !== null) camera.position.y = y;
    }
    uniforms.uTime.value = clock.elapsedTime;

    // The near plane follows the camera's height above the ground (or its distance to the island).
    const ground = field.top(camera.position.x, camera.position.z);
    const height = ground !== null ? camera.position.y - ground : camera.position.distanceTo(target);
    const near = Math.min(Math.max(Math.abs(height) * NEAR_SHARE, NEAR_RANGE[0]), NEAR_RANGE[1]);
    if (Math.abs(near - camera.near) > camera.near * 0.2) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    // The grass focus: under the walker, or where the view's centre meets the ground.
    if (clock.elapsedTime - lastFocus.current > FOCUS_EVERY) {
      lastFocus.current = clock.elapsedTime;
      const at = view.walk ? [camera.position.x, camera.position.z] as [number, number] : lookedAt(field, camera);
      const close = at !== null && Math.hypot(at[0] - camera.position.x, (field.top(at[0], at[1]) ?? 0) - camera.position.y, at[1] - camera.position.z) < GRASS_VIEW;
      if (!close) {
        if (focus) setFocus(null);
      } else if (!focus || focus.of !== field || Math.hypot(at[0] - focus.at[0], at[1] - focus.at[1]) > GRASS_MOVE) {
        setFocus({ of: field, at });
      }
    }

    // Sky and cloud sea follow the camera, so a large island seen from far away never leaves them.
    // Both shaders read world positions, so the clouds do not slide along with the camera.
    skyRef.current?.position.copy(camera.position);
    cloudRef.current?.position.set(camera.position.x, cloudY, camera.position.z);
  });

  return (
    <>
      <mesh ref={skyRef} material={sky} frustumCulled={false}>
        <sphereGeometry args={[FAR * 0.8, 32, 16]} />
      </mesh>
      <mesh geometry={geometry} material={terrain} onClick={onTerrainClick} />
      <mesh geometry={pools} material={poolMaterial} />
      <mesh geometry={grass} material={grassMaterial} frustumCulled={false} />
      <mesh geometry={flowers} material={flowerMaterial} frustumCulled={false} />
      <Pines field={field} island={island} count={surface.pineCount} material={pineMaterial} avoid={dry} />
      <Vegetation trees={trees} shrubs={shrubs} boulders={boulders} seed={island.seed} pineMaterial={pineMaterial} uniforms={uniforms} />
      {walks.map((w, i) => (
        <group key={i}>
          <Path path={w.path} uniforms={uniforms} seed={island.seed + i} />
          {w.pavilion && (
            <Pavilion position={pavilionSite(w.path)} facing={facingOf(w.path)} uniforms={uniforms} seed={w.seed} delay={layTime(w.path)} />
          )}
        </group>
      ))}
      {startPoint && (
        <mesh position={[startPoint[0], (field.top(startPoint[0], startPoint[1]) ?? 0) + 0.6 * marker, startPoint[1]]} rotation-x={Math.PI}>
          <coneGeometry args={[0.35 * marker, 1.2 * marker, 6]} />
          <meshBasicMaterial color={SEAL_MARK} />
        </mesh>
      )}
      {view.showWind && <WindTrails field={field} island={island} wind={wind} strength={scene.wind} />}
      <mesh geometry={falls} material={water} renderOrder={1} />
      <mesh ref={cloudRef} material={clouds} position-y={cloudY} rotation-x={-Math.PI / 2} frustumCulled={false}>
        <planeGeometry args={[FAR * 1.6, FAR * 1.6]} />
      </mesh>
      {scale && <ScaleView field={field} known={known} onMeasure={scale.onMeasure} bar={scale.bar} />}
      {view.walk && <Walk field={field} island={island} speed={view.walkSpeed} sun={walkSun} restore={start} onLockChange={onLockChange} />}
    </>
  );
}

/** Smallest and largest of a list, or null for none. */
function spanOf(values: number[]): [number, number] | null {
  if (!values.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return [lo, hi];
}

/**
 * Where the centre of the view meets the top of the island, or null if it misses: march along the
 * view ray in steps that shrink as the ray nears the ground.
 */
function lookedAt(field: IslandField, camera: Camera): [number, number] | null {
  const dir = camera.getWorldDirection(new Vector3());
  const p = camera.position.clone();
  for (let k = 0; k < 80; k++) {
    const ground = field.top(p.x, p.z);
    const above = ground === null ? Infinity : p.y - ground;
    if (above <= 0.5) return [p.x, p.z];
    p.addScaledVector(dir, Number.isFinite(above) ? Math.max(above * 0.5, 1) : 50);
    if (p.y < field.rimY - 1000) return null;
  }
  return null;
}

/** The pavilion stands on the path's end, a little sunk so its plinth meets the ground. */
function pavilionSite(p: IslandPath) {
  return new Vector3(p.lookout[0], p.lookout[1] - 0.1, p.lookout[2]);
}

/** The pavilion's steps face back along the path, toward where the visitor arrives. */
function facingOf(p: IslandPath) {
  if (p.points.length < 6) return 0;
  const before = p.points[p.points.length - 6];
  return Math.atan2(before.z - p.lookout[2], before.x - p.lookout[0]);
}

interface Walk {
  path: IslandPath;
  seed: number;
  /** Whether the path ends somewhere worth a pavilion. */
  pavilion: boolean;
}
