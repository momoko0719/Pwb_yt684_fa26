import { JADE_UI, PORCELAIN } from '../../core/palette';

/**
 * A jade dweller seen from above, for the Ideas page's small canvases: a pale body, neck and head,
 * a pair of jade antlers, four legs stepping while it walks. `x, y` is the body's middle, `heading`
 * where the muzzle points (radians, canvas axes), `s` its body length in pixels, `step` the gait phase
 * (0 while standing), `dip` 0–1 lowers the head to drink or graze.
 */
export function drawDweller(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, s: number, step: number, dip = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(heading);
  const line = Math.max(0.8, s * 0.035);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Shadow.
  ctx.fillStyle = 'rgba(46,51,48,0.16)';
  ctx.beginPath(); ctx.ellipse(s * 0.06, s * 0.1, s * 0.48, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  // Legs: front and back pairs swinging in opposite phase.
  ctx.strokeStyle = JADE_UI.ink; ctx.lineWidth = line * 2.2;
  const swing = Math.sin(step) * s * 0.08;
  for (const [lx, side, ph] of [[0.24, -1, 1], [0.24, 1, -1], [-0.26, -1, -1], [-0.26, 1, 1]] as const) {
    ctx.beginPath(); ctx.moveTo(s * lx, side * s * 0.1); ctx.lineTo(s * lx + swing * ph, side * s * 0.2); ctx.stroke();
  }
  // Tail.
  ctx.strokeStyle = PORCELAIN.fishBody; ctx.lineWidth = line * 2.4;
  ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.quadraticCurveTo(-s * 0.55, Math.sin(step * 0.5) * s * 0.06, -s * 0.6, s * 0.04); ctx.stroke();
  // Body.
  ctx.fillStyle = JADE_UI.paper; ctx.strokeStyle = JADE_UI.ink; ctx.lineWidth = line;
  ctx.beginPath(); ctx.ellipse(-s * 0.02, 0, s * 0.42, s * 0.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Neck and head (reaching further forward as it dips to drink).
  const hx = s * (0.5 + 0.12 * dip);
  ctx.beginPath(); ctx.moveTo(s * 0.32, -s * 0.06); ctx.lineTo(hx - s * 0.04, -s * 0.05); ctx.lineTo(hx - s * 0.04, s * 0.05); ctx.lineTo(s * 0.32, s * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(hx, 0, s * 0.1, s * 0.075, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Antlers: two forked jade strokes.
  ctx.strokeStyle = JADE_UI.jade; ctx.lineWidth = line * 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(hx - s * 0.04, side * s * 0.05); ctx.lineTo(hx - s * 0.14, side * s * 0.17);
    ctx.moveTo(hx - s * 0.1, side * s * 0.12); ctx.lineTo(hx - s * 0.03, side * s * 0.2); ctx.stroke();
  }
  ctx.restore();
}
