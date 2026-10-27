/**
 * Measure Wonderland walk steady speed on flat dry ground (seed 684).
 * Run: npx tsx scripts/probe-walk-speed.ts
 */
import { bakeGround, groundRules, GROUND_DEFAULTS } from '../src/experiments/wonderland-terrain/ground';
import { SEED } from '../src/experiments/wonderland-terrain/layout';
import { buildTerrace, TERRACE_DEFAULTS } from '../src/experiments/wonderland-terrain/terrace';
import { buildWater, WATER_DEFAULTS } from '../src/experiments/wonderland-terrain/water';
import { buildZones } from '../src/experiments/wonderland-terrain/zones';
import {
  spawnWonderWalker, stepWonderWalker, WONDER_BROWSE, wonderFeetAt,
} from '../src/experiments/wonderland-terrain/wonderlandWalk';

const seed = Number(process.argv[2] ?? SEED);
const params = { ...GROUND_DEFAULTS, seed };
const { grid } = bakeGround(params);
const rules = groundRules(params);
const terrace = buildTerrace(rules, grid, TERRACE_DEFAULTS, WATER_DEFAULTS.flow);
const water = buildWater(rules, grid, terrace, WATER_DEFAULTS, seed);
const zones = buildZones(grid, water, rules.plate(0), seed);
const world = { grid, water, terrace: rules.plate(0), seed, zones };

const { walker: start, heading } = spawnWonderWalker(world, zones);
const dt = 1 / 60;
const measure = (label: string, speed: number, run: boolean, seconds: number) => {
  let w = { ...start, vx: 0, vz: 0 };
  const input = { forward: 1, strafe: 0, run, heading };
  // Startup window
  for (let i = 0; i < Math.round(0.5 / dt); i++) w = stepWonderWalker(world, w, input, speed, dt);
  const x0 = w.x, z0 = w.z, t0 = 0;
  let t = 0;
  while (t < seconds) {
    w = stepWonderWalker(world, w, input, speed, dt);
    t += dt;
  }
  const dist = Math.hypot(w.x - x0, w.z - z0);
  // Stop test
  let stop = { ...w };
  const none = { forward: 0, strafe: 0, run: false, heading };
  let stopT = 0;
  while (Math.hypot(stop.vx, stop.vz) > 0.05 && stopT < 2) {
    stop = stepWonderWalker(world, stop, none, speed, dt);
    stopT += dt;
  }
  // Diagonal should not exceed axis speed
  let d = { ...start, vx: 0, vz: 0 };
  const diag = { forward: 1, strafe: 1, run, heading };
  for (let i = 0; i < Math.round(1.5 / dt); i++) d = stepWonderWalker(world, d, diag, speed, dt);
  const diagSpeed = Math.hypot(d.vx, d.vz);
  return {
    label, set_m_s: run ? WONDER_BROWSE.run : speed,
    steady_m_s: +(dist / seconds).toFixed(3),
    dist_m: +dist.toFixed(2), time_s: seconds,
    stop_s: +stopT.toFixed(3),
    diag_speed_m_s: +diagSpeed.toFixed(3),
    spawn: { x: +start.x.toFixed(1), z: +start.z.toFixed(1), feet: wonderFeetAt(world, start.x, start.z) },
    dt, fps: 1 / dt,
  };
};

const out = {
  seed,
  defaults: WONDER_BROWSE,
  note: 'Steady speed after 0.5 s accel; stop time from release to |v|<0.05',
  rows: [
    measure('browse', WONDER_BROWSE.browse, false, 2),
    measure('walk', WONDER_BROWSE.walk, false, 2),
    measure('run', WONDER_BROWSE.browse, true, 2),
    // Low fps delta cap check
    (() => {
      const speed = WONDER_BROWSE.browse;
      let w = { ...start, vx: 0, vz: 0 };
      const input = { forward: 1, strafe: 0, run: false, heading };
      const slowDt = 0.05;
      for (let i = 0; i < 10; i++) w = stepWonderWalker(world, w, input, speed, slowDt);
      const x0 = w.x, z0 = w.z;
      for (let i = 0; i < 20; i++) w = stepWonderWalker(world, w, input, speed, slowDt);
      return { label: 'browse@20fps_cap', set_m_s: speed, steady_m_s: +(Math.hypot(w.x - x0, w.z - z0) / 1).toFixed(3), dt: slowDt };
    })(),
  ],
};
console.log(JSON.stringify(out, null, 2));
