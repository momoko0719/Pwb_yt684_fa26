import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';

/**
 * The newcomer's walk round the island's controls: one place at a time is lit, the rest dimmed,
 * with a short card and a small moving picture of the gesture (a mouse dragging, a finger tapping).
 * Everything stays live (the dim layer takes no clicks), so the visitor tries each thing as it is
 * shown; doing it ticks the step, but only "next" moves on. "Skip" (or Esc) ends the whole walk;
 * once ended it does not come back by itself (Settings → Explore → the tour replays it).
 */
export const TOUR_STEPS = ['view', 'chapters', 'time', 'creature', 'layers', 'photo', 'atlas'] as const;
export type TourStep = typeof TOUR_STEPS[number];
export type TourSeen = Partial<Record<TourStep, boolean>>;

const KEY = 'whiteJade.tour.v1';
export function tourWasSeen() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
function rememberSeen() { try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: it will show again next visit */ } }

/**
 * What each step lights. Each entry is a list of selectors, the first present wins; `all:` lights the
 * box round every match (the chapters without the camera under them).
 */
type Phase = TourStep | 'creatureGo';
const TARGETS: Record<Phase, string[][]> = {
  view: [],
  chapters: [['all:.exhibit-cameras [data-chapter]']],
  time: [['.time-dial-dock']],
  creatureGo: [['.exhibit-cameras [data-chapter="life"]']],
  creature: [['.creature-status-dock']],
  layers: [['.layers-panel', '.layers-dock']],
  photo: [['.exhibit-photo']],
  atlas: [['.resource-atlas', '.exhibit-to-atlas', '.exhibit-gear']],
};
/** Steps whose lit thing is a button to press: a finger taps it. */
const TAP: Partial<Record<Phase, boolean>> = { creatureGo: true, creature: true, layers: true, photo: true, atlas: true };
/** Where the finger taps, when not the lit thing's corner: the creature's portrait (its form). */
const TAP_ON: Partial<Record<Phase, string>> = { creature: '.creature-status-portrait' };

interface Hole { x: number; y: number; w: number; h: number; r: number }
const PAD = 6, CARD_W = 310, GAP = 14;

function boxOf(sel: string): DOMRect | null {
  if (sel.startsWith('all:')) {
    const els = [...document.querySelectorAll(sel.slice(4))].map((e) => e.getBoundingClientRect()).filter((b) => b.width || b.height);
    if (!els.length) return null;
    const l = Math.min(...els.map((b) => b.left)), t = Math.min(...els.map((b) => b.top));
    return new DOMRect(l, t, Math.max(...els.map((b) => b.right)) - l, Math.max(...els.map((b) => b.bottom)) - t);
  }
  const b = document.querySelector(sel)?.getBoundingClientRect();
  return b && (b.width || b.height) ? b : null;
}

function holesOf(phase: Phase): Hole[] {
  const holes: Hole[] = [];
  for (const any of TARGETS[phase]) {
    for (const sel of any) {
      const b = boxOf(sel);
      if (!b) continue;
      holes.push({ x: b.left - PAD, y: b.top - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2, r: 12 });
      break;
    }
  }
  return holes.map((h) => ({ x: Math.round(h.x), y: Math.round(h.y), w: Math.round(h.w), h: Math.round(h.h), r: h.r }));
}

const rr = ({ x, y, w, h, r }: Hole) => {
  const q = Math.min(r, w / 2, h / 2);
  return `M${x + q} ${y}H${x + w - q}A${q} ${q} 0 0 1 ${x + w} ${y + q}V${y + h - q}A${q} ${q} 0 0 1 ${x + w - q} ${y + h}H${x + q}A${q} ${q} 0 0 1 ${x} ${y + h - q}V${y + q}A${q} ${q} 0 0 1 ${x + q} ${y}Z`;
};

/** The card beside what is lit: right if there is room, else left, above, below; else the bottom-right corner. */
function cardAt(holes: Hole[], cardH: number, vw: number, vh: number) {
  // Nothing lit (looking around): the open sky to the right of the island, clear of the gear and the map.
  if (!holes.length) return { left: vw - CARD_W - Math.max(90, vw * 0.06), top: Math.max(120, vh * 0.3) };
  const x0 = Math.min(...holes.map((h) => h.x)), y0 = Math.min(...holes.map((h) => h.y));
  const x1 = Math.max(...holes.map((h) => h.x + h.w)), y1 = Math.max(...holes.map((h) => h.y + h.h));
  const clampY = (y: number) => Math.min(Math.max(y, 12), vh - cardH - 12);
  const clampX = (x: number) => Math.min(Math.max(x, 12), vw - CARD_W - 12);
  if (x1 + GAP + CARD_W < vw - 12) return { left: x1 + GAP, top: clampY(y0) };
  if (x0 - GAP - CARD_W > 12) return { left: x0 - GAP - CARD_W, top: clampY(y0) };
  if (y0 - GAP - cardH > 12) return { left: clampX(x0), top: y0 - GAP - cardH };
  if (y1 + GAP + cardH < vh - 12) return { left: clampX(x0), top: y1 + GAP };
  return { left: vw - CARD_W - 12, top: vh - cardH - 12 };
}

