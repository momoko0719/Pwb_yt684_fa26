import { JADE_UI } from '../../core/palette';

/**
 * The Ideas page's small canvases, drawn as an ink-wash sketch seen from above (owner, 2026-11-22:
 * option A's brush, option C's colours): washes of mist and jade, a brushed rim, fish as single
 * tapered strokes in deep jade (the leader in seal red), and the dweller as a pale ink silhouette.
 */

/** A palette colour at an opacity. */
export const tint = (hex: string, a: number) =>
  `rgba(${[1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)).join(',')},${a})`;

/** A brushed ring: a slightly uneven line, as a loaded brush leaves it (no randomness: a fixed wobble). */
export function brushRing(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colour: string, width: number) {
  for (const [pass, a] of [[0, 0.75], [1, 0.35]] as const) {
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2 + 0.02; t += 0.02) {
      const wob = 1 + 0.008 * Math.sin(t * 3 + pass * 1.7);
      ctx.lineTo(x + Math.cos(t) * rx * wob, y + Math.sin(t) * ry * wob);
    }
    ctx.strokeStyle = tint(colour, a); ctx.lineWidth = width * (1 - pass * 0.4); ctx.stroke();
  }
}

/** A pool of water seen from above: a mist wash, jade deepening towards the middle, a brushed rim. */
export function washPool(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.fillStyle = JADE_UI.mist;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  for (const [s, a] of [[0.82, 0.14], [0.62, 0.16], [0.4, 0.16]] as const) {
    ctx.fillStyle = tint(JADE_UI.jade, a);
    ctx.beginPath(); ctx.ellipse(x + rx * 0.03, y + ry * 0.02, rx * s, ry * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  brushRing(ctx, x, y, rx, ry, JADE_UI.jadeDeep, Math.max(1.2, rx * 0.025));
}

/** One fish: a single tapered stroke and a two-flick tail, `size` pixels long, facing `heading`. */
export function inkFish(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, size: number, beat: number, lead = false) {
  const s = size, col = lead ? JADE_UI.seal : JADE_UI.jadeDeep, sway = Math.sin(beat) * s * 0.12;
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading);
  ctx.fillStyle = tint(col, 0.9);
  ctx.beginPath(); ctx.moveTo(s * 0.5, 0);
  ctx.bezierCurveTo(s * 0.2, -s * 0.2, -s * 0.2, -s * 0.1, -s * 0.45, sway);
  ctx.bezierCurveTo(-s * 0.2, s * 0.1, s * 0.2, s * 0.2, s * 0.5, 0); ctx.fill();
  ctx.strokeStyle = tint(col, 0.7); ctx.lineWidth = Math.max(1, s * 0.06); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, sway); ctx.lineTo(-s * 0.7, -s * 0.14 + sway * 1.6);
  ctx.moveTo(-s * 0.42, sway); ctx.lineTo(-s * 0.7, s * 0.14 + sway * 1.6);
  ctx.stroke(); ctx.restore();
}

/**
 * The dweller from above, a pale ink silhouette `size` pixels nose to tail, facing `heading`:
 * body, neck, head, the two antlers. `bob` sways it a little in step while it walks; `dip` (0..1)
 * reaches the head forward and down to the water.
 */
export function inkDweller(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, size: number, bob = 0, dip = 0) {
  const s = size, body = tint(JADE_UI.jadeDeep, 0.5), line = tint(JADE_UI.jadeDeep, 0.9);
  const swing = Math.sin(bob) * s * 0.07, reach = s * 0.08 * dip;
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Legs first (under the body): four short strokes out to the sides, swinging in step.
  ctx.strokeStyle = line; ctx.lineWidth = Math.max(1.2, s * 0.035);
  ctx.beginPath();
  for (const [lx, side, ph] of [[0.05, 1, 1], [0.05, -1, -1], [-0.38, 1, -1], [-0.38, -1, 1]] as const) {
    ctx.moveTo(s * lx, side * s * 0.1); ctx.lineTo(s * lx + swing * ph, side * s * 0.2);
  }
  ctx.stroke();
  // Body, a short tail, neck and head, in one wash.
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(-s * 0.17, 0, s * 0.32, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = s * 0.09;
  ctx.beginPath(); ctx.moveTo(s * 0.08, 0); ctx.lineTo(s * 0.28 + reach, 0); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(s * 0.36 + reach, 0, s * 0.1, s * 0.065, 0, 0, Math.PI * 2); ctx.fill();
  // Antlers: two branching strokes swept back from the head, the mark that says what it is.
  ctx.strokeStyle = line; ctx.lineWidth = Math.max(1.2, s * 0.03);
  ctx.beginPath();
  for (const side of [1, -1]) {
    const hx = s * 0.33 + reach, w = side * s;
    ctx.moveTo(hx, side * s * 0.05); ctx.lineTo(hx - s * 0.08, w * 0.2); ctx.lineTo(hx - s * 0.2, w * 0.27);
    ctx.moveTo(hx - s * 0.06, w * 0.16); ctx.lineTo(hx + s * 0.02, w * 0.27);
    ctx.moveTo(hx - s * 0.13, w * 0.23); ctx.lineTo(hx - s * 0.11, w * 0.33);
  }
  ctx.moveTo(-s * 0.48, 0); ctx.lineTo(-s * 0.56, swing * 0.4);
  ctx.stroke(); ctx.restore();
}

/** Spreading ripples where the dweller drinks: half rings opening towards the water, fading out. */
export function ripples(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, size: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.6 + i / 3) % 1;
    ctx.beginPath(); ctx.arc(x, y, p * size, facing - 1.3, facing + 1.3);
    ctx.strokeStyle = tint(JADE_UI.jadeDeep, 0.6 * (1 - p)); ctx.lineWidth = 1.2; ctx.stroke();
  }
}

/** A den seen from above: a rock mound in grey wash, its dark mouth on one side. */
export function inkDen(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = size * 0.5;
  ctx.fillStyle = tint(JADE_UI.inkDim, 0.35);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.72, -0.2, 0, Math.PI * 2); ctx.fill();
  brushRing(ctx, x, y, r, r * 0.72, JADE_UI.ink, 1.2);
  ctx.fillStyle = tint(JADE_UI.ink, 0.55);
  ctx.beginPath(); ctx.ellipse(x + r * 0.45, y + r * 0.2, r * 0.26, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
}

/** A patch of meadow from above: a jade wash and a few brushed blades. */
export function inkMeadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = size * 0.5;
  ctx.fillStyle = tint(JADE_UI.jade, 0.3);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = tint(JADE_UI.jadeDeep, 0.8); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [ox, oy] of [[-0.5, 0.1], [-0.1, -0.25], [0.35, 0.05], [0.05, 0.35], [-0.35, -0.3]]) {
    const gx = x + ox * r, gy = y + oy * r;
    ctx.moveTo(gx, gy + r * 0.18); ctx.lineTo(gx - r * 0.1, gy - r * 0.1);
    ctx.moveTo(gx, gy + r * 0.18); ctx.lineTo(gx + r * 0.08, gy - r * 0.14);
  }
  ctx.stroke();
}
