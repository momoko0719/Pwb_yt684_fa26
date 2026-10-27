import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector2, Vector3 } from 'three';
import { sampleGrid, type HeightGrid } from '../../core/terrain/heightGrid';

const MIN_DIST = 3;
const STUCK_EPS = 0.2;
/** Ground must be this far (orbit-style) before we relocate the pivot. */
const HIT_FAR = 14;
const LERP = 6;
const DRAG_COOLDOWN = 0.15;

type Ctrl = {
  target: Vector3;
  update: () => void;
  minDistance?: number;
};

/**
 * Stuck evidence: cam↔target ≈ minDistance while the *visual* subject is 80–200 m away.
 * Mesh raycasts often hit the island underside (y ≪ 0) first — those must not drive the pivot.
 *
 * Fix: when zooming in while stuck, march the **height grid** under the cursor (same land test as
 * cover focus). Hold the camera; lerp Orbit target to that ground point so cam↔target opens and
 * further wheel zooms work. No lower minDistance, no dig.
 */
export default function OrbitPivotRescue({
  enabled,
  grid,
  above,
  minDistance = MIN_DIST,
}: {
  enabled: boolean;
  grid: HeightGrid;
  above: (x: number, z: number) => number;
  minDistance?: number;
}) {
  const { camera, gl, controls } = useThree();
  const pointer = useRef({ x: 0.5, y: 0.5 });
  const wheelIn = useRef(false);
  const dragUntil = useRef(0);
  const dest = useRef<Vector3 | null>(null);
  const _dir = useRef(new Vector3());
  const _p = useRef(new Vector3());
  const _ndc = useRef(new Vector2());

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.x = (e.clientX - r.left) / Math.max(r.width, 1);
      pointer.current.y = (e.clientY - r.top) / Math.max(r.height, 1);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) wheelIn.current = true;
    };
    const onDown = () => {
      dragUntil.current = performance.now() / 1000 + DRAG_COOLDOWN;
      dest.current = null;
    };
    // Capture so we see the wheel even when OrbitControls stops dollying at minDistance.
    el.addEventListener('pointermove', onMove);
    el.addEventListener('wheel', onWheel, { passive: true, capture: true });
    el.addEventListener('pointerdown', onDown);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('wheel', onWheel, true);
      el.removeEventListener('pointerdown', onDown);
    };
  }, [enabled, gl]);

  /** March cursor ray against the height field (ignores underside / water meshes). */
  const pickGround = (): Vector3 | null => {
    _ndc.current.set(pointer.current.x * 2 - 1, -(pointer.current.y * 2 - 1));
    // Unproject a far point to get world direction through the cursor.
    const cam = camera;
    _p.current.set(_ndc.current.x, _ndc.current.y, 0.5).unproject(cam);
    _dir.current.copy(_p.current).sub(cam.position).normalize();
    _p.current.copy(cam.position);
    const half = ((grid.size - 1) * grid.texel) / 2;
    for (let k = 0; k < 100; k++) {
      const x = _p.current.x, z = _p.current.z;
      if (Math.abs(x) > half * 0.98 || Math.abs(z) > half * 0.98) {
        _p.current.addScaledVector(_dir.current, 40);
        if (_p.current.y < -250) return null;
        continue;
      }
      const gy = sampleGrid(grid, x, z);
      if (!(gy > -50) || sampleGrid(grid, x, z, 3) > -1.2) {
        _p.current.addScaledVector(_dir.current, 12);
        if (_p.current.y < -250) return null;
        continue;
      }
      const aboveG = _p.current.y - gy;
      if (aboveG <= 1.2) {
        return new Vector3(x, gy + 0.2, z);
      }
      const step = Math.max(aboveG * 0.45, 2);
      _p.current.addScaledVector(_dir.current, step);
      if (_p.current.y < -250) return null;
    }
    return null;
  };

  useFrame((_, dt) => {
    if (!enabled) return;
    const ctrl = controls as unknown as Ctrl | null;
    if (!ctrl?.target) return;

    const dist = camera.position.distanceTo(ctrl.target);
    const stuck = dist <= minDistance + STUCK_EPS;
    const now = performance.now() / 1000;
    if (now < dragUntil.current) {
      dest.current = null;
      wheelIn.current = false;
      return;
    }

    if (stuck && wheelIn.current) {
      const hit = pickGround();
      wheelIn.current = false;
      if (hit) {
        const range = Math.hypot(hit.x - camera.position.x, hit.y - camera.position.y, hit.z - camera.position.z);
        if (range >= HIT_FAR) dest.current = hit;
      }
    } else {
      wheelIn.current = false;
    }

    if (!dest.current) return;

    const t = 1 - Math.exp(-LERP * Math.min(dt, 0.05));
    ctrl.target.lerp(dest.current, t);
    const ty = above(ctrl.target.x, ctrl.target.z);
    if (Number.isFinite(ty) && ctrl.target.y < ty + 0.12) ctrl.target.y = ty + 0.12;
    ctrl.update();

    if (ctrl.target.distanceTo(dest.current) < 0.5) dest.current = null;
    if (camera.position.distanceTo(ctrl.target) > minDistance + 4) dest.current = null;
  });

  return null;
}
