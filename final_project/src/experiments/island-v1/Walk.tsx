import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import type { IslandField } from '../../core/generators/island';
import type { IslandParams } from '../../core/params/island';
import { spawnWalker, stepWalker, type Walker } from '../../core/walk';

/** Only a click on the 3D view locks the mouse, not clicks on the panels or the technique maps. */
export const WALK_CANVAS_CLASS = 'island-canvas';
const WALK_NEAR = 0.05; // near clipping plane while walking, so grass right in front is not cut off
const SUN_OFFSET = 0.5; // radians: the sun sits ahead and a little to the side when the walk starts

const KEYS: Record<string, 'forward' | 'back' | 'left' | 'right' | 'run'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

interface WalkProps {
  field: IslandField;
  island: IslandParams;
  speed: number;
  /** Sun azimuth while walking; set when the walk starts, then fixed. */
  sun: MutableRefObject<number>;
  /** Where the orbit camera goes back to when the walk ends. */
  restore: Vector3;
  onLockChange: (locked: boolean) => void;
}

/**
 * First-person walk: the mouse turns the head (pointer lock), WASD or the arrows move, Shift runs.
 * Movement rules live in core/walk.ts; this component only reads keys and moves the camera.
 */
export default function Walk({ field, island, speed, sun, restore, onLockChange }: WalkProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const walker = useRef<Walker | null>(null);
  const keys = useRef({ forward: false, back: false, left: false, right: false, run: false });
  const locked = useRef(false);
  const look = useMemo(() => new Vector3(), []);

  // Start on flat meadow facing the main peak; put the orbit view back when the walk ends.
  useEffect(() => {
    const { walker: start, heading } = spawnWalker(field, island);
    walker.current = start;
    camera.position.set(start.x, start.y, start.z);
    camera.lookAt(start.x + Math.cos(heading), start.y, start.z + Math.sin(heading));
    sun.current = heading + SUN_OFFSET;
    const near = camera.near;
    camera.near = WALK_NEAR;
    camera.updateProjectionMatrix();
    return () => {
      camera.near = near;
      camera.updateProjectionMatrix();
      camera.position.copy(restore);
    };
  }, [field, island, camera, sun, restore]);

  // Keys only steer while the mouse is locked, so typing in the panel never moves the walker.
  useEffect(() => {
    const set = (pressed: boolean) => (e: KeyboardEvent) => {
      const key = KEYS[e.code];
      if (!key || !locked.current) return;
      keys.current[key] = pressed;
      e.preventDefault();
    };
    const down = set(true);
    const up = set(false);
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
    const k = keys.current;
    const input = {
      forward: Number(k.forward) - Number(k.back),
      strafe: Number(k.right) - Number(k.left),
      run: k.run,
      heading: Math.atan2(look.z, look.x),
    };
    // Clamp the step so a stalled frame never jumps the walker across a cliff edge.
    walker.current = stepWalker(field, island, w, input, speed, Math.min(delta, 0.05));
    camera.position.set(walker.current.x, walker.current.y, walker.current.z);
  });

  return (
    <PointerLockControls
      selector={`.${WALK_CANVAS_CLASS} canvas`}
      onLock={() => {
        locked.current = true;
        onLockChange(true);
      }}
      onUnlock={() => {
        locked.current = false;
        keys.current = { forward: false, back: false, left: false, right: false, run: false };
        onLockChange(false);
      }}
    />
  );
}
