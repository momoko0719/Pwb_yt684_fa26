import type { OutletNode, PoolNode } from './terrace';
import type { Water } from './water';

export interface JadeRevealSites {
  pool: [number, number];
  poolY: number;
  tangent: [number, number];
  bend: [number, number];
  bendStrength: number;
}

/** Two deliberately small study sites, derived from generated flow rather than seed coordinates. */
export function jadeRevealSites(pools: PoolNode[], outlets: OutletNode[], water: Water): JadeRevealSites | null {
  if (!pools.length) return null;
  const edge = outlets.find((o) => o.pool === 0 && o.main) ?? outlets.find((o) => o.pool === 0) ?? outlets.find((o) => o.main);
  const lip = edge?.lip[Math.floor((edge.lip.length - 1) / 2)];
  const way = water.ways.find((w) => w.main && w.points.length >= 7) ?? water.ways.find((w) => w.points.length >= 7);
  if (!lip || !way) return null;
  const points = way.points;
  let best = Math.floor(points.length * 0.42);
  let bestScore = -Infinity;
  for (let i = Math.max(2, Math.floor(points.length * 0.18)); i < Math.floor(points.length * 0.78); i++) {
    const a = points[i - 2], b = points[i], c = points[i + 2];
    const ax = b[0] - a[0], az = b[2] - a[2];
    const bx = c[0] - b[0], bz = c[2] - b[2];
    const bend = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
    const farEnough = Math.min(i / points.length, 1 - i / points.length);
    const score = bend * (0.5 + farEnough);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return { pool: [lip.x, lip.z], poolY: lip.y, tangent: [-lip.dz, lip.dx], bend: [points[best][0], points[best][2]], bendStrength: bestScore };
}
