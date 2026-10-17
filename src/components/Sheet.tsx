import { useEffect, useRef, type ReactNode } from 'react';

// Open sheets, newest last, so the Android back button can close the top one.
const stack: { current: () => void }[] = [];

export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.current();
  return true;
}

/** Bottom sheet on phones, centred card on wider screens. */
export function Sheet({ open, onClose, children, label, wide }: { open: boolean; onClose: () => void; children: ReactNode; label: string; wide?: boolean }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

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

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${wide ? 'sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <button className="sheet-close" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>
  );
}
