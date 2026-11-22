import { useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, Material, PlaneGeometry, ShaderMaterial } from 'three';
import { JADE_UI, PORCELAIN } from '../../core/palette';
import { setWorldPointer } from './worldPointer';
import { stepFish, watching, type Scarer, type StreamFishData } from './streamFish';
import type { Dwelling } from './dwelling';
import { finShapes, fishPatches, fishProfile, FORM_RULES, SWIM, tailBeatHz, type FinShape, type FishForm } from './fishForm';

export { fishProfile } from './fishForm';

const smooth = (a: number, b: number, v: number) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/** A flat fin from its rounded outline: a fan from its centre, with a slight outward cup. */
function finGeometry({ outline, centre }: FinShape, cup = 0.012) {
  const g = new BufferGeometry(), verts: number[] = [centre[0], centre[1], 0], faces: number[] = [];
  outline.forEach(([x, y]) => verts.push(x, y, cup * Math.hypot(x - centre[0], y - centre[1]) * 6));
  for (let i = 0; i < outline.length; i++) faces.push(0, 1 + i, 1 + (i + 1) % outline.length);
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3)); g.setIndex(faces);
  g.computeVertexNormals(); return g;
}

/** The body's lateral wave: phase (radians) and sweep (fraction of length, tail tip side to side). */
export interface FishMotion { phase: number; sweep: number }

/** How far the body stands out sideways at u (nose 0, tail base 1): little at the head, most at the tail. */
const waveAt = (form: FishForm, m: FishMotion, u: number) => {
  const amp = 0.5 * m.sweep * form.length * (0.03 + 0.97 * u * u);
  return amp * Math.sin((2 * Math.PI * u) / SWIM.wavelength - m.phase);
};

