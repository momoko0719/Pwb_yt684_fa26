/**
 * Grotto heaven (洞天): a floating island as a density field, hollowed out with CSG.
 * A heightmap stores one height per (x, z), so it cannot hold a cave; a density field can.
 *
 *   1 density: an island shape (SDF) roughened by 3D noise      → solid where density > 0
 *   2 carve:   subtract a winding cave, a skylight shaft, and a hollow under the rim
 *   3 mesh:    blocky (culled faces) or smooth (marching cubes)
 * Coordinates are in −1 … +1.
 */
import { fbm3 } from './noise3d';
import { sdfCylinder, sdfSphere, smin } from './sdf';

export interface GrottoParams {
  roughness: number; // how much 3D noise disturbs the island
  noiseScale: number;
  cave: boolean;
  shaft: boolean;
  hollow: boolean;
  smooth: number; // smoothness of the carved edges
  seed: number;
}

export const DEFAULTS: GrottoParams = {
  roughness: 0.32,
  noiseScale: 2.4,
  cave: true,
  shaft: true,
  hollow: true,
  smooth: 0.08,
  seed: 1,
};

/** Smooth max: subtraction with a soft edge. */
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/** The island body: a flattened dome on top, a long cone hanging below, joined smoothly. */
function islandSdf(x: number, y: number, z: number): number {
  const r = Math.hypot(x, z);
  const dome = Math.hypot(r / 0.78, (y - 0.12) / 0.32) * 0.32 - 0.32; // ellipsoid
  const flat = y - 0.36; // cut the top of the dome so it reads as a plateau with peaks from noise
  const top = Math.max(dome, flat);
  // Inverted cone: radius shrinks to the tip at y = −0.85.
  const coneR = Math.max((y + 0.85) / 0.95, 0) * 0.62;
  const cone = Math.max(r - coneR, -0.85 - y, y - 0.12);
  return smin(top, cone, 0.18);
}

/** A cave winding through the island: distance to a chain of points, minus a varying radius. */
export const CAVE: [number, number, number][] = Array.from({ length: 13 }, (_, i) => {
  const t = i / 12;
  const x = -1.05 + t * 2.1;
  return [x, -0.02 + 0.06 * Math.sin(t * 7), 0.22 * Math.sin(t * 4.2 + 0.6)];
});

function caveSdf(x: number, y: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i < CAVE.length - 1; i++) {
    const [ax, ay, az] = CAVE[i];
    const [bx, by, bz] = CAVE[i + 1];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const t = Math.min(Math.max(((x - ax) * abx + (y - ay) * aby + (z - az) * abz) / (abx * abx + aby * aby + abz * abz), 0), 1);
    const r = 0.13 + 0.04 * Math.sin(i * 1.7);
    d = Math.min(d, Math.hypot(x - ax - abx * t, y - ay - aby * t, z - az - abz * t) - r);
  }
  return d;
}

export function makeDensity(p: GrottoParams) {
  const off = p.seed * 13.7;
  return (x: number, y: number, z: number): number => {
    let d = islandSdf(x, y, z) - p.roughness * 0.35 * fbm3(x * p.noiseScale + off, y * p.noiseScale, z * p.noiseScale - off, 4);
    const k = Math.max(p.smooth, 0.001);
    if (p.cave) d = smax(d, -caveSdf(x, y, z), k);
    // Skylight: a shaft from the plateau down into the cave.
    if (p.shaft) d = smax(d, -sdfCylinder({ x: x - 0.18, y: y - 0.25, z: z - 0.05 }, 0.1, 0.3), k);
    // Hollow under one side of the rim, leaving an overhang.
    if (p.hollow) d = smax(d, -sdfSphere({ x: x + 0.55, y: y + 0.28, z: z + 0.35 }, 0.3), k);
    return -d; // density > 0 = solid
  };
}

/** Density without any carving, for the "before" slice. */
export function makeBaseDensity(p: GrottoParams) {
  return makeDensity({ ...p, cave: false, shaft: false, hollow: false });
}
