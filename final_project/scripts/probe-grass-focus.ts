/**
 * Diagnose cover focus for a fixed grass patch (seed 684).
 * Simulates: camera fixed + look rotate vs orbit move.
 * Usage: npx tsx scripts/probe-grass-focus.ts [seed] [x] [z]
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { COVER_FOCUS, resolveCoverFocus, orbitRange, cameraFoot, groundLookAt } from '../src/experiments/wonderland-terrain/coverFocus';
import { COVER_NEAR } from '../src/experiments/wonderland-terrain/CoverGrass';
import { sampleGrid } from '../src/core/terrain/heightGrid';

const seed = Number(process.argv[2] ?? 684);
const patchX = Number(process.argv[3] ?? -40);
const patchZ = Number(process.argv[4] ?? 20);
const { grid } = bakeGround({ ...GROUND_DEFAULTS, seed });
const CHUNK = COVER_NEAR.chunk;
const chunkId = `${Math.floor(patchX / CHUNK)},${Math.floor(patchZ / CHUNK)}`;
const gy = sampleGrid(grid, patchX, patchZ);

console.log('=== active params (code) ===');
console.log(JSON.stringify({
  retention: 'Orbit: camera foot XZ; Walk: cam + lookAhead',
  loadOn: COVER_FOCUS.loadOn,
  loadOff: COVER_FOCUS.loadOff,
  fadeOn: COVER_FOCUS.fadeOn,
  fadeOff: COVER_FOCUS.fadeOff,
  prefetchMax: COVER_FOCUS.prefetchMax,
  refocus: COVER_FOCUS.refocus,
  chunk: COVER_NEAR.chunk,
  chunkRing: COVER_NEAR.chunkRing,
  prefetchRing: COVER_NEAR.prefetchRing,
  chunkBudget: COVER_NEAR.chunkBudget,
  radius: COVER_NEAR.radius,
  fadeNear: COVER_NEAR.fadeNear,
  fadeFar: COVER_NEAR.fadeFar,
  cacheMax: COVER_NEAR.cacheMax,
  shaderBlade: 'discard by camDist vs fadeNear/Far × uVisibility',
}, null, 2));

console.log('\n=== fixed patch ===');
console.log({ seed, patchX, patchZ, gy: +gy.toFixed(2), chunkId });

function camAt(px: number, py: number, pz: number, lookX: number, lookY: number, lookZ: number) {
  const cam = new PerspectiveCamera(50, 1, 0.2, 5000);
  cam.position.set(px, py, pz);
  cam.lookAt(lookX, lookY, lookZ);
  cam.updateMatrixWorld();
  return cam;
}

function row(label: string, cam: PerspectiveCamera, last: { x: number; z: number; near?: boolean; lastHitAt?: number; prefetchX?: number; prefetchZ?: number }) {
  const r = resolveCoverFocus(grid, cam, 'orbit', last, performance.now());
  const foot = cameraFoot(grid, cam);
  const look = groundLookAt(grid, cam);
  const patchDist = Math.hypot(patchX - cam.position.x, patchZ - cam.position.z);
  const inRetention = Math.hypot(patchX - r.x, patchZ - r.z) <= COVER_NEAR.radius;
  const loaded = r.near && inRetention;
  const bladeFade = patchDist <= COVER_NEAR.fadeNear ? 1
    : patchDist >= COVER_NEAR.fadeFar ? 0
    : 1 - (patchDist - COVER_NEAR.fadeNear) / (COVER_NEAR.fadeFar - COVER_NEAR.fadeNear);
  const reason = !r.near
    ? `卸载路径：cam→foot=${r.hitDist.toFixed(1)} > load band（或尚未进入）`
    : !inRetention
      ? `保留圆盘外：距保留中心 ${Math.hypot(patchX - r.x, patchZ - r.z).toFixed(1)} m > radius ${COVER_NEAR.radius}`
      : r.visibility < 0.05
        ? `全局透明淡出：uVisibility≈${r.visibility.toFixed(2)}（cam→foot）`
        : bladeFade < 0.05
          ? `叶渐隐：cam→叶 ${patchDist.toFixed(1)} m ≥ fadeFar`
          : '应可见（非卸载／非圆盘外；背面需目视）';
  return {
    label,
    cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
    foot: foot ? [+foot.x.toFixed(1), +foot.z.toFixed(1)] : null,
    look: look ? [+look.x.toFixed(1), +look.z.toFixed(1)] : null,
    retention: [+r.x.toFixed(1), +r.z.toFixed(1)],
    near: r.near,
    visibility: +r.visibility.toFixed(3),
    hitDist: +r.hitDist.toFixed(1),
    lookDist: +r.lookDist.toFixed(1),
    source: r.source,
    hasPrefetch: r.hasPrefetch,
    patchDist: +patchDist.toFixed(1),
    inRetentionDisc: inRetention,
    wouldShowInstances: loaded,
    bladeKeepApprox: +bladeFade.toFixed(2),
    reason,
  };
}

const nearCamY = gy + 2.2;
const base = camAt(patchX - 8, nearCamY, patchZ + 6, patchX, gy + 0.3, patchZ);
const last0 = { x: patchX, z: patchZ, near: true, lastHitAt: performance.now() };

const cases = [
  row('A 看脚下草', base, last0),
  row('B 同机位抬头望天', camAt(patchX - 8, nearCamY, patchZ + 6, patchX - 8, nearCamY + 40, patchZ + 6), last0),
  row('C 同机位平视远山', camAt(patchX - 8, nearCamY, patchZ + 6, patchX + 120, gy + 30, patchZ - 80), last0),
  row('D 同机位低头再看草', camAt(patchX - 8, nearCamY, patchZ + 6, patchX, gy, patchZ), {
    ...last0, lastHitAt: performance.now() - 200,
  }),
  row('E Orbit 拉远', camAt(patchX - 80, gy + 55, patchZ + 70, patchX, gy, patchZ), last0),
];

console.log('\n=== scenarios ===');
console.table(cases.map(({ label, near, visibility, hitDist, lookDist, source, wouldShowInstances, patchDist, reason }) => ({
  label, near, vis: visibility, hitDist, lookDist, source, show: wouldShowInstances, patchDist, reason,
})));

console.log(JSON.stringify({
  plainZh: 'Orbit 保留中心=相机脚下；只转视线不应改变 near／不应卸载近草。全局渐隐跟 cam→foot，不跟 look-hit。',
  patch: { x: patchX, z: patchZ, chunkId },
}, null, 2));