/** Shared seeded geometry for the live fish and its atlas model. Head toward +x, metres. */
export function FishBody({ fish, motion }: { fish: FishForm; motion?: MutableRefObject<FishMotion> }) {
  const L = fish.length, D = fish.depth;
  const body = useMemo(() => {
    const g = new BufferGeometry(), verts: number[] = [], colors: number[] = [], faces: number[] = [];
    const rings = 30, sides = 20;
    const base = new Color(PORCELAIN.fishBody), mark = new Color(PORCELAIN.fishMark), c = new Color();
    const patches = fishPatches(fish);
    for (let i = 0; i <= rings; i++) {
      const u = i / rings, x = L * (0.5 - u), p = Math.max(0.012, fishProfile(u));
      const top = D * 0.54 * p, belly = D * 0.46 * p, half = D * 0.3 * p * (1 - 0.45 * smooth(0.45, 1, u));
      for (let j = 0; j < sides; j++) {
        // A rounded-square section (superellipse, exponent 2.6): a fuller belly and back than an ellipse.
        const a = (j / sides) * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
        const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / 2.6), sz = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / 2.6);
        verts.push(x, sy * (sy > 0 ? top : belly), sz * half);
        const round = Math.atan2(ca, sa);
        let w = 0.16 * Math.pow(Math.max(0, sa), 2);
        for (const m of patches) {
          const dx = (u - m.u) * L, dy = (round - m.a) * Math.max(D * 0.4, 0.04);
          const edge = m.r * (1 + 0.28 * Math.sin(m.k * Math.atan2(dy, dx) + m.w));
          w = Math.max(w, 1 - smooth(edge * 0.75, edge, Math.hypot(dx, dy)));
        }
        c.copy(base).lerp(mark, Math.min(1, w) * (0.35 + 0.65 * smooth(-0.6, 0.4, sa)));
        colors.push(c.r, c.g, c.b);
      }
    }
    const nose = verts.length / 3; verts.push(L * 0.5 + L * 0.008, D * 0.02, 0); colors.push(base.r, base.g, base.b);
    for (let j = 0; j < sides; j++) faces.push(nose, (j + 1) % sides, j);
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a0 = i * sides + j, b0 = i * sides + (j + 1) % sides, c0 = (i + 1) * sides + j, d0 = (i + 1) * sides + (j + 1) % sides;
      faces.push(a0, b0, c0, b0, d0, c0);
    }
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    g.setIndex(faces); g.computeVertexNormals();
    g.userData.rest = new Float32Array(verts);
    return g;
  }, [L, D, fish]);
  const fins = useMemo(() => {
    const s = finShapes(fish);
    return { dorsal: finGeometry(s.dorsal), pectoral: finGeometry(s.pectoral), small: finGeometry(s.small), tail: finGeometry(s.tail, 0.006) };
  }, [fish]);
  const at = (u: number) => L * (0.5 - u);
  const tail = useRef<Group>(null), dorsal = useRef<Group>(null), pelvic = useRef<Group>(null), anal = useRef<Group>(null);
  // The swimming wave: every vertex moved sideways by its place along the body; fins ride along.
  useFrame(() => {
    if (!motion) return;
    const m = motion.current, pos = body.attributes.position as BufferAttribute, rest = body.userData.rest as Float32Array;
    for (let k = 0; k < pos.count; k++) {
      const x = rest[k * 3];
      pos.setZ(k, rest[k * 3 + 2] + waveAt(fish, m, 0.5 - x / L));
    }
    pos.needsUpdate = true; body.computeVertexNormals();
    if (dorsal.current) dorsal.current.position.z = waveAt(fish, m, 0.5);
    if (pelvic.current) pelvic.current.position.z = waveAt(fish, m, 0.54);
    if (anal.current) anal.current.position.z = waveAt(fish, m, 0.78);
    if (tail.current) {
      const z = waveAt(fish, m, 1), dzdu = (waveAt(fish, m, 1) - waveAt(fish, m, 0.97)) / 0.03;
      tail.current.position.z = z;
      tail.current.rotation.y = Math.atan2(dzdu, L);
    }
  });
  const finMat = <meshPhysicalMaterial color={PORCELAIN.fishFin} side={DoubleSide} transparent opacity={0.72} roughness={0.4} depthWrite={false} />;
  return <group>
    <mesh geometry={body}><meshPhysicalMaterial vertexColors roughness={0.3} clearcoat={0.5} clearcoatRoughness={0.3} /></mesh>
    <group ref={dorsal}><mesh geometry={fins.dorsal} position={[at(0.36), D * 0.5 * fishProfile(0.36), 0]}>{finMat}</mesh></group>
    {[-1, 1].map((s) => <mesh key={`p${s}`} geometry={fins.pectoral} position={[at(0.22), -D * 0.22, s * D * 0.26]} rotation={[s * 0.5, s * 0.5, 0]}>{finMat}</mesh>)}
    <group ref={pelvic}>{[-1, 1].map((s) => <mesh key={`v${s}`} geometry={fins.small} position={[at(0.5), -D * 0.36, s * D * 0.12]} rotation={[s * 0.35, 0, 0]}>{finMat}</mesh>)}</group>
    <group ref={anal}><mesh geometry={fins.small} position={[at(0.74), -D * 0.22, 0]} scale={[0.9, 0.8, 1]}>{finMat}</mesh></group>
    {[-1, 1].map((s) => <mesh key={`e${s}`} position={[at(0.1), D * 0.1, s * D * 0.21]} scale={[L * 0.016, L * 0.016, L * 0.01]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={PORCELAIN.fishEye} roughness={0.2} /></mesh>)}
    <group ref={tail} position={[-L * 0.5, 0, 0]}><mesh geometry={fins.tail}>{finMat}</mesh></group>
  </group>;
}

/**
 * One fish of the school: each frame it takes one step of the school's rules (streamFish.ts's
 * `stepFish`: its stamina, the school's goal, repel / align / attract, the water), then beats its tail
 * at the Strouhal rule (fishForm.ts), so a big fish beats slower than a small one.
 */
