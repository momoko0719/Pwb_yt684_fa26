import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3 } from 'three';

export type NavDiagSnapshot = {
  cam: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  camTargetDist: number;
  hitName: string;
  hitDist: number;
  hit: { x: number; y: number; z: number } | null;
  wheelDelta: number;
  camDelta: number;
  minDistanceHit: boolean;
  floorClampCam: boolean;
  floorClampTarget: boolean;
  focusAnim: boolean;
  coverBuildMs: number;
};

const EMPTY: NavDiagSnapshot = {
  cam: { x: 0, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  camTargetDist: 0,
  hitName: '—',
  hitDist: 0,
  hit: null,
  wheelDelta: 0,
  camDelta: 0,
  minDistanceHit: false,
  floorClampCam: false,
  floorClampTarget: false,
  focusAnim: false,
  coverBuildMs: 0,
};

/**
 * Default-off Orbit navigation diagnostics. Records camera/target, cursor ray hit, wheel vs
 * camera motion, minDistance / ground-clamp / focus-anim flags, and last cover rebuild ms.
 */
export default function OrbitNavDiag({
  enabled,
  above,
  minDistance,
  coverBuildMsRef,
  focusAnimRef,
  floorFlagsRef,
  onUpdate,
}: {
  enabled: boolean;
  above: (x: number, z: number) => number;
  minDistance: number;
  coverBuildMsRef: { current: number };
  focusAnimRef: { current: boolean };
  floorFlagsRef: { current: { cam: boolean; target: boolean } };
  onUpdate: (s: NavDiagSnapshot) => void;
}) {
  const { camera, gl, controls, scene } = useThree();
  const ray = useRef(new Raycaster());
  const ndc = useRef(new Vector2(0, 0));
  const pointer = useRef({ x: 0.5, y: 0.5 });
  const wheel = useRef({ delta: 0, at: 0 });
  const prevCam = useRef(new Vector3());
  const told = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.x = (e.clientX - r.left) / Math.max(r.width, 1);
      pointer.current.y = (e.clientY - r.top) / Math.max(r.height, 1);
    };
    const onWheel = (e: WheelEvent) => {
      wheel.current.delta = e.deltaY;
      wheel.current.at = performance.now();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('wheel', onWheel);
    };
  }, [enabled, gl]);

  useFrame(({ clock }) => {
    if (!enabled) return;
    if (clock.elapsedTime - told.current < 0.12) return;
    told.current = clock.elapsedTime;

    const ctrl = controls as unknown as { target?: Vector3; minDistance?: number } | null;
    const target = ctrl?.target ?? new Vector3();
    const cam = camera.position;
    const camDelta = prevCam.current.distanceTo(cam);
    prevCam.current.copy(cam);

    ndc.current.set(pointer.current.x * 2 - 1, -(pointer.current.y * 2 - 1));
    ray.current.setFromCamera(ndc.current, camera);
    const hits = ray.current.intersectObjects(scene.children, true);
    let hitName = 'none';
    let hitDist = 0;
    let hit: NavDiagSnapshot['hit'] = null;
    for (const h of hits) {
      if (h.object.userData?.orbitIgnore) continue;
      if (h.distance > 2500) continue;
      hitName = h.object.name || h.object.type || 'mesh';
      if ((h.object as { isInstancedMesh?: boolean }).isInstancedMesh) hitName = `instanced:${hitName}`;
      hitDist = h.distance;
      hit = { x: +h.point.x.toFixed(2), y: +h.point.y.toFixed(2), z: +h.point.z.toFixed(2) };
      break;
    }

    const dist = cam.distanceTo(target);
    const wheelAge = performance.now() - wheel.current.at;
    const wheelDelta = wheelAge < 400 ? wheel.current.delta : 0;
    const minDistanceHit = dist <= minDistance + 0.05;
    // Ground sample under camera (diagnostic only — actual clamp lives in Ground useFrame).
    void above;

    onUpdate({
      cam: { x: +cam.x.toFixed(2), y: +cam.y.toFixed(2), z: +cam.z.toFixed(2) },
      target: { x: +target.x.toFixed(2), y: +target.y.toFixed(2), z: +target.z.toFixed(2) },
      camTargetDist: +dist.toFixed(2),
      hitName,
      hitDist: +hitDist.toFixed(2),
      hit,
      wheelDelta: +wheelDelta.toFixed(1),
      camDelta: +camDelta.toFixed(3),
      minDistanceHit,
      floorClampCam: floorFlagsRef.current.cam,
      floorClampTarget: floorFlagsRef.current.target,
      focusAnim: focusAnimRef.current,
      coverBuildMs: +coverBuildMsRef.current.toFixed(1),
    });
  });

  return null;
}

export { EMPTY as EMPTY_NAV_DIAG };
