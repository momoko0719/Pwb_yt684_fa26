import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { AmbientLight, ConeGeometry, CylinderGeometry, DataTexture, DirectionalLight, Group, LinearFilter, Mesh, MeshStandardMaterial, PerspectiveCamera, RGBAFormat, Scene, SphereGeometry, Vector3, WebGLRenderer, type ShaderMaterial } from 'three';
import { LAYER, PORCELAIN, WEAR_DEBUG } from '../../core/palette';
import { setTerrainShadow, setTerrainWear } from '../../core/terrain/cdlod';
import { BODY, REST_MARK, type CreatureNeeds, type Dwelling, type Point } from './dwelling';
import { birthAxes, resolveMorph, type MorphAxes } from './creatureMorph';

/** A creature's form (dwellerNames.ts): all of it, or just its antlers (the rest as sculpted). */
export type Antlers = Partial<MorphAxes>;
import { buildRiggedCreature, poseRiggedCreature } from './creatureRig';
import { setWorldPointer } from './worldPointer';
import { NEED_ICON } from './LifeCard';

/** Which debug drawings are on. All default off; the normal picture has none of these lines. */
export interface CreatureDebugFlags {
  /** Body centre, simulated hips and feet, and the mesh's neck, head, tail and knees. */
  skeleton: boolean;
  /** The four feet, planted or swinging. */
  feet: boolean;
  /** State, goal, facing and movement. */
  state: boolean;
  /** The route it is walking now. */
  route: boolean;
  /** Muzzle and the water point it is trying to reach. */
  drink: boolean;
  /** Home anchor, the lie, and the rest contact ellipse. */
  rest: boolean;
}

export interface CreatureReadout {
  activity: string;
  heading: number;
  vx: number;
  vz: number;
  goalKind: 'drink' | 'rest' | 'eat';
  goalX: number;
  goalZ: number;
  planted: boolean[];
}

export const CREATURE_DEBUG_OFF: CreatureDebugFlags = {
  skeleton: false, feet: false, state: false, route: false, drink: false, rest: false,
};

/**
 * The dwelling on the page: its simulation advanced each frame (simulated seconds = real seconds ×
 * speed, in steps of at most STEP, so its marks are the same at any speed), the contact map
 * handed to the ground as a texture (the ground's shader makes jade of it), a soft shadow under
 * the creature, and the creature itself: a white figure, standing, walking, drinking or lying.
 */
const STEP = 0.25; // simulated seconds a step, at most
const UPLOAD = 0.1; // real seconds between uploads of the contact map, at most one each
const SHADOW = { radius: 1.1, strength: 0.28 };

export interface DwellingStats { activity: string; cycles: number; time: number; needs: CreatureNeeds; grass: number | null; goal: string }