function Fish({ fish, all, onPick, run, speed }: { fish: StreamFishData; all: StreamFishData[]; onPick?: (fish: StreamFishData) => void; run: boolean; speed: number }) {
  const root = useRef<Group>(null);
  const motion = useRef<FishMotion>({ phase: (fish.seed % 23) / 3, sweep: SWIM.sweep });
  useFrame((_, dt) => {
    // Its stamina runs on island time (the sim's speed); its swimming on real time, so it never darts.
    const t = run ? Math.min(dt, .05) : 0;
    stepFish(fish, all, t, t * speed);
    const now = fish.now;
    // Tail beat by the Strouhal rule; when holding it still fans gently.
    const beat = Math.max(tailBeatHz(fish, now.speed), SWIM.holdBeat);
    motion.current.phase += 2 * Math.PI * beat * t;
    motion.current.sweep = SWIM.sweep * (fish.state === 'hold' ? 0.45 : 1);
    if (root.current) {
      // The brook's fish keep their depth under a surface that falls along the stream.
      const level = fish.pool.levelAt?.(now.x, now.z);
      const y = level !== undefined && Number.isFinite(level) ? level - fish.dip : fish.y;
      root.current.position.set(now.x, y + Math.sin(motion.current.phase * 0.21) * .012, now.z);
      root.current.rotation.y = -now.heading;
    }
  });
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick?.(fish); };
  return <group ref={(node) => { root.current = node; node?.traverse((obj) => { if (obj instanceof Mesh) { obj.renderOrder = 2; const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach((m: Material) => { m.depthTest = false; }); } }); }} onClick={onPick ? click : undefined} onPointerOver={onPick ? (e) => { e.stopPropagation(); setWorldPointer('fish'); } : undefined} onPointerOut={onPick ? () => setWorldPointer(null) : undefined}>
    <FishBody fish={fish} motion={motion} /><mesh onClick={onPick ? click : undefined}><sphereGeometry args={[fish.length * .68, 10, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </group>;
}

export function StreamFish({ fish, onPick, run, speed, scarers }: { fish: StreamFishData[]; onPick?: (fish: StreamFishData) => void; run: boolean; speed: number; /** The dwellers this school is wary of (the brook school). */ scarers?: (Dwelling | null)[] }) {
  return <>
    {fish.map((f) => <Fish key={f.id} fish={f} all={fish} onPick={onPick} run={run} speed={speed} />)}
    {scarers && fish.length > 0 && <Wary fish={fish} scarers={scarers} run={run} />}
  </>;
}

/** Seconds (real) the dweller's bubble shows it watching, after the last fish it saw bolt. */
const WATCH_S = 4;
/** Metres: it notices fish bolting this close. */
const WATCH_NEAR = 16;
/** Seconds between the rings its muzzle makes on the water while it drinks. */
const SIP_RING_S = 1.3;
const RINGS = 28;

/**
 * A ring on the water, as a drop or a muzzle leaves: a short train of two or three wavelets behind
 * the front, each crest a little lighter (it catches the sky) and each trough a little darker; the
 * front slows as it spreads (fast at first, then easing), the wavelets keep their length in metres
 * and flatten as the ring grows. Drawn on a flat square (`uSize` metres to its edge), carried a
 * little down the current.
 */
const rippleVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const rippleFragment = /* glsl */ `
uniform float uK, uSize;
uniform float uReach[16]; // metres of water from the centre, by direction (the bank stops the ring)
uniform vec3 uLight, uDark;
varying vec2 vUv;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float r = length(d) * uSize; // metres from the centre
  // How far the water reaches this way: between the two nearest of the sixteen directions.
  float f = mod(atan(d.y, d.x) / 6.2832 * 16.0 + 16.0, 16.0);
  int i0 = int(floor(f));
  float reach = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i == i0) reach += uReach[i] * (1.0 - fract(f));
    if (i == int(mod(float(i0 + 1), 16.0))) reach += uReach[i] * fract(f);
  }
  float front = uSize * (1.0 - pow(1.0 - uK, 2.2)) * 0.92;
  float lambda = 0.09 + 0.05 * uK; // the wavelets lengthen a little as they travel
  float behind = front - r;
  // The train: only behind the front, two to three wavelets long, fading inward.
  float train = smoothstep(-lambda * 0.35, 0.0, behind) * exp(-max(behind, 0.0) / (lambda * 1.4));
  float wave = sin(behind / lambda * 6.2832) * train;
  // Weaker as the ring spreads (its energy over a longer circle) and as it ages.
  float fade = (1.0 - uK) * (1.0 - uK) * smoothstep(0.0, 0.08, uK) / (1.0 + front * 1.6);
  float a = abs(wave) * fade * smoothstep(reach, reach - 0.12, r);
  vec3 c = wave > 0.0 ? uLight : uDark;
  gl_FragColor = vec4(c, clamp(a * 0.9, 0.0, 0.6));
  #include <colorspace_fragment>
}
`;

/**
 * The brook school and the dwellers: each frame the school learns where each dweller is (its muzzle
 * at the water while it drinks, else its body) and whether it is up; a fish that bolts, and a muzzle
 * that drinks, sets a ring spreading on the water; a dweller near fish that bolt is marked watching
 * (its bubble shows an eye).
 */
function Wary({ fish, scarers, run }: { fish: StreamFishData[]; scarers: (Dwelling | null)[]; run: boolean }) {
  const pool = fish[0].pool;
  const rings = useMemo(() => {
    const geometry = new PlaneGeometry(2, 2);
    geometry.rotateX(-Math.PI / 2);
    const light = new Color(PORCELAIN.sheen), dark = new Color(PORCELAIN.waterDeep);
    return Array.from({ length: RINGS }, () => {
      const material = new ShaderMaterial({ vertexShader: rippleVertex, fragmentShader: rippleFragment, transparent: true, depthWrite: false,
        uniforms: { uK: { value: 0 }, uSize: { value: 1 }, uReach: { value: new Array<number>(16).fill(1) }, uLight: { value: light }, uDark: { value: dark } } });
      const m = new Mesh(geometry, material);
      m.renderOrder = 3; m.visible = false;
      return { mesh: m, age: 0, life: 1, size: 1 };
    });
  }, []);
  const next = useRef(0), sip = useRef<number[]>([]);
  const ring = (x: number, z: number, size: number, life: number) => {
    const y = pool.levelAt?.(x, z);
    if (y === undefined || !Number.isFinite(y)) return;
    const r = rings[next.current++ % RINGS];
    r.mesh.position.set(x, y + 0.02, z); r.mesh.scale.setScalar(size); r.age = 0; r.life = life; r.size = size; r.mesh.visible = true;
    const u = (r.mesh.material as ShaderMaterial).uniforms;
    u.uSize.value = size;
    // Where the bank stops it, each of sixteen ways (the plane's v runs against world z: rotateX(-π/2)).
    const reach = u.uReach.value as number[];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, cx = Math.cos(a), cz = -Math.sin(a);
      // The muzzle meets the water at its very edge: dry steps before the water is reached are skipped;
      // after it, the first dry step is the bank.
      let m = 0, wet = false;
      for (let s = 0.1; s <= size + 0.05; s += 0.1) {
        const w = (pool.depthAt?.(x + cx * s, z + cz * s) ?? 1) > 0.01;
        if (w) { wet = true; m = s; } else if (wet || s > 0.6) break;
      }
      reach[k] = m;
    }
  };
  // Dev: set a ring by hand (to look at the rings without waiting for a dweller to drink).
  if (import.meta.env.DEV) (window as unknown as { guixuRing?: typeof ring }).guixuRing = ring;
  useFrame((_, delta) => {
    const dt = run ? Math.min(delta, 0.05) : 0;
    const list: Scarer[] = [];
    scarers.forEach((d) => {
      if (!d) return;
      const p = d.pose, drinking = p.activity === 'drink';
      const at = drinking ? (d.stand?.water ?? d.sites.drink.water) : null;
      list.push({ id: d.id, x: at ? at[0] : p.x, z: at ? at[2] : p.z, on: p.activity === 'walk' || drinking, drinking });
    });
    pool.scarers = list;
    for (const sc of list) {
      let saw = false;
      for (const f of fish) {
        if (f.startled) { ring(f.now.x, f.now.z, 0.7, 1.1); if (Math.hypot(f.now.x - sc.x, f.now.z - sc.z) < WATCH_NEAR) saw = true; }
      }
      const left = Math.max(0, (watching.get(sc.id) ?? 0) - dt);
      watching.set(sc.id, saw ? WATCH_S : left);
      // A ring from the muzzle now and then while it drinks.
      sip.current[sc.id] = sc.drinking ? (sip.current[sc.id] ?? 0) + dt : SIP_RING_S;
      if (sc.drinking && sip.current[sc.id] >= SIP_RING_S) { sip.current[sc.id] = 0; ring(sc.x, sc.z, 1.4, 2.6); }
    }
    for (const r of rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) { r.mesh.visible = false; continue; }
      (r.mesh.material as ShaderMaterial).uniforms.uK.value = k;
      // Carried down the current, a little (the rings drift with the water, as the flow's own ripples do).
      const [fx, fz] = pool.flowAt(r.mesh.position.x, r.mesh.position.z);
      r.mesh.position.x += fx * 0.5 * dt; r.mesh.position.z += fz * 0.5 * dt;
      const y = pool.levelAt?.(r.mesh.position.x, r.mesh.position.z);
      if (y !== undefined && Number.isFinite(y)) r.mesh.position.y = y + 0.02;
    }
  });
  return <>{rings.map((r, i) => <primitive key={i} object={r.mesh} />)}</>;
}

