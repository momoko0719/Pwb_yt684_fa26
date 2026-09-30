import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Mesh, Vector3 } from 'three';
import { createIsland, createIslandField, flatGroundHeights, meadowLineHeight, SEAM_BAND } from '../../core/generators/island';
import { grassSites, placeFlowers, placeGrass } from '../../core/generators/grass';
import { createPools } from '../../core/generators/pools';
import { createWaterfalls } from '../../core/generators/waterfall';
import { getPalette } from '../../core/palette';
import type { IslandParams } from '../../core/params/island';
import { flowerPhase, sunElevation, type IslandPreset } from '../../core/params/scene';
import { applyPalette, createWorldUniforms, placeSunBehind, setSunDirection } from '../../core/shaders/uniforms';
import { createSkyMaterial } from '../../core/shaders/sky';
import { createTerrainMaterial } from '../../core/shaders/terrain';
import { createFlowerGeometry, createFlowerMaterial } from '../../core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../../core/shaders/grass';
import { createPoolMaterial } from '../../core/shaders/pool';
import { createWaterfallMaterial } from '../../core/shaders/waterfall';
import { createCloudSeaMaterial } from './cloudSea';
import { useIslandControls, type ViewParams } from './controls';
import { useLanguage } from '../../i18n/LanguageContext';
import TechniquePanel from './TechniquePanel';
import Walk, { WALK_CANVAS_CLASS } from './Walk';

const CLOUD_GAP = 6; // world units between the lowest rock and the cloud sea, at least
const CLOUD_GAP_SHARE = 0.2; // and at least this fraction of the radius
const START_DISTANCE = 2.6; // the first view frames the whole island: this many island sizes away
const MAX_DISTANCE = 6; // the wheel can zoom out to this many island sizes
const START_DIRECTION = new Vector3(1, 0.25, 1).normalize();

const BLADE_HEIGHT: [number, number] = [0.25, 1.4]; // world units at grassHeight 0 and 1, on a radius-31 island
const REFERENCE_RADIUS = 31;
const FLOWER_STEM = 1.15; // flower stems stand a little above the grass, as a share of the blade height
const FLOWER_HEAD = 0.25; // petal length, as a share of the blade height

/** Blade height in world units: grows with the island, so grass keeps its scale on larger islands. */
const bladeHeight = (grassHeight: number, radius: number) =>
  (BLADE_HEIGHT[0] + (BLADE_HEIGHT[1] - BLADE_HEIGHT[0]) * grassHeight) * (radius / REFERENCE_RADIUS);

/** The orbit target sits halfway between the summit and the lowest hanging rock. */
const orbitTarget = (island: IslandParams) => new Vector3(0, (island.peakHeight - island.undersideDepth) / 2, 0);

/** Half the island's extent: from the rim outward and from the summit down to the rock tips. */
const islandSize = (island: IslandParams) => Math.hypot(island.radius * 1.3, (island.peakHeight + island.undersideDepth) / 2);

export default function Scene() {
  const { island, surface, scene, view } = useIslandControls();
  const { t } = useLanguage();
  const [locked, setLocked] = useState(false);
  const target = useMemo(() => orbitTarget(island), [island]);
  const size = islandSize(island);
  // The first view, and where the orbit camera returns after a walk.
  const start = useMemo(() => target.clone().addScaledVector(START_DIRECTION, size * START_DISTANCE), [target, size]);
  return (
    <>
      <Canvas className={WALK_CANVAS_CLASS} flat camera={{ position: start.toArray(), fov: 40, near: 0.5, far: 2000 }}>
        <World island={island} surface={surface} scene={scene} view={view} target={target} start={start} onLockChange={setLocked} />
        {!view.walk && (
          <OrbitControls
            target={target}
            enableDamping
            minDistance={15}
            maxDistance={Math.max(140, size * MAX_DISTANCE)}
            maxPolarAngle={Math.PI * 0.6}
          />
        )}
      </Canvas>
      {view.walk && <p className="walk-hint">{t(locked ? 'walk.moving' : 'walk.click')}</p>}
      <TechniquePanel island={island} surface={surface} scene={scene} />
    </>
  );
}

interface WorldProps extends IslandPreset {
  view: ViewParams;
  target: Vector3;
  start: Vector3;
  onLockChange: (locked: boolean) => void;
}

