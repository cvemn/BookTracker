import { useEffect, useRef, useState, type ReactNode } from 'react';

// Open sheets, newest last, so the Android back button can close the top one.
const stack: { current: () => void }[] = [];

export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.current();
  return true;
}

const CLOSE_MS = 220;

/**
 * Bottom sheet on phones (drag it down to dismiss), centred card on wider
 * screens. Closing animates out before telling the parent.
 */
export function Sheet({ open, onClose, children, label, wide }: { open: boolean; onClose: () => void; children: ReactNode; label: string; wide?: boolean }) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(() => {});

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, CLOSE_MS);
  };
  closeRef.current = requestClose;

  useEffect(() => {
    if (!open) return;
    const handle = { current: () => closeRef.current() };
    stack.push(handle);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stack[stack.length - 1] === handle && handle.current();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      stack.splice(stack.indexOf(handle), 1);
      window.removeEventListener('keydown', onKey);
      if (!stack.length) document.body.classList.remove('no-scroll');
    };
  }, [open]);

  // Drag down to dismiss: only when the sheet is scrolled to the top, so it
  // never fights with scrolling the sheet's own content.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return;
    let startY = 0;
    let startX = 0;
    let dy = 0;
    let dragging = false;
    let tracking = false;
    let lastT = 0;
    let lastY = 0;
    let velocity = 0;

    const setY = (y: number, animate: boolean) => {
      sheet.style.transition = animate ? 'transform .28s cubic-bezier(.2,1.1,.3,1)' : 'none';
      sheet.style.transform = y ? `translateY(${y}px)` : '';
      if (backdropRef.current) {
        backdropRef.current.style.transition = animate ? 'opacity .28s' : 'none';
        backdropRef.current.style.opacity = y ? String(Math.max(0.2, 1 - y / 500)) : '';
      }
    };
    const start = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('textarea, input, select, .no-drag')) return;
      tracking = sheet.scrollTop <= 0;
      dragging = false;
      startY = lastY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      lastT = performance.now();
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      dy = y - startY;
      if (!dragging) {
        if (dy > 6 && Math.abs(dy) > Math.abs(x - startX)) dragging = true;
        else if (dy < -4 || Math.abs(x - startX) > 10) return void (tracking = false);
        else return;
      }
      e.preventDefault();
      const now = performance.now();
      velocity = (y - lastY) / Math.max(1, now - lastT);
      lastY = y;
      lastT = now;
      setY(Math.max(0, dy), false);
    };
    const end = () => {
      if (!dragging) return;
      dragging = tracking = false;
      if (dy > 140 || velocity > 0.6) {
        setY(window.innerHeight, true);
        setTimeout(() => {
          sheet.style.transform = '';
          onCloseRef.current();
        }, 200);
      } else {
        setY(0, true);
      }
    };
    sheet.addEventListener('touchstart', start, { passive: true });
    sheet.addEventListener('touchmove', move, { passive: false });
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
    return () => {
      sheet.removeEventListener('touchstart', start);
      sheet.removeEventListener('touchmove', move);
      sheet.removeEventListener('touchend', end);
      sheet.removeEventListener('touchcancel', end);
    };
  }, [open]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  if (!open) return null;
  return (
    <div ref={backdropRef} className={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div
        ref={sheetRef}
        className={`sheet ${wide ? 'sheet-wide' : ''} ${closing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <button className="sheet-close" onClick={requestClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>
  );
}
