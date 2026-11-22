import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useLanguage } from '../../i18n/LanguageContext';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, FrontSide, Group, Matrix4, ShaderMaterial, Vector3, Vector4 } from 'three';
import { LAYER } from '../../core/palette';
import { createRng } from '../../core/rng';
import type { WorldUniforms } from '../../core/shaders/uniforms';
import type { IslandBox, View } from './Exhibit';

/**
 * A few solid, sunlit clouds beside the island (far-view study, round 7:
 * docs/plan-2026-11-19-far-view.md). Each is a box the eye marches through: inside it a handful
 * of soft round puffs, eaten at their edges by noise, make the density; every step also looks a
 * few steps toward the sun, so the cloud shades itself (bright crown, grey belly, a silver edge
 * against the sun). The same way the Weatherglass study builds its clouds, at real size here:
 * 160 to 320 m across, beside an island some 600 m wide. One box each; the cost is only the
 * pixels a cloud covers.
 */
const PUFFS = 7;
const BOX = new BoxGeometry(1, 1, 1);

const vertexShader = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uSunDir, uCloudLight, uCloudShade, uSkyMid, uSkyHorizon;
uniform vec3 uSize; // the box, metres
uniform vec4 uPuffs[${PUFFS}]; // centre (box units, -0.5..0.5) and radius
uniform float uTime, uSeed;
uniform float uGrow; // 0..1: the puffs swelling from nothing (replayed when a cloud is picked)
uniform mat4 uWorldToBox;
varying vec3 vObj;

float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Density at a point in box units: the puffs' soft union, a flat base, the edges eaten by noise.
float density(vec3 p) {
  float field = 0.0;
  for (int i = 0; i < ${PUFFS}; i++) {
    // Round in metres (the box is not a cube): measured in the box's mean width.
    vec3 q = (p - uPuffs[i].xyz) * uSize / (0.5 * (uSize.x + uSize.z));
    field = max(field, 1.0 - length(q) / max(uPuffs[i].w * uGrow, 1e-3));
  }
  field *= smoothstep(-0.5, -0.36, p.y); // the flat underside of a fair-weather cloud
  vec3 w = p * uSize / 38.0 + vec3(uTime * 0.01, 0.0, uSeed);
  float n = vn3(w) * 0.62 + vn3(w * 2.3 + 5.1) * 0.38;
  return clamp(field * 1.5 - n * 0.8, 0.0, 1.0);
}

