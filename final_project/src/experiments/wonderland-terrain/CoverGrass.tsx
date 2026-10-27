import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DataTexture, LinearFilter, RGBAFormat, Vector4 } from 'three';
import { PORCELAIN } from '../../core/palette';
import { createRng } from '../../core/rng';
import { createFlowerGeometry, createFlowerMaterial } from '../../core/shaders/flowers';
import { createGrassGeometry, createGrassMaterial } from '../../core/shaders/grass';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { COVER_DEFAULTS, type CoverField } from './cover';
import { COVER_FOCUS, resolveCoverFocus } from './coverFocus';
import type { ContactMap } from './dwelling';
import { ZONE } from './zones';

/**
 * Near cover stream with **chunk cache**: only newly entered 24 m chunks are built.
 * Retention: Walk = camera+look-ahead; Orbit = camera foot (XZ). Look-hit **prefetches** only.
 * Load (hysteresis) vs display (shader fade) are separate — see coverFocus.ts.
 * Chunks are world-seeded (no focus-baked disc edge); soft rim is camera–blade fade.
 */
export const COVER_NEAR = {
  /** Hard cull radius around **retention** centre (camera foot / walk ahead). */
  radius: 48,
  chunk: 24,
  chunkRing: 2,
  /** Prefetch ring around look-hit (smaller than retention to keep budget). */
  prefetchRing: 1,
  /** Max chunks assembled per update (5×5 retention + prefetch extras). */
  chunkBudget: 36,
  refocus: COVER_FOCUS.refocus,
  lookAhead: COVER_FOCUS.walkLookAhead,
  /**
   * Grid for clump trials. With clumpsPerM2≈2 and cell≈0.72², presence rate stays ≤1
   * so interior patches can reach ~1–2 clumps/m² without a hard 0.95 cap killing density.
   */
  clumpCell: 0.72,
  bladeH: 0.24,
  /** Stem slightly above grass so petals clear the blade sheet without giant blooms. */
  stemH: 0.34,
  head: 0.12,
  blades: [9, 15] as const,
  clumpR: 0.36,
  flowerR: 0.32,
  suitFloor: 0.04,
  /** Keep at most this many cached chunks. */
  cacheMax: 48,
  /** Shader: camera–blade full keep / gone (metres). Wider so mid-height Orbit still sees blades. */
  fadeNear: 42,
  fadeFar: 78,
};

/** Absolute no-vegetation. Terrace / rockSlope niches come from cover.suit, not a blanket ban. */
const HARD_OFF = new Set<number>([ZONE.outside, ZONE.water, ZONE.cliff, ZONE.ridge]);

type Blades = { count: number; offset: Float32Array; shape: Float32Array };
const EMPTY: Blades = { count: 0, offset: new Float32Array(), shape: new Float32Array() };

export interface CoverPipeStats {
  cellsInDisc: number;
  densBelow: number;
  wearOrEdge: number;
  noPresence: number;
  wetOrBadY: number;
  clumpsKept: number;
  bladesAttempted: number;
  bladesKept: number;
  bladesWetReject: number;
  meanBladesPerClump: number;
  targetClumpsM2: number;
  focusX: number;
  focusZ: number;
  chunks: number;
  /** Chunks built this update (cache misses). */
  built: number;
  /** ms spent building missing chunks this update. */
  buildMs: number;
  /** walk | ray | hold | none */
  focusSource: string;
  /** Near blades loaded (hysteresis on cam→foot). */
  nearBlades: boolean;
  /** 0..1 display visibility (Orbit fade from cam→foot). */
  visibility: number;
  /** Cam→foot range (load / global fade). */
  hitDist: number;
  /** Cam→look-hit range (prefetch diagnostics). */
  lookDist: number;
  /** Retention chunk id "ix,iz". */
  chunkId: string;
}

export interface CoverLiveStats {
  grassBlades: number;
  flowerHeads: number;
  grassClumps: number;
  flowerClumps: number;
  flowerAt: { x: number; y: number; z: number }[];
  focus: { x: number; z: number };
  pipe: CoverPipeStats;
}

