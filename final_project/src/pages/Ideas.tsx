import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { JADE_UI } from '../core/palette';
import { useLanguage } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { LifeCard, type LifeNeed } from '../experiments/wonderland-terrain/LifeCard';
import { GrowSteps } from './ideas/GrowSteps';
import { FishPond } from './ideas/FishPond';
import { SCHOOL_DEFAULT } from '../experiments/wonderland-terrain/schoolRules';

/**
 * The Ideas page (docs/plan-2026-11-19-ideas-page.md): one full-screen stage held in place while the
 * page scrolls past it. The island's own pictures change behind (cross-fading, slowly drawing
 * nearer), and six short scenes come and go over them one after another, as the scroll-tied landing
 * the owner picked does it: little text, each idea shown by a small working piece of UI.
 */
const BASE = import.meta.env.BASE_URL;
const PICTURES = ['ideas-hero', 'ideas-rules', 'ideas-water', 'ideas-life', 'ideas-refs', 'ideas-night'] as const;
/** Each scene: when it is fully on (scroll progress 0–1), and the picture behind it. */
const SCENES: { on: [number, number]; picture: number; dark?: boolean }[] = [
  { on: [0, 0.12], picture: 0 },
  { on: [0.2, 0.32], picture: 1 },
  { on: [0.4, 0.5], picture: 2 },
  { on: [0.58, 0.7], picture: 3 },
  { on: [0.78, 0.86], picture: 4 },
  { on: [0.93, 1], picture: 5, dark: true },
];
const FADE = 0.06;
/** How much a scene is showing at progress p: fades in before its window, out after (the first stays from the top). */
function shown(p: number, [a, b]: [number, number], first: boolean) {
  if (p < a) return first ? 1 : Math.max(0, 1 - (a - p) / FADE);
  if (p <= b) return 1;
  return Math.max(0, 1 - (p - b) / FADE);
}

/** Scroll progress through the track, eased toward the real one each frame (no jumps). */
function useProgress(track: React.RefObject<HTMLDivElement | null>) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0, last = performance.now(), cur = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const el = track.current;
      if (el) {
        const span = el.offsetHeight - innerHeight;
        const target = Math.min(1, Math.max(0, (scrollY - el.offsetTop + 44) / Math.max(1, span)));
        const dt = Math.min(0.1, (now - last) / 1000);
        cur = reduced ? target : cur + (target - cur) * (1 - Math.exp(-dt * 8));
        if (Math.abs(target - cur) < 0.0005) cur = target;
        setP((old) => (Math.abs(old - cur) > 1e-4 ? cur : old));
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [track]);
  return p;
}

/** A child that rises into place once its scene is showing, after `delay` ms. */
function Rise({ on, delay = 0, children, className }: { on: boolean; delay?: number; children: ReactNode; className?: string }) {
  return <div className={`ideas-rise${on ? ' on' : ''}${className ? ` ${className}` : ''}`} style={{ transitionDelay: on ? `${delay}ms` : '0ms' }}>{children}</div>;
}

/** A dweller's card, as on the island: three needs running down and back up, each with its mark. */
function LifeMini() {
  const { t } = useLanguage();
  const [time, setTime] = useState(0);
  useEffect(() => { const id = setInterval(() => setTime((v) => v + 0.4), 400); return () => clearInterval(id); }, []);
  const wave = (phase: number, lo: number) => lo + (1 - lo) * (0.5 + 0.5 * Math.sin(time * 0.35 + phase));
  const needs: LifeNeed[] = [
    { key: 'food', label: t('life.food'), icon: 'food', value: wave(0, 0.3), act: 0.52, actNote: t('life.act.food') },
    { key: 'water', label: t('life.water'), icon: 'water', value: wave(2, 0.35), act: 0.5, actNote: t('life.act.water') },
    { key: 'rest', label: t('life.rest'), icon: 'rest', value: wave(4, 0.25), act: 0.35, actNote: t('life.act.rest') },
  ];
  const low = needs.find((n) => n.value < n.act);
  return <LifeCard inline kicker={`${t('dweller.name.5')} · ${t('ideas.now')}`} action={t(low ? `life.do.walk` : 'life.do.rest')} intent=""
    mood={{ word: t(low ? (`life.mood.${low.key}` as StringKey) : 'life.mood.settled'), tone: low ? 'low' : 'good' }}
    needs={needs} traits={[{ word: t('trait.roam.high'), note: '' }, { word: t('trait.bold.low'), note: '' }]} />;
}

