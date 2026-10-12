import { BufferAttribute, BufferGeometry, Color } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeBaseDensity, makeDensity, type GrottoParams } from './grotto';
import { meshCulled } from './meshCulled';
import { meshMarchingCubes } from './meshMarchingCubes';
import { createVolume } from './volume';

export const PAPER = '#efe8d8';
export const SCALE = 14; // world units per density unit
export type Method = 'blocks' | 'smooth';

const GRASS = new Color('#5e9452');
const STONE = new Color('#c9b48c');
const DEEP = new Color('#4a4440');
const CAVE_WALL = new Color('#b8834f');

export function buildMesh(p: GrottoParams, n: number, method: Method) {
  const t0 = performance.now();
  const density = makeDensity(p);
  const base = makeBaseDensity(p);
  const volume = createVolume(n, density, 1);
  const buf = method === 'smooth' ? meshMarchingCubes(volume, n, 0) : meshCulled(volume, n, 0);
  let g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(buf.positions, 3));
  g.setIndex(new BufferAttribute(buf.indices, 1));
  if (method === 'smooth') {
    // Marching cubes gives every triangle its own corners; welding them lets normals blend smoothly.
    g = mergeVertices(g, 1e-4);
    g.computeVertexNormals();
  } else {
    g.setAttribute('normal', new BufferAttribute(buf.normals, 3));
  }
  // Colour: grass on top, stone on the walls, darker toward the tip; carved surfaces glow warm.
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const carved = base(x, y, z) > 0.015;
    c.copy(STONE).lerp(DEEP, Math.min(Math.max(-y * 0.9, 0), 1));
    if (carved) c.copy(CAVE_WALL).lerp(DEEP, 0.25);
    else if (nor.getY(i) > 0.6 && y > 0) c.copy(GRASS).lerp(STONE, Math.max(0, 0.75 - nor.getY(i)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.scale(SCALE, SCALE, SCALE);
  return { geometry: g, triangles: buf.triangleCount, ms: Math.round(performance.now() - t0) };
}

