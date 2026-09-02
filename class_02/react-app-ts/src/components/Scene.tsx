import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useRef } from 'react'
import type { Mesh } from 'three'

function Cube() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.x += delta * 0.3
    meshRef.current.rotation.y += delta * 0.5
  })

  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#7c3aed" roughness={0.25} metalness={0.45} />
    </mesh>
  )
}

export default function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: [3.5, 2.5, 4], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0d0d14']} />

      {/* Lights */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 6, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-4, 2, -4]} intensity={0.8} color="#a855f7" />

      {/* Scene objects */}
      <Cube />

      {/* Grid helper */}
      <Grid
        position={[0, -1.2, 0]}
        args={[20, 20]}
        cellColor="#2a2a3a"
        sectionColor="#3d3d55"
        cellSize={0.5}
        sectionSize={2}
        fadeDistance={18}
        infiniteGrid
      />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={1.5}
        maxDistance={20}
      />
    </Canvas>
  )
}