export function DwellingView({ dwelling, ground, run, speed, show, debug, selecting, onSelect, calls, onStats, onReadout, antlers }: {
  dwelling: Dwelling;
  antlers?: Antlers;
  /** The ground's material (cdlod.ts), to hand the contact map and the shadow to. */
  ground: ShaderMaterial;
  run: boolean;
  speed: number;
  /** Contact painted on the ground (walk / drink / rest channels). Not the skeleton. */
  show: boolean;
  debug: CreatureDebugFlags;
  /** Click the creature to open its card. Orbit drag is paused by the page while this is on. */
  selecting: boolean;
  onSelect: () => void;
  /** The panel's button: start afresh (the creature at home, the ground untouched). */
  calls: { reset: () => void; look: () => void };
  onStats: (s: DwellingStats) => void;
  onReadout: (r: CreatureReadout) => void;
}) {
  const map = dwelling.map;
  useEffect(() => {
    calls.reset = () => dwelling.reset();
  }, [calls, dwelling]);
  const texture = useMemo(() => {
    const t = new DataTexture(new Uint8Array(map.cells * map.cells * 4), map.cells, map.cells, RGBAFormat);
    t.magFilter = t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [map]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    setTerrainWear(ground, { texture, x0: map.x0, z0: map.z0, size: map.cells * map.texel }, show);
    return () => setTerrainWear(ground, null);
  }, [ground, texture, map, show]);
  useEffect(() => () => setTerrainShadow(ground, 0, 0, 1, 0), [ground]);
  // In development only: the dwelling to the browser console (to run it ahead by the same rules,
  // a step at a time, and check the marks).
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { guixuDwelling?: Dwelling }).guixuDwelling = dwelling;
  }, [dwelling]);

  const body = useRef<Group>(null);
  const uploaded = useRef({ version: -1, at: 0 });
  const told = useRef(0);
  useFrame(({ clock }, delta) => {
    if (run) {
      let left = Math.min(delta, 0.1) * speed;
      while (left > 1e-6) { const dt = Math.min(left, STEP); dwelling.step(dt); left -= dt; }
    }
    const now = clock.elapsedTime;
    // (A clock that went back, as after a hot reload, counts as time enough.)
    if (map.version !== uploaded.current.version && (now - uploaded.current.at > UPLOAD || now < uploaded.current.at)) {
      const data = texture.image.data as Uint8Array;
      for (let t = 0, n = map.cells * map.cells; t < n; t++) {
        data[t * 4] = Math.round(map.walk[t] * 255);
        data[t * 4 + 1] = Math.round(map.drink[t] * 255);
        data[t * 4 + 2] = Math.round(map.rest[t] * 255);
      }
      texture.needsUpdate = true;
      uploaded.current = { version: map.version, at: now };
    }
    const p = dwelling.pose;
    setTerrainShadow(ground, p.x, p.z, SHADOW.radius * (1 + 0.2 * p.lying), SHADOW.strength * (0.7 + 0.3 * p.lying));
    if (body.current) pose(body.current, dwelling);
    if (now - told.current > 0.4) {
      told.current = now;
      onStats({ activity: p.activity, cycles: dwelling.cycles, time: dwelling.time, needs: { ...dwelling.needs }, grass: dwelling.grazing?.biomass ?? null, goal: dwelling.intent.kind });
      const g = dwelling.intent;
      onReadout({
        activity: p.activity, heading: p.heading, vx: g.vx, vz: g.vz,
        goalKind: g.kind, goalX: g.x, goalZ: g.z, planted: [...p.planted],
      });
    }
  });

  const drawing = debug.skeleton || debug.feet || debug.state || debug.route || debug.drink || debug.rest;
  return (
    <>
      <CreatureFigure ref={body} selecting={selecting} onSelect={onSelect} antlers={antlers} />
      {drawing && <CreatureDebug dwelling={dwelling} body={body} debug={debug} />}
      {selecting && <ThoughtBubble dwelling={dwelling} />}
    </>
  );
}

/**
 * A second creature (docs/plan-2026-11-18-school-herd.md): the same body and rules, its own home and
 * day. Its steps go on the contact map the first creature's view already paints; the ground shadow
 * and the debug drawings stay with the first.
 */
export function CompanionView({ dwelling, run, speed, selecting, onSelect, onStats, antlers, debug }: {
  antlers?: Antlers;
  /** The same debug drawings as the first creature's (the island rig shows both). */
  debug?: CreatureDebugFlags;
  dwelling: Dwelling; run: boolean; speed: number; selecting: boolean; onSelect: () => void; onStats: (s: DwellingStats) => void;
}) {
  const body = useRef<Group>(null);
  const told = useRef(0);
  useFrame(({ clock }, delta) => {
    if (run) {
      let left = Math.min(delta, 0.1) * speed;
      while (left > 1e-6) { const dt = Math.min(left, STEP); dwelling.step(dt); left -= dt; }
    }
    if (body.current) pose(body.current, dwelling);
    const now = clock.elapsedTime;
    if (now - told.current > 0.4) {
      told.current = now;
      const p = dwelling.pose;
      onStats({ activity: p.activity, cycles: dwelling.cycles, time: dwelling.time, needs: { ...dwelling.needs }, grass: dwelling.grazing?.biomass ?? null, goal: dwelling.intent.kind });
    }
  });
  return <>
    <CreatureFigure ref={body} selecting={selecting} onSelect={onSelect} antlers={antlers} />
    {debug && (debug.skeleton || debug.feet || debug.state || debug.route || debug.drink || debug.rest) && <CreatureDebug dwelling={dwelling} body={body} debug={debug} />}
    {selecting && <ThoughtBubble dwelling={dwelling} />}
  </>;
}

