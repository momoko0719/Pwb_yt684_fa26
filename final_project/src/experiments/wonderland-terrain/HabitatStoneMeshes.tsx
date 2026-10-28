import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { PORCELAIN } from '../../core/palette';
import { createPorcelainMaterial } from '../../core/shaders/porcelain';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { BODY, type Dwelling } from './dwelling';
import { obstaclesWithHeld, stoneGeometry, stonesWithHeld, type HabitatLayout } from './habitatStones';

/**
 * The stones from placeHabitat. One mesh each, no distance swap. A rest stone withheld because
 * the creature was in the seat is drawn, and added to the obstacle list, on the frame it leaves.
 * That does not rebuild the layout.
 */
export function HabitatStones({ layout, uniforms, dwelling }: { layout: HabitatLayout; uniforms: WorldUniforms; dwelling: Dwelling }) {
  const warm = useMemo(() => {
    const m = createPorcelainMaterial(uniforms);
    (m.uniforms.uBody.value as Color).set(PORCELAIN.habitatStone);
    return m;
  }, [uniforms]);
  const shade = useMemo(() => {
    const m = createPorcelainMaterial(uniforms);
    (m.uniforms.uBody.value as Color).set(PORCELAIN.habitatStoneShade);
    return m;
  }, [uniforms]);
  useEffect(() => () => { warm.dispose(); shade.dispose(); }, [warm, shade]);

  const [token, setToken] = useState(layout);
  const [revealed, setRevealed] = useState(false);
  if (token !== layout) {
    setToken(layout);
    setRevealed(false);
  }
  useFrame(() => {
    const held = layout.heldRest;
    if (!held || revealed) return;
    const p = dwelling.pose;
    if (Math.hypot(p.x - held.x, p.z - held.z) >= held.planR + BODY.torso.across + 0.2) setRevealed(true);
  });
  useLayoutEffect(() => {
    // No withheld stone: leave the obstacle list alone. The shelter's wall circles are set with
    // the layout and must not be replaced by the shore list.
    if (!layout.heldRest) return;
    dwelling.setObstacles(obstaclesWithHeld(layout, revealed));
  }, [dwelling, layout, revealed]);

  const draw = useMemo(() => stonesWithHeld(layout, revealed), [layout, revealed]);
  const geoms = useMemo(() => draw.map((s) => stoneGeometry(s.meshSeed, s.shape)), [draw]);
  useEffect(() => () => { geoms.forEach((g) => g.dispose()); }, [geoms]);
  return (
    <group>
      {draw.map((s, i) => (
        <mesh
          key={`${s.kind}-${s.group}-${s.meshSeed}`}
          geometry={geoms[i]}
          material={s.tint === 'warm' ? warm : shade}
          position={[s.x, s.y, s.z]}
          rotation-y={-s.yaw}
          raycast={() => {}}
          userData={{ scaleKind: 'habitatStone' }}
        />
      ))}
    </group>
  );
}
