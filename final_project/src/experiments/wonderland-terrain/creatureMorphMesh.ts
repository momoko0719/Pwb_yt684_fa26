import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, ShaderMaterial, SphereGeometry, type Material } from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import type { MorphFigure, Vec3 } from './creatureMorph';

const SIDES = 10;

const bodyMaterial = () => new MeshPhysicalMaterial({ color: '#FFF9F0', roughness: 0.52, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.3 });
const jadeMaterial = () => new MeshStandardMaterial({ color: '#B5D8CB', roughness: 0.43, metalness: 0.015, emissive: '#426b5f', emissiveIntensity: 0.26 });
const blackMaterial = () => new MeshStandardMaterial({ color: '#111111', roughness: 1, metalness: 0 });

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function unit(a: Vec3): Vec3 {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
function frameOf(prev: Vec3, next: Vec3): { n: Vec3; b: Vec3 } {
  const t = unit({ x: next.x - prev.x, y: next.y - prev.y, z: next.z - prev.z });
  let side = cross(t, { x: 0, y: 1, z: 0 });
  if (Math.hypot(side.x, side.y, side.z) < 1e-4) side = cross(t, { x: 1, y: 0, z: 0 });
  side = unit(side);
  return { n: unit(cross(side, t)), b: side };
}

function pushLoft(pos: number[], nrm: number[], idx: number[], centers: Vec3[], ry: number[], rz: number[]) {
  const base = pos.length / 3;
  const count = centers.length;
  for (let i = 0; i < count; i++) {
    const prev = centers[Math.max(0, i - 1)];
    const next = centers[Math.min(count - 1, i + 1)];
    const frame = frameOf(prev, next);
    for (let s = 0; s < SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      const cy = Math.cos(a), sy = Math.sin(a);
      const c = centers[i];
      pos.push(
        c.x + frame.n.x * cy * ry[i] + frame.b.x * sy * rz[i],
        c.y + frame.n.y * cy * ry[i] + frame.b.y * sy * rz[i],
        c.z + frame.n.z * cy * ry[i] + frame.b.z * sy * rz[i],
      );
      const nx = frame.n.x * cy / ry[i] + frame.b.x * sy / rz[i];
      const ny = frame.n.y * cy / ry[i] + frame.b.y * sy / rz[i];
      const nz = frame.n.z * cy / ry[i] + frame.b.z * sy / rz[i];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nrm.push(nx / nl, ny / nl, nz / nl);
    }
  }
  for (let i = 0; i < count - 1; i++) {
    for (let s = 0; s < SIDES; s++) {
      const s2 = (s + 1) % SIDES;
      const a = base + i * SIDES + s, b = base + i * SIDES + s2;
      const c = base + (i + 1) * SIDES + s, d = base + (i + 1) * SIDES + s2;
      idx.push(a, b, c, b, d, c);
    }
  }
  const cap = (ring: number, center: Vec3, flip: boolean) => {
    const ci = pos.length / 3;
    pos.push(center.x, center.y, center.z);
    nrm.push(0, flip ? -1 : 1, 0);
    for (let s = 0; s < SIDES; s++) {
      const s2 = (s + 1) % SIDES;
      const a = base + ring * SIDES + s, b = base + ring * SIDES + s2;
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  cap(0, centers[0], true);
  cap(count - 1, centers[count - 1], false);
}

function tube(stations: { at: Vec3; ry: number; rz: number }[]): BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  pushLoft(pos, nrm, idx, stations.map((s) => s.at), stations.map((s) => Math.max(s.ry, 0.004)), stations.map((s) => Math.max(s.rz, 0.004)));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}

function hornTube(samples: Vec3[], rootRadius = 0.028): BufferGeometry {
  const rings = samples.map((at, i) => {
    const r = rootRadius * (1 - i / (samples.length - 1)) + 0.003;
    return { at, ry: r, rz: r };
  });
  return tube(rings);
}

function add(group: Group, geo: BufferGeometry, material: Material, name = '') {
  const mesh = new Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  group.add(mesh);
}

const softMin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/** One porcelain skin around the torso, throat, face, and four legs; ears and tail dock at their roots. */
/**
 * The face is laid out level (cheek, jaw, muzzle, brows, eyes, nostrils, mouth as offsets along and
 * above its line) and then turned with the face about the head's base. (Laid out by plain x and y
 * offsets, they kept to a level face: when the face was set to slope down, the jaw hung below the
 * chin as a block and the mouth seams stood off it like whiskers.)
 */
function faceFrame(figure: MorphFigure) {
  const pivot = figure.head[0].at, mouth = figure.head[figure.head.length - 1].at;
  const angle = Math.atan2(mouth.y - pivot.y, mouth.x - pivot.x);
  const turn = (p: Vec3, a: number): Vec3 => {
    const dx = p.x - pivot.x, dy = p.y - pivot.y, c = Math.cos(a), s = Math.sin(a);
    return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c, z: p.z };
  };
  return {
    pivot, angle,
    /** A point of the face, from its level layout to where it is. */
    place: (p: Vec3) => turn(p, angle),
    /** A point in space, into the level layout (to test against the level face). */
    level: (p: Vec3) => turn(p, -angle),
    cheek: turn(figure.head[1].at, -angle),
    muzzle: turn(mouth, -angle),
  };
}

function skinGeometry(figure: MorphFigure, includeLegs: boolean): BufferGeometry {
  const size = 52;
  const field = new MarchingCubes(size, new ShaderMaterial(), false, false, 120000);
  field.isolation = 0;
  const ellipsoid = (x: number, y: number, z: number, center: Vec3, rx: number, ry: number, rz: number) =>
    (Math.hypot((x - center.x) / rx, (y - center.y) / ry, (z - center.z) / rz) - 1) * Math.min(rx, ry, rz);
  const segment = (x: number, y: number, z: number, a: Vec3, b: Vec3, radius: number) => {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / (dx * dx + dy * dy + dz * dz || 1)));
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy, z - a.z - t * dz) - radius;
  };
  // A single interpolated chest-to-rump profile avoids the scallops made by a row of balls.
  const torsoDistance = (x: number, y: number, z: number) => {
    const stations = figure.torso;
    const back = stations[0], front = stations[stations.length - 1];
    const xc = Math.max(back.at.x, Math.min(front.at.x, x));
    let i = 0;
    while (i < stations.length - 2 && stations[i + 1].at.x < xc) i++;
    const a = stations[i], b = stations[i + 1];
    const t = Math.max(0, Math.min(1, (xc - a.at.x) / (b.at.x - a.at.x || 1)));
    const ease = t * t * (3 - 2 * t);
    const cy = a.at.y + (b.at.y - a.at.y) * ease;
    const ry = a.ry + (b.ry - a.ry) * ease;
    const rz = a.rz + (b.rz - a.rz) * ease;
    const crossSection = (Math.hypot((y - cy) / ry, z / rz) - 1) * Math.min(ry, rz);
    return Math.hypot(Math.max(0, back.at.x - x, x - front.at.x), Math.max(0, crossSection)) + Math.min(0, crossSection) - 0.015;
  };
  const face = faceFrame(figure);
  const { cheek, muzzle } = face;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x / (size / 2) - 1) * 1.55;
    const py = (y / (size / 2) - 1) * 1.22 + 0.97;
    const pz = (z / (size / 2) - 1) * 0.72;
    let d = torsoDistance(px, py, pz);
    // Broad shoulder and haunch volumes blend into the continuous torso and leg roots.
    for (const side of [-1, 1]) {
      const shoulder = figure.legs[side < 0 ? 1 : 0].hip;
      const haunch = figure.legs[side < 0 ? 3 : 2].hip;
      d = softMin(d, ellipsoid(px, py, pz, { x: shoulder.x - 0.03, y: shoulder.y + 0.025, z: shoulder.z }, 0.18, 0.17, 0.125), 0.085);
      d = softMin(d, ellipsoid(px, py, pz, { x: haunch.x + 0.02, y: haunch.y + 0.015, z: haunch.z }, 0.2, 0.15, 0.125), 0.09);
    }
    // Keep the stationary withers low. A large fixed throat root became an
    // isolated hump when the animated neck rotated toward grass or water.
    const root = figure.neck[0];
    d = softMin(d, ellipsoid(px, py, pz,
      { x: root.at.x - 0.12, y: root.at.y - 0.18, z: 0 },
      0.21, root.ry * 0.62, root.rz * 0.94), 0.09);
    for (const s of figure.neck) d = softMin(d, ellipsoid(px, py, pz, s.at, s.ry * 1.02, s.ry, s.rz), 0.075);
    // One brow, cheek and lower jaw give the face a readable shape without a pointed tube; in the
    // face's own frame. A deer's (the concept's), not a horse's: a slim jaw, a narrow, short muzzle.
    const q = face.level({ x: px, y: py, z: pz });
    d = softMin(d, ellipsoid(q.x, q.y, pz, { x: cheek.x - 0.025, y: cheek.y + 0.018, z: 0 }, 0.16, 0.1, 0.108), 0.055);
    d = softMin(d, ellipsoid(q.x, q.y, pz, { x: cheek.x + 0.07, y: cheek.y - 0.03, z: 0 }, 0.12, 0.048, 0.068), 0.04);
    d = softMin(d, ellipsoid(q.x, q.y, pz, { x: muzzle.x - 0.055, y: muzzle.y - 0.012, z: 0 }, 0.085, 0.042, 0.048), 0.032);
    const tailRoot = figure.tail[0];
    d = softMin(d, ellipsoid(px, py, pz, tailRoot.at, tailRoot.ry * 1.4, tailRoot.ry, tailRoot.rz), 0.055);
    for (const leg of figure.legs) {
      const upper = includeLegs ? leg.knee : {
        x: leg.hip.x + (leg.knee.x - leg.hip.x) * 0.32,
        y: leg.hip.y + (leg.knee.y - leg.hip.y) * 0.32,
        z: leg.hip.z + (leg.knee.z - leg.hip.z) * 0.32,
      };
      d = softMin(d, segment(px, py, pz, leg.hip, upper, 0.07), 0.12);
      if (includeLegs) d = softMin(d, segment(px, py, pz, leg.knee, leg.foot, 0.055), 0.09);
    }
    field.field[x + y * size + z * size * size] = -d;
  }
  field.update();
  const count = field.geometry.drawRange.count;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute((field.geometry.getAttribute('position').array as Float32Array).slice(0, count * 3), 3));
  geometry.setAttribute('normal', new Float32BufferAttribute((field.geometry.getAttribute('normal').array as Float32Array).slice(0, count * 3), 3));
  geometry.scale(1.55, 1.22, 0.72);
  geometry.translate(0, 0.97, 0);
  field.geometry.dispose();
  (field.material as ShaderMaterial).dispose();
  return geometry;
}

