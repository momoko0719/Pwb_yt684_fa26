import { useEffect, useMemo } from 'react';
import { Color, Group, LOD, Mesh, Quaternion, Vector3 } from 'three';
import { PORCELAIN } from '../../core/palette';
import { expandPine, forestPineModel, interpretPine, pineGeometry, GROWN_PINE_HEIGHT } from '../../core/generators/pine';
import { createPineMaterial } from '../../core/shaders/pine';
import { createPorcelainMaterial } from '../../core/shaders/porcelain';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import type { Dwelling } from './dwelling';
import { STELE_TINT, WATCH_BASE, steleGeometry, watchBaseGeometry } from './stele';
import { WOODS_LOD } from './woods';
import { SUN_AZIMUTH } from './world';

/**
 * The dwelling's corner (the owner's composition A, with B's place to watch from), by rule from
 * its sites: its home H, its drinking stand D, the way between left open.
 *
 * - Two pines (Penglai's, grown from the same L-system) near the home: on open, gentle ground
 *   6–11 m from it, beside or behind it (away from the shore, never between it and the view), off
 *   its way, apart; each reaching toward the home, so it seems to shelter it.
 *   (A low screen of rough stone behind the home was tried and left out: in the porcelain's smooth
 *   white it read as a lump of sugar, not stone; the pines enclose the place enough.)
 * - A place to watch it drink from: a small level stone a few metres along the shore from the
 *   stand, off its ways (people's place, not the creature's), with a plain stone stele on it
 *   (scene object, not a human scale figure).
 * - The views: the corner (side-on to the way, the sun on the far side, over open ground, wide
 *   enough to see home, way and shore); the home (a middle view: the creature, where it lies, the
 *   way it leaves by, the water far behind); close to the ground where it lies (the stone and the
 *   jade side by side).
 *
 * Everything standing here is in the creature's way too: obstacles it keeps out of, placed clear
 * of its home and its stands.
 */
export interface Corner {
  pines: { x: number; z: number; height: number; facing: number; variant: number }[];
  stone: { x: number; z: number; half: [number, number]; facing: number };
  view: { from: [number, number, number]; to: [number, number, number] };
  /** A middle view of the home; a close view of where it lies. */
  homeView: { from: [number, number, number]; to: [number, number, number] };
  closeView: { from: [number, number, number]; to: [number, number, number] };
  /** Unit axes in the ground plane: home toward the drink, and the view's side. */
  axes: { forward: [number, number]; view: [number, number] };
}

const PINE = { heights: [7.5, 9.5], ring: [6, 11], apart: 6.5, turn: 0.9, trunk: 0.5, slope: 0.25, offWay: 5 }; // metres (turn: radians the two keep apart about the home)
/** Watching base — low stone seat; sizes from WATCH_BASE (not a giant white board). */
const STONE = {
  half: WATCH_BASE.half,
  rise: WATCH_BASE.rise,
  off: WATCH_BASE.off,
  flat: WATCH_BASE.flat,
  offWay: WATCH_BASE.offWay,
};
/**
 * Metres pines and the watch seat keep from the home and the stands.
 * The resting stone (habitatStones.ts) is allowed closer: a backrest at 4.5 m would not read as
 * one. It keeps its own gap outside the lying body and stays in the obstacle list.
 */
const CLEAR = { home: 4.5, stand: 4 };

/** Across the way, toward the view: the sun on the far side, over open ground. */
function viewSide(d: Dwelling): [number, number] {
  const H = d.sites.homes[d.home], D = d.sites.drink;
  const L = Math.hypot(D.x - H.x, D.z - H.z) || 1, ux = (D.x - H.x) / L, uz = (D.z - H.z) / L;
  let sx = -uz, sz = ux;
  if (sx * Math.cos(SUN_AZIMUTH) + sz * Math.sin(SUN_AZIMUTH) > 0) { sx = -sx; sz = -sz; }
  const mx = (H.x + D.x) / 2, mz = (H.z + D.z) / 2, away = Math.max(L * 0.8, 16);
  if (!d.open(mx + sx * away, mz + sz * away)) { sx = -sx; sz = -sz; }
  return [sx, sz];
}