/** Above the crown (metres over the ground under its middle). */
const BUBBLE_UP = 2.25;
const BUBBLE_ICON = { drink: 'water', eat: 'food', rest: 'rest' } as const;

/**
 * What it is going for, as The Sims' thought bubble: one icon above it while it walks to a goal (water,
 * grass, its bed); nothing while it rests, drinks or grazes. No words: the card says what it does and
 * how it feels, the bubble only where it is going.
 */
function ThoughtBubble({ dwelling }: { dwelling: Dwelling }) {
  const at = useRef<Group>(null), shown = useRef<keyof typeof BUBBLE_ICON | null>(null);
  const [kind, setKind] = useState<keyof typeof BUBBLE_ICON | null>(null);
  useFrame(() => {
    const p = dwelling.pose;
    const next = p.activity === 'walk' ? dwelling.intent.kind : null;
    if (next !== shown.current) { shown.current = next; setKind(next); }
    at.current?.position.set(p.x, p.y + BUBBLE_UP, p.z);
  });
  // The Html stays mounted (mounting and unmounting it as goals change raced React's DOM removal);
  // only its content comes and goes.
  return <group ref={at}><Html center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
    {kind && <div key={kind} className={`thought-bubble thought-${kind}`}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={NEED_ICON[BUBBLE_ICON[kind]]} /></svg></div>}
  </Html></group>;
}

/** The lie: the shelter bed when one is set, otherwise the home anchor. Default off with Contact debug. */
function RestRing({ x, y, z, radius, color = WEAR_DEBUG.rest }: { x: number; y: number; z: number; radius: number; color?: string }) {
  const pts = useMemo(() => {
    const n = 48, out: Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push(new Vector3(x + Math.cos(a) * radius, y + 0.08, z + Math.sin(a) * radius));
    }
    return out;
  }, [x, y, z, radius]);
  return <Line points={pts} color={color} lineWidth={1} depthTest={false} renderOrder={20} />;
}

const groundY = (d: Dwelling, x: number, z: number) => d.groundAt(x, z);

// The figure, drawn from the body's numbers (BODY in dwelling.ts: what is drawn is what touches):
// a torso, a neck from its shoulder to a head whose front is the muzzle, two small horns, a tail;
// four legs, each from its hip to where its foot stands (in the world, not the body: a planted
// foot stays put however the body moves above it), in two parts that bend when the leg is shorter
// than its length (forelegs at the knee, forward; hind legs at the hock, back; lying, in under
// the body).
const LEG = { top: 0.055, bottom: 0.045, part: (BODY.torso.stand - BODY.hipDrop) / 2 }; // metres: radii; each part's length

function CreatureFigure({ ref, selecting, onSelect, antlers }: { ref: React.Ref<Group>; selecting: boolean; onSelect: () => void; antlers?: Antlers }) {
  const figure = useMemo(() => buildCreatureObject(antlers), [antlers]);
  useEffect(() => () => disposeCreatureObject(figure), [figure]);
  return (
    <primitive
      object={figure}
      ref={ref}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!selecting) return;
        e.stopPropagation();
        setWorldPointer(null);
        onSelect();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { if (selecting) { e.stopPropagation(); setWorldPointer('creature'); } }}
      onPointerOut={() => setWorldPointer(null)}
    />
  );
}

const UP = new Vector3(0, 1, 0), along = new Vector3(), side = new Vector3(), knee = new Vector3();

/** A leg's part from a to b: a unit cylinder set between them. */
function part(m: { position: Vector3; quaternion: { setFromUnitVectors: (a: Vector3, b: Vector3) => void }; scale: Vector3 }, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  along.set(ax - bx, ay - by, az - bz);
  const length = along.length();
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.quaternion.setFromUnitVectors(UP, along.normalize());
  m.scale.set(1, Math.max(length, 0.01), 1);
}

