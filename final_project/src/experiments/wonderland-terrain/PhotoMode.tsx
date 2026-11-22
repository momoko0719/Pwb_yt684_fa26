import { useEffect, useRef, useState } from 'react';
import { PHOTO } from '../../core/palette';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import type { PhotoShot } from './PhotoPass';
import { PHOTO_FILTERS, type PhotoFilter } from './photoFilters';
import { WONDER_WALK_CANVAS } from './Walk';
import { createRng } from '../../core/rng';

/** The picture's shape: 3 : 2; the viewfinder shows exactly what it keeps. */
const ASPECT = 3 / 2;

/** The seal (the owner's, drawn for the island), on every print. */
const SEAL_URL = `${import.meta.env.BASE_URL}seal-white-jade.png`;

/** How a print is mounted: an instant print, or a handscroll on silk with two rollers. */
type PrintStyle = 'scroll' | 'polaroid';
const STYLE_KEY = 'white-jade.print-style';

/** Each filter's frame on the film strip: a few strokes in its own pigments. */
const SWATCH: Record<PhotoFilter, string> = {
  blueGreen: `linear-gradient(172deg, ${PHOTO.silk} 0 34%, ${PHOTO.malachite} 56%, ${PHOTO.azurite} 82%, ${PHOTO.ochre} 100%)`,
  watercolour: `radial-gradient(circle at 30% 42%, ${PHOTO.azurite}66 0 22%, transparent 48%), radial-gradient(circle at 66% 66%, ${PHOTO.seal}44 0 20%, transparent 46%), radial-gradient(circle at 72% 30%, ${PHOTO.malachite}66 0 16%, transparent 42%), linear-gradient(${PHOTO.wcPaper}, ${PHOTO.wcPaper})`,
  ink: `radial-gradient(ellipse 60% 45% at 28% 78%, ${PHOTO.ink} 0 30%, transparent 70%), radial-gradient(ellipse 45% 40% at 72% 62%, ${PHOTO.ink}99 0 25%, transparent 70%), linear-gradient(${PHOTO.inkPaper}, ${PHOTO.inkPaper})`,
  oil: `conic-gradient(from 40deg at 62% 38%, ${PHOTO.ultramarine}, ${PHOTO.azurite}, ${PHOTO.chrome}, ${PHOTO.ultramarine}, ${PHOTO.azurite}, ${PHOTO.chrome}aa, ${PHOTO.ultramarine})`,
  none: `linear-gradient(165deg, ${PHOTO.chrome}55 0%, ${PHOTO.wcPaper} 42%, ${PHOTO.malachite}aa 72%, ${PHOTO.azurite}cc 100%)`,
};

/** The painting each filter is after (public/paintings), shown beside the print. */
const PAINTING: Partial<Record<PhotoFilter, string>> = {
  blueGreen: 'paintings/blue-green-qianli.jpg',
  watercolour: 'paintings/watercolour-red-rigi.jpg',
  ink: 'paintings/ink-xiaoxiang.jpg',
  oil: 'paintings/oil-starry-night.jpg',
};

const dateStamp = (d: Date) => `’${String(d.getFullYear()).slice(2)} ${d.getMonth() + 1} ${d.getDate()}`;
const SERIF = '"Songti SC", "STSong", "Noto Serif SC", serif';

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

/**
 * Age a sheet (the saved handscroll): a fine grain, a few tea stains, the edges darker. Seeded,
 * so the same print ages the same way.
 */
