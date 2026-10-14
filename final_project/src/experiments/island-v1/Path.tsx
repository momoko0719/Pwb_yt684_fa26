import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Color, DodecahedronGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type ShaderMaterial } from 'three';
import { PATH_WIDTH, type IslandPath } from '../../core/generators/path';
import { PROPS } from '../../core/palette';
import { createRng } from '../../core/rng';
import { createPropMaterial } from '../../core/shaders/prop';
import type { WorldUniforms } from '../../core/shaders/uniforms';

const UP = new Vector3(0, 1, 0);
/** Seconds per path sample while the stones are laid, start to end. */
export const LAY_PER_POINT = 0.03;

/** One kind of piece (flagstone, step, arch stone, plank…): an instanced mesh, each copy tagged with the path sample it belongs to. */
interface Part {
  mesh: InstancedMesh;
  /** Path sample index of each instance, ascending, so "laid up to sample k" is a prefix. */
  at: number[];
}

/**
 * The footpath, laid from start to end when it appears: flagstones on gentle ground, steps where it
 * climbs, and a stone arch where it crosses a pool or a deep gully.
 */
export default function Path({ path, scale, uniforms, seed }: { path: IslandPath; scale: number; uniforms: WorldUniforms; seed: number }) {
  const materials = useMemo(() => {
    const m = (c: string) => createPropMaterial(uniforms, c);
    return { stone: m(PROPS.stone), step: m(PROPS.step), arch: m(PROPS.plinth) };
  }, [uniforms]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const { group, parts } = useMemo(() => buildPath(path, scale, seed, materials), [path, scale, seed, materials]);
  useEffect(() => () => parts.forEach((p) => p.mesh.geometry.dispose()), [parts]);

  // The animation clock starts when this path appears.
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const laid = Math.floor((clock.elapsedTime - start.current) / LAY_PER_POINT);
    for (const p of parts) {
      let n = 0;
      while (n < p.at.length && p.at[n] <= laid) n++;
      p.mesh.count = n;
    }
  });

  return <primitive object={group} />;
}

function buildPath(path: IslandPath, s: number, seed: number, mat: Record<'stone' | 'step' | 'arch', ShaderMaterial>) {
  const rng = createRng(seed + 505);
  const width = PATH_WIDTH * s;
  const m = new Matrix4();
  const q = new Quaternion();
  const shade = new Color();
  const group = new Group();
  const parts: Part[] = [];
  const part = (geometry: BoxGeometry | DodecahedronGeometry, material: ShaderMaterial, items: { at: number; matrix: Matrix4; tone: number }[]) => {
    items.sort((a, b) => a.at - b.at);
    const mesh = new InstancedMesh(geometry, material, Math.max(items.length, 1));
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.matrix);
      mesh.setColorAt(i, shade.setScalar(it.tone));
    });
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.push({ mesh, at: items.map((it) => it.at) });
  };
  const yaw = (tx: number, tz: number) => q.setFromAxisAngle(UP, Math.atan2(tx, tz)).clone();

  // Flagstones and steps on the ground.
  const flags: { at: number; matrix: Matrix4; tone: number }[] = [];
  const steps: { at: number; matrix: Matrix4; tone: number }[] = [];
  path.points.forEach((p, i) => {
    if (p.bridge >= 0) return;
    if (p.step) {
      const depth = 0.4 * s;
      steps.push({ at: i, tone: 0.9 + rng() * 0.2, matrix: m.clone().compose(new Vector3(p.x, p.y - depth / 2 + 0.06 * s, p.z), yaw(p.tx, p.tz), new Vector3(width, depth, 0.62 * s)) });
      return;
    }
    const across = new Vector3(-p.tz, 0, p.tx);
    const count = rng() < 0.4 ? 3 : 2;
    for (let k = 0; k < count; k++) {
      const offset = ((k + 0.5) / count - 0.5) * width + (rng() - 0.5) * 0.15 * width;
      const pos = new Vector3(p.x, p.y + 0.02 * s, p.z).addScaledVector(across, offset);
      const size = (0.55 + rng() * 0.25) * (width / count);
      const turn = new Quaternion().setFromAxisAngle(UP, Math.atan2(p.tx, p.tz) + (rng() - 0.5) * 0.8);
      flags.push({ at: i, tone: 0.85 + rng() * 0.25, matrix: m.clone().compose(pos, turn, new Vector3(size, 0.06 * s, size * (0.8 + rng() * 0.4))) });
    }
  });
  part(new DodecahedronGeometry(1, 0), mat.stone, flags);
  part(new BoxGeometry(1, 1, 1), mat.step, steps);

  // Bridges.
  const arch: { at: number; matrix: Matrix4; tone: number }[] = [];
  for (const b of path.bridges) {
    const a = new Vector3(...b.a), e = new Vector3(...b.b);
    const dir = e.clone().sub(a).setY(0).normalize();
    const across = new Vector3(-dir.z, 0, dir.x);
    const face = new Quaternion().setFromAxisAngle(UP, Math.atan2(dir.x, dir.z));
    const atOf = (t: number) => Math.round(b.first + (b.last - b.first) * t);
    const deckAt = (t: number) => a.clone().lerp(e, t);
    // A stone arch: the deck humps a little; the ring of arch stones springs from below the banks
    // and rises to just under the deck; short posts line both sides.
    const hump = 0.1 * b.length;
    const drop = 0.35 * b.length;
    const deck = (t: number) => deckAt(t).setY(a.y + (e.y - a.y) * t + hump * Math.sin(Math.PI * t));
    const n = Math.max(Math.ceil(b.length / (0.5 * s)), 4);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const d = deck(t);
      arch.push({ at: atOf(t), tone: 0.85 + rng() * 0.25, matrix: m.clone().compose(d.clone().setY(d.y - 0.08 * s), face, new Vector3(width * 1.05, 0.22 * s, (b.length / n) * 0.96)) });
      // Arch stone under this slab: tilted along the ring, a little uneven.
      const ring = (u: number) => deck(u).setY(deck(u).y - 0.3 * s - drop * (1 - Math.sin(Math.PI * u)));
      const p0 = ring(k / n), p1 = ring((k + 1) / n);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const tilt = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), p1.clone().sub(p0).normalize());
      const size = p0.distanceTo(p1) * (0.92 + rng() * 0.1);
      arch.push({ at: atOf(t), tone: 0.8 + rng() * 0.25, matrix: m.clone().compose(mid, tilt, new Vector3(width * 0.9, 0.4 * s * (0.9 + rng() * 0.3), size)) });
      if (k % 2 === 0) {
        for (const side of [-1, 1]) {
          arch.push({ at: atOf(t), tone: 0.8 + rng() * 0.2, matrix: m.clone().compose(d.clone().addScaledVector(across, side * width * 0.5).setY(d.y + 0.25 * s), face, new Vector3(0.18 * s, 0.5 * s, 0.18 * s)) });
        }
      }
    }
  }
  part(new BoxGeometry(1, 1, 1), mat.arch, arch);

  return { group, parts };
}
