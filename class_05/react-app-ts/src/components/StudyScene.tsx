/**
 * Shared GLSL snippets + per-study ShaderMaterial meshes.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParamValues } from '../studies/types';

const NOISE = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
`;

function num(p: ParamValues, key: string, fallback = 0) {
  const v = p[key];
  return typeof v === 'number' ? v : fallback;
}
function str(p: ParamValues, key: string, fallback = '') {
  const v = p[key];
  return typeof v === 'string' ? v : fallback;
}

function useShader(
  vertex: string,
  fragment: string,
  uniforms: Record<string, THREE.IUniform>,
) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    side: THREE.DoubleSide,
  }), [vertex, fragment]); // uniforms mutated each frame
}

function AnimatedMat({
  material, assign,
}: {
  material: THREE.ShaderMaterial;
  assign: (u: Record<string, THREE.IUniform>, t: number) => void;
}) {
  useFrame(({ clock }) => {
    assign(material.uniforms, clock.getElapsedTime());
  });
  return null;
}

/* ─── helpers to mount mesh + material ─── */

function SphereStudy({
  material, args = [1, 96, 64],
}: {
  material: THREE.ShaderMaterial;
  args?: [number, number, number];
}) {
  return (
    <mesh material={material}>
      <sphereGeometry args={args} />
    </mesh>
  );
}

function PlaneStudy({
  material, segs = 96,
}: {
  material: THREE.ShaderMaterial;
  segs?: number;
}) {
  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
      <planeGeometry args={[3.2, 3.2, segs, segs]} />
    </mesh>
  );
}

function TorusStudy({ material }: { material: THREE.ShaderMaterial }) {
  return (
    <mesh material={material} rotation={[0.4, 0.2, 0]}>
      <torusKnotGeometry args={[0.7, 0.22, 180, 32]} />
    </mesh>
  );
}

/* ═══════════════════════════════════════
   Individual studies
   ═══════════════════════════════════════ */

export function StudyScene({
  id, params, showMask,
}: {
  id: string; params: ParamValues; showMask: boolean;
}) {
  switch (id) {
    case 'vertex': return <VertexStudy params={params} />;
    case 'fragment': return <FragmentStudy params={params} />;
    case 'flat': return <FlatStudy params={params} />;
    case 'posGrad': return <PosGradStudy params={params} showMask={showMask} />;
    case 'interp': return <InterpStudy params={params} showMask={showMask} />;
    case 'bezier': return <BezierStudy params={params} showMask={showMask} />;
    case 'equation': return <EquationStudy params={params} showMask={showMask} />;
    case 'fresnel': return <FresnelStudy params={params} showMask={showMask} />;
    case 'slope': return <SlopeStudy params={params} showMask={showMask} />;
    case 'distance': return <DistanceStudy params={params} showMask={showMask} />;
    case 'ao': return <AoStudy params={params} showMask={showMask} />;
    case 'contact': return <ContactStudy params={params} showMask={showMask} />;
    case 'matcap': return <MatcapStudy params={params} />;
    case 'displace': return <DisplaceStudy params={params} />;
    case 'combo': return <ComboStudy params={params} showMask={showMask} />;
    default: return <FlatStudy params={params} />;
  }
}