const EMPTY_PIPE: CoverPipeStats = {
  cellsInDisc: 0, densBelow: 0, wearOrEdge: 0, noPresence: 0, wetOrBadY: 0,
  clumpsKept: 0, bladesAttempted: 0, bladesKept: 0, bladesWetReject: 0, meanBladesPerClump: 0,
  targetClumpsM2: COVER_DEFAULTS.clumpsPerM2, focusX: 0, focusZ: 0, chunks: 0, built: 0, buildMs: 0,
  focusSource: 'none', nearBlades: false, visibility: 0, hitDist: Infinity, lookDist: Infinity, chunkId: '',
};

type ChunkBlades = { go: number[]; gs: number[]; clumps: number; blades: number };

function soft(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Build one world chunk. Deterministic in (seed, ix, iz) — no focus edge baked in.
 * Soft visibility is shader-side (camera distance + Orbit visibility).
 */
/** Minimum centre-to-centre spacing (m) so clumps do not form a lattice after jitter. */
const CLUMP_GAP = 0.55;

export function buildChunk(
  cover: CoverField, grid: HeightGrid, seed: number, ix: number, iz: number,
): ChunkBlades {
  const { clumpCell: CELL, blades: BLADES, clumpR: CLUMP_R, suitFloor: SUIT_FLOOR, chunk: CHUNK } = COVER_NEAR;
  const cellArea = CELL * CELL;
  const rateCap = Math.min(0.98, COVER_DEFAULTS.clumpsPerM2 * cellArea);
  const go: number[] = [], gs: number[] = [];
  let clumps = 0, blades = 0;
  const xMin = ix * CHUNK, zMin = iz * CHUNK;
  const i0 = Math.floor(xMin / CELL), j0 = Math.floor(zMin / CELL);
  const i1 = Math.ceil((xMin + CHUNK) / CELL), j1 = Math.ceil((zMin + CHUNK) / CELL);
  // Accepted clump centres this chunk (plus a 1-cell halo of neighbours from adjacent cells) for gap tests.
  const placed: { x: number; z: number }[] = [];
  // Pre-seed halo: deterministic centres of neighbouring cells outside this chunk so edges don't double-up.
  for (let j = j0 - 1; j < j1 + 1; j++) {
    for (let i = i0 - 1; i < i1 + 1; i++) {
      if (i >= i0 && i < i1 && j >= j0 && j < j1) continue;
      const trial = clumpTrial(cover, grid, seed, i, j, CELL, rateCap, SUIT_FLOOR);
      if (trial) placed.push({ x: trial.cx, z: trial.cz });
    }
  }
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const trial = clumpTrial(cover, grid, seed, i, j, CELL, rateCap, SUIT_FLOOR);
      if (!trial) continue;
      const { cx, cz, rng, keep } = trial;
      // Neighbour distance: reject if too close to an already accepted centre (incl. halo).
      if (placed.some((p) => Math.hypot(p.x - cx, p.z - cz) < CLUMP_GAP)) continue;
      placed.push({ x: cx, z: cz });
      // Intra-patch density: fine noise opens small gaps inside large sheets (not per-clump colour).
      const local = 0.55 + 0.45 * soft(-0.2, 0.55, Math.sin(cx * 1.7 + cz * 1.3) * 0.5 + Math.sin(cx * 0.41 - cz * 0.37) * 0.5);
      if (rng() > local) continue;
      const y0 = sampleGrid(grid, cx, cz) - 0.02;
      if (!(y0 > -50) || sampleGrid(grid, cx, cz, 3) > -1.5) continue;
      if (HARD_OFF.has(cover.zoneAt(cx, cz))) continue;
      clumps++;
      const clumpScale = 0.7 + 0.55 * rng(); // per-clump radius / height stamp variation
      const nBlades = Math.max(BLADES[0], Math.min(BLADES[1], BLADES[0] + Math.floor(rng() * (BLADES[1] - BLADES[0] + 1) * (0.75 + 0.5 * keep))));
      const lowLeaves = 2 + Math.floor(rng() * 2);
      const rMax = CLUMP_R * clumpScale;
      for (let k = 0; k < nBlades; k++) {
        const outward = rng() * Math.PI * 2;
        const isLow = k < lowLeaves;
        const r = isLow ? Math.sqrt(rng()) * rMax * 0.22 : Math.sqrt(rng()) * rMax * 0.55;
        const x = cx + Math.cos(outward) * r;
        const z = cz + Math.sin(outward) * r;
        if (sampleGrid(grid, x, z, 3) > -1.5) continue;
        if (HARD_OFF.has(cover.zoneAt(x, z))) continue;
        blades++;
        const yaw = outward + (rng() - 0.5) * (isLow ? 1.2 : 0.55);
        const hScale = (isLow ? 0.28 + 0.22 * rng() : 0.7 + 0.55 * rng()) * (0.85 + 0.3 * clumpScale);
        const bend = isLow ? 0.15 + 0.35 * rng() : 0.3 + 0.7 * rng();
        go.push(x, y0, z);
        gs.push(yaw, hScale, bend, rng());
      }
    }
  }
  return { go, gs, clumps, blades };
}

