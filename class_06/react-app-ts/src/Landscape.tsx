import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Flow, Vortex } from './world/flow';
import { createRng } from './world/noise';
import type { Item, Species } from './world/scatter';
import type { P2 } from './world/spline';
import { N, RIVER_WIDTH, ROAD_WIDTH, SIZE, type Land, type Stroke } from './world/terrain';
import type { Style } from './styles';

export type Tool = 'look' | 'river' | 'road' | 'vortex';

interface Props {
  land: Land;
  strokes: Stroke[];
  items: Record<Species, Item[]>;
  flow: Flow;
  vortices: Vortex[];
  style: Style;
  tool: Tool;
  showScatter: boolean;
  showParticles: boolean;
  showArrows: boolean;
  highlightPaths: boolean;
  particleCount: number;
  onStroke: (path: P2[]) => void;
  onVortex: (x: number, z: number, clockwise: boolean) => void;
}

export default function Landscape(p: Props) {
  return (
    <>
      <Terrain {...p} />
      <Ribbons land={p.land} strokes={p.strokes} style={p.style} highlight={p.highlightPaths} />
      {p.showScatter && <Vegetation items={p.items} style={p.style} />}
      {p.showParticles && <Particles land={p.land} strokes={p.strokes} flow={p.flow} style={p.style} count={p.particleCount} />}
      {p.showArrows && <Arrows land={p.land} flow={p.flow} style={p.style} />}
      {p.vortices.map((v, i) => (
        <VortexMark key={i} v={v} land={p.land} color={p.style.stroke} />
      ))}
    </>
  );
}

/** The ground mesh, coloured by slope and height. It also catches the mouse for drawing and dropping whirlpools. */
function Terrain({ land, style, tool, onStroke, onVortex }: Props) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(style.low);
    const steep = new THREE.Color(style.steep);
    const high = new THREE.Color(style.high);
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const z = pos.getZ(k);
      // PlaneGeometry rows run along -z after the rotation, so look the height up by position.
      const h = land.heightAt(x, z);
      pos.setY(k, h);
      const s = land.sample(land.slope, x, z);
      c.copy(low).lerp(high, THREE.MathUtils.smoothstep(h, 2, 12) * 0.8).lerp(steep, THREE.MathUtils.smoothstep(s, 0.12, 0.45));
      colors.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [land, style]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const drawing = useRef<P2[] | null>(null);
  const [preview, setPreview] = useState<P2[]>([]);
  const drawTool = tool === 'river' || tool === 'road';

  const down = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    if (tool === 'vortex') {
      e.stopPropagation();
      onVortex(e.point.x, e.point.z, e.shiftKey);
    } else if (drawTool) {
      e.stopPropagation();
      drawing.current = [[e.point.x, e.point.z]];
      setPreview(drawing.current);
    }
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!drawing.current) return;
    drawing.current.push([e.point.x, e.point.z]);
    setPreview([...drawing.current]);
  };
  const up = () => {
    if (drawing.current && drawing.current.length > 3) onStroke(drawing.current);
    drawing.current = null;
    setPreview([]);
  };

  return (
    <>
      <mesh geometry={geometry} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
      {preview.length > 1 && <PathLine path={preview} land={land} color={style.stroke} lift={0.6} />}
    </>
  );
}

