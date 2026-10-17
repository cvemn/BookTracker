import { useState } from 'react';

const PALETTE = [
  ['#ff8f70', '#ffe3d6'],
  ['#7bb88a', '#e1f3e3'],
  ['#8fa8ff', '#e3e9ff'],
  ['#f7b84b', '#fff0cf'],
  ['#c49bff', '#f0e6ff'],
  ['#ff8fb8', '#ffe2ee'],
  ['#5fc4c4', '#dcf5f5'],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Cover({ title, author, src, isbn, className = '' }: { title: string; author?: string; src?: string; isbn?: string; className?: string }) {
  // Try the saved cover first, then Open Library's cover for the ISBN, then draw one.
  const candidates = [src, isbn && `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`].filter(Boolean) as string[];
  const [attempt, setAttempt] = useState(0);
  const url = candidates[attempt];
  const next = () => setAttempt((a) => a + 1);
  const [bg, fg] = PALETTE[hash(title) % PALETTE.length];
  return (
    <div className={`cover ${className}`}>
      {url ? (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={next}
          onLoad={(e) => {
            // Open Library serves a 1x1 gif when it has no cover.
            if ((e.target as HTMLImageElement).naturalWidth < 10) next();
          }}
        />
      ) : (
        <div className="cover-fallback" style={{ background: bg, color: fg }}>
          <span className="cover-fallback-title">{title}</span>
          {author && <span className="cover-fallback-author">{author}</span>}
        </div>
      )}
      <span className="cover-ear" aria-hidden="true" />
    </div>
  );
}
