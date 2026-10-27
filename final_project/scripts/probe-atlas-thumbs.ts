/** Render atlas thumbs to scripts/out/atlas-thumbs-*.png for visual evidence. */
import { mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import {
  AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';

// Dynamic import of atlas builders is heavy; duplicate minimal path via ResourceAtlas internals is not exported.
// Instead build subjects the same way the atlas does by importing CoverGrass + materials.
import { getPalette, PORCELAIN } from '../src/core/palette';
import { expandPine, GROWN_PINE_HEIGHT, interpretPine, pineGeometry } from '../src/core/generators/pine';
import { createFlowerGeometry, createFlowerMaterial } from '../src/core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../src/core/shaders/grass';
import { createPineMaterial } from '../src/core/shaders/pine';
import { applyPalette, createWorldUniforms, setSunDirection } from '../src/core/shaders/uniforms';
import { COVER_NEAR as COVER } from '../src/experiments/wonderland-terrain/CoverGrass';
import { makeShrubPreviewGeometry, shrubToneColors } from '../src/experiments/wonderland-terrain/ShrubPatches';
import { Mesh } from 'three';

const require = createRequire(import.meta.url);
// headless gl — optional
let gl: unknown = null;
try { gl = require('gl')(160, 120); } catch { /* no */ }

function makeClump(n: number, seed: number, rMax: number) {
  const offset = new Float32Array(n * 3), shape = new Float32Array(n * 4);
  let s = seed >>> 0;
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * rMax;
    offset[i * 3] = Math.cos(a) * r; offset[i * 3 + 1] = 0; offset[i * 3 + 2] = Math.sin(a) * r;
    shape[i * 4] = a; shape[i * 4 + 1] = 0.7 + 0.5 * rng(); shape[i * 4 + 2] = 0.4 + 0.5 * rng(); shape[i * 4 + 3] = rng();
  }
  return { offset, shape, count: n };
}

function uniforms() {
  const u = createWorldUniforms();
  applyPalette(u, getPalette('qinglv', 14));
  setSunDirection(u, 0.6, 55);
  u.uAccent.value.set(PORCELAIN.coverFlower);
  u.uRimColor.value.set(PORCELAIN.coverFlowerRim);
  u.uMeadow.value.set(PORCELAIN.cover);
  return u;
}

function render(name: string, object: Mesh, lookH: number) {
  const scene = new Scene();
  scene.background = new Color(name === 'grass' || name === 'flower' ? '#8a8680' : '#ebe6dc');
  scene.add(new AmbientLight(0xffffff, 0.85));
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 4, 3);
  scene.add(key);
  scene.add(object);
  const w = 160, h = 120;
  const cam = new PerspectiveCamera(35, w / h, 0.05, 80);
  const dist = Math.max(lookH * 3, 0.9);
  cam.position.set(dist * 0.55, Math.max(lookH * 0.8, 0.3), dist);
  cam.lookAt(0, lookH * 0.35, 0);
  const opts: ConstructorParameters<typeof WebGLRenderer>[0] = { antialias: true, preserveDrawingBuffer: true };
  if (gl) (opts as { context?: unknown }).context = gl;
  const renderer = new WebGLRenderer(opts);
  renderer.setSize(w, h, false);
  renderer.render(scene, cam);
  const data = renderer.domElement.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  mkdirSync('scripts/out', { recursive: true });
  const path = `scripts/out/atlas-thumb-${name}.png`;
  writeFileSync(path, Buffer.from(data, 'base64'));
  renderer.dispose();
  console.log('wrote', path);
}

const u = uniforms();
{
  const blades = makeClump(14, 11, COVER.clumpR * 0.85);
  const geom = createGrassGeometry(blades);
  const mat = createGrassMaterial(u);
  mat.uniforms.uBladeHeight.value = COVER.bladeH;
  mat.uniforms.uFadeNear.value = 200; mat.uniforms.uFadeFar.value = 250; mat.uniforms.uVisibility.value = 1;
  (mat.uniforms.uMeadow.value as Color).set(PORCELAIN.cover);
  render('grass', new Mesh(geom, mat), COVER.bladeH);
}
{
  const heads = makeClump(6, 14, COVER.flowerR * 0.9);
  const geom = createFlowerGeometry(heads);
  const mat = createFlowerMaterial(u);
  mat.uniforms.uStemHeight.value = COVER.stemH; mat.uniforms.uHeadSize.value = COVER.head;
  mat.uniforms.uFadeNear.value = 200; mat.uniforms.uFadeFar.value = 250; mat.uniforms.uVisibility.value = 1;
  mat.uniforms.uBloom.value = 1;
  render('flower', new Mesh(geom, mat), COVER.stemH + COVER.head);
}
{
  const { geometry, disposeExtra } = makeShrubPreviewGeometry(0, 0);
  const mat = createPineMaterial(u);
  const [hi, lo] = shrubToneColors(0);
  (mat.uniforms.uNeedle.value as Color).set(hi);
  (mat.uniforms.uNeedleShade.value as Color).set(lo);
  (mat.uniforms.uBark.value as Color).set(PORCELAIN.pineBark);
  mat.uniforms.uSnow.value = 0;
  const mesh = new Mesh(geometry, mat);
  mesh.scale.set(1.2, 0.8, 1.2);
  render('shrub', mesh, 0.8);
  disposeExtra();
}
{
  const seed = 9011;
  const geom = pineGeometry(interpretPine(expandPine(seed), seed), 0, seed);
  const mat = createPineMaterial(u);
  (mat.uniforms.uNeedle.value as Color).set(PORCELAIN.pineNeedle);
  const mesh = new Mesh(geom, mat);
  mesh.scale.setScalar(8 / GROWN_PINE_HEIGHT);
  render('pine', mesh, 8);
}
console.log('done');