/** Standing figure. `ink` is the black silhouette used for the shape sheet. */
export function buildMorphGroup(figure: MorphFigure, ink = false, includeLegs = true): Group {
  const group = new Group();
  const body = ink ? blackMaterial() : bodyMaterial();
  const jade = ink ? blackMaterial() : jadeMaterial();
  add(group, skinGeometry(figure, includeLegs), body, 'skin');
  // Overlapping porcelain mane locks. Each grows out of the same neck skin and curls back
  // into it; their roots overlap the body so there are no visible floating pieces.
  figure.ears.forEach((ear, index) => add(group, tube(ear), body, `ear-${index}`));
  add(group, tube(figure.tail), body, 'tail-plume');
  figure.horns.forEach((horn, index) => add(group, hornTube(horn, figure.hornWidths[index] ?? 0.017), jade, `horn-${index}`));
  if (includeLegs) for (const leg of figure.legs) {
    for (const side of [-1, 1]) {
      const toeGeo = new CylinderGeometry(0.034, 0.05, 0.09, 8, 1);
      toeGeo.scale(1.15, 1, 0.78);
      toeGeo.translate(leg.foot.x + 0.015, 0.045, leg.foot.z + side * 0.025);
      const toe = new Mesh(toeGeo, jade);
      toe.name = `toe-${figure.legs.indexOf(leg)}-${side}`;
      group.add(toe);
    }
  }
  if (!ink) {
    const face = faceFrame(figure);
    const cranium = face.cheek, muzzle = face.muzzle;
    // Laid out level, then turned with the face.
    const turned = (stations: { at: Vec3; ry: number; rz: number }[]) => stations.map((st) => ({ ...st, at: face.place(st.at) }));
    const onFace = (geo: BufferGeometry) => geo.translate(-face.pivot.x, -face.pivot.y, 0).rotateZ(face.angle).translate(face.pivot.x, face.pivot.y, 0);
    const eyeMaterial = new MeshStandardMaterial({ color: '#52665e', roughness: 0.55 });
    const mouthMaterial = new MeshStandardMaterial({ color: '#8b8a7e', roughness: 0.95 });
    for (const side of [-1, 1]) {
      add(group, tube(turned([
        { at: { x: cranium.x - 0.065, y: cranium.y + 0.065, z: side * 0.076 }, ry: 0.012, rz: 0.009 },
        { at: { x: cranium.x - 0.005, y: cranium.y + 0.073, z: side * 0.094 }, ry: 0.017, rz: 0.012 },
        { at: { x: cranium.x + 0.075, y: cranium.y + 0.052, z: side * 0.078 }, ry: 0.004, rz: 0.004 },
      ])), body, `brow-${side}`);
      const eyeGeo = new SphereGeometry(0.011, 10, 8);
      eyeGeo.scale(1.3, 0.72, 0.65);
      onFace(eyeGeo.translate(cranium.x - 0.014, cranium.y + 0.042, side * 0.112));
      const eye = new Mesh(eyeGeo, eyeMaterial);
      eye.name = `eye-${side}`;
      group.add(eye);
      // Paired nostril slits sit high on the muzzle. The mouth is a separate,
      // lower swept seam, rather than a third dot on the face.
      const noseGeo = new SphereGeometry(0.009, 10, 8);
      noseGeo.scale(1.45, 0.48, 0.54);
      noseGeo.rotateZ(-0.18);
      onFace(noseGeo.translate(muzzle.x - 0.03, muzzle.y + 0.016, side * 0.048));
      const nostril = new Mesh(noseGeo, eyeMaterial);
      nostril.name = `nostril-${side}`;
      group.add(nostril);
      // The mouth seam on the muzzle's own surface (short, low, into the skin at both ends).
      add(group, tube(turned([
        { at: { x: muzzle.x - 0.085, y: muzzle.y - 0.036, z: side * 0.05 }, ry: 0.002, rz: 0.002 },
        { at: { x: muzzle.x - 0.045, y: muzzle.y - 0.04, z: side * 0.047 }, ry: 0.0035, rz: 0.0035 },
        { at: { x: muzzle.x - 0.002, y: muzzle.y - 0.03, z: side * 0.034 }, ry: 0.002, rz: 0.002 },
      ])), mouthMaterial, `mouth-${side}`);
    }
  }
  return group;
}

export function disposeMorphGroup(group: Group) {
  const materials = new Set<Material>();
  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    list.forEach((material) => materials.add(material));
  });
  materials.forEach((material) => material.dispose());
  group.clear();
}
