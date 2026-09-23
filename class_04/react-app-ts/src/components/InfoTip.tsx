/**
 * Portal tooltip — never clipped by sidebar overflow.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function InfoTip({ text, title }: { text: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const preferAbove = r.top > 160;
      setStyle({
        position: 'fixed',
        left: Math.min(Math.max(r.left + r.width / 2, 120), window.innerWidth - 120),
        top: preferAbove ? r.top - 8 : r.bottom + 8,
        transform: preferAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 9999,
      });
    }
    setOpen(o => !o);
  };

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
      <button ref={btnRef} className="info-tip-btn" onClick={toggle} aria-label="Info" type="button">
        i
      </button>
      {open && createPortal(
        <div className="info-tip-panel" style={style} onClick={e => e.stopPropagation()}>
          {title && <p className="info-tip-title">{title}</p>}
          <p>{text}</p>
        </div>,
        document.body,
      )}
    </>
  );
}