export function planCorner(d: Dwelling): Corner {
  const H = d.sites.homes[d.home], D = d.sites.drink;
  const L = Math.hypot(D.x - H.x, D.z - H.z) || 1, ux = (D.x - H.x) / L, uz = (D.z - H.z) / L;
  const [vx, vz] = viewSide(d);
  const slope = (x: number, z: number) => { const e = 0.5; return Math.hypot(d.groundAt(x + e, z) - d.groundAt(x - e, z), d.groundAt(x, z + e) - d.groundAt(x, z - e)) / (2 * e); };
  const clear = (x: number, z: number) =>
    d.dry(x, z) && Math.hypot(x - H.x, z - H.z) >= CLEAR.home && d.sites.stands.every((s) => Math.hypot(x - s.x, z - s.z) >= CLEAR.stand);
  // Distance from the way between home and shore (as the crow flies: its routes keep near it).
  const offWay = (x: number, z: number) => {
    const t = Math.min(Math.max(((x - H.x) * ux + (z - H.z) * uz) / L, 0), 1);
    return Math.hypot(x - H.x - ux * L * t, z - H.z - uz * L * t);
  };
  // How open the ground is around a point: the share of it within 6 m a creature could stand on.
  const openness = (x: number, z: number) => {
    let n = 0, ok = 0;
    for (let a = 0; a < 12; a++) for (const r of [2, 4, 6]) { n++; if (d.dry(x + Math.cos((a / 12) * 2 * Math.PI) * r, z + Math.sin((a / 12) * 2 * Math.PI) * r)) ok++; }
    return ok / n;
  };
  // The pines: candidates on rings round the home, scored for open ground, behind (away from the
  // shore) and away from the view; the best, then the best of the rest apart from it.
  const cands: { x: number; z: number; a: number; score: number }[] = [];
  for (let r = PINE.ring[0]; r <= PINE.ring[1]; r += 1.5) for (let k = 0; k < 32; k++) {
    const a = (k / 32) * 2 * Math.PI, dx = Math.cos(a), dz = Math.sin(a), x = H.x + dx * r, z = H.z + dz * r;
    if (!clear(x, z) || slope(x, z) > PINE.slope || offWay(x, z) < PINE.offWay) continue;
    const toView = dx * vx + dz * vz, toShore = dx * ux + dz * uz;
    if (toView > 0.3) continue; // never between it and the eye
    cands.push({ x, z, a, score: openness(x, z) - 0.5 * toShore - 0.4 * toView - 0.03 * r });
  }
  cands.sort((p, q) => q.score - p.score);
  const pines: Corner['pines'] = [];
  const bearing = (x: number, z: number) => Math.atan2(z - H.z, x - H.x);
  for (const c of cands) {
    const tooNear = pines.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < PINE.apart || Math.abs(Math.atan2(Math.sin(bearing(p.x, p.z) - c.a), Math.cos(bearing(p.x, p.z) - c.a))) < PINE.turn);
    if (tooNear) continue;
    pines.push({ x: c.x, z: c.z, height: PINE.heights[pines.length], facing: Math.atan2(H.z - c.z, H.x - c.x), variant: pines.length });
    if (pines.length === PINE.heights.length) break;
  }
  // The watching stone: along the shore from the stand, toward the view's side, on level ground,
  // off the way from the shore to any of its homes (people's place, not in its path: with the
  // island's layout turned, a stone 6 m along the shore came to stand on the way).
  const offAll = (x: number, z: number) => Math.min(...d.sites.homes.map((h) => {
    const lx = D.x - h.x, lz = D.z - h.z, l = Math.hypot(lx, lz) || 1;
    const t = Math.min(Math.max(((x - h.x) * lx + (z - h.z) * lz) / (l * l), 0), 1);
    return Math.hypot(x - h.x - lx * t, z - h.z - lz * t);
  }));
  const level = (x: number, z: number) => {
    const hs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => d.groundAt(x + a * STONE.half[0], z + b * STONE.half[0]));
    return Math.max(...hs) - Math.min(...hs) < STONE.flat;
  };
  let stone: Corner['stone'] = { x: D.x + vx * STONE.off, z: D.z + vz * STONE.off, half: STONE.half, facing: D.facing };
  search: for (let r = 0; r <= 8; r += 0.5) for (let a = 0; a < 16; a++) {
    const x = D.x - ux * 1.5 + vx * STONE.off + Math.cos((a / 16) * 2 * Math.PI) * r, z = D.z - uz * 1.5 + vz * STONE.off + Math.sin((a / 16) * 2 * Math.PI) * r;
    if (clear(x, z) && level(x, z) && offAll(x, z) >= STONE.offWay) { stone = { x, z, half: STONE.half, facing: D.facing }; break search; }
  }
  // The views.
  const mx = (H.x + D.x) / 2, mz = (H.z + D.z) / 2, away = Math.max(L * 0.8, 16);
  const cx = mx + vx * away - ux * away * 0.15, cz = mz + vz * away - uz * away * 0.15;
  const hy = d.groundAt(H.x, H.z);
  // The home's middle view: from the view's side and a little ahead of the home, looking at it
  // with the pines behind it, the way leaving toward the eye's side; close enough
  // that the creature is a figure, not a speck.
  // (At a standing person's height and further off: from 4.5 m up, close, the pines were trunks
  // only, their crowns out of the frame.)
  const hx = H.x + vx * 13 + ux * 5, hz = H.z + vz * 13 + uz * 5;
  const kx = H.x + vx * 2.6 - ux * 0.6, kz = H.z + vz * 2.6 - uz * 0.6;
  return {
    pines, stone,
    view: { from: [cx, d.groundAt(cx, cz) + away * 0.6, cz], to: [mx, d.groundAt(mx, mz), mz] },
    homeView: { from: [hx, d.groundAt(hx, hz) + 3.2, hz], to: [H.x - vx * 3, hy + 1.6, H.z - vz * 3] },
    closeView: { from: [kx, d.groundAt(kx, kz) + 1.6, kz], to: [H.x - vx * 0.4, hy, H.z - vz * 0.4] },
    axes: { forward: [ux, uz], view: [vx, vz] },
  };
}

