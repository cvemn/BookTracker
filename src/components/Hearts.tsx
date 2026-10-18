import { useRef } from 'react';
import { heartBurst, tick } from '../lib/feel';

export function Hearts({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  const label = value ? `${value} out of 5 hearts` : 'Not rated yet';
  const rowRef = useRef<HTMLDivElement>(null);
  // How the current touch is being read: not yet known, a slide across the
  // hearts, or a scroll of the page that happens to start on them.
  const gesture = useRef<{ x: number; y: number; mode: 'tap' | 'slide' | 'scroll' } | null>(null);
  const touchedAt = useRef(0);

  if (!onChange) {
    return (
      <span className={`hearts hearts-${size}`} aria-label={label} title={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? 'on' : 'off'}>♥</span>
        ))}
      </span>
    );
  }

  // Tap a heart or slide a finger across them to pick a rating; slide off the
  // left end to clear it. With a mouse, clicking the current rating clears it.
  const heartAt = (x: number) => {
    const row = rowRef.current!;
    const kids = [...row.querySelectorAll('button')];
    for (let i = kids.length - 1; i >= 0; i--) {
      if (x >= kids[i].getBoundingClientRect().left) return i + 1;
    }
    return 0;
  };
  const set = (n: number, burst = false) => {
    if (n === value) {
      if (burst && n > 0) heartBurst(rowRef.current!.querySelectorAll('button')[n - 1], 4);
      return;
    }
    onChange(n);
    tick(n === 5 ? 'medium' : 'light');
    if (burst && n > 0) heartBurst(rowRef.current!.querySelectorAll('button')[n - 1], n === 5 ? 10 : 5);
  };

  return (
    <div
      ref={rowRef}
      className={`hearts hearts-${size} hearts-input no-drag`}
      role="radiogroup"
      aria-label="Rating"
      onTouchStart={(e) => {
        gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: 'tap' };
      }}
      onTouchMove={(e) => {
        const g = gesture.current;
        if (!g || g.mode === 'scroll') return;
        const dx = e.touches[0].clientX - g.x;
        const dy = e.touches[0].clientY - g.y;
        if (g.mode === 'tap') {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (g.mode = 'scroll');
          if (Math.abs(dx) > 8) g.mode = 'slide';
          else return;
        }
        set(heartAt(e.touches[0].clientX));
      }}
      onTouchEnd={(e) => {
        const g = gesture.current;
        gesture.current = null;
        if (!g || g.mode === 'scroll') return;
        // Handle the tap here so the browser's delayed click can't undo it.
        e.preventDefault();
        touchedAt.current = Date.now();
        if (g.mode === 'tap') set(Math.max(1, heartAt(g.x)), true);
        else if (value) heartBurst(rowRef.current!.querySelectorAll('button')[value - 1], value === 5 ? 10 : 5);
      }}
      onTouchCancel={() => (gesture.current = null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} heart${n > 1 ? 's' : ''}`}
          className={n <= value ? 'on' : 'off'}
          style={{ transitionDelay: n <= value ? `${(n - 1) * 25}ms` : '0ms' }}
          onClick={() => {
            if (Date.now() - touchedAt.current < 800) return;
            set(value === n ? 0 : n, true);
          }}
        >
          ♥
        </button>
      ))}
    </div>
  );
}
