import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3 } from 'three';

/**
 * Double-click a terrain hit → smooth orbit target + dolly toward that point.
 * Does not change pivot on ordinary left-drag (OrbitControls rotate stays stable).
 * Sky / miss → no jump. Shares the same OrbitControls target state as wheel/pan.
 * User wheel / pointer-down **immediately interrupts** the focus animation.
 */
export default function OrbitFocus({
  enabled,
  above,
  animRef,
}: {
  enabled: boolean;
  above: (x: number, z: number) => number;
  /** Optional: true while a focus tween is running (nav diagnostics). */
  animRef?: { current: boolean };
}) {
  const { camera, gl, controls, scene } = useThree();
  const anim = useRef<number | null>(null);
  const ray = useRef(new Raycaster());
  const ndc = useRef(new Vector2());

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;

    const cancelAnim = () => {
      if (anim.current) {
        cancelAnimationFrame(anim.current);
        anim.current = null;
      }
      if (animRef) animRef.current = false;
    };

    const onDbl = (e: MouseEvent) => {
      const ctrl = controls as unknown as {
        target: Vector3;
        update: () => void;
        enabled?: boolean;
      } | null;
      if (!ctrl?.target) return;
      const rect = el.getBoundingClientRect();
      ndc.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.current.setFromCamera(ndc.current, camera);
      const hits = ray.current.intersectObjects(scene.children, true);
      let hit: { point: Vector3 } | null = null;
      for (const h of hits) {
        if (h.object.userData?.orbitIgnore) continue;
        if (h.distance > 2200) continue;
        hit = h;
        break;
      }
      if (!hit) return;
      const dest = hit.point.clone();
      const floor = above(dest.x, dest.z);
      if (Number.isFinite(floor)) dest.y = Math.max(dest.y, floor + 0.2);

      const fromT = ctrl.target.clone();
      const fromP = camera.position.clone();
      const toFocus = dest.clone();
      const offset = fromP.clone().sub(fromT);
      const dist = Math.max(offset.length() * 0.85, 8);
      offset.normalize().multiplyScalar(dist);
      const toP = toFocus.clone().add(offset);
      const camFloor = above(toP.x, toP.z) + 2;
      if (toP.y < camFloor) toP.y = camFloor;

      cancelAnim();
      if (animRef) animRef.current = true;
      const t0 = performance.now();
      const dur = 420;
      const tick = (now: number) => {
        const u = Math.min(1, (now - t0) / dur);
        const s = u * u * (3 - 2 * u);
        ctrl.target.lerpVectors(fromT, toFocus, s);
        camera.position.lerpVectors(fromP, toP, s);
        ctrl.update();
        if (u < 1) anim.current = requestAnimationFrame(tick);
        else {
          anim.current = null;
          if (animRef) animRef.current = false;
        }
      };
      anim.current = requestAnimationFrame(tick);
    };

    el.addEventListener('dblclick', onDbl);
    el.addEventListener('wheel', cancelAnim, { passive: true });
    el.addEventListener('pointerdown', cancelAnim);
    return () => {
      el.removeEventListener('dblclick', onDbl);
      el.removeEventListener('wheel', cancelAnim);
      el.removeEventListener('pointerdown', cancelAnim);
      cancelAnim();
    };
  }, [enabled, camera, gl, controls, scene, above, animRef]);

  return null;
}
