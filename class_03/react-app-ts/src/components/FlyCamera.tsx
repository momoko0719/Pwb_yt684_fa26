/**
 * FlyCamera.tsx
 * ─────────────
 * First-person exploration camera for the 3D terrain.
 * Uses PointerLockControls so mouse movement directly rotates the view
 * (like a first-person game), and WASD / Arrow keys move forward.
 *
 * On first enable:  the camera is brought down to "ground level"
 *                   facing forward (horizontal), so you feel like you
 *                   are standing inside the landscape rather than viewing
 *                   it from above.
 *
 * Controls (while pointer is locked):
 *   W / ↑      – walk forward
 *   S / ↓      – walk backward
 *   A / ←      – strafe left
 *   D / →      – strafe right
 *   Q           – fly up
 *   E           – fly down
 *   Esc         – exit explore mode (releases mouse)
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  enabled: boolean;
  speed?: number;
  /** World-space Y to snap camera to when first entering explore mode. */
  groundY?: number;
  /** Called with `true` when pointer locks, `false` when it unlocks. */
  onLockChange?: (locked: boolean) => void;
}

export default function FlyCamera({ enabled, speed = 0.08, groundY = 1.8, onLockChange }: Props) {
  const { camera } = useThree();
  const held = useRef(new Set<string>());

  // ── Reposition camera to ground level when explore activates ──────────────
  useEffect(() => {
    if (!enabled) return;

    // Preserve XZ (stay above same terrain region), drop to walking height
    camera.position.y = groundY;

    // Level the pitch so we look forward, not downward (preserves yaw)
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    euler.x = -0.08; // very slight downward tilt so terrain is visible
    euler.z = 0;
    camera.quaternion.setFromEuler(euler);
  }, [enabled, groundY, camera]);

  // ── Track pointer lock state and surface it to parent ────────────────────
  useEffect(() => {
    if (!onLockChange) return;
    const onChange = () => onLockChange(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, [onLockChange]);

  // ── Key tracking ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) { held.current.clear(); return; }

    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      held.current.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => held.current.delete(e.code);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
      held.current.clear();
    };
  }, [enabled]);

  // ── Per-frame movement (only when pointer is locked) ─────────────────────
  useFrame(() => {
    // Only move when the pointer is actually locked (mouse look active)
    if (!enabled || !document.pointerLockElement) return;

    const h = held.current;
    if (h.size === 0) return;

    // Forward = where the camera faces, projected onto the horizontal plane
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (h.has('KeyW') || h.has('ArrowUp'))    camera.position.addScaledVector(forward,  speed);
    if (h.has('KeyS') || h.has('ArrowDown'))  camera.position.addScaledVector(forward, -speed);
    if (h.has('KeyA') || h.has('ArrowLeft'))  camera.position.addScaledVector(right,   -speed);
    if (h.has('KeyD') || h.has('ArrowRight')) camera.position.addScaledVector(right,    speed);
    if (h.has('KeyQ'))                         camera.position.y += speed * 0.5;
    if (h.has('KeyE'))                         camera.position.y -= speed * 0.5;
  });

  if (!enabled) return null;

  // PointerLockControls takes over mouse look; makeDefault replaces OrbitControls
  return <PointerLockControls makeDefault />;
}