function VertexStudy({ params }: { params: ParamValues }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAmp: { value: 0.15 },
    uFreq: { value: 3 },
    uSpeed: { value: 1.2 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    uniform float uTime, uAmp, uFreq, uSpeed;
    varying vec3 vN; varying float vW;
    void main() {
      float w = sin(position.y * uFreq + uTime * uSpeed) * uAmp;
      vec3 p = position + normal * w;
      vW = w;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
    /* glsl */ `
    varying vec3 vN; varying float vW;
    void main() {
      vec3 base = vec3(0.55, 0.7, 0.85);
      vec3 col = base + vN * 0.25 + vec3(vW * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u, t) => {
        u.uTime.value = t;
        u.uAmp.value = num(params, 'amp', 0.15);
        u.uFreq.value = num(params, 'freq', 3);
        u.uSpeed.value = num(params, 'speed', 1.2);
      }} />
      <SphereStudy material={mat} />
    </>
  );
}

function FragmentStudy({ params }: { params: ParamValues }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScale: { value: 8 },
    uMix: { value: 0.35 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uTime, uScale, uMix;
    varying vec2 vUv;
    void main() {
      vec2 g = abs(fract(vUv * uScale) - 0.5);
      float checker = step(0.25, max(g.x, g.y));
      vec3 a = vec3(0.15, 0.18, 0.22);
      vec3 b = vec3(0.85, 0.55, 0.35);
      vec3 pulse = 0.5 + 0.5 * sin(vec3(vUv * 6.0, uTime) + uTime);
      vec3 col = mix(a, b, checker);
      col = mix(col, pulse, uMix * 0.5);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u, t) => {
        u.uTime.value = t;
        u.uScale.value = num(params, 'scale', 8);
        u.uMix.value = num(params, 'mixA', 0.35);
      }} />
      <mesh material={mat}><boxGeometry args={[1.6, 1.6, 1.6]} /></mesh>
    </>
  );
}

function FlatStudy({ params }: { params: ParamValues }) {
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Vector3(0.75, 0.55, 0.4) },
    uIntensity: { value: 1 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vN;
    void main() {
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform vec3 uColor; uniform float uIntensity;
    varying vec3 vN;
    void main() {
      float lit = 0.55 + 0.45 * max(dot(vN, normalize(vec3(0.4,1.0,0.3))), 0.0);
      gl_FragColor = vec4(uColor * uIntensity * lit, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        (u.uColor.value as THREE.Vector3).set(num(params, 'r', 0.75), num(params, 'g', 0.55), num(params, 'b', 0.4));
        u.uIntensity.value = num(params, 'intensity', 1);
      }} />
      <SphereStudy material={mat} args={[1, 48, 32]} />
    </>
  );
}

function PosGradStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uAxis: { value: 1 },
    uSoft: { value: 1 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uAxis, uSoft, uMask;
    varying vec3 vPos;
    void main() {
      float t = uAxis < 0.5 ? vPos.x : (uAxis < 1.5 ? vPos.y : vPos.z);
      t = clamp(t * 0.5 / max(uSoft, 0.01) + 0.5, 0.0, 1.0);
      vec3 col = mix(vec3(0.12, 0.14, 0.2), vec3(0.95, 0.7, 0.35), t);
      if (uMask > 0.5) col = vec3(t);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  const axis = str(params, 'axis', 'y');
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uAxis.value = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
        u.uSoft.value = num(params, 'soft', 1);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <SphereStudy material={mat} />
    </>
  );
}

function InterpStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uMode: { value: 1 },
    uE0: { value: 0.2 },
    uE1: { value: 0.8 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uMode, uE0, uE1, uMask;
    varying vec2 vUv;
    void main() {
      float x = vUv.x;
      float t = uMode > 0.5 ? smoothstep(uE0, uE1, x) : clamp((x - uE0) / max(uE1 - uE0, 0.001), 0.0, 1.0);
      vec3 col = mix(vec3(0.2, 0.25, 0.4), vec3(0.95, 0.75, 0.4), t);
      if (uMask > 0.5) col = vec3(t);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uMode.value = str(params, 'mode', 'smooth') === 'smooth' ? 1 : 0;
        u.uE0.value = num(params, 'edge0', 0.2);
        u.uE1.value = num(params, 'edge1', 0.8);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <mesh material={mat}><planeGeometry args={[2.4, 1.4]} /></mesh>
    </>
  );
}

function BezierStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uC1: { value: 0.2 },
    uC2: { value: 0.85 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uC1, uC2, uMask;
    varying vec2 vUv;
    float bezier(float t, float c1, float c2) {
      float omt = 1.0 - t;
      // cubic from 0 → c1 → c2 → 1
      return 3.0 * omt * omt * t * c1 + 3.0 * omt * t * t * c2 + t * t * t;
    }
    void main() {
      float t = bezier(vUv.x, uC1, uC2);
      vec3 col = mix(vec3(0.15, 0.2, 0.28), vec3(0.9, 0.55, 0.7), t);
      // curve preview line
      float line = smoothstep(0.02, 0.0, abs(vUv.y - t));
      col = mix(col, vec3(1.0), line * 0.85);
      if (uMask > 0.5) col = vec3(t);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uC1.value = num(params, 'c1', 0.2);
        u.uC2.value = num(params, 'c2', 0.85);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <mesh material={mat}><planeGeometry args={[2.4, 1.6]} /></mesh>
    </>
  );
}

function EquationStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uEq: { value: 0 },
    uFreq: { value: 5 },
    uPhase: { value: 0 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uEq, uFreq, uPhase, uMask;
    varying vec3 vPos;
    void main() {
      float m;
      float r = length(vPos.xz);
      if (uEq < 0.5) m = 0.5 + 0.5 * sin(r * uFreq + uPhase);
      else if (uEq < 1.5) m = 0.5 + 0.5 * sin(vPos.x * uFreq + uPhase) * sin(vPos.z * uFreq * 0.7);
      else m = clamp(1.0 - r / 1.2, 0.0, 1.0);
      vec3 col = mix(vec3(0.1, 0.12, 0.18), vec3(0.4, 0.85, 0.75), m);
      if (uMask > 0.5) col = vec3(m);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  const eq = str(params, 'eq', 'rings');
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uEq.value = eq === 'waves' ? 1 : eq === 'radial' ? 2 : 0;
        u.uFreq.value = num(params, 'freq', 5);
        u.uPhase.value = num(params, 'phase', 0);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <PlaneStudy material={mat} segs={64} />
    </>
  );
}

function FresnelStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uPower: { value: 2.5 },
    uBias: { value: 0.05 },
    uScale: { value: 1 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
    /* glsl */ `
    uniform float uPower, uBias, uScale, uMask;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float f = uBias + uScale * pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower);
      f = clamp(f, 0.0, 1.0);
      vec3 base = vec3(0.12, 0.14, 0.18);
      vec3 rim = vec3(0.7, 0.9, 1.0);
      vec3 col = mix(base, rim, f);
      if (uMask > 0.5) col = vec3(f);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uPower.value = num(params, 'power', 2.5);
        u.uBias.value = num(params, 'bias', 0.05);
        u.uScale.value = num(params, 'scale', 1);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <SphereStudy material={mat} />
    </>
  );
}

function SlopeStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uThresh: { value: 0.55 },
    uSoft: { value: 0.12 },
    uHills: { value: 0.35 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    ${NOISE}
    uniform float uHills;
    varying vec3 vN; varying float vH;
    void main() {
      float h = vnoise(vec3(position.xz * 1.8, 0.0)) * uHills;
      vec3 p = position + vec3(0.0, h, 0.0);
      // approximate normal from neighbors
      float hx = vnoise(vec3((position.x + 0.05) * 1.8, position.z * 1.8, 0.0)) * uHills;
      float hz = vnoise(vec3(position.x * 1.8, (position.z + 0.05) * 1.8, 0.0)) * uHills;
      vec3 n = normalize(vec3(h - hx, 0.05, h - hz));
      vN = normalize(normalMatrix * n);
      vH = h;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
    /* glsl */ `
    uniform float uThresh, uSoft, uMask;
    varying vec3 vN; varying float vH;
    void main() {
      float slope = 1.0 - abs(normalize(vN).y);
      float rock = smoothstep(uThresh - uSoft, uThresh + uSoft, slope);
      vec3 grass = vec3(0.35, 0.55, 0.3);
      vec3 stone = vec3(0.45, 0.42, 0.4);
      vec3 col = mix(grass, stone, rock);
      col += vH * 0.15;
      if (uMask > 0.5) col = vec3(rock);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uThresh.value = num(params, 'threshold', 0.55);
        u.uSoft.value = num(params, 'soft', 0.12);
        u.uHills.value = num(params, 'hills', 0.35);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <PlaneStudy material={mat} segs={128} />
    </>
  );
}

function DistanceStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uPoint: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
    uRadius: { value: 1.2 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
    /* glsl */ `
    uniform vec3 uPoint; uniform float uRadius, uMask;
    varying vec3 vWorld;
    void main() {
      float d = distance(vWorld, uPoint);
      float m = 1.0 - smoothstep(0.0, uRadius, d);
      vec3 col = mix(vec3(0.1, 0.11, 0.14), vec3(1.0, 0.55, 0.25), m);
      if (uMask > 0.5) col = vec3(m);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  const px = num(params, 'px', 0.4);
  const py = num(params, 'py', 0.6);
  const pz = num(params, 'pz', 0.2);
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        (u.uPoint.value as THREE.Vector3).set(px, py, pz);
        u.uRadius.value = num(params, 'radius', 1.2);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <SphereStudy material={mat} />
      <mesh position={[px, py, pz]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ff9f5a" />
      </mesh>
    </>
  );
}

function AoStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uStrength: { value: 0.85 },
    uRadius: { value: 0.55 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vN; varying vec3 vPos;
    void main() {
      vPos = position;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uStrength, uRadius, uMask;
    varying vec3 vN; varying vec3 vPos;
    void main() {
      // Fake AO: darker in downward-facing / near "floor" and concave feel
      float down = pow(max(-vN.y, 0.0), 1.5);
      float nearFloor = 1.0 - smoothstep(0.0, uRadius, vPos.y + 1.0);
      float ao = clamp(1.0 - (down * 0.7 + nearFloor * 0.5) * uStrength, 0.0, 1.0);
      vec3 base = vec3(0.7, 0.68, 0.65);
      vec3 col = base * ao;
      if (uMask > 0.5) col = vec3(ao);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uStrength.value = num(params, 'strength', 0.85);
        u.uRadius.value = num(params, 'radius', 0.55);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <TorusStudy material={mat} />
    </>
  );
}

function ContactStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uHeight: { value: 0.35 },
    uSoft: { value: 0.25 },
    uIntensity: { value: 1.1 },
    uMask: { value: 0 },
  }), []);
  const groundMat = useShader(
    /* glsl */ `
    varying vec2 vUv; varying vec3 vW;
    void main() {
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
    /* glsl */ `
    uniform float uHeight, uSoft, uIntensity, uMask;
    varying vec2 vUv; varying vec3 vW;
    void main() {
      // contact under a sphere sitting above origin
      float d = length(vW.xz);
      float contact = (1.0 - smoothstep(0.0, uSoft + uHeight * 0.5, d * 0.55 + uHeight * 0.2)) * uIntensity;
      contact *= exp(-uHeight * 2.5);
      vec3 floorCol = vec3(0.18, 0.19, 0.22);
      vec3 shadow = vec3(0.02, 0.02, 0.03);
      vec3 col = mix(floorCol, shadow, clamp(contact, 0.0, 1.0));
      if (uMask > 0.5) col = vec3(clamp(contact, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  const h = num(params, 'height', 0.35);
  return (
    <>
      <AnimatedMat material={groundMat} assign={(u) => {
        u.uHeight.value = h;
        u.uSoft.value = num(params, 'soft', 0.25);
        u.uIntensity.value = num(params, 'intensity', 1.1);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <mesh material={groundMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[4, 4, 1, 1]} />
      </mesh>
      <mesh position={[0, h + 0.45, 0]}>
        <sphereGeometry args={[0.45, 48, 32]} />
        <meshStandardMaterial color="#c4a484" roughness={0.45} metalness={0.1} />
      </mesh>
    </>
  );
}

function MatcapStudy({ params }: { params: ParamValues }) {
  const uniforms = useMemo(() => ({
    uContrast: { value: 1.1 },
    uTint: { value: 0.35 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    varying vec3 vViewN;
    void main() {
      vViewN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    /* glsl */ `
    uniform float uContrast, uTint;
    varying vec3 vViewN;
    // Procedural matcap: soft specular lobe on a sphere map
    vec3 sampleMatcap(vec2 uv) {
      float r = length(uv - 0.5);
      float spec = pow(1.0 - smoothstep(0.1, 0.55, r), 4.0);
      float rim = smoothstep(0.35, 0.7, r);
      vec3 base = mix(vec3(0.25, 0.28, 0.32), vec3(0.85, 0.82, 0.78), 1.0 - rim);
      return base + vec3(spec);
    }
    void main() {
      vec2 uv = vViewN.xy * 0.5 + 0.5;
      vec3 col = sampleMatcap(uv);
      col = (col - 0.5) * uContrast + 0.5;
      col = mix(col, col * vec3(1.1, 0.95, 0.8), uTint);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u) => {
        u.uContrast.value = num(params, 'contrast', 1.1);
        u.uTint.value = num(params, 'tint', 0.35);
      }} />
      <TorusStudy material={mat} />
    </>
  );
}

function DisplaceStudy({ params }: { params: ParamValues }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAmp: { value: 0.18 },
    uFreq: { value: 2.5 },
    uNoise: { value: 0.6 },
    uSpeed: { value: 0.8 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    ${NOISE}
    uniform float uTime, uAmp, uFreq, uNoise, uSpeed;
    varying vec3 vN; varying float vD;
    void main() {
      float wave = sin(position.x * uFreq + uTime * uSpeed) * cos(position.z * uFreq * 0.8 + uTime * uSpeed * 0.7);
      float n = vnoise(position * uFreq + vec3(0.0, uTime * uSpeed * 0.3, 0.0)) * 2.0 - 1.0;
      float d = mix(wave, n, uNoise) * uAmp;
      vec3 p = position + normal * d;
      vD = d;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
    /* glsl */ `
    varying vec3 vN; varying float vD;
    void main() {
      float lit = 0.4 + 0.6 * max(dot(normalize(vN), normalize(vec3(0.5,1.0,0.3))), 0.0);
      vec3 col = mix(vec3(0.2, 0.35, 0.45), vec3(0.85, 0.7, 0.45), vD * 3.0 + 0.5);
      gl_FragColor = vec4(col * lit, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u, t) => {
        u.uTime.value = t;
        u.uAmp.value = num(params, 'amp', 0.18);
        u.uFreq.value = num(params, 'freq', 2.5);
        u.uNoise.value = num(params, 'noise', 0.6);
        u.uSpeed.value = num(params, 'speed', 0.8);
      }} />
      <SphereStudy material={mat} args={[1, 128, 96]} />
    </>
  );
}

function ComboStudy({ params, showMask }: { params: ParamValues; showMask: boolean }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAmp: { value: 0.14 },
    uFreq: { value: 2.2 },
    uContact: { value: 0.28 },
    uSpeed: { value: 0.6 },
    uMask: { value: 0 },
  }), []);
  const mat = useShader(
    /* glsl */ `
    ${NOISE}
    uniform float uTime, uAmp, uFreq, uSpeed;
    varying vec3 vN; varying vec3 vW; varying float vDisp;
    void main() {
      float n = vnoise(position * uFreq + vec3(0.0, uTime * uSpeed, 0.0));
      float d = (n * 2.0 - 1.0) * uAmp;
      vec3 p = position + normal * d;
      vec4 w = modelMatrix * vec4(p, 1.0);
      vW = w.xyz;
      vDisp = d;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
    /* glsl */ `
    uniform float uContact, uMask;
    varying vec3 vN; varying vec3 vW; varying float vDisp;
    void main() {
      float height = max(vW.y + 0.2, 0.0);
      float contact = exp(-height / max(uContact, 0.01));
      float lit = 0.35 + 0.65 * max(dot(normalize(vN), normalize(vec3(0.4,1.0,0.2))), 0.0);
      vec3 albedo = mix(vec3(0.25, 0.4, 0.5), vec3(0.9, 0.65, 0.4), vDisp * 4.0 + 0.5);
      vec3 col = albedo * lit * (0.55 + 0.45 * (1.0 - contact * 0.7));
      col = mix(col, vec3(0.05), contact * 0.5);
      if (uMask > 0.5) col = vec3(contact);
      gl_FragColor = vec4(col, 1.0);
    }`,
    uniforms,
  );
  return (
    <>
      <AnimatedMat material={mat} assign={(u, t) => {
        u.uTime.value = t;
        u.uAmp.value = num(params, 'amp', 0.14);
        u.uFreq.value = num(params, 'freq', 2.2);
        u.uContact.value = num(params, 'contact', 0.28);
        u.uSpeed.value = num(params, 'speed', 0.6);
        u.uMask.value = showMask ? 1 : 0;
      }} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.9} />
      </mesh>
      <SphereStudy material={mat} args={[1, 128, 96]} />
    </>
  );
}