function PathLine({ path, land, color, lift }: { path: P2[]; land: Land; color: string; lift: number }) {
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(path.map(([x, z]) => new THREE.Vector3(x, land.heightAt(x, z) + lift, z))),
    [path, land, lift],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={toSegments(geometry)}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

/** A polyline as line segments (pairs of points), so it can share one material type with the trails. */
function toSegments(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const out: number[] = [];
  for (let i = 0; i < p.count - 1; i++) out.push(p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
}

/** Water and road surfaces: a flat strip that follows each stroke (the 2D line projected onto the 3D ground). */
function Ribbons({ land, strokes, style, highlight }: { land: Land; strokes: Stroke[]; style: Style; highlight: boolean }) {
  const rivers = strokes.filter((s) => s.kind === 'river');
  return (
    <>
      {strokes.map((s, i) => {
        const riverIndex = rivers.indexOf(s);
        const y = (k: number, x: number, z: number) => (s.kind === 'river' ? land.waterY[riverIndex][k] : land.heightAt(x, z) + 0.12);
        return (
          <group key={i}>
            <Ribbon path={s.path} width={s.kind === 'river' ? RIVER_WIDTH * 1.5 : ROAD_WIDTH} height={y} color={s.kind === 'river' ? style.water : style.road} opacity={s.kind === 'river' ? 0.85 : 1} />
            {highlight && <PathLine path={s.path} land={land} color={style.stroke} lift={s.kind === 'river' ? 1.4 : 0.3} />}
          </group>
        );
      })}
    </>
  );
}

function Ribbon({ path, width, height, color, opacity }: { path: P2[]; width: number; height: (k: number, x: number, z: number) => number; color: string; opacity: number }) {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    path.forEach(([x, z], k) => {
      const [ax, az] = path[Math.max(k - 1, 0)];
      const [bx, bz] = path[Math.min(k + 1, path.length - 1)];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = (-(bz - az) / len) * width;
      const nz = ((bx - ax) / len) * width;
      const y = height(k, x, z);
      pos.push(x + nx, y, z + nz, x - nx, y, z - nz);
      if (k > 0) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [path, width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide} roughness={0.4} />
    </mesh>
  );
}

/** One instanced mesh per shape: the shape is stored once and drawn at every scattered point. */
function Instances({ items, geometry, color, lift, basic }: { items: Item[]; geometry: THREE.BufferGeometry; color: (it: Item) => THREE.Color; lift: number; basic?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw);
      m.compose(new THREE.Vector3(it.x, it.y + lift * it.scale, it.z), q, new THREE.Vector3(it.scale, it.scale, it.scale));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color(it));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, color, lift]);
  if (items.length === 0) return null;
  return (
    <instancedMesh key={items.length} ref={ref} args={[geometry, undefined, items.length]}>
      {basic ? <meshBasicMaterial /> : <meshStandardMaterial flatShading roughness={0.9} />}
    </instancedMesh>
  );
}

function Vegetation({ items, style }: { items: Record<Species, Item[]>; style: Style }) {
  const shapes = useMemo(
    () => ({
      pine: new THREE.ConeGeometry(0.9, 2.8, 6),
      reed: new THREE.ConeGeometry(0.07, 1.6, 3),
      flower: new THREE.IcosahedronGeometry(0.28, 0),
      rock: new THREE.DodecahedronGeometry(0.7, 0),
      roof: new THREE.ConeGeometry(2.4, 1.3, 4),
      wall: new THREE.BoxGeometry(2.2, 1.6, 2.2),
      post: new THREE.CylinderGeometry(0.06, 0.06, 1.4, 4),
      lamp: new THREE.SphereGeometry(0.28, 8, 6),
    }),
    [],
  );
  // Colours read the ground data carried by each item (moisture or height).
  const colors = useMemo(() => {
    const mix = ([a, b]: [string, string]) => (it: Item) => new THREE.Color(a).lerp(new THREE.Color(b), it.tint);
    const flat = (c: string) => () => new THREE.Color(c);
    return {
      pine: mix(style.pine),
      reed: flat(style.reed),
      flower: mix(style.flower),
      rock: (it: Item) => new THREE.Color(style.rock).multiplyScalar(0.8 + 0.4 * it.tint),
      roof: flat(style.roof),
      wall: flat(style.wall),
      post: flat(style.rock),
      lamp: flat(style.lantern),
    };
  }, [style]);
  return (
    <>
      <Instances items={items.pine} geometry={shapes.pine} color={colors.pine} lift={1.3} />
      <Instances items={items.reed} geometry={shapes.reed} color={colors.reed} lift={0.8} />
      <Instances items={items.flower} geometry={shapes.flower} color={colors.flower} lift={0.3} />
      <Instances items={items.rock} geometry={shapes.rock} color={colors.rock} lift={0.2} />
      <Instances items={items.pavilion} geometry={shapes.wall} color={colors.wall} lift={0.8} />
      <Instances items={items.pavilion} geometry={shapes.roof} color={colors.roof} lift={2.2} />
      <Instances items={items.lantern} geometry={shapes.post} color={colors.post} lift={0.7} />
      <Instances items={items.lantern} geometry={shapes.lamp} color={colors.lamp} lift={1.5} basic />
    </>
  );
}

const TRAIL = 12; // positions remembered per particle

/**
 * Particles carried by the vector field. Each frame every particle reads the field where it is
 * and moves; its last few positions are drawn as a line that fades into the background, like a
 * brush stroke. Half of them are born on the rivers, so the water you drew is always flowing.
 */
