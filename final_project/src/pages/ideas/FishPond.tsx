import { useEffect, useRef } from 'react';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { createRng } from '../../core/rng';
import { SCHOOL_DEFAULT, schoolPull, type Swimmer } from '../../experiments/wonderland-terrain/schoolRules';

/**
 * The streamlings' own school rule (schoolRules.ts), running live on nine fish in a round pool,
 * seen from above. The view drifts with the school over a pebbled floor (so the swimming reads),
 * each fish drawn as the island's: a white body with a jade patch, a beating tail. The red one
 * leads; its three rings are how far each rule reaches (in its body lengths).
 */
const R = 6; // the pool's radius, metres
const L = 0.5; // a fish's length, metres
const VIEW = 5; // metres across the panel

/** The ink colour at an opacity (shadows and outlines). */
const ink = (a: number) => `rgba(${[1, 3, 5].map((o) => parseInt(JADE_UI.ink.slice(o, o + 2), 16)).join(',')},${a})`;

interface Fish extends Swimmer { phase: number; mark: number }

export function FishPond() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const rand = createRng(684);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fish: Fish[] = Array.from({ length: 9 }, () => ({ x: (rand() - 0.5) * 2, z: (rand() - 0.5) * 2, heading: rand() * Math.PI * 2, length: L, phase: rand() * 6, mark: rand() }));
    const pebbles = Array.from({ length: 260 }, () => {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * R;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.03 + rand() * 0.07, a: rand() * 3 };
    });
    let frame = 0, last = performance.now(), t = 0, cx = 0, cz = 0;
    const draw = (now: number) => {
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // Where the school is heading: a slow loop round the pool.
      const gx = Math.cos(t * 0.12) * R * 0.5, gz = Math.sin(t * 0.17) * R * 0.45;
      for (const f of fish) {
        const pull = schoolPull(f, fish, SCHOOL_DEFAULT);
        let want = f === fish[0] ? Math.atan2(gz - f.z, gx - f.x) : f.heading;
        if (pull.dir) { const w = pull.repelled ? 2.5 : 1; want = Math.atan2(Math.sin(want) * 0.5 + pull.dir[1] * w, Math.cos(want) * 0.5 + pull.dir[0] * w); }
        if (Math.hypot(f.x, f.z) > R * 0.85) want = Math.atan2(-f.z, -f.x);
        const d = Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading));
        f.heading += Math.max(-dt * 1.8, Math.min(dt * 1.8, d));
        const speed = 0.55 + 0.15 * Math.sin(t * 1.3 + f.phase);
        f.x += Math.cos(f.heading) * speed * dt; f.z += Math.sin(f.heading) * speed * dt;
      }
      const mx = fish.reduce((s, f) => s + f.x, 0) / fish.length, mz = fish.reduce((s, f) => s + f.z, 0) / fish.length;
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 1.5);
      cx += (mx - cx) * ease; cz += (mz - cz) * ease;

      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (!w || !h) { frame = requestAnimationFrame(draw); return; }
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = w / VIEW, X = (x: number) => w / 2 + (x - cx) * k, Y = (z: number) => h / 2 + (z - cz) * k;

      // Stone around, water inside: milky jade, deeper towards the middle.
      ctx.fillStyle = PORCELAIN.rockFace; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), R * k);
      g.addColorStop(0, PORCELAIN.waterDeep); g.addColorStop(0.75, PORCELAIN.water); g.addColorStop(1, PORCELAIN.waterTint);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(0), Y(0), R * k, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.globalAlpha = 0.09; ctx.fillStyle = JADE_UI.paper;
      for (const p of pebbles) { ctx.beginPath(); ctx.ellipse(X(p.x), Y(p.z), p.s * k, p.s * k * 0.7, p.a, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.restore();

      // The lead's three rings (dashed, labelled by colour in the legend beside).
      const lead = fish[0];
      for (const [r, col] of [[SCHOOL_DEFAULT.attract, JADE_UI.jade], [SCHOOL_DEFAULT.align, JADE_UI.jadeDeep], [SCHOOL_DEFAULT.repel, JADE_UI.seal]] as const) {
        ctx.beginPath(); ctx.arc(X(lead.x), Y(lead.z), r * L * k, 0, Math.PI * 2);
        ctx.setLineDash([4, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
      }

      // Each fish: a soft shadow on the floor, a tapered white body, a jade patch, a beating tail.
      for (const f of fish) {
        const s = L * k, beat = Math.sin(t * 9 + f.phase) * 0.35;
        ctx.save(); ctx.translate(X(f.x), Y(f.z)); ctx.rotate(f.heading);
        ctx.fillStyle = ink(0.16);
        ctx.beginPath(); ctx.ellipse(-s * 0.05 + 4, 5, s * 0.45, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
        // Tail.
        ctx.save(); ctx.translate(-s * 0.36, 0); ctx.rotate(beat);
        ctx.fillStyle = PORCELAIN.fishFin;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.12, -s * 0.05, -s * 0.2, -s * 0.13); ctx.lineTo(-s * 0.14, 0); ctx.lineTo(-s * 0.2, s * 0.13); ctx.quadraticCurveTo(-s * 0.12, s * 0.05, 0, 0); ctx.fill();
        ctx.restore();
        // Body.
        ctx.fillStyle = f === lead ? JADE_UI.seal : PORCELAIN.fishBody;
        ctx.strokeStyle = ink(0.35); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(s * 0.5, 0);
        ctx.bezierCurveTo(s * 0.42, -s * 0.13, s * 0.05, -s * 0.15, -s * 0.38, -s * 0.03);
        ctx.lineTo(-s * 0.38, s * 0.03);
        ctx.bezierCurveTo(s * 0.05, s * 0.15, s * 0.42, s * 0.13, s * 0.5, 0);
        ctx.fill(); ctx.stroke();
        if (f !== lead) { ctx.fillStyle = PORCELAIN.fishMark; ctx.beginPath(); ctx.ellipse(s * (0.05 + f.mark * 0.15), (f.mark - 0.5) * s * 0.06, s * 0.1, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = PORCELAIN.fishEye;
        ctx.beginPath(); ctx.arc(s * 0.36, -s * 0.05, 1.2, 0, Math.PI * 2); ctx.arc(s * 0.36, s * 0.05, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvas} className="ideas-school" aria-hidden="true" />;
}