/** Swims in place for the preview: the same wave at its cruising speed. */
function PreviewSwim({ form, motion, speed }: { form: FishForm; motion: MutableRefObject<FishMotion>; speed: number }) {
  useFrame((_, dt) => { motion.current.phase += 2 * Math.PI * tailBeatHz(form, speed) * Math.min(dt, 0.05); });
  return null;
}

/**
 * How it was built, drawn on the model (the fish editor's "Structure", as the creature's "Rig"): the
 * spine, five section rings from the profile rule, and the seed point of each patch.
 */
function FishStructure({ form }: { form: FishForm }) {
  const L = form.length, D = form.depth, colour = JADE_UI.seal;
  const rings = [0.12, FORM_RULES.deepestAt, 0.55, 0.75, 0.92].map((u) => {
    const p = fishProfile(u), half = D * 0.3 * p * (1 - 0.45 * smooth(0.45, 1, u)) + 0.002;
    return Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2, sa = Math.sin(a); return [L * (0.5 - u), sa * (sa > 0 ? D * 0.54 : D * 0.46) * p * 1.04, Math.cos(a) * half * 1.06] as [number, number, number]; });
  });
  return <group renderOrder={5}>
    <Line points={[[L * 0.5, 0, 0], [-L * 0.5, 0, 0]]} color={colour} lineWidth={2} depthTest={false} />
    {rings.map((r, i) => <Line key={i} points={r} color={colour} lineWidth={1} depthTest={false} transparent opacity={0.8} />)}
    {fishPatches(form).map((m, i) => { const r = D * 0.5 * fishProfile(m.u) * 1.05; return <mesh key={i} position={[L * (0.5 - m.u), Math.cos(m.a) * r, Math.sin(m.a) * r * 0.6]}><sphereGeometry args={[L * 0.012, 8, 6]} /><meshBasicMaterial color={colour} depthTest={false} /></mesh>; })}
  </group>;
}

