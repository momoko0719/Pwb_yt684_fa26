import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { IslandParams } from '../params/island';
import { createRng } from '../rng';
import { SIZES, within } from '../scale';
import type { IslandField } from './island';

/**
 * A hexagonal pavilion (亭) from a small shape grammar: each rule replaces a part with the parts it
 * is made of, and every part becomes one block with a place in the building order.
 *
 *   Pavilion → Plinth  Steps  Columns  Beams  Roof  Finial
 *   Plinth   → one stone per side + a centre slab
 *   Steps    → three slabs, facing where the path arrives
 *   Columns  → one column per corner
 *   Beams    → one beam per side, on the column tops
 *   Roof     → one concave panel per side, its eave corners turned up (flying eaves);
 *              a double eave adds a lower skirt and the wall that joins it to the upper roof
 *
 * The grammar's numbers come from a seed, so every pavilion differs: 4, 6 or 8 sides, taller or
 * squatter columns, a steep or shallow roof, sharper or flatter eaves, and sometimes a double eave
 * (Roof → lower skirt + upper roof).
 * Pure: same seed, same blocks. Sizes in metres from core/scale.ts (SIZES.pavilion): the eave about
 * 3 m up, 4.5–6.5 m to the finial, 3.2–4.8 m across the columns.
 */
export type PartKind = 'plinth' | 'step' | 'column' | 'beam' | 'roof' | 'finial';

export interface Block {
  kind: PartKind;
  geometry: BufferGeometry;
  matrix: Matrix4;
  /** Position in the building order: rules apply in turn, so a layer starts after the one below. */
  order: number;
}

const UP = new Vector3(0, 1, 0);

/**
 * One roof panel from the eave edge a–b up to the top edge c–d (the same point twice for an apex):
 * concave toward the top, corners lifted at the eave.
 */