/** Temporarily hide stele + watch base in the live scene (assets kept for atlas). */
export const SHOW_WATCH_STELE = false;

/** The corner's obstacles, for the creature's ways (dwelling.ts DwellWorld.obstacles). */
export function cornerObstacles(c: Corner) {
  // Pines always block. Stone/stele footprint only while the watch seat is shown — when hidden,
  // drop the obstacle so routes are not blocked by invisible geometry (assets stay in atlas).
  const pines = c.pines.map((p) => ({ x: p.x, z: p.z, r: PINE.trunk + 0.9 }));
  if (!SHOW_WATCH_STELE) return pines;
  return [
    ...pines,
    { x: c.stone.x, z: c.stone.z, r: Math.hypot(...c.stone.half) + 0.55 },
  ];
}

/** Penglai's pine material in Wonderland's own colours (restrained grey-green, grey-brown). */
export function createIslandPineMaterial(uniforms: WorldUniforms) {
  const m = createPineMaterial(uniforms);
  (m.uniforms.uBark.value as Color).set(PORCELAIN.pineBark);
  (m.uniforms.uNeedle.value as Color).set(PORCELAIN.pineNeedle);
  (m.uniforms.uNeedleShade.value as Color).set(PORCELAIN.pineNeedleShade);
  return m;
}

