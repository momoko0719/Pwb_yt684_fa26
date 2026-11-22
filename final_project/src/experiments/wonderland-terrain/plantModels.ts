import { Color, Mesh, type BufferGeometry, type Material, type Object3D, type ShaderMaterial } from 'three';
import { expandPineTagged, interpretPine, isPineBirth, pineGeometry, PINE_BIRTH, PINE_KNOBS, type PineKnobs } from '../../core/generators/pine';
import { PORCELAIN } from '../../core/palette';
import { createRng } from '../../core/rng';
import { SIZES } from '../../core/scale';
import { createFlowerGeometry, createFlowerMaterial } from '../../core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../../core/shaders/grass';
import { createPineMaterial } from '../../core/shaders/pine';
import type { StringKey } from '../../i18n/strings';
import { BROADLEAF, BROADLEAF_KNOBS, birthKnobs, growBroadleafStages, skeletonStage, type BroadleafKind } from './broadleaf';
import { bladesUnder, COVER_NEAR, coverKnob, FLOWER_KNOBS, GRASS_KNOBS, type CoverKnobs } from './CoverGrass';
import { pickTone, shrubMix, SHRUB_HEIGHT, SHRUB_TONE_WEIGHTS, SHRUB_WIDTH_RATIO, type ShrubTone } from './shrubs';
import { growShrubStages, SHRUB_BIRTH, SHRUB_KNOBS } from './shrubLSystem';

/**
 * Every plant's atlas card is the same editor (PlantEditor.tsx): the plant on the left, growing
 * step by step when played; on the right its rule, a few knobs, and "apply to island". What
 * differs is only how each one grows, here: the four L-system plants (parasol, weeping, shrub,
 * pine) replay generation by generation; grass and flowers, which are not L-systems, replay the
 * order a clump is laid (blade by blade; stems as buds, then the flowers open).
 */
export type PlantKind = BroadleafKind | 'shrub' | 'pine' | 'grass' | 'flower';
export type PlantKnobs = Record<string, number>;
export interface PlantKnob { key: string; min: number; max: number; step: number }

/** A plant grown for the editor: one object per step of the replay (the last the grown plant), at real size (m). */
export interface PlantGrowth {
  frames: Object3D[];
  /** Metres: how tall and how wide the grown plant stands. */
  height: number;
  spread: number;
  dispose: () => void;
}
type T = (key: StringKey) => string;
export interface PlantModel {
  knobs: PlantKnob[];
  birth: () => PlantKnobs;
  grow: (seed: number, knobs: PlantKnobs) => PlantGrowth;
  /** The step's name (under the scrubber) and what it did (the caption). */
  label: (frame: number, frames: number, t: T, knobs: PlantKnobs) => { name: string; caption: string };
  /** The note under the buttons: how the replay is to be read. */
  note: StringKey;
  /** Milliseconds a step in the replay. */
  stepMs: number;
  /** A person beside it for scale (trees and shrubs; grass and flowers are framed close). */
  person: boolean;
}

export const PLANT_COLOURS: Record<BroadleafKind, [string, string]> = {
  parasol: [PORCELAIN.parasolLeaf, PORCELAIN.parasolLeafShade],
  weeping: [PORCELAIN.weepingLeaf, PORCELAIN.weepingLeafShade],
};
export const SHRUB_TONE_COLOURS: Record<ShrubTone, [string, string]> = {
  0: [PORCELAIN.shrub, PORCELAIN.shrubShade],
  1: [PORCELAIN.shrubOchre, PORCELAIN.shrubOchreShade],
  2: [PORCELAIN.shrubRed, PORCELAIN.shrubRedShade],
};