/** Set the figure to the creature's pose: the body where it is, which way, tipped; its neck; each leg from hip to foot. */
function pose(g: Group, d: Dwelling) {
  const p = d.pose;
  const body = g.getObjectByName('body')!, torso = g.getObjectByName('torso')!, neck = g.getObjectByName('neck')!, head = g.getObjectByName('head')!;
  // (Tipped about the torso's middle, as the body's numbers are.)
  body.position.set(p.x, p.y + p.torso, p.z);
  body.rotation.set(0, -p.heading, p.pitch);
  torso.position.y = 0;
  // The neck at its own angle from level (the body's tip taken off); the head turned back toward level.
  neck.rotation.z = p.neck - p.pitch;
  head.rotation.z = -d.form.head.level * p.neck;
  const morphFigure = g.getObjectByName('morphFigure') as Group | undefined;
  for (let k = 0; k < 4; k++) {
    const [hx, hy, hz] = p.hips[k], [fx, fy, fz] = p.feet[k];
    // The knee (or hock): off the hip–foot line by what the two parts' length leaves, in the
    // body's upright plane, forward for a foreleg, back for a hind leg.
    const dx = fx - hx, dy = fy - hy, dz = fz - hz, reach = Math.hypot(dx, dy, dz) || 1;
    // (Lying, folded the other way: in under the body, not out of it.)
    // During a sip the compact stance is mostly carried by a continuous foreleg
    // silhouette. The old full IK bend bulged out as two false shoulder humps.
    const bend = Math.sqrt(Math.max(LEG.part * LEG.part - (reach / 2) ** 2, 0)) * (k < 2 ? 1 - 0.72 * p.drinking : -1);
    side.set(Math.cos(p.heading), 0, Math.sin(p.heading)); // forward
    along.set(dx / reach, dy / reach, dz / reach);
    side.addScaledVector(along, -side.dot(along)).normalize(); // forward, square to the leg
    knee.set((hx + fx) / 2, (hy + fy) / 2, (hz + fz) / 2).addScaledVector(side, bend);
    part(g.getObjectByName(`leg${k}a`)! as never, hx, hy, hz, knee.x, knee.y, knee.z);
    part(g.getObjectByName(`leg${k}b`)! as never, knee.x, knee.y, knee.z, fx, fy, fz);
    knees[k] = [knee.x, knee.y, knee.z];
  }
  g.updateWorldMatrix(true, true);
  if (morphFigure) {
    const local = ([x, y, z]: Point) => {
      const v = morphFigure.worldToLocal(new Vector3(x, y, z));
      return { x: v.x, y: v.y, z: v.z };
    };
    // The mouth where the sim puts it (its neck and face are the sculpt's: dwelling.ts SCULPT); the
    // face's angle by the same rule as the sim's (BODY.head), both with the body's tip taken off.
    const muzzle = local(p.muzzle);
    const faceAngle = p.neck * (1 - d.form.head.level) + d.form.head.offset - p.pitch;
    poseRiggedCreature(morphFigure, p.neck - p.pitch - d.form.neckUp, faceAngle, muzzle, p.hips.map(local), knees.map(local), p.feet.map(local), Math.max(p.drinking, p.eating));
  }
}