/**
 * Same view bands as the woods (`WOODS_LOD`): grown L-system up close, then the shared mid/far
 * stand-ins. Stand-in meshes are scaled to GROWN_PINE_HEIGHT so one LOD root scale fits all levels.
 */
export function CornerBlocks({ corner, uniforms, groundAt, seed }: { corner: Corner; uniforms: WorldUniforms; groundAt: (x: number, z: number) => number; seed: number }) {
  const needles = useMemo(() => createIslandPineMaterial(uniforms), [uniforms]);
  const stoneMaterial = useMemo(() => createPorcelainMaterial(uniforms), [uniforms]);
  const steleMaterial = useMemo(() => {
    const m = createPorcelainMaterial(uniforms);
    (m.uniforms.uBody.value as Color).set(STELE_TINT);
    return m;
  }, [uniforms]);
  useEffect(() => () => { needles.dispose(); stoneMaterial.dispose(); steleMaterial.dispose(); }, [needles, stoneMaterial, steleMaterial]);
  const variants = useMemo(() => {
    const mid = forestPineModel('mid');
    const far = forestPineModel('far');
    mid.scale(GROWN_PINE_HEIGHT, GROWN_PINE_HEIGHT, GROWN_PINE_HEIGHT);
    far.scale(GROWN_PINE_HEIGHT, GROWN_PINE_HEIGHT, GROWN_PINE_HEIGHT);
    const grown = corner.pines.map((p) => {
      const s = seed * 10 + 3 + p.variant;
      // Lod 0 near the home (few trees); beyond WOODS_LOD[0] the stand-ins take over.
      return pineGeometry(interpretPine(expandPine(s), s), 0, s);
    });
    return { grown, mid, far };
  }, [corner, seed]);
  useEffect(() => () => {
    variants.grown.forEach((g) => g.dispose());
    variants.mid.dispose();
    variants.far.dispose();
  }, [variants]);
  const trees = useMemo(() => {
    const root = new Group();
    const [near, mid] = WOODS_LOD;
    corner.pines.forEach((p, k) => {
      const tree = new LOD();
      tree.addLevel(new Mesh(variants.grown[k], needles), 0);
      tree.addLevel(new Mesh(variants.mid, needles), near);
      tree.addLevel(new Mesh(variants.far, needles), mid);
      tree.position.set(p.x, groundAt(p.x, p.z) - 0.2, p.z);
      // Its reaching side (+x in its own frame) toward the home.
      tree.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -p.facing));
      tree.scale.setScalar(p.height / GROWN_PINE_HEIGHT);
      tree.userData.scaleId = 'pine';
      root.add(tree);
    });
    return root;
  }, [corner, variants, needles, groundAt]);
  // Watching base: low seat following the bank — top above max under, foot just under min (less board-like thickness).
  const { x, z, half, facing } = corner.stone;
  const c = Math.cos(facing), s = Math.sin(facing);
  const under = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => groundAt(x + c * a * half[0] - s * b * half[1], z + s * a * half[0] + c * b * half[1]));
  const top = Math.max(...under) + STONE.rise;
  const foot = Math.min(...under) - 0.12;
  const height = Math.max(top - foot, 0.22);
  const slab = useMemo(() => watchBaseGeometry(seed * 10 + 7, half, height), [half, height, seed]);
  useEffect(() => () => slab.dispose(), [slab]);
  const stele = useMemo(() => steleGeometry(seed * 10 + 41), [seed]);
  useEffect(() => () => stele.dispose(), [stele]);
  return (
    <group>
      <primitive object={trees} />
      {SHOW_WATCH_STELE && (
        <>
          <mesh geometry={slab} material={stoneMaterial} position={[x, foot, z]} rotation-y={-facing}
            userData={{ scaleKind: 'watchBase' }} />
          <mesh geometry={stele} material={steleMaterial} position={[x, top, z]} rotation-y={-facing}
            userData={{ scaleKind: 'stele' }} />
        </>
      )}
    </group>
  );
}