void main() {
  vec3 ro = (uWorldToBox * vec4(cameraPosition, 1.0)).xyz;
  vec3 rd = normalize(vObj - ro);
  // Where the eye's ray is inside the box.
  vec3 inv = 1.0 / rd, t0 = (-0.5 - ro) * inv, t1 = (0.5 - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float a = max(max(max(tmin.x, tmin.y), tmin.z), 0.0), b = min(min(tmax.x, tmax.y), tmax.z);
  if (b <= a) discard;
  const int STEPS = 40;
  float dt = (b - a) / float(STEPS);
  float metres = length(rd * uSize) * dt; // one step, in metres
  vec3 sun = normalize(uSunDir / uSize); // the sun's direction in box units
  vec3 sunWorld = normalize(uSunDir);
  vec3 rdWorld = normalize(rd * uSize);
  float silver = pow(max(dot(rdWorld, sunWorld), 0.0), 6.0);
  // The far cloud banks' own colour (AtmosphereClouds.tsx: the palette's cloud light, 62% white),
  // so the near clouds and the far ones read as one sky; the shade is that colour dimmed toward
  // the sky's own blue, not grey.
  vec3 lit = mix(uCloudLight, vec3(1.0), 0.62);
  vec3 shade = mix(lit * 0.78, uSkyMid, 0.22);
  float t = a + dt * h3(vec3(gl_FragCoord.xy, uSeed)); // jittered, against banding
  float through = 1.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = density(p);
    if (d > 0.01) {
      // Toward the sun: how much cloud lies between this point and the light.
      float toward = 0.0;
      for (int j = 1; j <= 4; j++) toward += density(p + sun * 0.06 * float(j));
      float light = exp(-toward * 1.6);
      vec3 c = mix(shade, lit, light) + lit * silver * light * 0.5;
      float alpha = 1.0 - exp(-d * metres * 0.035);
      col += through * alpha * c;
      through *= 1.0 - alpha;
      if (through < 0.03) break;
    }
    t += dt;
  }
  float cover = 1.0 - through;
  if (cover < 0.004) discard;
  vec3 c = col / cover;
  c = mix(c, uSkyHorizon, smoothstep(500.0, 2600.0, length(rd * uSize) * a) * 0.6); // air between
  gl_FragColor = vec4(c, cover);
  #include <colorspace_fragment>
}
`;

/**
 * `parts`: the Layers view of how each cloud is made (its box and the puffs inside it).
 * `approach`: the opening view; clouds stand to its left and right and behind the island, never
 * between it and the island. Click a cloud: it grows again from nothing, its parts shown, with a
 * card of what it is made of.
 */
export function Cumulus({ uniforms, box, seed, parts = false, approach }: { uniforms: WorldUniforms; box: IslandBox; seed: number; parts?: boolean; approach: View | null }) {
  const { t } = useLanguage();
  const [picked, setPicked] = useState<number | null>(null);
  const grownAt = useRef(-1);
  const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
  const r = Math.max(box.maxX - box.minX, box.maxZ - box.minZ) / 2;
  const clouds = useMemo(() => {
    const rand = createRng(seed + 307);
    // Eight, placed from the opening view (no coordinates by hand): three to its left, three to its
    // right (60-125° round from the eye), two high behind the island; nothing in front, so the
    // island is always seen clear. Of the side ones, the last on each side sits low by the keel.
    const COUNT = 8;
    const eye = approach ? Math.atan2(approach.from[2] - cz, approach.from[0] - cx) : 0;
    const slots = [1, 1, 1, -1, -1, -1, 0, 0];
    return Array.from({ length: COUNT }, (_, k) => {
      const side = slots[k];
      const low = k === 2 || k === 5;
      const size = new Vector3(160 + rand() * 150, 90 + rand() * 60, 130 + rand() * 100).multiplyScalar(low ? 0.7 : 1);
      const puffs = Array.from({ length: PUFFS }, (_, i) => {
        const core = i < 3;
        return new Vector4((rand() - 0.5) * (core ? 0.3 : 0.62), (core ? -0.12 : -0.22) + rand() * (core ? 0.22 : 0.16), (rand() - 0.5) * (core ? 0.25 : 0.5), core ? 0.24 + rand() * 0.08 : 0.15 + rand() * 0.08);
      });
      return {
        size, puffs,
        angle: side === 0 ? eye + Math.PI + (k === 6 ? -0.45 : 0.5) + (rand() - 0.5) * 0.3 : eye + side * (1.05 + ((k % 3) / 2) * 1.0 + (rand() - 0.5) * 0.25),
        distance: r * (low ? 0.75 + rand() * 0.25 : 1.1 + rand() * 0.45) + size.x * 0.5,
        y: low ? box.minY + (box.maxY - box.minY) * (0.05 + rand() * 0.15) : box.minY + (box.maxY - box.minY) * (side === 0 ? 0.9 + rand() * 0.3 : 0.45 + rand() * 0.6),
        drift: 0.0015 + rand() * 0.001,
        seed: rand() * 100,
      };
    });
  }, [seed, r, box.minY, box.maxY, cx, cz, approach]);
  const materials = useMemo(() => clouds.map((c) => new ShaderMaterial({
    transparent: true, depthWrite: false, side: FrontSide,
    uniforms: {
      uSunDir: uniforms.uSunDir, uCloudLight: uniforms.uCloudLight, uCloudShade: uniforms.uCloudShade,
      uSkyMid: uniforms.uSkyMid, uSkyHorizon: uniforms.uSkyHorizon, uTime: uniforms.uTime,
      uSize: { value: c.size }, uPuffs: { value: c.puffs }, uSeed: { value: c.seed },
      uWorldToBox: { value: new Matrix4() },
      uGrow: { value: 1 },
    },
    vertexShader, fragmentShader,
  })), [clouds, uniforms]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    clouds.forEach((c, i) => {
      const group = refs.current[i];
      if (!group) return;
      // A slow sway to and fro, never round into the view.
      const a = c.angle + Math.sin(clock.elapsedTime * c.drift * 6 + c.seed) * 0.06;
      const grow = i === picked && grownAt.current >= 0 ? Math.min((clock.elapsedTime - grownAt.current) / 2.5, 1) : 1;
      materials[i].uniforms.uGrow.value = grow < 1 ? 0.15 + 0.85 * grow * grow * (3 - 2 * grow) : 1;
      if (i === picked && grownAt.current < 0) grownAt.current = clock.elapsedTime;
      group.position.set(cx + Math.cos(a) * c.distance, c.y, cz + Math.sin(a) * c.distance);
      group.updateMatrixWorld(true);
      // The box mesh (scaled to the cloud's size): world to box units.
      (materials[i].uniforms.uWorldToBox.value as Matrix4).copy(group.children[0].matrixWorld).invert();
    });
  });
  return <>{clouds.map((c, i) => {
    const unit = 0.5 * (c.size.x + c.size.z);
    return <group key={i} ref={(g) => { refs.current[i] = g; }}>
      <mesh scale={c.size} material={materials[i]} renderOrder={6} userData={{ orbitIgnore: true }}
        onClick={(e) => {
          // A cloud's box is big and stands across the line of sight: it gives way to whatever the
          // pointer is on (the creature, a fish, a plant), and cannot be picked from inside it
          // (owner, 2026-11-22: clicking the creature opened a cloud's card instead).
          if (document.body.dataset.worldPointer) return;
          const local = e.object.worldToLocal(e.camera.position.clone());
          if (Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) < 0.5) return;
          e.stopPropagation(); grownAt.current = -1; setPicked(picked === i ? null : i);
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {(parts || picked === i) && <>
        <lineSegments scale={c.size} raycast={() => {}}>
          <edgesGeometry args={[BOX]} />
          <lineBasicMaterial color={LAYER.cloudBox} transparent opacity={0.8} depthTest={false} />
        </lineSegments>
        {c.puffs.map((p, j) => <mesh key={j} position={[p.x * c.size.x, p.y * c.size.y, p.z * c.size.z]} scale={p.w * unit} renderOrder={7} raycast={() => {}}>
          <sphereGeometry args={[1, 16, 10]} />
          <meshBasicMaterial color={LAYER.cloudPuff} wireframe transparent opacity={0.55} depthTest={false} />
        </mesh>)}
      </>}
      {picked === i && <Html position={[0, c.size.y * 0.62, 0]} center zIndexRange={[5, 0]}>
        <div className="cloud-card" onClick={() => setPicked(null)}>
          <strong>{t('cloud.title').replace('{n}', String(i + 1))}</strong>
          <span>{t('cloud.size').replace('{w}', String(Math.round(c.size.x))).replace('{h}', String(Math.round(c.size.y))).replace('{d}', String(Math.round(c.size.z)))}</span>
          <span>{t('cloud.made').replace('{n}', String(PUFFS))}</span>
        </div>
      </Html>}
    </group>;
  })}</>;
}

/** The shaders, for a compile check outside the scene (dev only). */
export const CUMULUS_SHADERS = { vertexShader, fragmentShader, PUFFS };
