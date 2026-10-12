import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { RES } from './lib/pipeline';

export const PAPER = '#efe8d8';
const SIZE = 40; // world units across
const UNDER = 13; // depth of the hanging rock under the island
const COAST = 0.12; // the mask value where the land is cut off

// Blue-green painting: ochre at the foot, malachite in the middle, azurite on the summits.
const TOP_STOPS: [number, string][] = [
  [0.0, '#d6bf94'],
  [0.05, '#c9b27e'],
  [0.14, '#5e9452'],
  [0.5, '#3f8a5e'],
  [0.68, '#258272'],
  [0.86, '#3a74a8'],
  [1.0, '#c8dcea'],
];
const ROCK = new Color('#a39070');
const UNDER_TOP = new Color('#c4a078');
const UNDER_TIP = new Color('#4a4440');

function ramp(t: number, out: Color) {
  for (let i = 0; i < TOP_STOPS.length - 1; i++) {
    const [a, ca] = TOP_STOPS[i];
    const [b, cb] = TOP_STOPS[i + 1];
    if (t <= b) return out.set(ca).lerp(new Color(cb), (t - a) / (b - a));
  }
  return out.set(TOP_STOPS[TOP_STOPS.length - 1][1]);
}

/** One grid → two surfaces: the land on top and the rock hanging below; only cells inside the coast are kept. */
function buildGeometry(height: Float32Array, mask: Float32Array, noise: Float32Array, heightScale: number, under: boolean) {
  const n = RES * RES;
  const peak = height.reduce((m, v) => Math.max(m, v), 1e-6);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new Color();
  const cell = SIZE / (RES - 1);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const k = j * RES + i;
      const x = (i / (RES - 1) - 0.5) * SIZE;
      const z = (j / (RES - 1) - 0.5) * SIZE;
      let y: number;
      if (under) {
        // At the coast the rock starts exactly at the land's height, so the two meet with no gap.
        const w = Math.min(Math.max((mask[k] - COAST) / 0.2, 0), 1);
        const d = w * Math.pow(mask[k], 1.1) * (0.6 + 0.5 * noise[k]);
        y = height[k] * heightScale * (1 - w) - d * UNDER;
        c.copy(UNDER_TOP).lerp(UNDER_TIP, Math.min(d, 1));
      } else {
        y = height[k] * heightScale;
        const hx = height[Math.min(k + 1, n - 1)] - height[Math.max(k - 1, 0)];
        const hz = height[Math.min(k + RES, n - 1)] - height[Math.max(k - RES, 0)];
        const slope = (Math.hypot(hx, hz) * heightScale) / (2 * cell);
        ramp(height[k] / peak, c).lerp(ROCK, Math.min(Math.max((slope - 1.3) / 0.8, 0), 1) * 0.75);
      }
      pos.set([x, y, z], k * 3);
      col.set([c.r, c.g, c.b], k * 3);
    }
  }
  const index: number[] = [];
  const keep = (k: number) => mask[k] > COAST;
  for (let j = 0; j < RES - 1; j++) {
    for (let i = 0; i < RES - 1; i++) {
      const a = j * RES + i, b = a + 1, d = a + RES, e = d + 1;
      // Keep single triangles, trying both diagonals: the coast gets slanted edges instead of stairs.
      const split1 = [[a, d, b], [b, d, e]];
      const split2 = [[a, d, e], [a, e, b]];
      const kept = (tris: number[][]) => tris.filter((t) => t.every(keep));
      const tris = kept(split1).length >= kept(split2).length ? kept(split1) : kept(split2);
      // The underside faces down, so its triangles are wound the other way.
      for (const [p, q, r] of tris) index.push(...(under ? [p, r, q] : [p, q, r]));
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export default function Island({ height, mask, noise, heightScale }: { height: Float32Array; mask: Float32Array; noise: Float32Array; heightScale: number }) {
  const top = useMemo(() => buildGeometry(height, mask, noise, heightScale, false), [height, mask, noise, heightScale]);
  const bottom = useMemo(() => buildGeometry(height, mask, noise, heightScale, true), [height, mask, noise, heightScale]);
  useEffect(() => () => top.dispose(), [top]);
  useEffect(() => () => bottom.dispose(), [bottom]);
  return (
    <group position-y={2}>
      <mesh geometry={top}>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <mesh geometry={bottom}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
      {/* Sea of clouds far below */}
      {[-9, -8.4].map((y, i) => (
        <mesh key={i} position-y={y} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[70 - i * 12, 64]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
