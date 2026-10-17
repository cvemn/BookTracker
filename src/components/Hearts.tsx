export function Hearts({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  const label = value ? `${value} out of 5 hearts` : 'Not rated yet';
  if (!onChange) {
    return (
      <span className={`hearts hearts-${size}`} aria-label={label} title={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? 'on' : 'off'}>♥</span>
        ))}
      </span>
    );
  }
  return (
    <div className={`hearts hearts-${size} hearts-input`} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} heart${n > 1 ? 's' : ''}`}
          className={n <= value ? 'on' : 'off'}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          ♥
        </button>
      ))}
    </div>
  );
}
