import { useEffect, useRef, useState } from 'react';
import { confetti, success, tick } from '../lib/feel';
import { HER_NAME, isFirstVisit } from '../lib/store';
import { Mascot } from './Mascot';

const SPRINKLES = ['📚', '💛', '✨', '📖', '💕', '⭐', '🔖', '🌸'];

const BACK_LINES = ['Ready for another chapter?', 'Your shelf missed you.', 'Miso saved your spot.', 'What are we reading today?', 'Cozy reading time!'];

const TOUR = [
  { emoji: '＋', tone: 'tomato', title: 'Add a book', text: 'Tap the big + at the bottom and type a title or an author. I’ll fetch the cover and all the details.' },
  { emoji: '💕', tone: 'pink', title: 'Rate it with hearts', text: 'Open any book and slide your finger across the hearts. Pick its vibes and write whatever you thought.' },
  { emoji: '👉', tone: 'butter', title: 'Flip through your shelf', text: 'Swipe left or right to move between Read, Reading and To read. Tap a cover to open it.' },
  { emoji: '🛟', tone: 'sage', title: 'Your books are safe', text: 'Everything saves on your phone as you go. Tap Me to save a backup to Google Drive whenever you like.' },
];

/** A little hello every time the app opens, plus a short tour the very first time. */
export function Welcome() {
  const first = useRef(isFirstVisit()).current;
  const [phase, setPhase] = useState<'hello' | 'leaving' | 'tour' | 'done'>('hello');
  const line = useRef(BACK_LINES[Math.floor(Math.random() * BACK_LINES.length)]).current;

  const finishHello = () => {
    setPhase((p) => (p === 'hello' ? 'leaving' : p));
  };

  useEffect(() => {
    if (phase === 'hello') {
      const t = setTimeout(finishHello, first ? 3200 : 2300);
      return () => clearTimeout(t);
    }
    if (phase === 'leaving') {
      const t = setTimeout(() => setPhase(first ? 'tour' : 'done'), 420);
      return () => clearTimeout(t);
    }
  }, [phase, first]);

  if (phase === 'done') return null;
  if (phase === 'tour') return <Tour onDone={() => setPhase('done')} />;

  return (
    <div className={`welcome ${phase === 'leaving' ? 'out' : ''}`} onClick={finishHello} role="dialog" aria-label="Welcome">
      <div className="sprinkles" aria-hidden="true">
        {SPRINKLES.map((s, i) => (
          <span key={i} style={{ ['--i' as string]: i }}>
            {s}
          </span>
        ))}
      </div>
      <div className="welcome-pup">
        <Mascot size={150} />
      </div>
      {first ? (
        <h1 className="welcome-text">
          <span>Hello, {HER_NAME}.</span>
          <span>Welcome to Dogear.</span>
        </h1>
      ) : (
        <h1 className="welcome-text">
          <span>Welcome back, {HER_NAME}!</span>
          <small>{line}</small>
        </h1>
      )}
    </div>
  );
}

function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [closing, setClosing] = useState(false);
  const last = i === TOUR.length - 1;
  const step = TOUR[i];

  const close = (party: boolean) => {
    if (party) {
      success();
      confetti(window.innerWidth / 2, window.innerHeight * 0.6, 40);
    }
    setClosing(true);
    setTimeout(onDone, 300);
  };
  const go = (n: number) => {
    if (n < 0 || n >= TOUR.length) return;
    tick();
    setI(n);
  };

  const swipe = useRef<number | null>(null);

  return (
    <div className={`tour-scrim ${closing ? 'out' : ''}`}>
      <div
        className="tour"
        role="dialog"
        aria-label="How Dogear works"
        onTouchStart={(e) => (swipe.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (swipe.current === null) return;
          const dx = e.changedTouches[0].clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <button className="link-btn tour-skip" onClick={() => close(false)}>
          Skip
        </button>
        <div key={i} className="tour-step">
          <span className={`tour-icon tone-${step.tone}`} aria-hidden="true">
            {step.emoji}
          </span>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </div>
        <div className="tour-dots" aria-hidden="true">
          {TOUR.map((_, n) => (
            <i key={n} className={n === i ? 'on' : ''} />
          ))}
        </div>
        <button className="btn primary big press" onClick={() => (last ? close(true) : go(i + 1))}>
          {last ? 'Let’s read! 📚' : 'Next'}
        </button>
      </div>
    </div>
  );
}
