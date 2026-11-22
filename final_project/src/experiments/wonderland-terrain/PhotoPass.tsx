import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DepthTexture, HalfFloatType, Mesh, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, Vector2, WebGLRenderTarget } from 'three';
import { createPhotoMaterial, PHOTO_MODE, type PhotoFilter } from './photoFilters';

/** A picture taken: the whole canvas as PNG, at its drawing size. */
export interface PhotoShot { url: string; width: number; height: number }

/**
 * The camera's pass, inside the Canvas while the camera is out: the island is drawn into a target
 * (colour and depth), then painted onto the screen through the chosen filter (photoFilters.ts).
 * Taking over the frame (useFrame priority 1) stops R3F's own render while it is mounted. A shot
 * asked for (`shoot`) is read from the canvas right after the frame is drawn.
 */
export function PhotoPass({ filter, shoot }: { filter: PhotoFilter; shoot: MutableRefObject<((shot: PhotoShot) => void) | null> }) {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), camera = useThree((s) => s.camera);
  const target = useMemo(() => {
    const t = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    t.depthTexture = new DepthTexture(1, 1);
    return t;
  }, []);
  const material = useMemo(() => createPhotoMaterial(target.texture, target.depthTexture!), [target]);
  const screen = useMemo(() => {
    const s = new Scene(), m = new Mesh(new PlaneGeometry(2, 2), material);
    m.frustumCulled = false; s.add(m);
    return { scene: s, mesh: m, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [material]);
  useEffect(() => () => { target.depthTexture?.dispose(); target.dispose(); material.dispose(); screen.mesh.geometry.dispose(); }, [target, material, screen]);
  const size = useMemo(() => new Vector2(), []);
  useFrame(() => {
    gl.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    const u = material.uniforms;
    u.uRes.value.copy(size);
    const cam = camera as PerspectiveCamera;
    u.uNear.value = cam.near; u.uFar.value = cam.far;
    u.uMode.value = PHOTO_MODE[filter];
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(screen.scene, screen.camera);
    const take = shoot.current;
    if (take) { shoot.current = null; take({ url: gl.domElement.toDataURL('image/png'), width: size.x, height: size.y }); }
  }, 1);
  return null;
}
