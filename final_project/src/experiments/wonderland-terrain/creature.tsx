import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { DataTexture, LinearFilter, MeshStandardMaterial, RGBAFormat, Vector3, type Group, type ShaderMaterial } from 'three';
import { PORCELAIN, WEAR_DEBUG } from '../../core/palette';
import { setTerrainShadow, setTerrainWear } from '../../core/terrain/cdlod';
import { BODY, type Dwelling } from './dwelling';

/**
 * The dwelling on the page: its simulation advanced each frame (simulated seconds = real seconds ×
 * speed, in steps of at most STEP, so its marks are the same at any speed), the contact map
 * handed to the ground as a texture (the ground's shader makes jade of it), a soft shadow under
 * the creature, and the creature itself: a white figure, standing, walking, drinking or lying.
 */
const STEP = 0.25; // simulated seconds a step, at most
const UPLOAD = 0.1; // real seconds between uploads of the contact map, at most one each
const SHADOW = { radius: 1.1, strength: 0.28 };

export interface DwellingStats { activity: string; cycles: number; time: number }

export function DwellingView({ dwelling, ground, run, speed, show, calls, onStats }: {
  dwelling: Dwelling;
  /** The ground's material (cdlod.ts), to hand the contact map and the shadow to. */
  ground: ShaderMaterial;
  run: boolean;
  speed: number;
  /** The debug view: contact channels coloured on the ground, the sites, the way it is walking. */
  show: boolean;
  /** The panel's button: start afresh (the creature at home, the ground untouched). */
  calls: { reset: () => void; look: () => void };
  onStats: (s: DwellingStats) => void;
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
      onStats({ activity: p.activity, cycles: dwelling.cycles, time: dwelling.time });
    }
  });

  const { drink, homes } = dwelling.sites;
  return (
    <>
      <CreatureFigure ref={body} />
      {show && (
        <group>
          <SiteMark x={drink.x} z={drink.z} y={groundY(dwelling, drink.x, drink.z)} colour={WEAR_DEBUG.drink} />
          {homes.map((h, k) => <SiteMark key={k} x={h.x} z={h.z} y={groundY(dwelling, h.x, h.z)} colour={WEAR_DEBUG.rest} big={k === dwelling.home} />)}
          <WalkingWay dwelling={dwelling} />
        </group>
      )}
    </>
  );
}

const groundY = (d: Dwelling, x: number, z: number) => d.groundAt(x, z);

function SiteMark({ x, y, z, colour, big }: { x: number; y: number; z: number; colour: string; big?: boolean }) {
  return (
    <mesh position={[x, y + 2.5, z]} renderOrder={20}>
      <coneGeometry args={[big ? 0.5 : 0.3, big ? 1.2 : 0.8, 12]} />
      <meshBasicMaterial color={colour} depthTest={false} transparent opacity={0.9} />
    </mesh>
  );
}

/** The way it is walking now, drawn over the ground (refreshed a few times a second). */
function WalkingWay({ dwelling }: { dwelling: Dwelling }) {
  const line = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const shown = useRef<unknown>(null);
  useFrame(() => {
    if (!line.current || shown.current === dwelling.way) return;
    shown.current = dwelling.way;
    const way = dwelling.way ?? [[dwelling.pose.x, dwelling.pose.z], [dwelling.pose.x, dwelling.pose.z]];
    line.current.geometry.setPositions(way.flatMap(([x, z]) => [x, dwelling.pose.y + 0.4, z]));
  });
  return <Line ref={line as never} points={[[0, 0, 0], [0, 0, 0]]} color={WEAR_DEBUG.walk} lineWidth={2} depthTest={false} renderOrder={20} />;
}

// The figure, drawn from the body's numbers (BODY in dwelling.ts: what is drawn is what touches):
// a torso, a neck from its shoulder to a head whose front is the muzzle, two small horns, a tail;
// four legs, each from its hip to where its foot stands (in the world, not the body: a planted
// foot stays put however the body moves above it), in two parts that bend when the leg is shorter
// than its length (forelegs at the knee, forward; hind legs at the hock, back; lying, in under
// the body).
const LEG = { top: 0.055, bottom: 0.045, part: (BODY.torso.stand - BODY.hipDrop) / 2 }; // metres: radii; each part's length

function CreatureFigure({ ref }: { ref: React.Ref<Group> }) {
  const material = useMemo(() => new MeshStandardMaterial({ color: PORCELAIN.body, roughness: 0.55, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const { along, up, across } = BODY.torso;
  const headAt = BODY.head.at; // the head's middle along the neck (its front, the muzzle, BODY.head.front ahead)
  return (
    <group ref={ref}>
      <group name="body" rotation-order="YZX">
        <group name="torso">
          <mesh material={material} scale={[along, up, across]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          <mesh material={material} position={[-along - 0.02, 0.08, 0]} rotation-z={1.1}>
            <coneGeometry args={[0.06, 0.32, 10]} />
          </mesh>
          <group name="neck" position={[BODY.shoulder[0], BODY.shoulder[1], 0]}>
            <mesh material={material} position={[headAt / 2, 0, 0]} rotation-z={-Math.PI / 2}>
              <cylinderGeometry args={[0.09, 0.13, headAt, 12]} />
            </mesh>
            <group name="head" position={[headAt, 0, 0]}>
              <mesh material={material} scale={[1.35, 0.95, 0.9]}>
                <sphereGeometry args={[0.15, 18, 12]} />
              </mesh>
              {[1, -1].map((s) => (
                <mesh key={s} material={material} position={[-0.06, 0.15, 0.07 * s]} rotation-z={0.35} rotation-x={-0.3 * s}>
                  <coneGeometry args={[0.03, 0.2, 8]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
      {BODY.hips.map((_, k) => (
        <group key={k}>
          <mesh name={`leg${k}a`} material={material}>
            <cylinderGeometry args={[LEG.top, (LEG.top + LEG.bottom) / 2, 1, 10]} />
          </mesh>
          <mesh name={`leg${k}b`} material={material}>
            <cylinderGeometry args={[(LEG.top + LEG.bottom) / 2, LEG.bottom, 1, 10]} />
          </mesh>
        </group>
      ))}
    </group>
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
  head.rotation.z = -BODY.head.level * p.neck;
  for (let k = 0; k < 4; k++) {
    const [hx, hy, hz] = p.hips[k], [fx, fy, fz] = p.feet[k];
    // The knee (or hock): off the hip–foot line by what the two parts' length leaves, in the
    // body's upright plane, forward for a foreleg, back for a hind leg.
    const dx = fx - hx, dy = fy - hy, dz = fz - hz, reach = Math.hypot(dx, dy, dz) || 1;
    // (Lying, folded the other way: in under the body, not out of it.)
    const bend = Math.sqrt(Math.max(LEG.part * LEG.part - (reach / 2) ** 2, 0)) * (k < 2 ? 1 : -1) * (p.lying > 0.5 ? -1 : 1);
    side.set(Math.cos(p.heading), 0, Math.sin(p.heading)); // forward
    along.set(dx / reach, dy / reach, dz / reach);
    side.addScaledVector(along, -side.dot(along)).normalize(); // forward, square to the leg
    knee.set((hx + fx) / 2, (hy + fy) / 2, (hz + fz) / 2).addScaledVector(side, bend);
    part(g.getObjectByName(`leg${k}a`)! as never, hx, hy, hz, knee.x, knee.y, knee.z);
    part(g.getObjectByName(`leg${k}b`)! as never, knee.x, knee.y, knee.z, fx, fy, fz);
  }
}
