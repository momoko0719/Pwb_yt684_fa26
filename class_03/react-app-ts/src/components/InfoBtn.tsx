/**
 * InfoBtn.tsx
 * ───────────
 * A portal-based info tooltip that renders at document.body level,
 * so it's never clipped by overflow:hidden parents (sidebar, cards, etc.).
 *
 * Usage:  <InfoBtn text="This does X." />
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  text: string;
  /** Optional title shown bold above the body text */
  title?: string;
}

export default function InfoBtn({ text, title }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Position the popup above the button, centred horizontally
      setStyle({
        position: 'fixed',
        left:     r.left + r.width / 2,
        top:      r.top - 8,
        transform: 'translate(-50%, -100%)',
        zIndex:   9999,
      });
    }
    setOpen(o => !o);
  };

  // Close on any outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className="info-btn"
        onClick={toggle}
        aria-label="More information"
        aria-expanded={open}
      >
        i
      </button>

      {open && createPortal(
        <div className="info-tooltip-portal" style={style} onClick={e => e.stopPropagation()}>
          {title && <p className="info-tooltip-title">{title}</p>}
          <p>{text}</p>
          <button className="info-panel-close" onClick={() => setOpen(false)}>✕ close</button>
        </div>,
        document.body
      )}
    </>
  );
}
