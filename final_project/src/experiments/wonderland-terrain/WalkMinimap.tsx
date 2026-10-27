import { useEffect, useRef } from 'react';

export type WalkMapPose = {
  x: number;
  z: number;
  /** Radians, atan2(dz, dx) world heading. */
  heading: number;
};

export type WalkMapMark = { x: number; z: number; kind: 'home' | 'drink' };

const SIZE = 128;
const PAD = 10;

/**
 * Tiny top-down map while Walk is on: island extent, player wedge, home/drink marks.
 * Drawn in 2D (no 3D cost). `extent` = half-width of the island square in metres.
 */
export default function WalkMinimap({
  pose,
  marks,
  extent,
  label,
}: {
  pose: WalkMapPose | null;
  marks: WalkMapMark[];
  extent: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !pose) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const half = Math.max(extent, 80);
    const to = (x: number, z: number) => ({
      u: PAD + ((x + half) / (2 * half)) * (SIZE - 2 * PAD),
      v: PAD + ((z + half) / (2 * half)) * (SIZE - 2 * PAD),
    });

    ctx.clearRect(0, 0, SIZE, SIZE);
    // Panel
    ctx.fillStyle = 'rgba(245, 240, 230, 0.92)';
    ctx.strokeStyle = 'rgba(40, 36, 32, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);

    // Soft island disc
    const c = to(0, 0);
    const r = ((half * 0.92) / (2 * half)) * (SIZE - 2 * PAD);
    ctx.fillStyle = 'rgba(220, 214, 204, 0.95)';
    ctx.beginPath();
    ctx.arc(c.u, c.v, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 72, 64, 0.35)';
    ctx.stroke();

    for (const m of marks) {
      const p = to(m.x, m.z);
      ctx.fillStyle = m.kind === 'drink' ? 'rgba(70, 140, 160, 0.95)' : 'rgba(120, 90, 60, 0.9)';
      ctx.beginPath();
      ctx.arc(p.u, p.v, m.kind === 'home' ? 3.2 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player wedge (faces heading)
    const p = to(pose.x, pose.z);
    const ang = pose.heading;
    ctx.fillStyle = 'rgba(180, 40, 30, 0.95)';
    ctx.beginPath();
    ctx.moveTo(p.u + Math.cos(ang) * 7, p.v + Math.sin(ang) * 7);
    ctx.lineTo(p.u + Math.cos(ang + 2.5) * 5, p.v + Math.sin(ang + 2.5) * 5);
    ctx.lineTo(p.u + Math.cos(ang - 2.5) * 5, p.v + Math.sin(ang - 2.5) * 5);
    ctx.closePath();
    ctx.fill();
  }, [pose, marks, extent]);

  if (!pose) return null;
  return (
    <div className="walk-minimap" aria-label={label}>
      <canvas ref={ref} width={SIZE} height={SIZE} />
      <span className="walk-minimap-label">{label}</span>
    </div>
  );
}
