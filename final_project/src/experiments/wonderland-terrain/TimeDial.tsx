import { useId, useRef, type PointerEvent } from 'react';
import { getPalette, nearestTimeOfDay, type TimeOfDay } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { SpeedSlider } from './SpeedSlider';

/**
 * The hour, always at hand (bottom left of the island): a small round dial, once round is one
 * day. Noon at the top, midnight at the bottom, dawn on the left and dusk on the right of the
 * horizon across its middle; the upper half is painted with the island's own sky for the hour.
 * Drag the sun round the ring to set the hour (the palette blends between its keyframes all the
 * way, so the light changes as it does in a day).
 */
const S = 64, C = S / 2, R = 25;
const wrap = (hour: number) => ((hour % 24) + 24) % 24;
// Hour to angle on screen: noon straight up, 6 left, 18 right, midnight straight down.
const pointOf = (hour: number, r = R): [number, number] => {
  const a = ((hour - 12) / 24) * Math.PI * 2;
  return [C + Math.sin(a) * r, C - Math.cos(a) * r];
};
const LABEL: Record<TimeOfDay, StringKey> = { dawn: 'option.dawn', noon: 'option.noon', dusk: 'option.dusk', night: 'option.night' };

/** The simulation speeds the chip steps through (the creatures' days, the fish, the footprints). */
export const SIM_SPEEDS = [1, 10, 30, 100] as const;

export function TimeDial({ hour, onHour, speed, onSpeed }: { hour: number; onHour: (hour: number) => void; speed?: number; onSpeed?: (speed: number) => void }) {
  const { t } = useLanguage();
  const id = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const drag = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'pointermove' && !(e.buttons & 1)) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const box = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * S - C, y = ((e.clientY - box.top) / box.height) * S - C;
    const a = Math.atan2(x, -y); // 0 at the top (noon), growing clockwise
    onHour(Math.round(wrap(12 + (a / (Math.PI * 2)) * 24) * 4) / 4);
  };
  const sky = getPalette('qinglv', hour);
  const day = hour >= 6 && hour <= 18;
  const [sx, sy] = pointOf(hour);
  const hh = Math.floor(hour).toString().padStart(2, '0');
  const mm = (Math.round((hour % 1) * 60) % 60).toString().padStart(2, '0');
  return (
    <div className="time-dial-dock">
      {/* The sim speed: a glass slider on top of the dial (a sibling, so its own glass blurs the island). */}
      {onSpeed && speed !== undefined && <SpeedSlider speeds={SIM_SPEEDS} speed={speed} onSpeed={onSpeed} />}
    <div className="time-dial" role="group" aria-label={t('exhibit.sunClock')}>
      <svg ref={svg} viewBox={`0 0 ${S} ${S}`} width={S} height={S} className="time-dial-svg"
        onPointerDown={drag} onPointerMove={drag} aria-label={t('exhibit.sunClock')}>
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.skyTop} />
            <stop offset="0.35" stopColor={sky.skyMid} />
            <stop offset="0.5" stopColor={sky.skyHorizon} />
            <stop offset="0.5" stopColor={sky.fog} stopOpacity="0.55" />
            <stop offset="1" stopColor={sky.shadowCool} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={R - 6} fill={`url(#${id}-sky)`} className="time-dial-face" />
        <line x1={C - R + 6} x2={C + R - 6} y1={C} y2={C} className="time-dial-horizon" />
        <circle cx={C} cy={C} r={R} className="time-dial-ring" />
        {[0, 6, 12, 18].map((h) => { const [x, y] = pointOf(h, R); return <circle key={h} cx={x} cy={y} r={1.2} className="time-dial-tick" />; })}
        {day
          ? <circle cx={sx} cy={sy} r="5" className="time-dial-sun" />
          : <g className="time-dial-moon"><circle cx={sx} cy={sy} r="5" /><circle cx={sx + 2.4} cy={sy - 1.8} r="4.2" fill={sky.skyMid} /></g>}
      </svg>
      <div className="time-dial-read">
        <strong>{hh}:{mm}</strong>
        <span>{t(LABEL[nearestTimeOfDay(hour)])}</span>
      </div>
    </div>
    </div>
  );
}