/** Dwelling turns stone to jade: a walker's steps tint the cells it crosses, a little each time. */
function JadeMini() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const NX = 28, NZ = 16, cells = new Float32Array(NX * NZ);
    // Stone white to jade (JADE_UI.paper → jadeDeep), as the island's contact tint deepens.
    const from = [0xf6, 0xf3, 0xec], to = [0x5f, 0x87, 0x7d];
    let frame = 0, t = 0, last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // A loop between a "den", a "pool" and a "meadow": the same few ways, walked again and again.
      const x = NX / 2 + Math.sin(t * 0.5) * NX * 0.38, z = NZ / 2 + Math.sin(t * 1.0 + 0.6) * NZ * 0.3;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const ci = Math.round(x) + i, cj = Math.round(z) + j;
        if (ci >= 0 && cj >= 0 && ci < NX && cj < NZ) cells[cj * NX + ci] = Math.min(1, cells[cj * NX + ci] + dt * (i || j ? 0.09 : 0.25));
      }
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = w / NX, ch = h / NZ;
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const v = cells[j * NX + i];
        ctx.fillStyle = `rgb(${from.map((a, k) => Math.round(a + (to[k] - a) * v)).join(',')})`;
        ctx.fillRect(i * cw, j * ch, cw - 1, ch - 1);
      }
      ctx.beginPath(); ctx.arc(x * cw, z * ch, Math.min(cw, ch) * 0.55, 0, Math.PI * 2); ctx.fillStyle = JADE_UI.ink; ctx.fill();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvas} className="ideas-jade" aria-hidden="true" />;
}

/** Each source: where to read or see it (English, Chinese). Pictures in public/ideas/refs (credit on the page). */
const SOURCES = {
  liezi: ['https://ctext.org/liezi/tang-wen', 'https://ctext.org/liezi/tang-wen/zh'],
  shanhaijing: ['https://ctext.org/shan-hai-jing', 'https://ctext.org/shan-hai-jing/zh'],
  qianli: ['https://en.wikipedia.org/wiki/A_Thousand_Li_of_Rivers_and_Mountains', 'https://zh.wikipedia.org/wiki/千里江山图'],
  dunhuang: ['https://en.wikipedia.org/wiki/Mogao_Caves', 'https://zh.wikipedia.org/wiki/莫高窟'],
} as const;
const GAMES = {
  sims: 'https://www.ea.com/games/the-sims/the-sims-4',
  rainworld: 'https://store.steampowered.com/app/312520/',
  abzu: 'https://store.steampowered.com/app/384190/',
  shelter: 'https://store.steampowered.com/app/244710/',
  botw: 'https://zelda.nintendo.com/breath-of-the-wild/',
} as const;

/** How far each school rule reaches, in body lengths (schoolRules.ts). */
const SCHOOL_RINGS = { repel: SCHOOL_DEFAULT.repel, align: SCHOOL_DEFAULT.align, attract: SCHOOL_DEFAULT.attract };

