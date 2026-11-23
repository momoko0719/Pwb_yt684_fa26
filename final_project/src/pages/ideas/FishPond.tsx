import { useEffect, useRef } from 'react';
import { JADE_UI } from '../../core/palette';
import { createRng } from '../../core/rng';
import { SCHOOL_DEFAULT, schoolPull, type Swimmer } from '../../experiments/wonderland-terrain/schoolRules';
import { SCARE } from '../../experiments/wonderland-terrain/streamFish';
import { inkDweller, inkFish, ripples, tint, washPool } from './dweller';

/**
 * The streamlings' own school rule (schoolRules.ts), running live on nine fish in a round pool,
 * seen from above as an ink-wash sketch (dweller.ts): each fish a single jade stroke with a flicking
 * tail. The red one leads; its three rings are how far each rule reaches (in its body lengths).
 *
 * Now and then a dweller comes down to drink (the island's rule, streamFish.ts SCARE): every fish
 * within its reach darts away, keeps clear while its fear lasts, then the school's rules bring it back.
 */
const R = 3.5; // the pool's radius, metres
const L = 0.5; // a fish's length, metres
const VIEW = 2 * R + 4; // metres across: the pool and the rim the dweller drinks at
/** A dweller's visit, seconds: walking in, drinking, walking off, away. */
const VISIT = { in: 4, drink: 6, out: 4, away: 6 };
const DWELLER = 1.5; // its body length, metres

interface Fish extends Swimmer { phase: number; mark: number; fear: number }

