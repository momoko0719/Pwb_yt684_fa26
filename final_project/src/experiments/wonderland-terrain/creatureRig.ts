import { Bone, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Quaternion, Skeleton, SkinnedMesh, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import type { MorphFigure, Vec3 } from './creatureMorph';
import { buildMorphGroup } from './creatureMorphMesh';

/** One shared rest skeleton. Scene simulation supplies the four feet and the muzzle. */
interface Rig {
  figure: MorphFigure;
  neck: Bone;
  neckMid: Bone;
  head: Bone;
  upper: Bone[];
  lower: Bone[];
  restNeckAngle: number;
  restMidAngle: number;
  restHeadAngle: number;
  neckLength: number;
  lowerNeckLength: number;
  upperNeckLength: number;
  faceLength: number;
}

const point = (v: Vec3) => new Vector3(v.x, v.y, v.z);
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

function weights(figure: MorphFigure, mesh: Mesh) {
  const position = mesh.geometry.getAttribute('position');
  const indices = new Uint16Array(position.count * 4);
  const values = new Float32Array(position.count * 4);
  const shoulder = figure.neck[0].at;
  const head = figure.head[0].at;
  const neckDx = head.x - shoulder.x, neckDy = head.y - shoulder.y;
  const neckDenom = neckDx * neckDx + neckDy * neckDy || 1;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const influence: [number, number][] = [];
    let leg = 0, distance = Infinity;
    for (let k = 0; k < 4; k++) {
      const h = figure.legs[k].hip;
      const d = Math.hypot(x - h.x, z - h.z);
      if (d < distance) { distance = d; leg = k; }
    }
    const hip = figure.legs[leg].hip, knee = figure.legs[leg].knee;
    const legWeight = smooth((hip.y + 0.1 - y) / 0.25) * (1 - smooth((distance - 0.09) / 0.23));
    const lowerShare = smooth((knee.y + 0.14 - y) / 0.27);
    const neckWeight = (1 - legWeight) * smooth((x - shoulder.x + 0.14) / 0.38) * smooth((y - shoulder.y + 0.14) / 0.32);
    const alongNeck = ((x - shoulder.x) * neckDx + (y - shoulder.y) * neckDy) / neckDenom;
    const midShare = smooth((alongNeck - 0.31) / 0.38);
    // The throat can project ahead of the skull in side view. X alone assigned
    // that low throat skin to the head hinge and made a hanging chin when bowed.
    const headShare = smooth((x - head.x + 0.09) / 0.22)
      * smooth((y - head.y + 0.23) / 0.25);
    influence.push([0, 1 - legWeight - neckWeight]);
    influence.push([1, neckWeight * (1 - headShare) * (1 - midShare)]);
    influence.push([2, neckWeight * (1 - headShare) * midShare]);
    influence.push([3, neckWeight * headShare]);
    influence.push([4 + leg * 2, legWeight * (1 - lowerShare)]);
    influence.push([5 + leg * 2, legWeight * lowerShare]);
    influence.sort((a, b) => b[1] - a[1]);
    const selected = influence.slice(0, 4);
    const sum = selected.reduce((n, item) => n + item[1], 0) || 1;
    selected.forEach(([bone, weight], slot) => { indices[i * 4 + slot] = bone; values[i * 4 + slot] = weight / sum; });
  }
  mesh.geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  mesh.geometry.setAttribute('skinWeight', new Float32BufferAttribute(values, 4));
}

function attach(mesh: Mesh, bone: Bone, rest: Vec3) {
  mesh.removeFromParent();
  mesh.geometry.translate(-rest.x, -rest.y, -rest.z);
  bone.add(mesh);
}

