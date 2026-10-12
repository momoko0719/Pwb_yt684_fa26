import { useEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { SCALE } from './lib/buildMesh';
import { CAVE } from './lib/grotto';

export default function Grotto({ geometry, cave, flat }: { geometry: BufferGeometry; cave: boolean; flat: boolean }) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Small lights along the cave, as if something lived inside.
  const glows = useMemo(() => CAVE.filter((_, i) => i % 3 === 1).map(([x, y, z]) => [x * SCALE, (y - 0.06) * SCALE, z * SCALE] as [number, number, number]), []);
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading={flat} />
      </mesh>
      {cave && (
        <>
          <pointLight position={[0, -0.2, 2]} intensity={60} distance={18} color="#ffc27a" />
          {glows.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.22, 10, 8]} />
              <meshBasicMaterial color="#ffd89a" />
            </mesh>
          ))}
        </>
      )}
      {[-14, -13.4].map((y, i) => (
        <mesh key={i} position-y={y} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[70 - i * 12, 64]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