function Particles({ land, strokes, flow, style, count }: { land: Land; strokes: Stroke[]; flow: Flow; style: Style; count: number }) {
  const state = useMemo(() => {
    const rng = createRng(7);
    const rivers = strokes.filter((s) => s.kind === 'river');
    const spawn = (pts: Float32Array, i: number) => {
      let x = (rng() - 0.5) * SIZE * 0.95;
      let z = (rng() - 0.5) * SIZE * 0.95;
      if (rivers.length && rng() < 0.6) {
        const path = rivers[Math.floor(rng() * rivers.length)].path;
        const [px, pz] = path[Math.floor(rng() * path.length * 0.7)];
        x = px + (rng() - 0.5) * RIVER_WIDTH;
        z = pz + (rng() - 0.5) * RIVER_WIDTH;
      }
      for (let k = 0; k < TRAIL; k++) pts.set([x, 0, z], (i * TRAIL + k) * 3);
    };
    const pts = new Float32Array(count * TRAIL * 3);
    const age = new Float32Array(count);
    const life = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      spawn(pts, i);
      life[i] = 3 + rng() * 6;
      age[i] = rng() * life[i];
    }
    return { pts, age, life, spawn, rng };
  }, [count, strokes]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * (TRAIL - 1) * 6), 3));
    const colors = new Float32Array(count * (TRAIL - 1) * 6);
    const head = new THREE.Color(style.trail[0]);
    const tail = new THREE.Color(style.trail[1]);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < TRAIL - 1; k++) {
        for (let e = 0; e < 2; e++) {
          c.copy(head).lerp(tail, (k + e) / (TRAIL - 1));
          colors.set([c.r, c.g, c.b], ((i * (TRAIL - 1) + k) * 2 + e) * 3);
        }
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [count, style]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { pts, age, life, spawn } = state;
    const out = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const b = i * TRAIL * 3;
      // Shift the history back by one and move the head along the field.
      pts.copyWithin(b + 3, b, b + (TRAIL - 1) * 3);
      const [vx, vz] = flow.sample(pts[b], pts[b + 2]);
      pts[b] += vx * dt * 4;
      pts[b + 2] += vz * dt * 4;
      age[i] += dt;
      const outside = Math.abs(pts[b]) > SIZE / 2 || Math.abs(pts[b + 2]) > SIZE / 2;
      if (age[i] > life[i] || outside) {
        spawn(pts, i);
        age[i] = 0;
      }
      for (let k = 0; k < TRAIL; k++) {
        const x = pts[b + k * 3];
        const z = pts[b + k * 3 + 2];
        const water = land.sample(land.river, x, z) < RIVER_WIDTH * 1.5;
        pts[b + k * 3 + 1] = land.heightAt(x, z) + (water ? 1.3 : 1.8);
      }
      for (let k = 0; k < TRAIL - 1; k++) {
        const o = (i * (TRAIL - 1) + k) * 6;
        for (let c = 0; c < 3; c++) {
          out[o + c] = pts[b + k * 3 + c];
          out[o + 3 + c] = pts[b + (k + 1) * 3 + c];
        }
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors />
    </lineSegments>
  );
}

/** The field itself, as a grid of short arrows (direction and strength). */
function Arrows({ land, flow, style }: { land: Land; flow: Flow; style: Style }) {
  const geometry = useMemo(() => {
    const out: number[] = [];
    const step = 4;
    for (let x = -SIZE / 2 + 2; x < SIZE / 2; x += step) {
      for (let z = -SIZE / 2 + 2; z < SIZE / 2; z += step) {
        const [vx, vz] = flow.sample(x, z);
        const y = land.heightAt(x, z) + 2.2;
        const s = Math.min(Math.hypot(vx, vz), 3) * 0.9;
        const len = Math.hypot(vx, vz) || 1;
        const ex = x + (vx / len) * s;
        const ez = z + (vz / len) * s;
        out.push(x, y, z, ex, y, ez);
        // Arrow head: two short strokes back from the tip.
        for (const a of [2.6, -2.6]) {
          const hx = Math.cos(a) * (vx / len) - Math.sin(a) * (vz / len);
          const hz = Math.sin(a) * (vx / len) + Math.cos(a) * (vz / len);
          out.push(ex, y, ez, ex + hx * s * 0.35, y, ez + hz * s * 0.35);
        }
      }
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  }, [land, flow]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={style.stroke} transparent opacity={0.55} />
    </lineSegments>
  );
}

function VortexMark({ v, land, color }: { v: Vortex; land: Land; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * Math.sign(v.strength) * 1.5;
  });
  return (
    <group ref={ref} position={[v.x, land.heightAt(v.x, v.z) + 2, v.z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <torusGeometry args={[2.2, 0.06, 6, 40, Math.PI * 1.6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
