import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments } from 'three';
import { WIND_DIR, type WindField } from '../../core/generators/wind';
import { createNoise2D } from '../../core/noise';
import { LAYER } from '../../core/palette';
import { createRng } from '../../core/rng';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';

/**
 * The wind layer: the island's wind field (islandWind.ts) made visible, as the flow layer shows the
 * water. Slate threads drift a few metres over the ground along the field and leave fading
 * trails: long and quick where the wind is strong (over the crests), short and slow in the lee;
 * they bend round the peaks and run down the valleys. Gusts (the same scale and drift as the
 * grass's, atmosphere.ts) pass over them as stronger bands moving downwind.
 */
const COUNT = 1400;
const TRAIL = 16; // points per thread
const SAMPLE = 0.09; // seconds between trail points (a thread spans about 1.4 s of travel)
const LIFE = 6; // seconds before a thread is born again somewhere else
const SPEED = 14; // metres a second drawn at wind 1 (a strong breeze: slower would not read from the overview)
const LIFT = 5; // metres over the ground (above the shrubs, through the crowns)

export function WindStreaks({ wind, grid, seed }: { wind: WindField; grid: HeightGrid; seed: number }) {
  const { lines, state } = useMemo(() => {
    const rng = createRng(seed + 77);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * (TRAIL - 1) * 6), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(COUNT * (TRAIL - 1) * 8), 4));
    const material = new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false });
    const lines = new LineSegments(geometry, material);
    lines.renderOrder = 20;
    lines.frustumCulled = false;
    const extent = ((grid.size - 1) / 2) * grid.texel;
    const onIsland = (x: number, z: number) => sampleGrid(grid, x, z, 3) < -2;
    const spawn = () => {
      for (let k = 0; k < 40; k++) {
        const x = (rng() * 2 - 1) * extent, z = (rng() * 2 - 1) * extent;
        if (onIsland(x, z)) return { x, z };
      }
      return { x: 0, z: 0 };
    };
    const particles = Array.from({ length: COUNT }, () => ({ ...spawn(), age: rng() * LIFE }));
    const trails = particles.map((q) => Array.from({ length: TRAIL }, () => [q.x, q.z, sampleGrid(grid, q.x, q.z) + LIFT] as [number, number, number]));
    return { lines, state: { particles, trails, spawn, onIsland, clock: 0, time: 0, gust: createNoise2D(seed + 515) } };
  }, [grid, seed]);
  useEffect(() => () => { lines.geometry.dispose(); (lines.material as LineBasicMaterial).dispose(); }, [lines]);

  // One colour (owner: two shades read as the same thing); a gust only makes the thread stronger.
  const tint = useMemo(() => new Color(LAYER.windGust), []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const pos = lines.geometry.getAttribute('position') as BufferAttribute;
    const col = lines.geometry.getAttribute('color') as BufferAttribute;
    const P = pos.array as Float32Array, C = col.array as Float32Array;
    state.clock += dt; state.time += dt;
    const record = state.clock >= SAMPLE;
    if (record) state.clock = 0;
    const [gx, gz] = WIND_DIR;
    state.particles.forEach((q, p) => {
      const [vx, vz] = wind.at(q.x, q.z);
      q.x += vx * SPEED * dt; q.z += vz * SPEED * dt; q.age += dt;
      const trail = state.trails[p];
      if (q.age > LIFE || !state.onIsland(q.x, q.z)) {
        Object.assign(q, state.spawn(), { age: 0 });
        const y = sampleGrid(grid, q.x, q.z) + LIFT;
        trail.forEach((pt) => { pt[0] = q.x; pt[1] = q.z; pt[2] = y; });
      } else if (record) {
        trail.pop();
        trail.unshift([q.x, q.z, sampleGrid(grid, q.x, q.z) + LIFT]);
      } else {
        trail[0][0] = q.x; trail[0][1] = q.z;
      }
      // A gust band drifting downwind (bright), between them a quieter thread.
      const n = state.gust(q.x * 0.012 - gx * state.time * 0.16, q.z * 0.012 - gz * state.time * 0.16);
      const gust = Math.min(Math.max((n + 0.2) / 1.1, 0), 1);
      // Born and dying softly, not popping.
      const life = Math.min(q.age / 0.6, 1, (LIFE - q.age) / 0.6);
      const a = (0.35 + 0.55 * gust) * Math.max(life, 0);
      for (let k = 0; k < TRAIL - 1; k++) {
        const o = (p * (TRAIL - 1) + k) * 6, c = (p * (TRAIL - 1) + k) * 8;
        const [ax, az, ay] = trail[k], [bx, bz, by] = trail[k + 1];
        P[o] = ax; P[o + 1] = ay; P[o + 2] = az; P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz;
        const a0 = a * (1 - k / (TRAIL - 1)), a1 = a * (1 - (k + 1) / (TRAIL - 1));
        C[c] = tint.r; C[c + 1] = tint.g; C[c + 2] = tint.b; C[c + 3] = a0;
        C[c + 4] = tint.r; C[c + 5] = tint.g; C[c + 6] = tint.b; C[c + 7] = a1;
      }
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });
  return <primitive object={lines} />;
}
