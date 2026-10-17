import { useEffect, useState, type ReactNode } from 'react';

/** Asks "are you sure?" in place: the first tap arms it, the second does it. */
export function ConfirmButton({ className, onConfirm, children, confirmText }: { className: string; onConfirm: () => void; children: ReactNode; confirmText: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={`${className} ${armed ? 'armed' : ''}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}
