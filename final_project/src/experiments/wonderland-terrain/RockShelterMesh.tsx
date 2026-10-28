import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Color, Plane, ShaderMaterial, Vector3 } from 'three';
import { PORCELAIN } from '../../core/palette';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import { shelterGeometry, type ShelterPlan } from './rockShelter';

/**
 * Fractured slab. The shared sun shades the normals; occlusion is structural
 * (underside, back corner, ground contact), not a view-dependent darkening.
 * No glaze. The palette is the shelter's own, not the island's white stone.
 */
const vertexShader = /* glsl */ `
attribute float aOcclusion;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vWorld;
varying float vOcc;
#include <clipping_planes_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vOcc = aOcclusion;
  #include <clipping_planes_vertex>
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uBody;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uSeed;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vWorld;
varying float vOcc;
#include <clipping_planes_pars_fragment>

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Value noise in object space. Continuous, so it stays on the mesh when the camera turns.
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, f.x);
  float x10 = mix(n010, n110, f.x);
  float x01 = mix(n001, n101, f.x);
  float x11 = mix(n011, n111, f.x);
  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
}

// About 6 cm, 12 cm, and 19 cm, mixed so it does not read as one repeating cell.
float relief(vec3 p) {
  return noise(p / 0.12) * 0.48
    + noise(p / 0.055 + vec3(4.1, 8.3, 1.7)) * 0.30
    + noise(p / 0.19 + vec3(2.2, 0.4, 7.5)) * 0.22;
}

void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vNormal);
  float dist = length(cameraPosition - vWorld);
  vec3 p = vLocal + vec3(uSeed, uSeed * 0.37, uSeed * -0.21);

  // This shader has no roughness uniform. The rough look is this normal offset,
  // and it is what sky and key below actually light.
  float e = 0.03;
  vec3 g = vec3(
    relief(p + vec3(e, 0.0, 0.0)) - relief(p - vec3(e, 0.0, 0.0)),
    relief(p + vec3(0.0, e, 0.0)) - relief(p - vec3(0.0, e, 0.0)),
    relief(p + vec3(0.0, 0.0, e)) - relief(p - vec3(0.0, 0.0, e))
  );
  float mid = 1.0 - smoothstep(16.0, 34.0, dist);
  n = normalize(n - g * 0.9 * mid);

  float near = 1.0 - smoothstep(1.6, 6.0, dist);
  float fine = noise(p / 0.022 + vec3(2.0, 5.0, 1.0));
  n = normalize(n + (vec3(fine, fine * 0.35, 1.0 - fine) - 0.5) * 0.10 * near);

  vec3 sun = normalize(uSunDir);
  float sky = n.y * 0.5 + 0.5;
  float key = clamp(dot(n, sun) * 0.55 + 0.45, 0.0, 1.0);

  float field = sin(vLocal.x * 0.48 + uSeed) * cos(vLocal.z * 0.36 + vLocal.y * 0.18 + uSeed * 0.7);
  vec3 tone = mix(uCool, uWarm, 0.5 + 0.5 * field);
  vec3 albedo = mix(uBody, tone, 0.16);
  albedo *= 1.0 + (fine - 0.5) * 0.055 * near;

  vec3 color = albedo * (0.52 + 0.20 * sky + 0.34 * key);
  color *= mix(0.74, 1.0, vOcc);
  float contact = smoothstep(0.5, 0.0, vLocal.y);
  color *= mix(1.0, 0.84, contact);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

export function RockShelter({ plan, cut, uniforms }: { plan: ShelterPlan; cut: boolean; uniforms: WorldUniforms }) {
  const geometry = useMemo(() => shelterGeometry(plan.mirror, plan.formSeed), [plan.mirror, plan.formSeed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: {
      uSunDir: uniforms.uSunDir,
      uBody: { value: new Color(PORCELAIN.shelterSlab) },
      uWarm: { value: new Color(PORCELAIN.shelterWarm) },
      uCool: { value: new Color(PORCELAIN.shelterCool) },
      uSeed: { value: plan.formSeed * 0.17 },
    },
    vertexShader,
    fragmentShader,
  }), [uniforms, plan.formSeed]);
  const plane = useMemo(() => new Plane(), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    if (!cut) {
      material.clippingPlanes = [];
      material.clipping = false;
      return;
    }
    const flank = plan.mirror ? -1 : 1;
    const s = Math.sin(plan.yaw), c = Math.cos(plan.yaw);
    const lz = 1.32 * flank;
    const px = plan.bed.x - s * lz;
    const pz = plan.bed.z + c * lz;
    const nx = -s * flank, nz = c * flank;
    plane.setFromNormalAndCoplanarPoint(new Vector3(nx, 0, nz), new Vector3(px, plan.originY + 1.2, pz));
    material.clipping = true;
    material.clippingPlanes = [plane];
    material.clipShadows = true;
    material.needsUpdate = true;
  }, [cut, plan, material, plane]);
  return (
    <mesh
      name="rock-shelter"
      geometry={geometry}
      material={material}
      position={[plan.bed.x, plan.originY, plan.bed.z]}
      rotation-y={-plan.yaw}
      raycast={() => {}}
      userData={{ liveFrom: plan.liveView.from, liveTo: plan.liveView.to }}
    />
  );
}