/** Every step of an L-system plant as a mesh in its material, scaled by `scale` (x, y, z metres a unit). */
function meshes(geometries: BufferGeometry[], material: Material, scale: [number, number, number]): PlantGrowth['frames'] {
  return geometries.map((g) => { const m = new Mesh(g, material); m.scale.set(...scale); return m; });
}
function barkMaterial(uniforms: unknown, leaf: [string, string], bark: string) {
  const m = createPineMaterial(uniforms as Parameters<typeof createPineMaterial>[0]);
  (m.uniforms.uNeedle.value as Color).set(leaf[0]);
  (m.uniforms.uNeedleShade.value as Color).set(leaf[1]);
  (m.uniforms.uBark.value as Color).set(bark);
  m.uniforms.uSnow.value = 0;
  return m;
}
const disposeAll = (frames: Object3D[], materials: Material[]) => () => {
  for (const f of frames) (f as Mesh).geometry?.dispose();
  materials.forEach((m) => m.dispose());
};
/** Generation names: the bud, generation n, then the grown plant's own word. */
const genLabel = (kind: string, budAt0: boolean) => (frame: number, frames: number, t: T) => {
  const last = frame >= frames - 1;
  return {
    name: last ? t(`plant.stage.${kind}` as StringKey) : frame === 0 && budAt0 ? t('plant.bud') : t('plant.gen').replace('{n}', String(frame)),
    caption: t(`plant.grow.${kind}.${last ? 'leaf' : frame}` as StringKey),
  };
};
const mid = ([lo, hi]: readonly number[]) => (lo + hi) / 2;

function broadleafModel(kind: BroadleafKind, uniforms: () => unknown): PlantModel {
  return {
    knobs: BROADLEAF_KNOBS[kind],
    birth: () => birthKnobs(kind),
    grow: (seed, knobs) => {
      const g = growBroadleafStages(kind, seed, knobs);
      const h = mid(BROADLEAF[kind].height);
      const material = barkMaterial(uniforms(), PLANT_COLOURS[kind], PORCELAIN.broadleafBark);
      const frames = meshes([...g.stages, g.grown], material, [h, h, h]);
      return { frames, height: h, spread: g.spread * h, dispose: disposeAll(frames, [material]) };
    },
    label: genLabel(kind, true),
    note: 'plant.lsystem',
    stepMs: 750,
    person: true,
  };
}

/** The shrub, in the colour its rule rolls for this seed under the mix. */
function shrubModel(uniforms: () => unknown): PlantModel {
  return {
    knobs: SHRUB_KNOBS,
    birth: () => ({ ...SHRUB_BIRTH, mixOlive: SHRUB_TONE_WEIGHTS[0], mixOchre: SHRUB_TONE_WEIGHTS[1] }),
    grow: (seed, knobs) => {
      const g = growShrubStages(9137 + seed * 31, knobs);
      const tone = pickTone(createRng(seed * 977 + 5)(), shrubMix(knobs));
      const h = mid(SHRUB_HEIGHT), w = mid(SHRUB_WIDTH_RATIO);
      const material = barkMaterial(uniforms(), SHRUB_TONE_COLOURS[tone], PORCELAIN.pineBark);
      const frames = meshes([...g.stages, g.grown], material, [h * w, h, h * w]);
      return { frames, height: h, spread: g.spread * h * w, dispose: disposeAll(frames, [material]) };
    },
    label: genLabel('shrub', true),
    note: 'plant.lsystem.shrub',
    stepMs: 800,
    person: true,
  };
}

