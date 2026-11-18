import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, DoubleSide, PerspectiveCamera, ShaderMaterial, Vector3, type Mesh } from 'three';
import { getPalette } from '../../core/palette';
import { frameIsland, type IslandBox, type View } from './Exhibit';

/**
 * Soft horizontal cloud banks in world space. The overview places one set in the arrival sky
 * and the same set on the far side of the island. Each card turns to face the camera, so an
 * orbit slides the near banks more than the far ones instead of showing the card edge-on.
 * The alpha dies out inside the card. There is no blob mesh.
 */
const SLOTS = [
  { distance: 1600, x: -0.5, y: 0.7, width: 1400, height: 400, opacity: 0.92, speed: 0.05 },
  { distance: 1900, x: 0.58, y: 0.64, width: 1200, height: 340, opacity: 0.8, speed: 0.04 },
  { distance: 2300, x: 0.05, y: 0.86, width: 1800, height: 260, opacity: 0.62, speed: 0.03 },
  { distance: 880, x: -0.92, y: 0.06, width: 520, height: 170, opacity: 0.5, speed: 0.1 },
  { distance: 940, x: 0.96, y: 0.0, width: 480, height: 150, opacity: 0.45, speed: 0.09 },
];

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec3 uLight;
uniform float uTime;
uniform float uOpacity;
uniform float uSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
vec2 gradient(vec2 p) { float a = hash(p) * 6.2831853; return vec2(cos(a), sin(a)); }
float noise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradient(cell), f);
  float b = dot(gradient(cell + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(gradient(cell + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(gradient(cell + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
void main() {
  vec2 uv = vUv - 0.5;
  vec2 p = vec2(uv.x * 1.1 + uTime * 0.012, uv.y * 1.6);
  float n = noise(p) * 0.65 + noise(p * 2.1 + 5.0) * 0.35;
  float field = 0.75 + 0.25 * smoothstep(-0.2, 0.5, n);
  float upper = exp(-pow((uv.y - 0.02) / 0.16, 2.0));
  float lower = exp(-pow((uv.y + 0.16) / 0.09, 2.0));
  float side = exp(-pow(uv.x / 0.22, 2.0));
  float alpha = clamp((upper + lower * 0.4) * side * field * uOpacity, 0.0, 0.78);
  if (alpha < 0.03) discard;
  vec3 body = mix(uLight, vec3(1.0), 0.62);
  gl_FragColor = vec4(body, alpha);
  #include <colorspace_fragment>
}
`;

type Bank = { point: Vector3; width: number; height: number; opacity: number; speed: number };

export function AtmosphereClouds({ seed, hour, box, approach }: { seed: number; hour: number; cloudHeight: number; box: IslandBox | null; approach: View | null }) {
  const size = useThree((state) => state.size);
  const banks = useMemo(() => {
    if (!box || !approach) return null;
    const view = frameIsland(approach, box, size.width, size.height);
    const camera = new PerspectiveCamera(40, Math.max(size.width, 1) / Math.max(size.height, 1), 0.5, 8000);
    camera.position.set(...view.from);
    camera.lookAt(...view.to);
    camera.updateMatrixWorld();
    const forward = new Vector3(); camera.getWorldDirection(forward);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const placed: Bank[] = [];
    for (const slot of SLOTS) {
      const halfV = Math.tan(camera.fov * Math.PI / 360) * slot.distance;
      const point = camera.position.clone().addScaledVector(forward, slot.distance)
        .addScaledVector(right, slot.x * halfV * camera.aspect)
        .addScaledVector(up, slot.y * halfV);
      placed.push({ point, width: slot.width, height: slot.height, opacity: slot.opacity, speed: slot.speed });
      const far = point.clone();
      far.x = cx * 2 - point.x;
      far.z = cz * 2 - point.z;
      placed.push({ point: far, width: slot.width, height: slot.height, opacity: slot.opacity * 0.85, speed: slot.speed });
    }
    return placed;
  }, [approach, box, size.height, size.width]);
  const palette = getPalette('qinglv', hour);
  const materials = useMemo(() => (banks ?? []).map((bank, i) => new ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: {
      uLight: { value: new Color(palette.cloudLight) },
      uTime: { value: 0 },
      uOpacity: { value: bank.opacity },
      uSeed: { value: seed * 0.017 + i * 2.7 },
    },
  })), [banks, palette.cloudLight, seed]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(({ camera, clock }) => {
    meshes.current.forEach((mesh, i) => {
      const bank = banks?.[i];
      if (!mesh || !bank) return;
      mesh.lookAt(camera.position.x, mesh.position.y, camera.position.z);
      (mesh.material as ShaderMaterial).uniforms.uTime.value = clock.elapsedTime * bank.speed;
    });
  });
  if (!banks) return null;
  return <>
    {banks.map((bank, i) => <mesh key={i} ref={(mesh) => { meshes.current[i] = mesh; }} position={bank.point} material={materials[i]} renderOrder={2} raycast={() => {}}>
      <planeGeometry args={[bank.width, bank.height]} />
    </mesh>)}
  </>;
}
