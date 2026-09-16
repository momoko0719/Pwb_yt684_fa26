import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { ColorMode } from '../types';
import { noiseToRGB } from '../lib/colors';
import FlyCamera from './FlyCamera';

// ─── Terrain mesh ─────────────────────────────────────────────────────────────

interface TerrainProps {
  noiseMap: Float32Array;
  resolution: number;
  heightScale: number;
  wireframe: boolean;
  colorMode: ColorMode;
}

function TerrainMesh({ noiseMap, resolution, heightScale, wireframe, colorMode }: TerrainProps) {
  const geomRef = useRef<THREE.PlaneGeometry>(null);

  useEffect(() => {
    const geom = geomRef.current;
    if (!geom || !noiseMap) return;

    const positions = geom.attributes.position.array as Float32Array;
    const totalVerts = resolution * resolution;
    const colors = new Float32Array(totalVerts * 3);

    for (let r = 0; r < resolution; r++) {
      for (let c = 0; c < resolution; c++) {
        const vi = r * resolution + c;
        positions[vi * 3 + 2] = noiseMap[vi] * heightScale;
        const [R, G, B] = noiseToRGB(noiseMap[vi], colorMode);
        colors[vi * 3] = R; colors[vi * 3 + 1] = G; colors[vi * 3 + 2] = B;
      }
    }

    geom.attributes.position.needsUpdate = true;
    geom.computeVertexNormals();
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [noiseMap, resolution, heightScale, colorMode]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <planeGeometry ref={geomRef} args={[10, 10, resolution - 1, resolution - 1]} />
      <meshStandardMaterial
        vertexColors wireframe={wireframe}
        side={THREE.DoubleSide} roughness={0.8} metalness={0.1}
      />
    </mesh>
  );
}

// ─── Scene wrapper ────────────────────────────────────────────────────────────

interface SceneProps extends TerrainProps {
  exploreMode: boolean;
  flySpeed: number;
  onLockChange?: (locked: boolean) => void;
}

export default function Terrain3D({ exploreMode, flySpeed, onLockChange, ...terrainProps }: SceneProps) {
  // Walking height ≈ mid terrain height + 0.5
  const groundY = terrainProps.heightScale * 0.5 + 0.5;

  return (
    <Canvas
      shadows
      camera={{ position: [8, 6, 10], fov: 65 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0d0d14']} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 8]} intensity={1.6}
        castShadow shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-6, 4, -6]} intensity={0.5} color="#6d28d9" />

      <TerrainMesh {...terrainProps} />

      <Grid
        position={[0, -0.02, 0]} args={[30, 30]}
        cellSize={0.5} sectionSize={5}
        cellColor="#1e1e30" sectionColor="#2a2a45"
        fadeDistance={25} infiniteGrid
      />

      {exploreMode
        ? <FlyCamera enabled speed={flySpeed} groundY={groundY} onLockChange={onLockChange} />
        : <OrbitControls makeDefault enableDamping dampingFactor={0.07} minDistance={2} maxDistance={40} />
      }
    </Canvas>
  );
}
