import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Quaternion, Vector3 } from 'three';
import { createRng } from '../world/noise';
import type { Trace } from './traits';

const PAPER = '#efe8d8';
const INK = '#2b2a27';

/** The three mountains that remain, drawn with the traces their history left. */
export default function MiniWorld({ traces, seed }: { traces: Set<Trace>; seed: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 22], fov: 48 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, -5.5, 0)}>
      <color attach="background" args={[PAPER]} />
      <hemisphereLight args={['#ffffff', '#8a8072', 1.3]} />
      <directionalLight position={[8, 14, 6]} intensity={1.4} />
      <Scene traces={traces} seed={seed} />
    </Canvas>
  );
}

function Scene({ traces, seed }: { traces: Set<Trace>; seed: number }) {
  const spin = useRef<Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.15;
  });
  const has = (t: Trace) => traces.has(t);
  const spread = has('walls') ? 5.2 : 4.2;
  const islands = useMemo(() => [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    return new Vector3(Math.cos(a) * spread, (i - 1) * 0.5, Math.sin(a) * spread);
  }), [spread]);

  return (
    <group ref={spin}>
      {islands.map((p, i) => (
        <Island key={i} position={p} traces={traces} seed={seed * 7 + i} />
      ))}

      {/* Bridges: the pact of three */}
      {has('bridges') && islands.map((p, i) => <Rope key={i} a={p} b={islands[(i + 1) % 3]} />)}

      {/* Sea of clouds, thicker when immortals turned into cloud */}
      {(has('thickCloud') ? [-1.6, -1.1, -0.6] : [-1.6]).map((y, i) => (
        <mesh key={i} position-y={y - 1.2} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[11 - i * 1.5, 48]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={has('thickCloud') ? 0.5 : 0.35} depthWrite={false} />
        </mesh>
      ))}

      {/* The two lost mountains, faint, deep below in the north */}
      {(has('ghosts') || has('collided')) && (
        <group position={[0, -10, -5]}>
          <IslandShape position={new Vector3(has('collided') ? -0.8 : -3, 0, 0)} ghost />
          <IslandShape position={new Vector3(has('collided') ? 0.8 : 3, 0.4, 0)} ghost />
        </group>
      )}

      {/* Lights in the abyss */}
      {has('abyssLights') && <AbyssLights seed={seed} />}

      {/* Guixu itself */}
      <mesh position-y={-15} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[9, 48]} />
        <meshBasicMaterial color={INK} transparent opacity={0.85} />
      </mesh>

      {/* The giant's fishing line */}
      {has('fishingLine') && (
        <group position={[1.5, 0, -6]}>
          <mesh position-y={8}>
            <cylinderGeometry args={[0.03, 0.03, 22, 4]} />
            <meshBasicMaterial color={INK} />
          </mesh>
          <mesh position-y={-3} rotation-z={Math.PI / 2}>
            <torusGeometry args={[0.5, 0.08, 6, 12, Math.PI * 1.3]} />
            <meshStandardMaterial color="#8a8072" />
          </mesh>
        </group>
      )}

      {/* A stone brought back from Guixu */}
      {has('stone') && (
        <mesh position={[0, 0.5, 0]} scale={0.6}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#6f6b63" flatShading />
        </mesh>
      )}
    </group>
  );
}

function Island({ position, traces, seed }: { position: Vector3; traces: Set<Trace>; seed: number }) {
  const has = (t: Trace) => traces.has(t);
  const rng = createRng(seed);
  const houses = has('refugees') ? 6 : 1;
  const spots = Array.from({ length: houses }, () => [(rng() - 0.5) * 2.2, (rng() - 0.5) * 2.2] as const);

  return (
    <group position={position}>
      <IslandShape position={new Vector3()} lush={has('lush')} snow={has('snow')} />

      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0.45, z]} scale={0.35}>
          <mesh position-y={0.4}>
            <boxGeometry args={[1, 0.8, 0.8]} />
            <meshStandardMaterial color="#c9483a" />
          </mesh>
          <mesh position-y={1.05} rotation-y={Math.PI / 4}>
            <coneGeometry args={[0.95, 0.6, 4]} />
            <meshStandardMaterial color={INK} />
          </mesh>
        </group>
      ))}

      {has('walls') && (
        <mesh position-y={0.35} rotation-x={Math.PI / 2}>
          <torusGeometry args={[2.25, 0.08, 6, 32]} />
          <meshStandardMaterial color="#9b2f22" />
        </mesh>
      )}

      {/* What holds it up */}
      {has('turtles') && (
        <group position-y={-3.9}>
          <mesh scale={[1.5, 0.6, 1.8]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#4f5a3a" flatShading />
          </mesh>
          <mesh position={[0, -0.1, 2]} scale={0.45}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#6b6a4a" flatShading />
          </mesh>
        </group>
      )}
      {has('cloudPillar') && (
        <mesh position-y={-6}>
          <cylinderGeometry args={[0.9, 1.4, 7, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.75} />
        </mesh>
      )}
      {has('giantHands') && (
        <group position-y={-4.3}>
          <mesh scale={[1.6, 0.5, 1.3]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#d9b79a" flatShading />
          </mesh>
          {[-1.1, -0.4, 0.4, 1.1].map((x) => (
            <mesh key={x} position={[x, 0.7, 1.1]}>
              <capsuleGeometry args={[0.2, 0.9, 4, 8]} />
              <meshStandardMaterial color="#d9b79a" flatShading />
            </mesh>
          ))}
        </group>
      )}
      {has('runes') && (
        <mesh position-y={-1.4} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.6, 0.06, 6, 32]} />
          <meshStandardMaterial color="#e0b44c" emissive="#e0b44c" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function IslandShape({ position, lush, snow, ghost }: { position: Vector3; lush?: boolean; snow?: boolean; ghost?: boolean }) {
  const mat = (color: string) => <meshStandardMaterial color={color} flatShading transparent={ghost} opacity={ghost ? 0.25 : 1} />;
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[2.2, 2.0, 0.6, 9]} />
        {mat(lush ? '#5f8a4a' : '#7f8f62')}
      </mesh>
      <mesh position-y={-2} rotation-x={Math.PI}>
        <coneGeometry args={[2.0, 3.4, 9]} />
        {mat('#6f6b63')}
      </mesh>
      {[[-0.6, 0.2, 1.6], [0.7, -0.4, 1.1]].map(([x, z, h], i) => (
        <group key={i} position={[x, 0.3 + h / 2, z]}>
          <mesh>
            <coneGeometry args={[0.7, h, 6]} />
            {mat('#3f78a8')}
          </mesh>
          {snow && !ghost && (
            <mesh position-y={h * 0.32}>
              <coneGeometry args={[0.25, h * 0.36, 6]} />
              <meshStandardMaterial color="#ffffff" flatShading />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function Rope({ a, b }: { a: Vector3; b: Vector3 }) {
  const mid = a.clone().add(b).multiplyScalar(0.5).setY((a.y + b.y) / 2 + 0.2);
  const len = a.distanceTo(b);
  const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <mesh position={mid} quaternion={turn}>
      <cylinderGeometry args={[0.05, 0.05, len, 4]} />
      <meshStandardMaterial color="#9b2f22" />
    </mesh>
  );
}

function AbyssLights({ seed }: { seed: number }) {
  const pts = useMemo(() => {
    const rng = createRng(seed + 5);
    return Array.from({ length: 40 }, (): [number, number, number] => [(rng() - 0.5) * 12, -12 - rng() * 3, (rng() - 0.5) * 12]);
  }, [seed]);
  return (
    <>
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.12, 6, 4]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
      ))}
    </>
  );
}
