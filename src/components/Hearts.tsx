import { useRef } from 'react';
import { heartBurst, tick } from '../lib/feel';

export function Hearts({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  const label = value ? `${value} out of 5 hearts` : 'Not rated yet';
  const rowRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  if (!onChange) {
    return (
      <span className={`hearts hearts-${size}`} aria-label={label} title={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? 'on' : 'off'}>♥</span>
        ))}
      </span>
    );
  }

  // Slide a finger across the hearts to pick a rating; tap to set or clear.
  const heartAt = (x: number) => {
    const row = rowRef.current!;
    const kids = [...row.querySelectorAll('button')];
    for (let i = kids.length - 1; i >= 0; i--) {
      if (x >= kids[i].getBoundingClientRect().left) return i + 1;
    }
    return 0;
  };
  const set = (n: number, burst = false) => {
    if (n === value) return;
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
      onTouchStart={() => (dragged.current = false)}
      onTouchMove={(e) => {
        dragged.current = true;
        set(heartAt(e.touches[0].clientX));
      }}
      onTouchEnd={() => {
        if (dragged.current && value) heartBurst(rowRef.current!.querySelectorAll('button')[value - 1], value === 5 ? 10 : 5);
      }}
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
            if (dragged.current) return;
            set(value === n ? 0 : n, true);
          }}
        >
          ♥
        </button>
      ))}
    </div>
  );
}