const PINE_GENERATIONS = 8;
function pineModel(uniforms: () => unknown): PlantModel {
  return {
    knobs: PINE_KNOBS,
    birth: () => ({ ...PINE_BIRTH }),
    grow: (seed, knobs: PineKnobs) => {
      const s = 9000 + seed;
      const { str, birth } = expandPineTagged(s, PINE_GENERATIONS, knobs);
      const skel = interpretPine(str, s, knobs, birth);
      const grown = pineGeometry(skel, 0, s);
      grown.computeBoundingBox();
      const unit = Math.max(grown.boundingBox!.max.y, 1e-3);
      grown.scale(1 / unit, 1 / unit, 1 / unit);
      grown.computeBoundingBox();
      const stages = Array.from({ length: PINE_GENERATIONS + 1 }, (_, g) => skeletonStage(skel.segments, skel.buds[g] ?? [], g, unit));
      const h = mid(SIZES.forest.height);
      const material = barkMaterial(uniforms(), [PORCELAIN.pineNeedle, PORCELAIN.pineNeedleShade], PORCELAIN.pineBark);
      const frames = meshes([...stages, grown], material, [h, h, h]);
      const b = grown.boundingBox!;
      return { frames, height: h, spread: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * h, dispose: disposeAll(frames, [material]) };
    },
    label: (frame, frames, t, knobs) => {
      const last = frame >= frames - 1;
      // Generations past this one spread the crown (the crown knob: how many of the last).
      const crownFrom = PINE_GENERATIONS - Math.round(isPineBirth(knobs) ? PINE_BIRTH.crown : knobs.crown ?? PINE_BIRTH.crown);
      return {
        name: last ? t('plant.stage.pine') : t('plant.gen').replace('{n}', String(frame)),
        caption: t(frame === 0 ? 'plant.grow.pine.0' : last ? 'plant.grow.pine.leaf' : frame > crownFrom ? 'plant.grow.pine.crown' : 'plant.grow.pine.climb'),
      };
    },
    note: 'plant.lsystem.pine',
    stepMs: 650,
    person: true,
  };
}

/** A clump's blades as the island lays them (CoverGrass buildChunk): low leaves at the heart first, then the long blades. */
function clumpBlades(seed: number, mul: number) {
  const rng = createRng(seed * 131 + 7);
  const [lo, hi] = COVER_NEAR.blades;
  const n = bladesUnder(lo + Math.floor(rng() * (hi - lo + 1)), mul);
  const low = Math.min(2 + Math.floor(rng() * 2), n);
  const offset = new Float32Array(n * 3), shape = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const isLow = k < low, outward = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * COVER_NEAR.clumpR * (isLow ? 0.22 : 0.55);
    offset.set([Math.cos(outward) * r, 0, Math.sin(outward) * r], k * 3);
    shape.set([
      outward + (rng() - 0.5) * (isLow ? 1.2 : 0.55),
      isLow ? 0.28 + 0.22 * rng() : 0.7 + 0.55 * rng(),
      isLow ? 0.15 + 0.35 * rng() : 0.3 + 0.7 * rng(),
      rng(),
    ], k * 4);
  }
  return { offset, shape, count: n, low };
}
/** The first `k` of a clump's instances, as their own geometry. */
const firstOf = (c: { offset: Float32Array; shape: Float32Array }, k: number) => ({ count: k, offset: c.offset.slice(0, k * 3), shape: c.shape.slice(0, k * 4) });

function grassModel(uniforms: () => unknown): PlantModel {
  let low = 2;
  return {
    knobs: GRASS_KNOBS,
    birth: () => ({ blades: 1, height: 1, bend: 1 }),
    grow: (seed, knobs: CoverKnobs) => {
      const clump = clumpBlades(seed, coverKnob(knobs, 'blades'));
      low = clump.low;
      const material = createGrassMaterial(uniforms() as Parameters<typeof createGrassMaterial>[0]);
      material.uniforms.uBladeHeight.value = COVER_NEAR.bladeH * coverKnob(knobs, 'height');
      material.uniforms.uLean.value = coverKnob(knobs, 'bend');
      material.uniforms.uFadeNear.value = 500; material.uniforms.uFadeFar.value = 600; material.uniforms.uVisibility.value = 1;
      (material.uniforms.uMeadow.value as Color).set(PORCELAIN.cover);
      const frames = Array.from({ length: clump.count + 1 }, (_, k) => new Mesh(createGrassGeometry(firstOf(clump, Math.min(k + 1, clump.count))), material));
      const h = COVER_NEAR.bladeH * coverKnob(knobs, 'height') * 1.25;
      return { frames, height: h, spread: COVER_NEAR.clumpR * 1.3, dispose: disposeAll(frames, [material]) };
    },
    label: (frame, frames, t) => {
      const last = frame >= frames - 1;
      return {
        name: last ? t('plant.stage.grass') : t('plant.blade').replace('{n}', String(frame + 1)),
        caption: t(last ? 'plant.grow.grass.leaf' : frame < low ? 'plant.grow.grass.low' : 'plant.grow.grass.blade'),
      };
    },
    note: 'plant.clump.grass',
    stepMs: 280,
    person: false,
  };
}