/** Knees from the last pose. The bend is the same one the leg meshes use; it is not a simulated joint. */
const knees: Point[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

const V = new Vector3();
function worldOf(g: Group, name: string): Point {
  const o = g.getObjectByName(name);
  if (!o) return [0, 0, 0];
  o.getWorldPosition(V);
  return [V.x, V.y, V.z];
}

/**
 * Drawings taken from the pose and from the meshes just posed. Neck, head, tail and knees are
 * labelled visual joints: the simulation stores hips, feet and the muzzle, not those bends.
 */
function CreatureDebug({ dwelling, body, debug }: {
  dwelling: Dwelling;
  body: React.RefObject<Group | null>;
  debug: CreatureDebugFlags;
}) {
  const skel = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const route = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const headLine = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const moveLine = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const drinkLine = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const restLine = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const restGroup = useRef<Group>(null);
  const feetM = useRef<(import('three').Mesh | null)[]>([]);
  const goalM = useRef<import('three').Mesh | null>(null);
  const waterM = useRef<import('three').Mesh | null>(null);
  const muzzleM = useRef<import('three').Mesh | null>(null);
  const plantedMat = useMemo(() => new MeshStandardMaterial({ color: LAYER.footPlanted, depthTest: false, transparent: true, opacity: 0.95 }), []);
  const swingMat = useMemo(() => new MeshStandardMaterial({ color: LAYER.footSwing, depthTest: false, transparent: true, opacity: 0.95 }), []);
  useEffect(() => () => { plantedMat.dispose(); swingMat.dispose(); }, [plantedMat, swingMat]);
  useFrame(() => {
    const g = body.current;
    const p = dwelling.pose;
    if (debug.skeleton && skel.current && g) {
      const neck = worldOf(g, 'rig-neck');
      const neckMid = worldOf(g, 'rig-neck-mid');
      const head = worldOf(g, 'rig-head');
      const tail = worldOf(g, 'tail');
      const bodyC: Point = [p.x, p.y + p.torso, p.z];
      const flat: number[] = [];
      const push = (a: Point, b: Point) => { flat.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
      push(tail, bodyC); push(bodyC, neck); push(neck, neckMid); push(neckMid, head); push(head, p.muzzle);
      for (let k = 0; k < 4; k++) {
        push(worldOf(g, `rig-upper-${k}`), worldOf(g, `rig-lower-${k}`));
        push(worldOf(g, `rig-lower-${k}`), p.feet[k]);
      }
      skel.current.geometry.setPositions(flat);
    }
    if (debug.route && route.current) {
      const way = dwelling.way ?? [[p.x, p.z], [p.x, p.z]];
      route.current.geometry.setPositions(way.flatMap(([x, z]) => [x, p.y + 0.35, z]));
    }
    if (debug.state && headLine.current && moveLine.current) {
      const y = p.y + p.torso + 0.15;
      const hx = p.x + Math.cos(p.heading) * 1.4, hz = p.z + Math.sin(p.heading) * 1.4;
      headLine.current.geometry.setPositions([p.x, y, p.z, hx, y, hz]);
      const speed = Math.hypot(dwelling.intent.vx, dwelling.intent.vz);
      const mx = speed > 0.05 ? p.x + dwelling.intent.vx / speed * 1.4 : p.x;
      const mz = speed > 0.05 ? p.z + dwelling.intent.vz / speed * 1.4 : p.z;
      moveLine.current.geometry.setPositions([p.x, y + 0.08, p.z, mx, y + 0.08, mz]);
      const gy = groundY(dwelling, dwelling.intent.x, dwelling.intent.z);
      goalM.current?.position.set(dwelling.intent.x, gy + 0.2, dwelling.intent.z);
    }
    if (debug.drink && drinkLine.current) {
      const w = dwelling.stand?.water ?? dwelling.sites.drink.water;
      drinkLine.current.geometry.setPositions([p.muzzle[0], p.muzzle[1], p.muzzle[2], w[0], w[1], w[2]]);
      waterM.current?.position.set(w[0], w[1] + 0.05, w[2]);
      muzzleM.current?.position.set(p.muzzle[0], p.muzzle[1], p.muzzle[2]);
    }
    if (debug.rest && restLine.current) {
      const bed = dwelling.restPlace?.bed ?? dwelling.sites.homes[Math.min(dwelling.home, dwelling.sites.homes.length - 1)];
      const lying = p.activity === 'rest';
      const heading = lying ? p.heading : bed?.facing ?? p.heading;
      const cx = lying ? p.x : bed?.x ?? p.x;
      const cz = lying ? p.z : bed?.z ?? p.z;
      const y = groundY(dwelling, cx, cz) + 0.08;
      const c = Math.cos(heading), s = Math.sin(heading);
      const pts: number[] = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const lx = Math.cos(a) * REST_MARK.along, lz = Math.sin(a) * REST_MARK.across;
        pts.push(cx + c * lx - s * lz, y, cz + s * lx + c * lz);
      }
      restLine.current.geometry.setPositions(pts);
    }
    const walking = p.activity === 'walk';
    for (let k = 0; k < 4; k++) {
      const m = feetM.current[k];
      if (!m) continue;
      m.visible = debug.feet && walking;
      if (!m.visible) continue;
      const f = p.feet[k];
      m.position.set(f[0], f[1] + 0.06, f[2]);
      m.material = p.planted[k] ? plantedMat : swingMat;
    }
    if (restGroup.current) restGroup.current.visible = debug.rest && p.activity === 'rest';
  });
  const home = dwelling.sites.homes[Math.min(dwelling.home, dwelling.sites.homes.length - 1)];
  const water = dwelling.stand?.water ?? dwelling.sites.drink.water;
  const goal = dwelling.intent;
  return (
    <group>
      {debug.skeleton && (
        <Line ref={skel as never} points={[[0, 0, 0], [0, 0.01, 0]]} color="#C47B2B" lineWidth={1} depthTest={false} renderOrder={30} segments />
      )}
      {debug.feet && [0, 1, 2, 3].map((k) => (
        <mesh key={k} ref={(m) => { feetM.current[k] = m; }} renderOrder={31}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color={LAYER.footPlanted} depthTest={false} transparent opacity={0.95} />
        </mesh>
      ))}
      {debug.state && (
        <>
          <Line ref={headLine as never} points={[[0, 0, 0], [0, 0.01, 0]]} color="#2E3330" lineWidth={2} depthTest={false} renderOrder={30} />
          <Line ref={moveLine as never} points={[[0, 0, 0], [0, 0.01, 0]]} color="#C47B2B" lineWidth={2} depthTest={false} renderOrder={30} />
          <mesh ref={goalM} position={[goal.x, groundY(dwelling, goal.x, goal.z) + 0.2, goal.z]} renderOrder={31}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshBasicMaterial color="#8FB3AA" depthTest={false} transparent opacity={0.9} />
          </mesh>
        </>
      )}
      {debug.route && (
        <Line ref={route as never} points={[[0, 0, 0], [0, 0.01, 0]]} color="#2C6CB0" lineWidth={2} depthTest={false} renderOrder={29} />
      )}
      {debug.drink && (
        <>
          <Line ref={drinkLine as never} points={[[0, 0, 0], [0, 0.01, 0]]} color="#3A7CA5" lineWidth={1} depthTest={false} renderOrder={30} />
          <mesh ref={waterM} position={[water[0], water[1] + 0.05, water[2]]} renderOrder={31}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color="#3A7CA5" depthTest={false} transparent opacity={0.9} />
          </mesh>
          <mesh ref={muzzleM} position={dwelling.pose.muzzle} renderOrder={31}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshBasicMaterial color="#E0A85A" depthTest={false} transparent opacity={0.95} />
          </mesh>
        </>
      )}
      {debug.rest && home && (
        <group ref={restGroup}>
          <RestRing x={home.x} z={home.z} y={groundY(dwelling, home.x, home.z)} radius={0.45} color="#5F877D" />
          <Line ref={restLine as never} points={[[0, 0, 0], [0, 0.01, 0]]} color="#B8452F" lineWidth={1} depthTest={false} renderOrder={29} />
        </group>
      )}
    </group>
  );
}

/** The exact mesh used by the live creature, initialized in a neutral standing pose for the atlas. */
/** `antlers`: this creature's (dwellerNames.ts); the body is the one sculpt every creature shares. */
export function buildCreatureObject(antlers?: Antlers): Group {
  const material = new MeshStandardMaterial({ color: PORCELAIN.body, roughness: 0.55, metalness: 0 });
  const root = new Group();
  const { along, up, across } = BODY.torso;
  const body = new Group();
  body.name = 'body';
  body.rotation.order = 'YZX';
  body.position.y = BODY.torso.stand;
  root.add(body);
  const torsoGroup = new Group();
  torsoGroup.name = 'torso';
  body.add(torsoGroup);
  const torso = new Mesh(new SphereGeometry(1, 24, 16), material);
  torso.visible = false;
  torso.scale.set(along, up, across);
  torsoGroup.add(torso);
  const tail = new Mesh(new ConeGeometry(0.06, 0.32, 10), material);
  tail.visible = false;
  tail.name = 'tail';
  tail.position.set(-along - 0.02, 0.08, 0);
  tail.rotation.z = 1.1;
  torsoGroup.add(tail);
  const neckGroup = new Group();
  neckGroup.name = 'neck';
  neckGroup.position.set(BODY.shoulder[0], BODY.shoulder[1], 0);
  torsoGroup.add(neckGroup);
  const neck = new Mesh(new CylinderGeometry(0.09, 0.13, BODY.head.at, 12), material);
  neck.visible = false;
  neck.position.x = BODY.head.at / 2;
  neck.rotation.z = -Math.PI / 2;
  neckGroup.add(neck);
  const headGroup = new Group();
  headGroup.name = 'head';
  headGroup.position.x = BODY.head.at;
  neckGroup.add(headGroup);
  const head = new Mesh(new SphereGeometry(0.15, 18, 12), material);
  head.visible = false;
  head.scale.set(1.35, 0.95, 0.9);
  headGroup.add(head);
  for (const side of [-1, 1]) {
    const horn = new Mesh(new ConeGeometry(0.03, 0.2, 8), material);
    horn.visible = false;
    horn.position.set(-0.06, 0.15, side * 0.07);
    horn.rotation.z = 0.35;
    horn.rotation.x = -0.3 * side;
    headGroup.add(horn);
  }
  const resolved = resolveMorph({ worldSeed: 684, creatureSeed: 11, axes: { ...birthAxes(11), ...antlers } });
  const morph = buildRiggedCreature(resolved.figure);
  morph.name = 'morphFigure';
  morph.userData.source = resolved.figure;
  const morphScale = BODY.torso.stand / resolved.morph.torso.stand;
  morph.scale.setScalar(morphScale);
  morph.position.y = -resolved.morph.torso.stand * morphScale;
  body.add(morph);
  BODY.hips.forEach(([x, z], k) => {
    const upper = new Mesh(new CylinderGeometry(LEG.top, (LEG.top + LEG.bottom) / 2, 1, 10), material);
    upper.name = `leg${k}a`;
    upper.visible = false;
    const lower = new Mesh(new CylinderGeometry((LEG.top + LEG.bottom) / 2, LEG.bottom, 1, 10), material);
    lower.name = `leg${k}b`;
    lower.visible = false;
    root.add(upper, lower);
    const hipY = BODY.torso.stand - BODY.hipDrop;
    part(upper, x, hipY, z, x, hipY / 2, z);
    part(lower, x, hipY / 2, z, x, 0, z);
  });
  return root;
}

function disposeCreatureObject(root: Group) {
  const materials = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    if (object.material instanceof MeshStandardMaterial) materials.add(object.material);
  });
  materials.forEach((material) => material.dispose());
}