export function buildRiggedCreature(figure: MorphFigure): Group {
  const group = buildMorphGroup(figure);
  const original = group.getObjectByName('skin') as Mesh;
  weights(figure, original);
  const skin = new SkinnedMesh(original.geometry, original.material);
  skin.name = 'riggedSkin';
  skin.frustumCulled = false;
  original.removeFromParent();
  group.add(skin);

  const root = new Bone(); root.name = 'rig-root';
  const neck = new Bone(); neck.name = 'rig-neck'; neck.position.copy(point(figure.neck[0].at));
  const neckMid = new Bone(); neckMid.name = 'rig-neck-mid'; neckMid.position.copy(point(figure.neck[3].at).sub(point(figure.neck[0].at)));
  const head = new Bone(); head.name = 'rig-head'; head.position.copy(point(figure.head[0].at).sub(point(figure.neck[3].at)));
  const upper: Bone[] = [], lower: Bone[] = [];
  root.add(neck);
  neck.add(neckMid);
  neckMid.add(head);
  figure.legs.forEach((leg, k) => {
    const u = new Bone(); u.name = `rig-upper-${k}`; u.position.copy(point(leg.hip));
    const l = new Bone(); l.name = `rig-lower-${k}`; l.position.copy(point(leg.knee));
    root.add(u, l); upper.push(u); lower.push(l);
  });
  skin.add(root);
  group.updateMatrixWorld(true);
  skin.bind(new Skeleton([root, neck, neckMid, head, ...figure.legs.flatMap((_, k) => [upper[k], lower[k]])]));

  const headPivot = figure.head[0].at;
  for (const child of [...group.children]) {
    if (!(child instanceof Mesh) || child === skin) continue;
    if (child.name.startsWith('horn-') || child.name.startsWith('ear-') || child.name.startsWith('brow-') || child.name.startsWith('eye-') || child.name.startsWith('nostril-') || child.name.startsWith('mouth-')) attach(child, head, headPivot);
    else if (child.name.startsWith('toe-')) {
      const k = Number(child.name.split('-')[1]);
      attach(child, lower[k], figure.legs[k].knee);
    }
  }
  const shoulder = figure.neck[0].at, middle = figure.neck[3].at, headAt = figure.head[0].at, mouth = figure.head[figure.head.length - 1].at;
  group.userData.rig = {
    figure, neck, neckMid, head, upper, lower,
    restNeckAngle: Math.atan2(middle.y - shoulder.y, middle.x - shoulder.x),
    restMidAngle: Math.atan2(headAt.y - middle.y, headAt.x - middle.x),
    restHeadAngle: Math.atan2(mouth.y - headAt.y, mouth.x - headAt.x),
    neckLength: Math.hypot(headAt.x - shoulder.x, headAt.y - shoulder.y),
    lowerNeckLength: Math.hypot(middle.x - shoulder.x, middle.y - shoulder.y),
    upperNeckLength: Math.hypot(headAt.x - middle.x, headAt.y - middle.y),
    faceLength: Math.hypot(mouth.x - headAt.x, mouth.y - headAt.y),
  } satisfies Rig;
  return group;
}

/** Visible rest-pose anatomy for the catalog review. Lines are the rig's actual pivots. */
export function buildRigOverlay(figure: MorphFigure): Group {
  const overlay = new Group();
  overlay.name = 'rigOverlay';
  const tail = figure.torso[0].at, shoulder = figure.neck[0].at;
  const middle = figure.neck[3].at, head = figure.head[0].at, muzzle = figure.head[figure.head.length - 1].at;
  const pairs: [Vec3, Vec3][] = [[tail, shoulder], [shoulder, middle], [middle, head], [head, muzzle]];
  for (const leg of figure.legs) pairs.push([leg.hip, leg.knee], [leg.knee, leg.foot]);
  const points = pairs.flatMap(([a, b]) => [point(a), point(b)]);
  const lines = new LineSegments(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: '#176d69', depthTest: false, linewidth: 2 }));
  lines.renderOrder = 20;
  overlay.add(lines);
  const dotGeometry = new SphereGeometry(0.028, 9, 7);
  const dotMaterial = new MeshBasicMaterial({ color: '#ba663b', depthTest: false });
  for (const p of [tail, shoulder, middle, head, muzzle, ...figure.legs.flatMap((leg) => [leg.hip, leg.knee, leg.foot])]) {
    const dot = new Mesh(dotGeometry, dotMaterial);
    dot.position.copy(point(p));
    dot.renderOrder = 21;
    overlay.add(dot);
  }
  return overlay;
}