function roofPanel(a: Vector3, b: Vector3, c: Vector3, d: Vector3, lift: number): BufferGeometry {
  const U = 10, V = 8;
  const pos: number[] = [];
  const point = (u: number, v: number) => {
    const eave = a.clone().lerp(b, u);
    eave.y += lift * Math.abs(2 * u - 1) ** 3; // corners turn up
    const top = c.clone().lerp(d, u);
    const p = eave.clone().lerp(top, v);
    p.y = eave.y + (top.y - eave.y) * v ** 1.7; // a concave sweep, steep near the top
    return p;
  };
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const p00 = point(i / U, j / V), p10 = point((i + 1) / U, j / V), p01 = point(i / U, (j + 1) / V), p11 = point((i + 1) / U, (j + 1) / V);
      for (const p of [p00, p01, p10, p10, p01, p11]) pos.push(p.x, p.y, p.z);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function createPavilion(facing: number, seed: number): Block[] {
  const size = SIZES.pavilion;
  const rng = createRng(seed * 97 + 13);
  const sides = [4, 6, 6, 8][Math.floor(rng() * 4)];
  const doubleEave = rng() < 0.35;
  const roofH = within(size.roof, rng());
  const lift = within(size.eaveLift, rng());
  const blocks: Block[] = [];
  let order = 0;
  const R = within(size.ring, rng()); // column ring radius
  const plinthH = size.plinth;
  const columnH = within(size.column, rng());
  const corner = (r: number, i: number, y: number) => {
    const a = facing + Math.PI / sides + (i / sides) * Math.PI * 2;
    return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };
  const place = (kind: PartKind, geometry: BufferGeometry, position: Vector3, yaw = 0, scale = new Vector3(1, 1, 1)) =>
    blocks.push({ kind, geometry, matrix: new Matrix4().compose(position, new Quaternion().setFromAxisAngle(UP, yaw), scale), order });

  // Plinth: a stone along each side of a slightly larger hexagon, then the centre slab.
  const plinthR = R * 1.3;
  for (let i = 0; i < sides; i++) {
    const a = corner(plinthR, i, 0), b = corner(plinthR, i + 1, 0);
    const mid = a.clone().add(b).multiplyScalar(0.5).multiplyScalar(0.92);
    const len = a.distanceTo(b);
    place('plinth', new BoxGeometry(len, plinthH, 0.45), new Vector3(mid.x, plinthH / 2, mid.z), -Math.atan2(b.z - a.z, b.x - a.x));
    order++;
  }
  place('plinth', new CylinderGeometry(plinthR * 0.9, plinthR * 0.9, plinthH * 0.9, sides), new Vector3(0, plinthH * 0.45, 0), -facing - Math.PI / sides);
  order++;

  // Steps: three slabs climbing to the plinth on the side facing the path.
  const out = new Vector3(Math.cos(facing), 0, Math.sin(facing));
  for (let k = 0; k < 3; k++) {
    const d = plinthR * 0.95 + (2.5 - k) * 0.3;
    const h = ((k + 1) / 3) * plinthH;
    place('step', new BoxGeometry(1.4, h, 0.3), new Vector3(out.x * d, h / 2, out.z * d), -facing + Math.PI / 2);
    order++;
  }

  // Columns at the corners, then beams on their tops.
  for (let i = 0; i < sides; i++) {
    const c = corner(R, i, plinthH + columnH / 2);
    place('column', new CylinderGeometry(0.12, 0.14, columnH, 10), c);
    order++;
  }
  const beamY = plinthH + columnH + 0.1;
  for (let i = 0; i < sides; i++) {
    const a = corner(R, i, beamY), b = corner(R, i + 1, beamY);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    place('beam', new BoxGeometry(a.distanceTo(b) + 0.2, 0.22, 0.2), mid, -Math.atan2(b.z - a.z, b.x - a.x));
    order++;
  }

  // Roof: panels from the eave (outside the columns) up to the apex. A double eave first lays a
  // lower skirt up to a ring inside the columns, then the upper roof rises from a step above it.
  let eaveY = beamY + 0.15;
  if (doubleEave) {
    const ringY = eaveY + roofH * 0.35;
    for (let i = 0; i < sides; i++) {
      place('roof', roofPanel(corner(R * 1.55, i, eaveY), corner(R * 1.55, i + 1, eaveY), corner(R * 0.8, i, ringY), corner(R * 0.8, i + 1, ringY), lift), new Vector3());
      order++;
    }
    // The wall between the two eaves: it rises from inside the lower skirt to above the upper eave,
    // so the two roofs are one building, with no gap between them.
    const drumTop = ringY + 0.55;
    place('beam', new CylinderGeometry(R * 0.86, R * 0.86, drumTop - ringY + 0.15, sides), new Vector3(0, (ringY - 0.15 + drumTop) / 2, 0), -facing - Math.PI / sides);
    order++;
    eaveY = ringY + 0.45;
  }
  const eaveR = doubleEave ? R * 1.15 : R * 1.55;
  const apex = new Vector3(0, eaveY + roofH * (doubleEave ? 0.8 : 1), 0);
  for (let i = 0; i < sides; i++) {
    place('roof', roofPanel(corner(eaveR, i, eaveY), corner(eaveR, i + 1, eaveY), apex, apex, lift), new Vector3());
    order++;
  }

  // Finial: a gilt bead on a short spike.
  place('finial', new ConeGeometry(0.12, 0.5, 8), apex.clone().add(new Vector3(0, 0.2, 0)));
  place('finial', new SphereGeometry(0.16, 12, 8), apex.clone().add(new Vector3(0, 0.5, 0)));
  return blocks;
}

const PAVILION_GAP = SIZES.pavilion.gap; // metres between pavilions
const PAVILION_MAX = SIZES.pavilion.max;
const SITE_SEARCH = SIZES.pavilion.search; // metres from the click to look for a site
const SITE_PATCH = 3; // metres each way over which the ground must be flat enough to build on

/**
 * Whether a spot is worth a pavilion, as people chose where to build them: flat enough to build on
 * (the mean slope over a 3 m patch, so small bumps in the heightmap do not count), with a view
 * (high on the island or out at the cliff edge), and not crowding another pavilion. Pure.
 */
export function worthAPavilion(field: IslandField, p: IslandParams, at: [number, number, number], others: [number, number][]): boolean {
  const [x, y, z] = at;
  if (others.length >= PAVILION_MAX) return false;
  if (others.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < PAVILION_GAP)) return false;
  const h = SITE_PATCH / 2;
  const e = field.top(x + h, z), w = field.top(x - h, z), n = field.top(x, z + h), so = field.top(x, z - h);
  if (e === null || w === null || n === null || so === null) return false;
  if (Math.hypot(e - w, n - so) / (2 * h) > 0.25) return false;
  const edge = Math.hypot(x, z) / field.rim(Math.atan2(z, x));
  return edge > 0.7 || y > 0.3 * p.peakHeight;
}

/**
 * The visitor's click is an intent, not an exact spot: look around it for the nearest place worth a
 * pavilion. Returns that place, or null if there is none nearby (the path then ends at the click).
 */
export function pavilionSiteNear(field: IslandField, p: IslandParams, x: number, z: number, others: [number, number][]): [number, number, number] | null {
  const r = SITE_SEARCH;
  let best: [number, number, number] | null = null;
  let bestD = Infinity;
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) {
      const dx = (i / 6) * r, dz = (j / 6) * r;
      const d = Math.hypot(dx, dz);
      if (d > r || d >= bestD) continue;
      const y = field.top(x + dx, z + dz);
      if (y === null || field.pools.some((q) => Math.hypot(x + dx - q.x, z + dz - q.z) < q.radius * 1.3)) continue;
      if (!worthAPavilion(field, p, [x + dx, y, z + dz], others)) continue;
      best = [x + dx, y, z + dz];
      bestD = d;
    }
  }
  return best;
}
