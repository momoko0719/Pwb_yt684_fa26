/**
 * Diagnose Orbit vs Walk cover focus (seed 684).
 * Run: npx tsx scripts/probe-cover-focus.ts
 */
import { Vector3, PerspectiveCamera } from 'three';
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { buildCover, COVER_DEFAULTS, coverFieldStats } from '../src/experiments/wonderland-terrain/cover';
import { COVER_FOCUS, groundLookAt, resolveCoverFocus } from '../src/experiments/wonderland-terrain/coverFocus';
import { buildSites, COVER_NEAR } from '../src/experiments/wonderland-terrain/CoverGrass';
import { SEED } from '../src/experiments/wonderland-terrain/layout';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones, zoneAt, ZONE, ZONE_NAMES } from '../src/experiments/wonderland-terrain/zones';

const seed = Number(process.argv[2] ?? SEED);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const cover = buildCover(zones, grid, seed, COVER_DEFAULTS.amount);

function camAt(pos: [number, number, number], look: [number, number, number]) {
  const c = new PerspectiveCamera(40, 1, 0.5, 5000);
  c.position.set(...pos);
  c.lookAt(...look);
  c.updateMatrixWorld(true);
  return c;
}

function summarize(label: string, mode: 'walk' | 'orbit', camera: PerspectiveCamera, last = { x: NaN, z: NaN }) {
  const oldWalk = (x: number, z: number, look: Vector3) => {
    const flat = Math.hypot(look.x, look.z) || 1;
    return {
      x: x + (look.x / flat) * COVER_FOCUS.walkLookAhead,
      z: z + (look.z / flat) * COVER_FOCUS.walkLookAhead,
    };
  };
  const look = new Vector3();
  camera.getWorldDirection(look);
  const legacy = oldWalk(camera.position.x, camera.position.z, look);
  const hit = groundLookAt(grid, camera);
  const resolved = resolveCoverFocus(grid, camera, mode, last);
  const built = resolved.near
    ? buildSites(cover, grid, seed, resolved.x, resolved.z, null, COVER_DEFAULTS.amount)
    : null;
  const zk = zoneAt(zones, resolved.x, resolved.z);
  return {
    label,
    mode,
    camera: { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) },
    legacyFocus: { x: +legacy.x.toFixed(1), z: +legacy.z.toFixed(1), zone: ZONE_NAMES[zoneAt(zones, legacy.x, legacy.z)] ?? '?' },
    rayHit: hit && { x: +hit.x.toFixed(1), z: +hit.z.toFixed(1), y: +hit.y.toFixed(2) },
    resolved: {
      x: +resolved.x.toFixed(1),
      z: +resolved.z.toFixed(1),
      near: resolved.near,
      visibility: +resolved.visibility.toFixed(3),
      hitDist: Number.isFinite(resolved.hitDist) ? +resolved.hitDist.toFixed(1) : null,
      source: resolved.source,
      zone: ZONE_NAMES[zk] ?? zk,
    },
    disc: built
      ? { clumps: built.stats.grassClumps, blades: built.stats.grassBlades, flowers: built.stats.flowerClumps }
      : { clumps: 0, blades: 0, flowers: 0, note: 'near blades off (far / miss / outside load band)' },
  };
}

const overview = camAt([-430, 300, 380], [-20, 10, 0]);
const midWet = camAt([-90, 18, -120], [-111, 2.5, -143]);
const nearWet = camAt([-105, 5.9, -148], [-111, 2.8, -143]);
const walkish = camAt([-100, 4.0, -140], [-111, 2.5, -143]);

// Hold test: miss then hold last wet focus
const sky = camAt([-430, 400, 380], [-430, 400, 500]);
const afterHold = resolveCoverFocus(grid, sky, 'orbit', { x: -111, z: -143 });

console.log(JSON.stringify({
  seed,
  constants: COVER_FOCUS,
  nearRadius: COVER_NEAR.radius,
  island: coverFieldStats(cover),
  cases: [
    summarize('overview_orbit', 'orbit', overview),
    summarize('mid_wet_orbit', 'orbit', midWet),
    summarize('near_wet_orbit', 'orbit', nearWet),
    summarize('walk_near_wet', 'walk', walkish),
  ],
  holdAfterSkyMiss: {
    ...afterHold,
    x: +afterHold.x.toFixed(1),
    z: +afterHold.z.toFixed(1),
    expect: 'source=hold, near depends on distance to held wet point',
  },
}, null, 2));
