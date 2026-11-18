import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, MeshBasicMaterial, Vector3 } from 'three';

function wing(side: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, side * 2.5, 0.45, -1.7, side * 7.4, 0.1, -4.6,
    0, 0, 0, side * 7.4, 0.1, -4.6, side * 4.1, -0.18, -2.2,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Small world-space birds with flapping wings and real parallax when the camera moves. */
export function AtmosphereBirds({ seed, hour }: { seed: number; hour: number }) {
  const left = useMemo(() => wing(-1), []);
  const right = useMemo(() => wing(1), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: '#596268', side: DoubleSide, transparent: true, opacity: 0.4, depthWrite: false }), []);
  const refs = useRef<(Group | null)[]>([]);
  const wings = useRef<(Group | null)[]>([]);
  const phase = (seed % 97) * 0.031;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    material.opacity = hour >= 6 && hour < 19 ? 0.42 : 0.23;
    for (let i = 0; i < refs.current.length; i++) {
      const bird = refs.current[i], pair = wings.current[i];
      if (!bird || !pair) continue;
      const angle = t * (0.075 + i * 0.009) + phase + i * 1.7;
      const radius = 42 + i * 12;
      bird.position.set(405 + Math.cos(angle) * radius, 115 + i * 8 + Math.sin(angle * 1.3) * 6, -185 + Math.sin(angle) * (50 + i * 9));
      const forward = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
      bird.lookAt(bird.position.clone().add(forward));
      const flap = Math.sin(t * 4 + i * 1.6) * 0.18;
      pair.children[0].rotation.z = -flap;
      pair.children[1].rotation.z = flap;
    }
  });
  return <>
    {[0, 1, 2].map((i) => <group key={i} ref={(bird) => { refs.current[i] = bird; }}>
      <group ref={(pair) => { wings.current[i] = pair; }}>
        <mesh geometry={left} material={material} />
        <mesh geometry={right} material={material} />
      </group>
    </group>)}
  </>;
}