/* The small moving pictures (CSS keyframes in index.css: tour-*). */
function Mouse({ button, motion }: { button: 'left' | 'right' | 'wheel'; motion: 'sway' | 'slide' | 'scroll' }) {
  return <svg viewBox="0 0 44 40" className={`tour-mouse tour-${motion}`} aria-hidden="true">
    <g className="tour-mouse-body">
      <rect x="13" y="6" width="18" height="28" rx="9" className="tour-line" />
      <path d="M22 6v10M13 16h18" className="tour-line" />
      {button === 'left' && <path d="M22 6.5a8.5 8.5 0 0 0-8.5 8.5v1H22Z" className="tour-press" />}
      {button === 'right' && <path d="M22 6.5a8.5 8.5 0 0 1 8.5 8.5v1H22Z" className="tour-press" />}
      {button === 'wheel' && <rect x="20.5" y="9" width="3" height="6" rx="1.5" className="tour-press tour-wheel" />}
    </g>
    {motion === 'sway' && <path d="M8 36q14 6 28 0" className="tour-line tour-arrow" />}
    {motion === 'slide' && <path d="M6 37h32" className="tour-line tour-arrow" />}
    {motion === 'scroll' && <path d="M38 12v16M35 15l3-3 3 3M35 25l3 3 3-3" className="tour-line tour-arrow" />}
  </svg>;
}
function Dial() {
  return <svg viewBox="0 0 44 40" className="tour-mouse" aria-hidden="true">
    <circle cx="22" cy="22" r="13" className="tour-line" /><path d="M9 22h26" className="tour-line tour-faint" />
    <g className="tour-orbit"><circle cx="22" cy="9" r="3.4" className="tour-press" /></g>
  </svg>;
}
function Bar() {
  return <svg viewBox="0 0 44 40" className="tour-mouse" aria-hidden="true">
    <rect x="5" y="16" width="34" height="8" rx="4" className="tour-line" />
    <rect x="5" y="16" width="34" height="8" rx="4" className="tour-press tour-fill" />
  </svg>;
}

function Gestures({ rows }: { rows: [ReactNode, string][] }) {
  return <ul className="tour-gestures">{rows.map(([pic, text], i) => <li key={i}>{pic}<span>{text}</span></li>)}</ul>;
}

export function Tour({ open, seen, following, onClose }: {
  open: boolean;
  /** Steps the visitor has already done (ticked on the card). */
  seen: TourSeen;
  /** The camera is following a creature (the Creature chapter): the creature step can point at it. */
  following: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [at, setAt] = useState(0);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cardH, setCardH] = useState(180);
  const card = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[at];
  // The creature step: first send the camera to it (the Creature chapter), then point at it.
  const phase: Phase = step === 'creature' && !following ? 'creatureGo' : step;

  useEffect(() => { if (open) setAt(0); }, [open]);
  const end = () => { rememberSeen(); onClose(); };

  // Follow the lit things every frame (panels open, the camera carries the creature).
  useEffect(() => {
    if (!open) return;
    let id = 0, last = '';
    const look = () => {
      const next = holesOf(phase);
      const key = JSON.stringify(next) + window.innerWidth + 'x' + window.innerHeight;
      if (key !== last) { last = key; setHoles(next); setView({ w: window.innerWidth, h: window.innerHeight }); }
    };
    const tick = () => { look(); id = requestAnimationFrame(tick); };
    tick();
    // Frames pause while the page is in the background; look now and then anyway.
    const slow = window.setInterval(look, 250);
    return () => { cancelAnimationFrame(id); window.clearInterval(slow); };
  }, [open, phase]);

  useLayoutEffect(() => { if (card.current) setCardH(card.current.offsetHeight); }, [open, at, phase, t]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); end(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const lastStep = at === TOUR_STEPS.length - 1;
  const pos = cardAt(holes, cardH, view.w, view.h);
  const tx = (k: string) => t(k as StringKey);
  const pictures: Partial<Record<Phase, ReactNode>> = {
    view: <Gestures rows={[
      [<Mouse button="left" motion="sway" />, tx('tour.view.turn')],
      [<Mouse button="right" motion="slide" />, tx('tour.view.pan')],
      [<Mouse button="wheel" motion="scroll" />, tx('tour.view.zoom')],
    ]} />,
    time: <Gestures rows={[[<Dial />, tx('tour.time.dial')], [<Bar />, tx('tour.time.bar')]]} />,
  };
  const body = phase === 'view' || phase === 'time' ? null : tx(`tour.${phase}.body`);

  return <div className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
    <svg className="tour-dim" width={view.w} height={view.h} aria-hidden="true">
      <path d={`M0 0H${view.w}V${view.h}H0Z ${holes.map(rr).join(' ')}`} fillRule="evenodd" />
      {holes.map((h, i) => <path key={i} d={rr(h)} className="tour-ring" />)}
    </svg>
    {/* A finger tapping the thing to press. */}
    {TAP[phase] && (() => {
      const on = TAP_ON[phase] ? boxOf(TAP_ON[phase]!) : null;
      const h = holes[0];
      const at = on ? { left: on.right - 14, top: on.bottom - 14 } : h ? { left: h.x + h.w - 12, top: h.y + h.h - 12 } : null;
      return at && <span key={phase} className="tour-tap" style={at} aria-hidden="true" />;
    })()}
    <div ref={card} className="tour-card" style={{ left: pos.left, top: pos.top, width: CARD_W }}>
      <small className="tour-count">{t('tour.count').replace('{n}', String(at + 1)).replace('{total}', String(TOUR_STEPS.length))}
        {seen[step] && <span className="tour-tick">✓ {t('tour.done')}</span>}</small>
      <h2 id="tour-title">{tx(`tour.${step}.title`)}</h2>
      {pictures[phase]}
      {body && <p>{body}</p>}
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={end}>{t('tour.skip')}</button>
        <span>
          {at > 0 && <button type="button" onClick={() => setAt(at - 1)}>{t('tour.prev')}</button>}
          <button type="button" className="tour-next" onClick={() => (lastStep ? end() : setAt(at + 1))}>{t(lastStep ? 'tour.finish' : 'tour.next')}</button>
        </span>
      </div>
    </div>
  </div>;
}
