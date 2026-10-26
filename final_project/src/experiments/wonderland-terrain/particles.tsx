import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Points, PointsMaterial } from 'three';
import { createRng } from '../../core/rng';
import { lipSpeed } from '../../core/terrain/fallMesh';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';
import { sampleField } from '../../core/terrain/potentialFlow';
import type { OutletNode, PoolNode } from './terrace';
import type { Water } from './water';

/**
 * The debug view's particles: carried by the water through the whole system, so the way it goes
 * can be followed from the spring to the cloud. In a pool, by its flow field (terrace.ts); at an
 * outlet's lip, off it at the lip's own speed and down on its parabola (as its fall); into the
 * pool below, or onto the water below the terrace, then by that water's field (water.ts); over the
 * rim, down into the cloud. Each draws a dot and a short trail. Time runs CARRIED times faster
 * on the water (a pool's middle moves a few centimetres a second), FALLING times in the air (a
 * fall takes a second or two: faster, it would not be seen).
 *
 * Half are born at the spring, half anywhere on the water (so every part shows its flow).
 */
const COUNT = 900;
const TRAIL = 8; // points of each trail
const TRAIL_EVERY = 0.2; // seconds (real) between them
const CARRIED = 40;
const FALLING = 1.5;
const G = 9.81;
const OVER_RIM_FOR = 2.5; // seconds a particle is followed over the rim
const LIFE = 3000; // seconds on the water before a particle is born again (so all keep moving)
const COLOURS = { pool: [0.12, 0.35, 0.85], falling: [0.85, 0.15, 0.1], stream: [0.1, 0.55, 0.25] };

type Mode = 'pool' | 'falling' | 'stream' | 'rim';
interface Particle { mode: Mode; pool: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; to: number; age: number; trail: number[] }