const REST_UP = new Vector3();
const GOAL_UP = new Vector3();
const Q = new Quaternion();
function aim(bone: Bone, restA: Vec3, restB: Vec3, goalA: Vec3, goalB: Vec3) {
  REST_UP.subVectors(point(restB), point(restA));
  GOAL_UP.subVectors(point(goalB), point(goalA));
  bone.position.copy(point(goalA));
  bone.quaternion.copy(Q.setFromUnitVectors(REST_UP.clone().normalize(), GOAL_UP.clone().normalize()));
  bone.scale.setScalar(Math.max(0.7, Math.min(1.35, GOAL_UP.length() / Math.max(REST_UP.length(), 0.01))));
}

/**
 * The rig set to the sim's pose. Angles are the body's own (its tip taken off); the mouth target is
 * in the rig group's local metres, from the sim.
 *
 * - Standing, walking, lying: the sculpt's own neck, turned by how far the sim's neck is from its
 *   standing angle (`neckDelta`: lying, a little lower), most of it at the root and the rest above;
 *   the face keeps nearly its sculpted slope, as an animal holds its head.
 * - Drinking or grazing (`sip` toward 1): the mouth to the sim's target with the face at the sim's
 *   angle (`faceAngle`, near upright), the neck as two rigid pieces bent upward between them, so its
 *   top line arches from the withers as a grazing horse's or sheep's does. (The downward bend hung the
 *   neck under the chest like a trunk; stretching the bones to reach made the throat thin and the
 *   skull pointed.)
 */
export function poseRiggedCreature(group: Group, neckDelta: number, faceAngle: number, muzzle: Vec3, hips: Vec3[], knees: Vec3[], feet: Vec3[], sip = 0) {
  const rig = group.userData.rig as Rig;
  if (!rig) return;
  const { figure, neck, neckMid, head } = rig;
  const shoulder = figure.neck[0].at;
  // At rest: the sculpt turned.
  const restLower = rig.restNeckAngle + 0.7 * neckDelta;
  const restUpper = rig.restMidAngle + neckDelta;
  const restHead = rig.restHeadAngle + 0.15 * neckDelta;
  // Reaching: the head's base back from the mouth along the face; the two neck pieces to it.
  const hx = muzzle.x - Math.cos(faceAngle) * rig.faceLength, hy = muzzle.y - Math.sin(faceAngle) * rig.faceLength;
  const rx = hx - shoulder.x, ry = hy - shoulder.y;
  const a = rig.lowerNeckLength, b = rig.upperNeckLength;
  const reach = Math.min(Math.hypot(rx, ry) || 1e-6, a + b - 1e-4);
  const elbow = Math.acos(Math.max(-1, Math.min(1, (reach * reach + a * a - b * b) / (2 * reach * a))));
  const lowerAngle = Math.atan2(ry, rx) + elbow; // bent upward: an arched top line
  const ex = shoulder.x + Math.cos(lowerAngle) * a, ey = shoulder.y + Math.sin(lowerAngle) * a;
  const upperAngle = Math.atan2(hy - ey, hx - ex);
  const t = Math.max(0, Math.min(1, sip));
  const ease = t * t * (3 - 2 * t);
  const lowerPose = restLower + (lowerAngle - restLower) * ease;
  const upperPose = restUpper + (upperAngle - restUpper) * ease;
  const headPose = restHead + (faceAngle - restHead) * ease;
  neck.rotation.z = lowerPose - rig.restNeckAngle;
  neck.scale.set(1, 1, 1);
  neckMid.rotation.z = upperPose - rig.restMidAngle - neck.rotation.z;
  head.scale.set(1, 1, 1);
  head.rotation.z = headPose - rig.restHeadAngle - neck.rotation.z - neckMid.rotation.z;
  for (let k = 0; k < 4; k++) {
    const leg = figure.legs[k];
    aim(rig.upper[k], leg.hip, leg.knee, hips[k], knees[k]);
    aim(rig.lower[k], leg.knee, leg.foot, knees[k], feet[k]);
  }
}