function flowerModel(uniforms: () => unknown): PlantModel {
  return {
    knobs: FLOWER_KNOBS,
    birth: () => ({ heads: 1, stem: 1, head: 1 }),
    grow: (seed, knobs: CoverKnobs) => {
      const rng = createRng(seed * 211 + 3);
      const n = bladesUnder(5 + Math.floor(rng() * 4), coverKnob(knobs, 'heads'));
      const offset = new Float32Array(n * 3), shape = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * COVER_NEAR.flowerR;
        offset.set([Math.cos(a) * r, 0, Math.sin(a) * r], k * 3);
        shape.set([rng() * Math.PI * 2, 0.8 + 0.35 * rng(), rng(), rng()], k * 4);
      }
      const make = (bloom: number) => {
        const m = createFlowerMaterial(uniforms() as Parameters<typeof createFlowerMaterial>[0]);
        m.uniforms.uStemHeight.value = COVER_NEAR.stemH * coverKnob(knobs, 'stem');
        m.uniforms.uHeadSize.value = COVER_NEAR.head * 1.15 * coverKnob(knobs, 'head');
        m.uniforms.uFadeNear.value = 500; m.uniforms.uFadeFar.value = 600; m.uniforms.uVisibility.value = 1;
        m.uniforms.uBloom.value = bloom;
        return m as ShaderMaterial;
      };
      const bud = make(0.12), open = make(1);
      const clump = { offset, shape };
      const frames = [
        ...Array.from({ length: n }, (_, k) => new Mesh(createFlowerGeometry(firstOf(clump, k + 1)), bud)),
        new Mesh(createFlowerGeometry(firstOf(clump, n)), open),
      ];
      const h = COVER_NEAR.stemH * coverKnob(knobs, 'stem') + COVER_NEAR.head * coverKnob(knobs, 'head');
      return { frames, height: h, spread: COVER_NEAR.flowerR * 2, dispose: disposeAll(frames, [bud, open]) };
    },
    label: (frame, frames, t) => {
      const last = frame >= frames - 1;
      return {
        name: last ? t('plant.stage.flower') : t('plant.stemN').replace('{n}', String(frame + 1)),
        caption: t(last ? 'plant.grow.flower.leaf' : 'plant.grow.flower.stem'),
      };
    },
    note: 'plant.clump.flower',
    stepMs: 420,
    person: false,
  };
}

/** The editor's model for each plant; `uniforms` makes a fresh set of preview world uniforms. */
export function plantModels(uniforms: () => unknown): Record<PlantKind, PlantModel> {
  return {
    parasol: broadleafModel('parasol', uniforms),
    weeping: broadleafModel('weeping', uniforms),
    shrub: shrubModel(uniforms),
    pine: pineModel(uniforms),
    grass: grassModel(uniforms),
    flower: flowerModel(uniforms),
  };
}

/** True when these knobs grow the plant's own form (nothing turned). */
export function isPlantBirth(model: PlantModel, knobs?: PlantKnobs | null): boolean {
  if (!knobs) return true;
  const b = model.birth();
  return Object.keys(b).every((k) => knobs[k] === undefined || Math.abs(knobs[k] - b[k]) < 1e-6);
}
