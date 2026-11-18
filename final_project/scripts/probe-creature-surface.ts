import { performance } from 'node:perf_hooks';
import { birthAxes, resolveMorph } from '../src/experiments/wonderland-terrain/creatureMorph';
import { buildMorphGroup, disposeMorphGroup } from '../src/experiments/wonderland-terrain/creatureMorphMesh';

for (const [name, axes] of [
  ['birth', birthAxes(11)],
  ['light-tall', { bulk: 0, stature: 1, crown: 0.5 }],
  ['heavy-low', { bulk: 1, stature: 0, crown: 0.5 }],
] as const) {
  const { figure } = resolveMorph({ worldSeed: 684, creatureSeed: 11, axes });
  const t0 = performance.now();
  const mesh = buildMorphGroup(figure);
  const buildMs = performance.now() - t0;
  let triangles = 0;
  mesh.traverse((object) => {
    if (!('isMesh' in object && object.isMesh)) return;
    const geometry = (object as import('three').Mesh).geometry;
    triangles += geometry.index ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3;
  });
  console.log(JSON.stringify({ name, buildMs: Number(buildMs.toFixed(1)), triangles }));
  disposeMorphGroup(mesh);
}