export default function Ideas() {
  const { t, language } = useLanguage();
  const track = useRef<HTMLDivElement>(null);
  const p = useProgress(track);
  const levels = SCENES.map((s, i) => shown(p, s.on, i === 0));
  const current = levels.indexOf(Math.max(...levels));
  const dark = SCENES[current].dark;
  const pictureLevel = PICTURES.map((_, k) => Math.max(0, ...SCENES.map((s, i) => (s.picture === k ? levels[i] : 0))));
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const span = el.offsetHeight - innerHeight;
    scrollTo({ top: el.offsetTop - 44 + span * ((SCENES[i].on[0] + SCENES[i].on[1]) / 2), behavior: 'smooth' });
  };
  const scene = (i: number, children: ReactNode, className = '') => {
    const o = levels[i];
    return <section className={`ideas-scene ${className}`} style={{ opacity: o, visibility: o > 0.01 ? 'visible' : 'hidden' } as CSSProperties} aria-hidden={o < 0.3}>{children}</section>;
  };
  const on = (i: number) => levels[i] > 0.3;
  return (
    <div className={`ideas-track${dark ? ' dark' : ''}`} ref={track}>
      <div className="ideas-stage">
        {PICTURES.map((name, k) => <img key={name} className="ideas-picture" src={`${BASE}ideas/${name}.webp`} alt=""
          style={{ opacity: pictureLevel[k], transform: `scale(${1.08 - 0.08 * Math.min(1, Math.max(0, p * PICTURES.length - k))})` }} />)}

        {scene(0, <div className="ideas-sky-text">
          <Rise on={on(0)}><small className="ideas-eyebrow">{t('ideas.kicker')}</small></Rise>
          <Rise on={on(0)} delay={120}><h1>{t('ideas.title')}</h1></Rise>
          <Rise on={on(0)} delay={260}><p className="ideas-sub">{t('ideas.sub')}</p></Rise>
        </div>, 'ideas-hero')}

        {scene(1, <div className="ideas-card ideas-wide">
          <Rise on={on(1)}><small className="ideas-eyebrow">{t('ideas.rules.eyebrow')}</small><h2>{t('ideas.rules.title')}</h2></Rise>
          <Rise on={on(1)} delay={220}><GrowSteps /></Rise>
        </div>, 'ideas-left')}

        {scene(2, <div className="ideas-split">
          <Rise on={on(2)} className="ideas-card"><small className="ideas-eyebrow">{t('ideas.fish.eyebrow')}</small><h2>{t('ideas.fish.title')}</h2>
            <ul className="ideas-keys">
              {([['repel', JADE_UI.seal], ['align', JADE_UI.jadeDeep], ['attract', JADE_UI.jade]] as const).map(([k, col]) => <li key={k}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke={col} strokeWidth="1.6" strokeDasharray="3 2" /></svg>
                {t(`ideas.fish.${k}` as StringKey)}<em>{t('ideas.fish.body').replace('{n}', String(SCHOOL_RINGS[k]))}</em></li>)}
            </ul>
            <p className="ideas-note">{t('ideas.fish.lead')}</p></Rise>
          <Rise on={on(2)} delay={200} className="ideas-panel ideas-pond"><FishPond /></Rise>
        </div>, 'ideas-left')}

        {scene(3, <div className="ideas-split">
          <Rise on={on(3)} className="ideas-card"><small className="ideas-eyebrow">{t('ideas.life.eyebrow')}</small><h2>{t('ideas.life.title')}</h2><p className="ideas-note">{t('ideas.life.note')}</p></Rise>
          <div className="ideas-stack">
            <Rise on={on(3)} delay={180} className="ideas-panel"><LifeMini /></Rise>
            <Rise on={on(3)} delay={320} className="ideas-panel"><JadeMini /><small className="ideas-caption">{t('ideas.jade')}</small></Rise>
          </div>
        </div>, 'ideas-left')}

        {scene(4, <div className="ideas-refs-wrap">
          <Rise on={on(4)}><small className="ideas-eyebrow ideas-chip">{t('ideas.refs.eyebrow')}</small></Rise>
          <div className="ideas-refs">
            <Rise on={on(4)} delay={120} className="ideas-panel"><h3>{t('ideas.refs.books')}</h3><ul>{(Object.keys(SOURCES) as (keyof typeof SOURCES)[]).map((k) =>
              <li key={k}><a href={SOURCES[k][language === 'zh' ? 1 : 0]} target="_blank" rel="noreferrer">
                <img src={`${BASE}ideas/refs/${k}.webp`} alt="" loading="lazy" />
                <span><b>{t(`ideas.src.${k}` as StringKey)} <i aria-hidden="true">↗</i></b><span>{t(`ideas.src.${k}.use` as StringKey)}</span></span></a></li>)}</ul></Rise>
            <Rise on={on(4)} delay={240} className="ideas-panel"><h3>{t('ideas.refs.games')}</h3><ul>{(Object.keys(GAMES) as (keyof typeof GAMES)[]).map((k) =>
              <li key={k}><a href={GAMES[k]} target="_blank" rel="noreferrer">
                <img className="wide" src={`${BASE}ideas/refs/${k}.webp`} alt="" loading="lazy" />
                <span><b>{t(`ideas.game.${k}` as StringKey)} <i aria-hidden="true">↗</i></b><span>{t(`ideas.game.${k}.use` as StringKey)}</span></span></a></li>)}</ul></Rise>
          </div>
          <Rise on={on(4)} delay={360}><small className="ideas-credit">{t('ideas.refs.credit')}</small></Rise>
        </div>, 'ideas-left')}

        {scene(5, <div className="ideas-sky-text ideas-enter-text">
          <Rise on={on(5)}><h2>{t('ideas.enter.title')}</h2></Rise>
          <Rise on={on(5)} delay={180}><Link className="ideas-enter" to="/world">{t('ideas.enter')} <span aria-hidden="true">→</span></Link></Rise>
        </div>, 'ideas-center ideas-sky')}

        <nav className="ideas-dots" aria-label={t('ideas.dots')}>
          {SCENES.map((_, i) => <button key={i} type="button" aria-label={t(`ideas.dot.${i}` as StringKey)} aria-current={i === current} onClick={() => go(i)} />)}
        </nav>
        {current === 0 && <button type="button" className="ideas-down" aria-label={t('ideas.dot.1')} onClick={() => go(1)}>↓</button>}
      </div>
    </div>
  );
}