export function FishPond() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const rand = createRng(684);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fish: Fish[] = Array.from({ length: 9 }, () => ({ x: (rand() - 0.5) * 2, z: (rand() - 0.5) * 2, heading: rand() * Math.PI * 2, length: L, phase: rand() * 6, mark: rand(), fear: 0 }));
    let frame = 0, last = performance.now(), t = 0;
    let visitAt = 6, side = 0; // when the next visit starts, and where on the rim it drinks
    const draw = (now: number) => {
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // Where the school is heading: a slow loop round the pool.
      const gx = Math.cos(t * 0.12) * R * 0.5, gz = Math.sin(t * 0.17) * R * 0.45;
      // The dweller's visit: in from beyond the rim on the school's side, drink, then off again.
      const period = VISIT.in + VISIT.drink + VISIT.out + VISIT.away;
      if (t >= visitAt + period) visitAt += period;
      const v = t - visitAt;
      // It comes down at the rim nearest the school (so the school is within its reach).
      if (v >= 0 && v < VISIT.in * 0.5) { const sx = fish.reduce((a, f) => a + f.x, 0), sz = fish.reduce((a, f) => a + f.z, 0); side = Math.atan2(sz, sx); }
      const ux = Math.cos(side), uz = Math.sin(side);
      const reach = (k: number) => R + DWELLER * 0.62 + k * 5; // the body's middle, its muzzle at the water's edge when k = 0
      let dweller: { x: number; z: number; dist: number; step: number; dip: number; drinking: boolean } | null = null;
      if (v >= 0 && v < VISIT.in) dweller = { x: 0, z: 0, dist: reach(1 - v / VISIT.in), step: v * 7, dip: 0, drinking: false };
      else if (v >= VISIT.in && v < VISIT.in + VISIT.drink) dweller = { x: 0, z: 0, dist: reach(0), step: 0, dip: 1, drinking: true };
      else if (v >= VISIT.in + VISIT.drink && v < VISIT.in + VISIT.drink + VISIT.out) { const o = v - VISIT.in - VISIT.drink; dweller = { x: 0, z: 0, dist: reach(o / VISIT.out), step: o * 7, dip: 0, drinking: false }; }
      if (dweller) { dweller.x = ux * dweller.dist; dweller.z = uz * dweller.dist; }
      const muzzle = dweller && { x: ux * (dweller.dist - DWELLER * 0.62), z: uz * (dweller.dist - DWELLER * 0.62) };
      for (const f of fish) {
        // Frightened: within reach of a dweller at the water (drinking or close by).
        if (muzzle && dweller!.dist < reach(0.3) && Math.hypot(f.x - muzzle.x, f.z - muzzle.z) < SCARE.radius) f.fear = 1;
        f.fear = Math.max(0, f.fear - dt / SCARE.calm);
        const pull = schoolPull(f, fish, SCHOOL_DEFAULT);
        let want = f === fish[0] ? Math.atan2(gz - f.z, gx - f.x) : f.heading;
        if (pull.dir) { const w = pull.repelled ? 2.5 : 1; want = Math.atan2(Math.sin(want) * 0.5 + pull.dir[1] * w, Math.cos(want) * 0.5 + pull.dir[0] * w); }
        if (f.fear > 0 && muzzle && Math.hypot(f.x - muzzle.x, f.z - muzzle.z) < SCARE.radius * SCARE.keep) want = Math.atan2(f.z - muzzle.z, f.x - muzzle.x);
        if (Math.hypot(f.x, f.z) > R * 0.85) want = Math.atan2(-f.z, -f.x);
        const d = Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading));
        const turn = f.fear > 0.6 ? 5 : 1.8;
        f.heading += Math.max(-dt * turn, Math.min(dt * turn, d));
        // The dart: up to SCARE.burst times its cruise at the start of the fright, easing back.
        const speed = (0.55 + 0.15 * Math.sin(t * 1.3 + f.phase)) * (1 + (SCARE.burst - 1) * f.fear ** 4);
        f.x += Math.cos(f.heading) * speed * dt; f.z += Math.sin(f.heading) * speed * dt;
        // The pool's wall: a darting fish slides along it rather than out of the water.
        const r = Math.hypot(f.x, f.z), wall = R - L * 0.6;
        if (r > wall) { f.x *= wall / r; f.z *= wall / r; }
      }

      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (!w || !h) { frame = requestAnimationFrame(draw); return; }
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The whole pool and its rim in view (the dweller drinks at the rim; the school crosses to the far side).
      const k = Math.min(w / VIEW, h / (2 * R + DWELLER * 2.4)), X = (x: number) => w / 2 + x * k, Y = (z: number) => h / 2 + z * k;

      // Paper around, the pool an ink-wash sketch: mist, jade deepening inward, a brushed rim.
      ctx.fillStyle = JADE_UI.paper; ctx.fillRect(0, 0, w, h);
      washPool(ctx, X(0), Y(0), R * k, R * k);

      // The lead's three rings (dashed, labelled by colour in the legend beside).
      const lead = fish[0];
      for (const [r, col] of [[SCHOOL_DEFAULT.attract, JADE_UI.jade], [SCHOOL_DEFAULT.align, JADE_UI.jadeDeep], [SCHOOL_DEFAULT.repel, JADE_UI.seal]] as const) {
        ctx.beginPath(); ctx.arc(X(lead.x), Y(lead.z), r * L * k, 0, Math.PI * 2);
        ctx.setLineDash([3, 5]); ctx.strokeStyle = tint(col, 0.5); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      }

      // The dweller, and ripples spreading from its muzzle while it drinks (its reach a faint dashed ring).
      if (dweller && muzzle) {
        if (dweller.drinking) {
          ctx.beginPath(); ctx.arc(X(muzzle.x), Y(muzzle.z), SCARE.radius * k, 0, Math.PI * 2);
          ctx.setLineDash([2, 5]); ctx.strokeStyle = tint(JADE_UI.ink, 0.18); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
          ripples(ctx, X(muzzle.x), Y(muzzle.z), side + Math.PI, 1.4 * k, t);
        }
        const leaving = v > VISIT.in + VISIT.drink;
        inkDweller(ctx, X(dweller.x), Y(dweller.z), leaving ? side : side + Math.PI, Math.max(34, DWELLER * k * 1.3), dweller.step, dweller.dip);
      }

      // Each fish: one tapered stroke and a flicking tail; the leader in seal red.
      for (const f of fish) inkFish(ctx, X(f.x), Y(f.z), f.heading, Math.max(14, L * k * 1.6), t * 9 + f.phase, f === lead);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvas} className="ideas-school" aria-hidden="true" />;
}
