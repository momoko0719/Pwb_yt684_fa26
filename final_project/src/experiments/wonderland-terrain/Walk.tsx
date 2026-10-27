import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Walker } from '../../core/walk';
import type { DwellWorld } from './dwelling';
import type { Zones } from './zones';
import { spawnWonderWalker, stepWonderWalker, WONDER_BROWSE } from './wonderlandWalk';
import type { WalkMapPose } from './WalkMinimap';

/** Click target for pointer lock (same pattern as Penglai island-v1). */
export const WONDER_WALK_CANVAS = 'wonderland-canvas';
/** Near clip (m). Was 0.05 → depth ratio 5000/0.05=1e5, which shredded bank z-precision at eye height. */
const WALK_NEAR = 0.2;

const KEYS: Record<string, 'forward' | 'back' | 'left' | 'right' | 'run'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

/**
 * First-person browse: PointerLock look, WASD move, Shift → absolute run (WONDER_BROWSE.run).
 * Spawns near `near` (creature home) when given. Esc unlocks pointer (stay in Walk).
 */
export default function WonderlandWalk({
  world, zones, speed, restore, near, onLockChange, onSpeedHint, onPose,
}: {
  world: DwellWorld;
  zones: Zones;
  speed: number;
  restore: MutableRefObject<{ pos: Vector3; target: Vector3 }>;
  /** Prefer spawn ~8 m from this point (home), looking toward it. */
  near?: { x: number; z: number } | null;
  onLockChange: (locked: boolean) => void;
  onSpeedHint?: (s: { mode: string; mps: number }) => void;
  onPose?: (p: WalkMapPose) => void;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const walker = useRef<Walker | null>(null);
  const keys = useRef({ forward: false, back: false, left: false, right: false, run: false });
  const locked = useRef(false);
  const look = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const { walker: start, heading } = spawnWonderWalker({ ...world, zones }, zones, near);
    walker.current = start;
    camera.position.set(start.x, start.y, start.z);
    camera.lookAt(start.x + Math.cos(heading), start.y, start.z + Math.sin(heading));
    onPose?.({ x: start.x, z: start.z, heading });
    const nearClip = camera.near;
    camera.near = WALK_NEAR;
    camera.updateProjectionMatrix();
    return () => {
      camera.near = nearClip;
      camera.updateProjectionMatrix();
      camera.position.copy(restore.current.pos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, world.grid, world.seed, near?.x, near?.z, camera, restore]);

  useEffect(() => {
    const set = (pressed: boolean) => (e: KeyboardEvent) => {
      const key = KEYS[e.code];
      if (!key || !locked.current) return;
      keys.current[key] = pressed;
      e.preventDefault();
    };
    const down = set(true), up = set(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  useFrame((_, delta) => {
    const w = walker.current;
    if (!w) return;
    camera.getWorldDirection(look);
    const heading = Math.atan2(look.z, look.x);
    const k = keys.current;
    const run = k.run;
    const mps = run ? WONDER_BROWSE.run : speed;
    const mode = run ? 'run' : speed <= 1.6 ? 'walk' : 'browse';
    onSpeedHint?.({ mode, mps });
    walker.current = stepWonderWalker(
      { ...world, zones },
      w,
      {
        forward: Number(k.forward) - Number(k.back),
        strafe: Number(k.right) - Number(k.left),
        run,
        heading,
      },
      speed,
      Math.min(delta, 0.05),
    );
    camera.position.set(walker.current.x, walker.current.y, walker.current.z);
    onPose?.({ x: walker.current.x, z: walker.current.z, heading });
  });

  return (
    <PointerLockControls
      selector={`.${WONDER_WALK_CANVAS} canvas`}
      onLock={() => { locked.current = true; onLockChange(true); }}
      onUnlock={() => {
        locked.current = false;
        keys.current = { forward: false, back: false, left: false, right: false, run: false };
        onLockChange(false);
      }}
    />
  );
}

export const WONDER_WALK_SPEED = WONDER_BROWSE.browse;