export function FlowParticles({ pools, outlets, water, grid }: { pools: PoolNode[]; outlets: OutletNode[]; water: Water; grid: HeightGrid }) {
  const { lines, geometry, dots, heads } = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * (TRAIL - 1) * 6), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(COUNT * (TRAIL - 1) * 6), 3));
    const l = new LineSegments(g, new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    l.renderOrder = 20;
    l.frustumCulled = false;
    const h = new BufferGeometry();
    h.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    h.setAttribute('color', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    const d = new Points(h, new PointsMaterial({ vertexColors: true, size: 4, sizeAttenuation: false, depthTest: false }));
    d.renderOrder = 21;
    d.frustumCulled = false;
    return { lines: l, geometry: g, dots: d, heads: h };
  }, []);
  useEffect(() => () => {
    geometry.dispose(); heads.dispose();
    (lines.material as LineBasicMaterial).dispose(); (dots.material as PointsMaterial).dispose();
  }, [geometry, heads, lines, dots]);

  const sim = useMemo(() => {
    const rng = createRng(4242);
    const top = pools.reduce((a, b) => (b.id > a.id ? b : a));
    const spring = top.inflows[0];
    // Every water cell, to be born on.
    const cells: { pool: number; x: number; z: number }[] = [];
    for (const pl of pools) {
      const f = pl.field;
      for (let t = 0; t < f.nx * f.nz; t += 3) if (f.mask[t]) cells.push({ pool: pl.id, x: f.x0 + (t % f.nx) * f.step, z: f.z0 + Math.floor(t / f.nx) * f.step });
    }
    const down = water.field;
    if (down) for (let t = 0; t < down.nx * down.nz; t += 2) if (down.mask[t]) cells.push({ pool: -1, x: down.x0 + (t % down.nx) * down.step, z: down.z0 + Math.floor(t / down.nx) * down.step });
    const surface = (x: number, z: number) => (down ? sampleField(down, down.level, down.level, x, z)?.[0] ?? null : null);
    const born = (q: Particle) => {
      if (rng() < 0.5 && spring) {
        q.mode = 'pool'; q.pool = top.id;
        q.x = spring.x + (rng() - 0.5) * 4; q.z = spring.z + (rng() - 0.5) * 4; q.y = top.level;
      } else {
        const c = cells[Math.floor(rng() * cells.length)];
        q.x = c.x; q.z = c.z;
        if (c.pool >= 0) { q.mode = 'pool'; q.pool = c.pool; q.y = pools[c.pool].level; } else { q.mode = 'stream'; q.y = surface(c.x, c.z) ?? 0; }
      }
      q.age = 0;
      q.trail = Array.from({ length: TRAIL }).flatMap(() => [q.x, q.y + 0.15, q.z]);
    };
    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const q: Particle = { mode: 'pool', pool: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, to: -1, age: 0, trail: [] };
      born(q);
      return q;
    });
    // Each pool's lips: where a particle leaves it.
    const lips = pools.map((pl) => outlets.filter((o) => o.pool === pl.id));
    const offLip = (q: Particle, reach: number) => {
      for (const o of lips[q.pool]) {
        for (const lp of o.lip) {
          if (Math.hypot(lp.x - q.x, lp.z - q.z) > reach) continue;
          const v = lipSpeed(Math.max(lp.q, 1e-4));
          q.mode = 'falling'; q.x = lp.x; q.z = lp.z; q.y = lp.y;
          q.vx = lp.dx * v; q.vz = lp.dz * v; q.vy = 0; q.to = o.to;
          return true;
        }
      }
      return false;
    };
    const step = (q: Particle, dt: number) => {
      q.age += dt;
      if (q.mode === 'pool') {
        const f = pools[q.pool].field;
        const v = sampleField(f, f.vx, f.vz, q.x, q.z);
        if (offLip(q, 0.8)) return;
        if (!v) { if (!offLip(q, 3)) born(q); return; }
        q.x += v[0] * dt; q.z += v[1] * dt; q.y = pools[q.pool].level;
        if (q.age > LIFE) born(q);
      } else if (q.mode === 'falling') {
        q.vy -= G * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        const below = q.to >= 0 ? pools[q.to].level : Math.max(surface(q.x, q.z) ?? -Infinity, sampleGrid(grid, q.x, q.z));
        if (q.y <= below) {
          q.y = below;
          if (q.to >= 0) { q.mode = 'pool'; q.pool = q.to; } else { q.mode = 'stream'; }
          q.age = 0;
        }
      } else if (q.mode === 'stream') {
        const v = down ? sampleField(down, down.vx, down.vz, q.x, q.z) : null;
        const level = surface(q.x, q.z);
        if (!v || level === null || (down && !inWater(down, q.x, q.z))) {
          // At the rim: over it, into the cloud; anywhere else it has left the water: born again.
          if (sampleGrid(grid, q.x, q.z, 3) > -2) { q.mode = 'rim'; q.vx = (v?.[0] ?? 0); q.vz = (v?.[1] ?? 0); q.vy = 0; q.age = 0; } else born(q);
          return;
        }
        q.x += v[0] * dt; q.z += v[1] * dt; q.y = level;
        if (q.age > LIFE) born(q);
      } else {
        q.vy -= G * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.age > OVER_RIM_FOR) born(q);
      }
    };
    return { particles, step };
  }, [pools, outlets, water, grid]);

  const since = useRef(0);
  useFrame((_, delta) => {
    const real = Math.min(delta, 0.05), sub = 6;
    for (const q of sim.particles) {
      for (let s = 0; s < sub; s++) sim.step(q, (real / sub) * (q.mode === 'falling' || q.mode === 'rim' ? FALLING : CARRIED));
    }
    since.current += delta;
    const shift = since.current > TRAIL_EVERY;
    if (shift) since.current = 0;
    const pos = geometry.attributes.position.array as Float32Array, col = geometry.attributes.color.array as Float32Array;
    const headPos = heads.attributes.position.array as Float32Array, headCol = heads.attributes.color.array as Float32Array;
    sim.particles.forEach((q, i) => {
      const t = q.trail;
      if (shift) { t.splice(0, 3); t.push(q.x, q.y + 0.15, q.z); } else { t[t.length - 3] = q.x; t[t.length - 2] = q.y + 0.15; t[t.length - 1] = q.z; }
      const c = COLOURS[q.mode === 'rim' ? 'falling' : q.mode];
      headPos.set([q.x, q.y + 0.15, q.z], i * 3);
      headCol.set(c, i * 3);
      for (let k = 0; k + 1 < TRAIL; k++) {
        const o = (i * (TRAIL - 1) + k) * 6;
        pos.set(t.slice(k * 3, k * 3 + 6), o);
        const fade = (k + 1) / TRAIL;
        col.set([c[0] * fade + (1 - fade), c[1] * fade + (1 - fade), c[2] * fade + (1 - fade), c[0], c[1], c[2]], o);
      }
    });
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    heads.attributes.position.needsUpdate = true;
    heads.attributes.color.needsUpdate = true;
  });
  return (
    <>
      <primitive object={lines} />
      <primitive object={dots} />
    </>
  );
}

/** Whether (x, z) is on a field's water (its nearest cell). */
function inWater(f: { x0: number; z0: number; step: number; nx: number; nz: number; mask: Uint8Array }, x: number, z: number) {
  const i = Math.round((x - f.x0) / f.step), j = Math.round((z - f.z0) / f.step);
  return i >= 0 && j >= 0 && i < f.nx && j < f.nz && f.mask[j * f.nx + i] === 1;
}
