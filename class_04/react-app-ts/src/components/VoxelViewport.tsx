/**
 * Shared Three.js viewport for a MeshBuffers volume surface.
 */
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { MeshBuffers } from '../lib/meshCulled';

function TerrainMesh({ mesh, wireframe, color }: {
  mesh: MeshBuffers; wireframe: boolean; color: string;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.12}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface Props {
  mesh: MeshBuffers;
  wireframe?: boolean;
  color?: string;
  cameraPos?: [number, number, number];
}

export default function VoxelViewport({
  mesh, wireframe = false, color = '#b08968', cameraPos = [2.4, 1.8, 2.8],
}: Props) {
  return (
    <Canvas camera={{ position: cameraPos, fov: 45 }} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#1a1410']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={1.25} />
      <directionalLight position={[-3, 2, -4]} intensity={0.4} color="#e8c4a0" />
      <TerrainMesh mesh={mesh} wireframe={wireframe} color={color} />
      <Grid
        position={[0, -1.05, 0]} args={[8, 8]}
        cellSize={0.25} sectionSize={1}
        cellColor="#3a2e26" sectionColor="#4a3b30"
        fadeDistance={10} infiniteGrid
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={12} />
    </Canvas>
  );
}