/**
 * Deterministic clump candidate for cell (i,j): full-cell jitter (not grid-centre), then
 * re-sample suit/patch/height at the offset position. Same seed → same trial across chunk reloads.
 */
function clumpTrial(
  cover: CoverField, grid: HeightGrid, seed: number, i: number, j: number,
  CELL: number, rateCap: number, SUIT_FLOOR: number,
): { cx: number; cz: number; rng: () => number; keep: number } | null {
  const rng = createRng(((seed * 0x9e3779b9) ^ Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0);
  // Full cell jitter — was (i+0.5)*CELL with no offset (lattice).
  const cx = (i + rng()) * CELL, cz = (j + rng()) * CELL;
  if (HARD_OFF.has(cover.zoneAt(cx, cz))) return null;
  const suit = cover.suitAt(cx, cz);
  const patch = cover.patchAt(cx, cz);
  if (suit < SUIT_FLOOR) return null;
  const interior = soft(0.28, 0.75, patch);
  if (interior < 0.1) return null;
  const suitW = soft(SUIT_FLOOR, SUIT_FLOOR + 0.18, suit);
  const keep = interior * suitW;
  if (keep < 0.06) return null;
  if (rng() > rateCap * keep) return null;
  if (!(sampleGrid(grid, cx, cz) > -50) || sampleGrid(grid, cx, cz, 3) > -1.5) return null;
  return { cx, cz, rng, keep };
}

/** Full disc build (tests / probe). Wear optional for stats only. */
export function buildSites(cover: CoverField, grid: HeightGrid, seed: number, fx: number, fz: number, map: ContactMap | null, amount: number) {
  void map; void amount;
  const { chunk: CHUNK, chunkRing: RING, radius: RADIUS, flowerR: FLOWER_R } = COVER_NEAR;
  const go: number[] = [], gs: number[] = [], fo: number[] = [], fs: number[] = [];
  const flowerAt: { x: number; y: number; z: number }[] = [];
  let grassClumps = 0, flowerClumps = 0, bladesKept = 0;
  const cx0 = Math.floor(fx / CHUNK), cz0 = Math.floor(fz / CHUNK);
  let chunks = 0;
  const t0 = performance.now();
  for (let jz = -RING; jz <= RING; jz++) {
    for (let ix = -RING; ix <= RING; ix++) {
      chunks++;
      const c = buildChunk(cover, grid, seed, cx0 + ix, cz0 + jz);
      for (let i = 0, n = c.go.length / 3; i < n; i++) {
        const x = c.go[i * 3], y = c.go[i * 3 + 1], z = c.go[i * 3 + 2];
        if (Math.hypot(x - fx, z - fz) > RADIUS) continue;
        go.push(x, y, z);
        gs.push(c.gs[i * 4], c.gs[i * 4 + 1], c.gs[i * 4 + 2], c.gs[i * 4 + 3]);
        bladesKept++;
      }
      grassClumps += c.clumps;
    }
  }
  for (const site of cover.flowerAnchors) {
    if (Math.hypot(site.x - fx, site.z - fz) > RADIUS) continue;
    if (HARD_OFF.has(cover.zoneAt(site.x, site.z))) continue;
    flowerClumps++;
    const rng = createRng(((seed * 0x85ebca6b) ^ Math.imul(Math.round(site.x * 10), 0x27d4eb2d) ^ Math.imul(Math.round(site.z * 10), 0x165667b1)) >>> 0);
    const heads = site.heads ?? 3;
    let placed = 0;
    for (let k = 0; k < heads; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * FLOWER_R;
      const x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
      const y = sampleGrid(grid, x, z);
      if (!(y > -50) || sampleGrid(grid, x, z, 3) > -1.5) continue;
      fo.push(x, y, z);
      fs.push(rng() * Math.PI * 2, 0.8 + 0.35 * rng(), rng(), rng());
      if (placed === 0 && flowerAt.length < 8) flowerAt.push({ x, y: site.y, z });
      placed++;
    }
  }
  if (flowerAt.length === 0) {
    for (const a of cover.flowerAnchors.slice(0, 4)) flowerAt.push({ x: a.x, y: a.y, z: a.z });
  }
  const buildMs = performance.now() - t0;
  return {
    grass: { count: go.length / 3, offset: new Float32Array(go), shape: new Float32Array(gs) },
    flowers: { count: fo.length / 3, offset: new Float32Array(fo), shape: new Float32Array(fs) },
    stats: {
      grassBlades: go.length / 3,
      flowerHeads: fo.length / 3,
      grassClumps,
      flowerClumps,
      flowerAt,
      focus: { x: fx, z: fz },
      pipe: {
        ...EMPTY_PIPE,
        clumpsKept: grassClumps,
        bladesKept,
        meanBladesPerClump: grassClumps ? bladesKept / grassClumps : 0,
        focusX: fx, focusZ: fz, chunks, built: chunks, buildMs,
        nearBlades: true, visibility: 1, hitDist: 0,
      },
    },
  };
}

export function CoverGrass({
  cover, grid, uniforms, seed, map, amount = COVER_DEFAULTS.amount, walking = false, onStats, buildMsRef,
}: {
  cover: CoverField;
  grid: HeightGrid;
  uniforms: WorldUniforms;
  seed: number;
  map: ContactMap | null;
  amount?: number;
  /** First-person Walk → camera+look-ahead focus; Orbit → ground ray. */
  walking?: boolean;
  onStats?: (s: CoverLiveStats) => void;
  /** Latest chunk rebuild ms (for nav diagnostics). */
  buildMsRef?: { current: number };
}) {
  const grassMat = useMemo(() => {
    const m = createGrassMaterial(uniforms);
    m.uniforms.uMeadow = { value: new Color(PORCELAIN.cover) };
    m.uniforms.uBladeHeight.value = COVER_NEAR.bladeH;
    m.uniforms.uFadeNear.value = COVER_NEAR.fadeNear;
    m.uniforms.uFadeFar.value = COVER_NEAR.fadeFar;
    return m;
  }, [uniforms]);
  const flowerMat = useMemo(() => {
    const m = createFlowerMaterial(uniforms);
    m.uniforms.uAccent = { value: new Color(PORCELAIN.coverFlower) };
    m.uniforms.uMeadow = { value: new Color(PORCELAIN.coverShade) };
    m.uniforms.uRimColor = { value: new Color(PORCELAIN.coverFlowerRim) };
    m.uniforms.uStemHeight.value = COVER_NEAR.stemH;
    m.uniforms.uHeadSize.value = COVER_NEAR.head;
    m.uniforms.uBloom.value = 1;
    m.uniforms.uGlow.value = 0;
    m.uniforms.uFadeNear.value = COVER_NEAR.fadeNear;
    m.uniforms.uFadeFar.value = COVER_NEAR.fadeFar;
    return m;
  }, [uniforms]);
  useEffect(() => () => { grassMat.dispose(); flowerMat.dispose(); }, [grassMat, flowerMat]);

  const wearTex = useMemo(() => {
    if (!map || map.cells <= 0) return null;
    const t = new DataTexture(new Uint8Array(map.cells * map.cells * 4), map.cells, map.cells, RGBAFormat);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [map?.cells, map?.x0, map?.z0, map?.texel]);
  useEffect(() => () => wearTex?.dispose(), [wearTex]);
  const wearUploaded = useRef(-1);
  useFrame(() => {
    const u = grassMat.uniforms;
    if (!wearTex || !map || map.cells <= 0) {
      u.uWear.value = null;
      (u.uWearRect.value as Vector4).w = 0;
      return;
    }
    u.uWear.value = wearTex;
    (u.uWearRect.value as Vector4).set(map.x0, map.z0, map.cells * map.texel, 1);
    if (map.version !== wearUploaded.current) {
      const data = wearTex.image.data as Uint8Array;
      const n = map.cells * map.cells;
      for (let i = 0; i < n; i++) {
        data[i * 4] = Math.round(Math.min(map.walk[i], 1) * 255);
        data[i * 4 + 3] = 255;
      }
      wearTex.needsUpdate = true;
      wearUploaded.current = map.version;
    }
  });

  const focus = useRef({
    x: NaN, z: NaN, near: false, source: 'none', visibility: 0, hitDist: Infinity, lookDist: Infinity,
    prefetchX: NaN, prefetchZ: NaN, hasPrefetch: false, lastHitAt: 0,
  });
  const cache = useRef(new Map<string, ChunkBlades>());
  const lastBuildMs = useRef(0);
  const hasInstances = useRef(false);
  /** Generation token: ignore stale assemble results if the camera request moved on. */
  const assembleGen = useRef(0);
  const lastAssembledKey = useRef('');
  const [sites, setSites] = useState<{ grass: Blades; flowers: Blades; stats: CoverLiveStats }>({
    grass: EMPTY, flowers: EMPTY,
    stats: { grassBlades: 0, flowerHeads: 0, grassClumps: 0, flowerClumps: 0, flowerAt: [], focus: { x: 0, z: 0 }, pipe: EMPTY_PIPE },
  });

  const clearNear = (fx: number, fz: number, source: string, hitDist: number, lookDist: number) => {
    lastBuildMs.current = 0;
    if (buildMsRef) buildMsRef.current = 0;
    hasInstances.current = false;
    lastAssembledKey.current = '';
    assembleGen.current++;
    const CHUNK = COVER_NEAR.chunk;
    setSites({
      grass: EMPTY,
      flowers: EMPTY,
      stats: {
        grassBlades: 0, flowerHeads: 0, grassClumps: 0, flowerClumps: 0,
        flowerAt: cover.flowerAnchors.slice(0, 4).map((a) => ({ x: a.x, y: a.y, z: a.z })),
        focus: { x: fx, z: fz },
        pipe: {
          ...EMPTY_PIPE,
          focusX: fx, focusZ: fz, focusSource: source, nearBlades: false,
          visibility: 0, hitDist, lookDist,
          chunkId: `${Math.floor(fx / CHUNK)},${Math.floor(fz / CHUNK)}`,
        },
      },
    });
  };

  const assemble = (
    fx: number, fz: number, source: string, visibility: number, hitDist: number, lookDist: number,
    prefetchX: number, prefetchZ: number, hasPrefetch: boolean,
  ) => {
    const gen = ++assembleGen.current;
    const {
      chunk: CHUNK, chunkRing: RING, prefetchRing: PRE_RING, chunkBudget: BUDGET,
      radius: RADIUS, flowerR: FLOWER_R, cacheMax,
    } = COVER_NEAR;
    const cx0 = Math.floor(fx / CHUNK), cz0 = Math.floor(fz / CHUNK);
    const assembleKey = `${cx0},${cz0}|${hasPrefetch ? `${Math.floor(prefetchX / CHUNK)},${Math.floor(prefetchZ / CHUNK)}` : '-'}`;
    const need: string[] = [];
    const pushRing = (cx: number, cz: number, ring: number) => {
      for (let jz = -ring; jz <= ring; jz++) {
        for (let ix = -ring; ix <= ring; ix++) {
          const key = `${cx + ix},${cz + jz}`;
          if (!need.includes(key)) need.push(key);
        }
      }
    };
    // Retention ring first (camera foot) — never dropped for look-hit.
    pushRing(cx0, cz0, RING);
    if (hasPrefetch) {
      pushRing(Math.floor(prefetchX / CHUNK), Math.floor(prefetchZ / CHUNK), PRE_RING);
    }
    // Explicit budget: keep retention intact, trim farthest prefetch keys if over.
    if (need.length > BUDGET) {
      const retention = new Set<string>();
      for (let jz = -RING; jz <= RING; jz++) {
        for (let ix = -RING; ix <= RING; ix++) retention.add(`${cx0 + ix},${cz0 + jz}`);
      }
      const extras = need.filter((k) => !retention.has(k));
      extras.sort((a, b) => {
        const [ax, az] = a.split(',').map(Number);
        const [bx, bz] = b.split(',').map(Number);
        const da = Math.hypot((ax + 0.5) * CHUNK - fx, (az + 0.5) * CHUNK - fz);
        const db = Math.hypot((bx + 0.5) * CHUNK - fx, (bz + 0.5) * CHUNK - fz);
        return da - db;
      });
      need.length = 0;
      for (const k of retention) need.push(k);
      for (const k of extras) {
        if (need.length >= BUDGET) break;
        need.push(k);
      }
    }
    const t0 = performance.now();
    let built = 0;
    for (const key of need) {
      if (!cache.current.has(key)) {
        const [ix, iz] = key.split(',').map(Number);
        cache.current.set(key, buildChunk(cover, grid, seed, ix, iz));
        built++;
      }
    }
    if (cache.current.size > cacheMax) {
      for (const k of [...cache.current.keys()]) {
        if (!need.includes(k)) cache.current.delete(k);
      }
    }
    // Hard disc cull around **retention** only — look-hit must not strip grass at the feet.
    const go: number[] = [], gs: number[] = [];
    let grassClumps = 0, bladesKept = 0;
    for (const key of need) {
      const c = cache.current.get(key)!;
      for (let i = 0, n = c.go.length / 3; i < n; i++) {
        const x = c.go[i * 3], y = c.go[i * 3 + 1], z = c.go[i * 3 + 2];
        if (Math.hypot(x - fx, z - fz) > RADIUS) continue;
        go.push(x, y, z);
        gs.push(c.gs[i * 4], c.gs[i * 4 + 1], c.gs[i * 4 + 2], c.gs[i * 4 + 3]);
        bladesKept++;
      }
      grassClumps += c.clumps;
    }
    const fo: number[] = [], fs: number[] = [];
    const flowerAt: { x: number; y: number; z: number }[] = [];
    let flowerClumps = 0;
    for (const site of cover.flowerAnchors) {
      if (Math.hypot(site.x - fx, site.z - fz) > RADIUS) continue;
      if (HARD_OFF.has(cover.zoneAt(site.x, site.z))) continue;
      flowerClumps++;
      const rng = createRng(((seed * 0x85ebca6b) ^ Math.imul(Math.round(site.x * 10), 0x27d4eb2d) ^ Math.imul(Math.round(site.z * 10), 0x165667b1)) >>> 0);
      const heads = site.heads ?? 3;
      let placed = 0;
      for (let k = 0; k < heads; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * FLOWER_R;
        const x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
        const y = sampleGrid(grid, x, z);
        if (!(y > -50) || sampleGrid(grid, x, z, 3) > -1.5) continue;
        fo.push(x, y, z);
        fs.push(rng() * Math.PI * 2, 0.8 + 0.35 * rng(), rng(), rng());
        if (placed === 0 && flowerAt.length < 8) flowerAt.push({ x, y: site.y, z });
        placed++;
      }
    }
    if (flowerAt.length === 0) {
      for (const a of cover.flowerAnchors.slice(0, 4)) flowerAt.push({ x: a.x, y: a.y, z: a.z });
    }
    const buildMs = performance.now() - t0;
    // Stale: a newer camera request started assemble after this one.
    if (gen !== assembleGen.current) return;
    lastBuildMs.current = buildMs;
    if (buildMsRef) buildMsRef.current = buildMs;
    hasInstances.current = go.length > 0 || fo.length > 0;
    lastAssembledKey.current = assembleKey;
    setSites({
      grass: { count: go.length / 3, offset: new Float32Array(go), shape: new Float32Array(gs) },
      flowers: { count: fo.length / 3, offset: new Float32Array(fo), shape: new Float32Array(fs) },
      stats: {
        grassBlades: go.length / 3,
        flowerHeads: fo.length / 3,
        grassClumps,
        flowerClumps,
        flowerAt,
        focus: { x: fx, z: fz },
        pipe: {
          ...EMPTY_PIPE,
          clumpsKept: grassClumps,
          bladesKept,
          meanBladesPerClump: grassClumps ? bladesKept / grassClumps : 0,
          focusX: fx, focusZ: fz, chunks: need.length, built, buildMs,
          focusSource: source, nearBlades: true, visibility, hitDist, lookDist,
          chunkId: `${cx0},${cz0}`,
        },
      },
    });
  };

  useFrame(({ camera }) => {
    const now = performance.now();
    const resolved = resolveCoverFocus(grid, camera, walking ? 'walk' : 'orbit', {
      x: focus.current.x, z: focus.current.z, near: focus.current.near,
      prefetchX: focus.current.prefetchX, prefetchZ: focus.current.prefetchZ,
      lastHitAt: focus.current.lastHitAt,
    }, now);
    const visTarget = resolved.visibility;
    const visPrev = focus.current.visibility;
    // Near: ramp up quickly so blades appear without waiting for a scroll event.
    const lerp = resolved.near ? 0.35 : 0.12;
    const visibility = visPrev + (visTarget - visPrev) * lerp;
    grassMat.uniforms.uVisibility.value = visibility;
    flowerMat.uniforms.uVisibility.value = visibility;

    const retentionMoved = Number.isNaN(focus.current.x)
      || Math.hypot(resolved.x - focus.current.x, resolved.z - focus.current.z) > COVER_NEAR.refocus
      || resolved.near !== focus.current.near;
    const prefetchMoved = resolved.hasPrefetch !== focus.current.hasPrefetch
      || (resolved.hasPrefetch && (
        Number.isNaN(focus.current.prefetchX)
        || Math.hypot(resolved.prefetchX - focus.current.prefetchX, resolved.prefetchZ - focus.current.prefetchZ) > COVER_NEAR.refocus
      ));

    const lastHitAt = resolved.source === 'ray' ? now : focus.current.lastHitAt;
    focus.current = {
      x: resolved.x, z: resolved.z, near: resolved.near, source: resolved.source,
      visibility, hitDist: resolved.hitDist, lookDist: resolved.lookDist,
      prefetchX: resolved.prefetchX, prefetchZ: resolved.prefetchZ, hasPrefetch: resolved.hasPrefetch,
      lastHitAt,
    };

    if (!resolved.near) {
      if (hasInstances.current && visibility < 0.03) {
        clearNear(resolved.x, resolved.z, resolved.source, resolved.hitDist, resolved.lookDist);
      }
      return;
    }
    const CHUNK = COVER_NEAR.chunk;
    const wantKey = `${Math.floor(resolved.x / CHUNK)},${Math.floor(resolved.z / CHUNK)}|${
      resolved.hasPrefetch
        ? `${Math.floor(resolved.prefetchX / CHUNK)},${Math.floor(resolved.prefetchZ / CHUNK)}`
        : '-'
    }`;
    // Critical: assemble when the retention/prefetch key is new — even while the camera is still
    // (no scroll). Empty land still records the key so we do not spin every frame.
    const pending = lastAssembledKey.current !== wantKey;
    if (retentionMoved || prefetchMoved || pending) {
      assemble(
        resolved.x, resolved.z, resolved.source, visibility, resolved.hitDist, resolved.lookDist,
        resolved.prefetchX, resolved.prefetchZ, resolved.hasPrefetch,
      );
    }
  });

  useEffect(() => {
    cache.current.clear();
    assembleGen.current++;
    lastAssembledKey.current = '';
    hasInstances.current = false;
    focus.current = {
      x: NaN, z: NaN, near: false, source: 'none', visibility: 0, hitDist: Infinity, lookDist: Infinity,
      prefetchX: NaN, prefetchZ: NaN, hasPrefetch: false, lastHitAt: 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, grid, seed, amount, walking]);

  useEffect(() => { onStats?.(sites.stats); }, [sites, onStats]);

  const grass = useMemo(() => createGrassGeometry(sites.grass), [sites]);
  const flowers = useMemo(() => createFlowerGeometry(sites.flowers), [sites]);
  useEffect(() => () => { grass.dispose(); flowers.dispose(); }, [grass, flowers]);

  // Skip raycast so Orbit zoomToCursor / dblclick focus hit terrain, not blades.
  const noHit = () => {};
  if (sites.grass.count === 0 && sites.flowers.count === 0) return null;
  return (
    <>
      {sites.grass.count > 0 && <mesh geometry={grass} material={grassMat} frustumCulled={false} raycast={noHit} userData={{ orbitIgnore: true }} />}
      {sites.flowers.count > 0 && <mesh geometry={flowers} material={flowerMat} frustumCulled={false} raycast={noHit} userData={{ orbitIgnore: true }} />}
    </>
  );
}

export const COVER_SCALE = {
  grass: [COVER_NEAR.bladeH * 0.7, COVER_NEAR.bladeH * 1.35] as [number, number],
  flower: [COVER_NEAR.stemH * 0.85, COVER_NEAR.stemH + COVER_NEAR.head] as [number, number],
};
