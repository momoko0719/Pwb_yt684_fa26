import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { StudyScene } from './StudyScene';
import type { ParamValues } from '../studies/types';

export default function Viewport({
  studyId, params, showMask,
}: {
  studyId: string;
  params: ParamValues;
  showMask: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [2.4, 1.6, 2.8], fov: 42 }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={['#0e1014']} />
      <fog attach="fog" args={['#0e1014', 8, 18]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 2]} intensity={1.1} />
      <directionalLight position={[-3, 2, -4]} intensity={0.25} color="#9ab0c8" />

      <StudyScene id={studyId} params={params} showMask={showMask} />

      <Grid
        position={[0, -1.1, 0]}
        args={[10, 10]}
        cellSize={0.25}
        sectionSize={1}
        cellColor="#1c222c"
        sectionColor="#2a3340"
        fadeDistance={12}
        infiniteGrid
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={10} />
    </Canvas>
  );
}