function ageSheet(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const rand = createRng(Math.round(w * 7 + h));
  const grain = document.createElement('canvas');
  grain.width = grain.height = 256;
  const gg = grain.getContext('2d')!, data = gg.createImageData(256, 256);
  for (let i = 0; i < data.data.length; i += 4) { const v = 110 + rand() * 60; data.data[i] = v; data.data[i + 1] = v * 0.9; data.data[i + 2] = v * 0.72; data.data[i + 3] = 26; }
  gg.putImageData(data, 0, 0);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip(); // the stains stay on the silk
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(grain, 'repeat')!; g.fillRect(x, y, w, h);
  for (let k = 0; k < 7; k++) {
    const sx = x + rand() * w, sy = y + rand() * h, r = (0.08 + rand() * 0.2) * h;
    const stain = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    stain.addColorStop(0, `${PHOTO.silkDark}33`); stain.addColorStop(1, `${PHOTO.silkDark}00`);
    g.fillStyle = stain; g.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  const edge = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
  edge.addColorStop(0, `${PHOTO.silkDark}00`); edge.addColorStop(1, `${PHOTO.silkDark}66`);
  g.fillStyle = edge; g.fillRect(x, y, w, h);
  g.restore();
}

/** Text set one character under another (a scroll's inscription), from (x, y) down. */
function vertical(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  g.textAlign = 'center'; g.textBaseline = 'top';
  [...text].forEach((ch, i) => g.fillText(ch, x, y + i * size * 1.12));
}

/**
 * The camera (owner, 2026-11-21: like a film camera, or an instant print). While it is out, the
 * island's own buttons step aside; a viewfinder frames a 3 : 2 picture (outside it the view dims),
 * with the film camera's orange date imprint in its corner. Below, the camera body: the filters
 * on a strip of film (the Chinese landscape's manners first), the shutter. The shutter flashes, and
 * the picture comes out, developing (pale, then the colour comes up), mounted as a handscroll on
 * silk or as an instant print, with the island's seal; beside it, the painting the filter is after.
 * Either mounting can be saved as a PNG.
 */
export function PhotoMode({ filter, onFilter, onShoot, onClose, when, hourName }: {
  filter: PhotoFilter;
  onFilter: (f: PhotoFilter) => void;
  /** Ask the canvas for the next frame. */
  onShoot: (take: (shot: PhotoShot) => void) => void;
  onClose: () => void;
  /** The hour and its name ("17:00 Dusk"), and the name alone ("Dusk"), for the captions. */
  when: string;
  hourName: string;
}) {
  const { t, language } = useLanguage();
  const finder = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(0);
  const [print, setPrint] = useState<{ url: string; filter: PhotoFilter; when: string; hourName: string; date: string; n: number } | null>(null);
  const [style, setStyle] = useState<PrintStyle>(() => {
    // The instant print by default (owner, 2026-11-21); the handscroll when chosen.
    try { return localStorage.getItem(STYLE_KEY) === 'scroll' ? 'scroll' : 'polaroid'; } catch { return 'polaroid'; }
  });
  const [original, setOriginal] = useState(false);
  const count = useRef(0);
  const today = dateStamp(new Date());
  const pickStyle = (s: PrintStyle) => { setStyle(s); try { localStorage.setItem(STYLE_KEY, s); } catch { /* kept for this visit */ } };

  // While a print is out, the dial steps back too (it sits above the camera's layer).
  useEffect(() => { document.body.classList.toggle('photo-printing', !!print); return () => document.body.classList.remove('photo-printing'); }, [print]);

  // Escape: the print first, then the camera.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (print) setPrint(null); else onClose(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [print, onClose]);

  const shoot = () => {
    const box = finder.current?.getBoundingClientRect();
    const canvas = document.querySelector(`.${WONDER_WALK_CANVAS} canvas`) as HTMLCanvasElement | null;
    const area = canvas?.getBoundingClientRect();
    if (!box || !area) return;
    setFlash((f) => f + 1);
    onShoot((shot) => {
      // Crop the frame to the viewfinder, in the drawing's pixels.
      const sx = shot.width / area.width, sy = shot.height / area.height;
      const x = (box.left - area.left) * sx, y = (box.top - area.top) * sy, w = box.width * sx, h = box.height * sy;
      loadImage(shot.url).then((img) => {
        const c = document.createElement('canvas');
        c.width = Math.round(w); c.height = Math.round(h);
        c.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
        count.current += 1;
        setOriginal(false);
        setPrint({ url: c.toDataURL('image/png'), filter, when, hourName, date: today, n: count.current });
      });
    });
  };

  const save = async () => {
    if (!print) return;
    const [img, seal] = await Promise.all([loadImage(print.url), loadImage(SEAL_URL).catch(() => null)]);
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    if (style === 'polaroid') {
      const W = 1500, side = W * 0.055, top = W * 0.055, inner = W - side * 2, ih = inner / ASPECT;
      c.width = W; c.height = Math.round(top + ih + W * 0.2);
      g.fillStyle = PHOTO.wcPaper; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, side, top, inner, ih);
      const line = top + ih + W * 0.09;
      g.textBaseline = 'middle'; g.fillStyle = PHOTO.ink;
      g.font = `${Math.round(W * 0.03)}px ${SERIF}`;
      g.fillText(`${t('photo.island')} · ${print.when}`, side, line);
      g.fillStyle = PHOTO.silkDark; g.font = `${Math.round(W * 0.017)}px "Courier New", monospace`;
      const dateW = g.measureText(print.date).width;
      const s = W * 0.06;
      g.fillText(print.date, W - side - s - W * 0.02 - dateW, line);
      if (seal) g.drawImage(seal, W - side - s, line - s / 2, s, s);
    } else {
      // A handscroll: silk round the picture, a title column on the right (where a scroll begins),
      // a roller at each end with jade caps.
      const W = 2200, roll = 34, pad = 70, col = 190, ih = 1100, iw = ih * ASPECT;
      const silkW = pad * 2 + iw + col, H = ih + pad * 2;
      c.width = W; c.height = Math.round(H + 60);
      const x0 = (W - silkW) / 2, y0 = 30;
      g.fillStyle = PHOTO.wcPaper; g.fillRect(0, 0, c.width, c.height);
      const mount = g.createLinearGradient(0, y0, 0, y0 + H);
      mount.addColorStop(0, PHOTO.silkDark); mount.addColorStop(0.18, PHOTO.umberSilk); mount.addColorStop(0.82, PHOTO.umberSilk); mount.addColorStop(1, PHOTO.silkDark);
      g.fillStyle = mount; g.fillRect(x0, y0, silkW, H);
      g.strokeStyle = PHOTO.outline; g.globalAlpha = 0.5; g.lineWidth = 3;
      g.strokeRect(x0 + 12, y0 + 12, silkW - 24, H - 24); g.globalAlpha = 1;
      g.fillStyle = PHOTO.silk; g.fillRect(x0 + pad - 12, y0 + pad - 12, iw + 24, ih + 24);
      g.drawImage(img, x0 + pad, y0 + pad, iw, ih);
      g.strokeStyle = PHOTO.outline; g.lineWidth = 2; g.strokeRect(x0 + pad - 12, y0 + pad - 12, iw + 24, ih + 24);
      ageSheet(g, x0, y0, silkW, H);
      // The title column.
      const cx = x0 + pad + iw + 20 + (col - 20) / 2;
      g.fillStyle = PHOTO.inkWarm; g.font = `${88}px ${SERIF}`;
      vertical(g, t('photo.island'), cx, y0 + pad + 40, 88);
      g.font = `${54}px ${SERIF}`; g.fillStyle = PHOTO.outline;
      vertical(g, print.hourName, cx, y0 + pad + 40 + 88 * 1.12 * [...t('photo.island')].length + 50, 54);
      if (seal) g.drawImage(seal, cx - 55, y0 + pad + ih - 130, 110, 110);
      // The rollers.
      for (const rx of [x0 - roll, x0 + silkW]) {
        const wood = g.createLinearGradient(rx, 0, rx + roll, 0);
        wood.addColorStop(0, PHOTO.woodDark); wood.addColorStop(0.45, PHOTO.wood); wood.addColorStop(1, PHOTO.woodDark);
        g.fillStyle = wood; g.fillRect(rx, y0 - 14, roll, H + 28);
        g.fillStyle = PHOTO.huaqing;
        g.fillRect(rx - 3, y0 - 30, roll + 6, 18); g.fillRect(rx - 3, y0 + H + 12, roll + 6, 18);
      }
    }
    const a = document.createElement('a');
    a.download = `white-jade-${print.date.replace(/[’ ]+/g, '-').replace(/^-/, '')}-${print.n}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  };

  const painting = print ? PAINTING[print.filter] : undefined;

  return (
    <div className="photo-mode" role="region" aria-label={t('photo.title')}>
      <div ref={finder} className="photo-finder" aria-hidden="true">
        <i className="photo-corner tl" /><i className="photo-corner tr" /><i className="photo-corner bl" /><i className="photo-corner br" />
        <i className="photo-third v1" /><i className="photo-third v2" /><i className="photo-third h1" /><i className="photo-third h2" />
        <span className="photo-finder-label">{t('photo.island')} · {t(`photo.filter.${filter}` as StringKey)}</span>
        <span className="photo-date">{today}</span>
        <p className="photo-after">{t(`photo.after.${filter}` as StringKey)}</p>
      </div>

      <div className="photo-deck">
        <button type="button" className="photo-exit" onClick={onClose} aria-label={t('photo.exit')} title={t('photo.exit')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div className="photo-film" role="radiogroup" aria-label={t('photo.filters')}>
          {PHOTO_FILTERS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={f === filter} className={`photo-frame${f === filter ? ' on' : ''}`} onClick={() => onFilter(f)} title={t(`photo.after.${f}` as StringKey)}>
              <i className="photo-swatch" style={{ background: SWATCH[f] }} aria-hidden="true" />
              <span>{t(`photo.filter.${f}` as StringKey)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="photo-shutter" onClick={shoot} aria-label={t('photo.shoot')} title={t('photo.shoot')}><i aria-hidden="true" /></button>
      </div>

      {flash > 0 && <div key={flash} className="photo-flash" aria-hidden="true" />}

      {print && (
        <div className={`photo-print-wrap${original && painting ? ' with-original' : ''}`} role="dialog" aria-label={t('photo.print')}>
          <div className="photo-print-row">
            {style === 'polaroid' ? (
              <figure key={`p${print.n}`} className="photo-print">
                <img src={print.url} alt={`${t('photo.island')} · ${print.when}`} />
                <figcaption>
                  <span className="photo-print-line">{t('photo.island')} · {print.when}</span>
                  <span className="photo-print-end"><span className="photo-print-date">{print.date}</span><img className="photo-seal" src={SEAL_URL} alt="" /></span>
                </figcaption>
              </figure>
            ) : (
              <figure key={`s${print.n}`} className={`photo-scroll${language === 'zh' ? '' : ' latin'}`}>
                <i className="photo-roller left" aria-hidden="true" />
                <div className="photo-scroll-silk">
                  <div className="photo-scroll-picture"><img src={print.url} alt={`${t('photo.island')} · ${print.when}`} /></div>
                  <figcaption className="photo-scroll-title">
                    <span className="photo-scroll-name">{t('photo.island')}</span>
                    <span className="photo-scroll-hour">{print.hourName}</span>
                    <img className="photo-seal" src={SEAL_URL} alt="" />
                  </figcaption>
                </div>
                <i className="photo-roller right" aria-hidden="true" />
              </figure>
            )}
            {original && painting && (
              <aside className="photo-original" aria-label={t('photo.original')}>
                <div className="photo-original-strip"><img src={`${import.meta.env.BASE_URL}${painting}`} alt={t(`painting.${print.filter}.title` as StringKey)} /></div>
                <h3>{t(`painting.${print.filter}.title` as StringKey)}</h3>
                <p className="photo-original-by">{t(`painting.${print.filter}.by` as StringKey)}</p>
                <p>{t(`painting.${print.filter}.took` as StringKey)}</p>
                <p className="photo-original-credit">{t(`painting.${print.filter}.credit` as StringKey)}</p>
              </aside>
            )}
          </div>
          <div className="photo-print-actions">
            <div className="photo-print-style" role="radiogroup" aria-label={t('photo.mount')}>
              {(['polaroid', 'scroll'] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={style === s} className={style === s ? 'on' : ''} onClick={() => pickStyle(s)}>{t(`photo.style.${s}` as StringKey)}</button>)}
            </div>
            {painting && <button type="button" className="photo-print-btn" aria-pressed={original} onClick={() => setOriginal((o) => !o)}>{original ? t('photo.originalHide') : t('photo.original')}</button>}
            <button type="button" className="photo-print-btn primary" onClick={save}>{t('photo.save')}</button>
            <button type="button" className="photo-print-btn" onClick={() => setPrint(null)}>{t('photo.again')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