/** `portrait`: the life card's frame (90 × 78), aimed at the middle of the whole figure, antlers included. */
export function CreatureThumb({ compact = false, portrait = false, antlers }: { compact?: boolean; portrait?: boolean; antlers?: Antlers }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    const height = portrait ? 156 : compact ? 150 : 220;
    const width = portrait ? 180 : Math.max(el.clientWidth, compact ? 160 : 240);
    const narrowCard = compact && width < 210;
    renderer.setSize(width, height);
    el.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(narrowCard ? 52 : compact ? 43 : 34, width / height, 0.05, 20);
    camera.position.set(narrowCard ? 1.8 : compact ? 1.55 : 2.1, narrowCard ? 1.25 : compact ? 1.15 : 1.35, narrowCard ? 2.15 : compact ? 1.85 : 2.5);
    if (portrait) { camera.fov = 40; camera.position.set(1.3, 1.35, 3.7); camera.updateProjectionMatrix(); camera.lookAt(0.23, 0.86, 0); }
    else camera.lookAt(0.32, 0.68, 0);
    scene.add(new AmbientLight(0xffffff, 0.75));
    const sun = new DirectionalLight(0xffffff, 1.15);
    sun.position.set(3, 4, 2);
    scene.add(sun);
    const figure = buildCreatureObject(antlers);
    scene.add(figure);
    renderer.render(scene, camera);
    return () => { disposeCreatureObject(figure); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, [compact, portrait, antlers]);
  return <div ref={host} className={compact ? 'resource-thumb creature-thumb' : 'resource-preview-host'} />;
}