function World({ island, surface, scene, view, target, start, onLockChange }: WorldProps) {
  const uniforms = useMemo(createWorldUniforms, []);
  const sky = useMemo(() => createSkyMaterial(uniforms), [uniforms]);
  const terrain = useMemo(() => createTerrainMaterial(uniforms), [uniforms]);
  const clouds = useMemo(() => createCloudSeaMaterial(uniforms), [uniforms]);
  const water = useMemo(() => createWaterfallMaterial(uniforms), [uniforms]);
  const geometry = useMemo(() => createIsland(island), [island]);
  const field = useMemo(() => createIslandField(island), [island]);
  const flatHeights = useMemo(() => flatGroundHeights(field, island), [field, island]);
  const falls = useMemo(() => createWaterfalls(field, island, surface.fallCount), [field, island, surface.fallCount]);
  const pools = useMemo(() => createPools(field), [field]);
  // Sites are sampled once per island; the meadow line and density only filter them.
  const sites = useMemo(() => grassSites(field, island), [field, island]);
  const grass = useMemo(
    () => createGrassGeometry(placeGrass(sites, meadowLineHeight(flatHeights, surface.meadowLine), surface.grassDensity)),
    [sites, flatHeights, surface.meadowLine, surface.grassDensity],
  );
  const grassMaterial = useMemo(() => createGrassMaterial(uniforms), [uniforms]);
  const flowers = useMemo(
    () => createFlowerGeometry(placeFlowers(sites, field, island, meadowLineHeight(flatHeights, surface.meadowLine), surface.flowerDensity)),
    [sites, field, island, flatHeights, surface.meadowLine, surface.flowerDensity],
  );
  const flowerMaterial = useMemo(() => createFlowerMaterial(uniforms), [uniforms]);
  const poolMaterial = useMemo(() => createPoolMaterial(uniforms), [uniforms]);
  // The cloud sea sits below the lowest point the mesh actually reaches (the rim itself is below 0,
  // and the hanging rocks carry lumps past undersideDepth), with a gap that grows with the island.
  const cloudY = useMemo(() => {
    geometry.computeBoundingBox();
    return geometry.boundingBox!.min.y - Math.max(CLOUD_GAP, CLOUD_GAP_SHARE * island.radius);
  }, [geometry, island.radius]);

  const walkSun = useRef(0);
  const skyRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => falls.dispose(), [falls]);
  useEffect(() => () => pools.dispose(), [pools]);
  useEffect(() => () => grass.dispose(), [grass]);
  useEffect(() => () => flowers.dispose(), [flowers]);

  useEffect(() => {
    const blade = bladeHeight(surface.grassHeight, island.radius);
    grassMaterial.uniforms.uBladeHeight.value = blade;
    flowerMaterial.uniforms.uStemHeight.value = blade * FLOWER_STEM;
    flowerMaterial.uniforms.uHeadSize.value = blade * FLOWER_HEAD;
    uniforms.uWind.value = scene.wind;
  }, [grassMaterial, flowerMaterial, uniforms, surface.grassHeight, island.radius, scene.wind]);

  // The flowers open by day, fold at dusk and glow through the night.
  useEffect(() => {
    const { bloom, glow } = flowerPhase(scene.hour);
    flowerMaterial.uniforms.uBloom.value = bloom;
    flowerMaterial.uniforms.uGlow.value = glow;
  }, [flowerMaterial, scene.hour]);

  useEffect(() => {
    applyPalette(uniforms, getPalette(scene.theme, scene.hour));
  }, [uniforms, scene.theme, scene.hour]);

  useEffect(() => {
    terrain.uniforms.uDepth.value = island.undersideDepth;
    terrain.uniforms.uGrassLine.value = meadowLineHeight(flatHeights, surface.meadowLine);
    terrain.uniforms.uRimY.value = field.rimY;
    terrain.uniforms.uSeamBand.value = SEAM_BAND * island.radius;
  }, [terrain, island.undersideDepth, island.radius, field, flatHeights, surface.meadowLine]);

  useFrame(({ camera, clock }) => {
    const elevation = sunElevation(scene.hour);
    // Orbiting, the sun stays behind the island; walking, it stays put, so turning around shows
    // the island backlit one way and front-lit the other.
    if (view.walk) setSunDirection(uniforms, walkSun.current, elevation);
    else placeSunBehind(uniforms, camera.position, target, elevation);
    uniforms.uTime.value = clock.elapsedTime;
    // Sky and cloud sea follow the camera, so a large island seen from far away never leaves them.
    // Both shaders read world positions, so the clouds do not slide along with the camera.
    skyRef.current?.position.copy(camera.position);
    cloudRef.current?.position.set(camera.position.x, cloudY, camera.position.z);
  });

  return (
    <>
      <mesh ref={skyRef} material={sky} frustumCulled={false}>
        <sphereGeometry args={[900, 32, 16]} />
      </mesh>
      <mesh geometry={geometry} material={terrain} />
      <mesh geometry={pools} material={poolMaterial} />
      <mesh geometry={grass} material={grassMaterial} frustumCulled={false} />
      <mesh geometry={flowers} material={flowerMaterial} frustumCulled={false} />
      <mesh geometry={falls} material={water} renderOrder={1} />
      <mesh ref={cloudRef} material={clouds} position-y={cloudY} rotation-x={-Math.PI / 2} frustumCulled={false}>
        <planeGeometry args={[1600, 1600]} />
      </mesh>
      {view.walk && <Walk field={field} island={island} speed={view.walkSpeed} sun={walkSun} restore={start} onLockChange={onLockChange} />}
    </>
  );
}
