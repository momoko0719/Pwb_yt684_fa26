import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments } from 'three';
import type { IslandField } from '../../core/generators/island';
import type { WindField } from '../../core/generators/wind';
import { WIND_STREAK } from '../../core/palette';
import type { IslandParams } from '../../core/params/island';
import { createRng } from '../../core/rng';

const COUNT = 900;
const TRAIL = 14; // points per streak
const SAMPLE = 0.05; // seconds between trail points, so a streak spans about 0.7 s of travel
const LIFE = 4; // seconds before a streak is reborn somewhere else
const SPEED = 5; // world units per second at wind 1, on a radius-31 island
const LIFT = 1.4; // height above the ground, on a radius-31 island

/**
 * The wind field made visible (Class 06): particles drift over the island along the field and leave
 * short fading streaks. Every frame each one reads the field where it is and moves.
 */
export default function WindTrails({ field, island, wind, strength }: { field: IslandField; island: IslandParams; wind: WindField; strength: number }) {
  const s = island.radius / 31;
  const { lines, state } = useMemo(() => {
    const rng = createRng(island.seed + 77);
    const geometry = new BufferGeometry();
    const positions = new Float32Array(COUNT * (TRAIL - 1) * 2 * 3);
    const colors = new Float32Array(COUNT * (TRAIL - 1) * 2 * 4);
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 4));
    const material = new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    const lines = new LineSegments(geometry, material);
    lines.frustumCulled = false;
    const color = new Color(WIND_STREAK);
    // Fade from the head (opaque) to the tail (clear); the colour never changes, only alpha.
    for (let p = 0; p < COUNT; p++) {
      for (let k = 0; k < TRAIL - 1; k++) {
        for (let e = 0; e < 2; e++) {
          const o = ((p * (TRAIL - 1) + k) * 2 + e) * 4;
          colors.set([color.r, color.g, color.b, 0.95 * (1 - (k + e) / (TRAIL - 1))], o);
        }
      }
    }
    const spawn = () => {
      const angle = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * field.rim(angle) * 0.98;
      return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, age: rng() * LIFE };
    };
    const particles = Array.from({ length: COUNT }, spawn);
    // Each trail point keeps its height, so the ground is sampled once per point, not every frame.
    const trails = particles.map((q) => Array.from({ length: TRAIL }, () => [q.x, q.z, 0] as [number, number, number]));
    return { lines, state: { particles, trails, spawn, clock: 0 } };
  }, [field, island.seed]);
  useEffect(() => () => {
    lines.geometry.dispose();
    (lines.material as LineBasicMaterial).dispose();
  }, [lines]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const pos = lines.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    const groundY = (x: number, z: number) => (field.top(x, z) ?? field.rimY) + LIFT * s;
    state.clock += dt;
    const record = state.clock >= SAMPLE;
    if (record) state.clock = 0;
    state.particles.forEach((q, p) => {
      const [vx, vz] = wind.at(q.x, q.z);
      q.x += vx * SPEED * s * (0.3 + strength) * dt;
      q.z += vz * SPEED * s * (0.3 + strength) * dt;
      q.age += dt;
      const trail = state.trails[p];
      const off = Math.hypot(q.x, q.z) > field.rim(Math.atan2(q.z, q.x)) * 1.05;
      if (q.age > LIFE || off) {
        Object.assign(q, state.spawn(), { age: 0 });
        const y = groundY(q.x, q.z);
        trail.forEach((pt) => { pt[0] = q.x; pt[1] = q.z; pt[2] = y; });
      } else if (record) {
        trail.pop();
        trail.unshift([q.x, q.z, groundY(q.x, q.z)]);
      } else {
        trail[0][0] = q.x; // the head follows the particle between samples, at the last height
        trail[0][1] = q.z;
      }
      for (let k = 0; k < TRAIL - 1; k++) {
        const o = (p * (TRAIL - 1) + k) * 6;
        const [ax, az, ay] = trail[k], [bx, bz, by] = trail[k + 1];
        arr[o] = ax; arr[o + 1] = ay; arr[o + 2] = az;
        arr[o + 3] = bx; arr[o + 4] = by; arr[o + 5] = bz;
      }
    });
    pos.needsUpdate = true;
  });

  return <primitive object={lines} />;
}