/**
 * The model (atlas editor, life card): true size in metres against a camera framed for the longest
 * fish (75 cm), so the length slider shows. `swim` beats its tail by its own rule; `structure` draws
 * how it was built.
 */
export function FishPreview({ fish, compact = false, swim = false, structure = false, speed }: { fish: FishForm; compact?: boolean; swim?: boolean; structure?: boolean; speed?: number }) {
  const motion = useRef<FishMotion>({ phase: 0, sweep: SWIM.sweep });
  const cruise = speed ?? fish.length * (SWIM.cruise[0] + SWIM.cruise[1]) / 2;
  return <div className="fish-preview" aria-label="3D model"><Canvas camera={{ position: compact ? [0.35, 0.25, 1.0] : [0.32, 0.22, 0.95], fov: 35 }}><color attach="background" args={[JADE_UI.mist]} /><ambientLight intensity={1.5} /><directionalLight position={[2, 3, 3]} intensity={2.2} />
    <group rotation={[0, -0.25, 0]} scale={compact ? 0.6 / fish.length : 1}><FishBody fish={fish} motion={swim ? motion : undefined} />{structure && <FishStructure form={fish} />}</group>
    {swim && <PreviewSwim form={fish} motion={motion} speed={cruise} />}
    <OrbitControls enablePan={false} minDistance={0.4} maxDistance={2.4} /></Canvas></div>;
}
