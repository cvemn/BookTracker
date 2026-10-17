import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BookSheet } from './components/BookSheet';
import { Cover } from './components/Cover';
import { Hearts } from './components/Hearts';
import { Mascot } from './components/Mascot';
import { SearchSheet } from './components/SearchSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { Welcome } from './components/Welcome';
import { tick } from './lib/feel';
import { books as booksOf, useStore } from './lib/store';
import type { Book, Status, Take } from './lib/types';

type Tab = Status | 'all';
type Sort = 'recent' | 'rating' | 'title';

const TABS: { id: Tab; label: string }[] = [
  { id: 'read', label: 'Read' },
  { id: 'reading', label: 'Reading' },
  { id: 'want', label: 'To read' },
  { id: 'all', label: 'All' },
];

export default function App() {
  const me = useStore((s) => s.me);
  return me ? (
    <>
      <Shelf />
      <Welcome />
    </>
  ) : (
    <div className="loading-pup">
      <Mascot size={110} mood="sleepy" />
    </div>
  );
}

function Shelf() {
  const me = useStore((s) => s.me)!;
  const entries = useStore((s) => s.entries);
  // Her books, each with her take on it.
  const mine = useMemo(
    () => booksOf({ entries }).flatMap((b) => (b.takes[me.readerId] ? [{ book: b, take: b.takes[me.readerId] }] : [])),
    [entries, me.readerId],
  );

  const [tab, setTab] = useState<Tab>('read');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openBook, setOpenBook] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = mine.filter(({ book, take }) => {
      if (tab !== 'all' && take.status !== tab) return false;
      return !needle || `${book.title} ${book.authors.join(' ')}`.toLowerCase().includes(needle);
    });
    return list.sort((a, b) =>
      sort === 'title'
        ? a.book.title.localeCompare(b.book.title)
        : sort === 'rating'
          ? b.take.rating - a.take.rating || b.take.updatedAt - a.take.updatedAt
          : b.take.updatedAt - a.take.updatedAt,
    );
  }, [mine, tab, q, sort]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: mine.length, read: 0, reading: 0, want: 0 };
    for (const { take } of mine) c[take.status]++;
    return c;
  }, [mine]);

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const [slide, setSlide] = useState<'left' | 'right' | ''>('');
  const goTab = (next: Tab) => {
    const ni = TABS.findIndex((t) => t.id === next);
    if (ni === tabIndex) return;
    setSlide(ni > tabIndex ? 'left' : 'right');
    setTab(next);
    tick();
  };

  // Swipe sideways on the shelf to move between tabs.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0) return;
    const dx = e.changedTouches[0].clientX - s0.x;
    const dy = e.changedTouches[0].clientY - s0.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const ni = tabIndex + (dx < 0 ? 1 : -1);
    if (ni >= 0 && ni < TABS.length) goTab(TABS[ni].id);
  };

  // Opening a book zooms its cover up into the sheet where the browser can.
  const open = (id: string, el: HTMLElement | null) => {
    const cover = el?.querySelector<HTMLElement>('.cover');
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    tick();
    if (!cover || !doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return setOpenBook(id);
    cover.style.viewTransitionName = 'book-cover';
    document.documentElement.classList.add('vt');
    const t = doc.startViewTransition(() => {
      cover.style.viewTransitionName = '';
      flushSync(() => setOpenBook(id));
    }) as { finished: Promise<void> };
    t.finished.finally(() => document.documentElement.classList.remove('vt'));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Mascot size={40} />
          <span className="wordmark">
            Dog<span>ear</span>
          </span>
        </div>
        <button className="avatars press" onClick={() => (setSettingsOpen(true), tick())} aria-label="Settings">
          <span className="avatar">{me.critter}</span>
        </button>
      </header>

      <main onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Hello name={me.name} mine={mine} />

        <nav className="seg" role="tablist" style={{ ['--i' as string]: tabIndex }}>
          <span className="seg-pill" aria-hidden="true" />
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t.id)}>
              {t.label}
              <b>{counts[t.id]}</b>
            </button>
          ))}
        </nav>

        {mine.length > 0 && (
          <div className="toolbar">
            <div className="toolbar-right">
              {mine.length > 4 && (
                <input className="filter" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter shelf…" aria-label="Filter shelf" />
              )}
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                <option value="recent">Newest</option>
                <option value="rating">Most loved</option>
                <option value="title">A → Z</option>
              </select>
            </div>
          </div>
        )}

        <div key={tab} className={`shelf-page ${slide ? `from-${slide}` : ''}`}>
          {shown.length ? (
            <ul className="grid">
              {shown.map(({ book, take }, i) => (
                <li key={book.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                  <BookCard book={book} take={take} onOpen={(el) => open(book.id, el)} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty tab={tab} filtered={!!q} onAdd={() => setSearchOpen(true)} />
          )}
        </div>
      </main>

      <nav className="bottom-bar" aria-label="Main">
        <button className="bb-item press" onClick={() => (window.scrollTo({ top: 0, behavior: 'smooth' }), tick())}>
          <span aria-hidden="true">📚</span>
          Shelf
        </button>
        <button className="bb-add press" onClick={() => (setSearchOpen(true), tick('medium'))} aria-label="Add a book">
          <span aria-hidden="true">＋</span>
        </button>
        <button className="bb-item press" onClick={() => (setSettingsOpen(true), tick())}>
          <span aria-hidden="true">{me.critter}</span>
          Me
        </button>
      </nav>

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAdded={(id) => {
          setSearchOpen(false);
          setOpenBook(id);
        }}
      />
      <BookSheet bookId={openBook} onClose={() => setOpenBook(null)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Hello({ name, mine }: { name: string; mine: { book: Book; take: Take }[] }) {
  const year = new Date().getFullYear();
  const read = mine.filter(({ take }) => take.status === 'read');
  const readThisYear = read.filter(({ take }) => (take.finishedOn ?? '').startsWith(String(year))).length;
  const pages = read.reduce((n, { book }) => n + (book.pages ?? 0), 0);
  const rated = mine.filter(({ take }) => take.rating > 0);
  const avg = rated.length ? rated.reduce((n, { take }) => n + take.rating, 0) / rated.length : 0;
  const reading = mine.filter(({ take }) => take.status === 'reading').length;
  const hour = new Date().getHours();
  const hi = hour < 5 ? 'Up late reading' : hour < 12 ? 'Good morning' : hour < 18 ? 'Hey there' : 'Cozy evening';

  return (
    <section className="hello">
      <h1>
        {hi}, {name}!
      </h1>
      <div className="stats">
        <Stat n={readThisYear} label={`read in ${year}`} tone="tomato" />
        <Stat n={pages.toLocaleString()} label="pages turned" tone="butter" />
        <Stat n={avg ? avg.toFixed(1) : '–'} label="avg hearts" tone="pink" />
        <Stat n={reading} label="reading now" tone="sage" />
      </div>
    </section>
  );
}

function Stat({ n, label, tone }: { n: number | string; label: string; tone: string }) {
  return (
    <div className={`stat stat-${tone}`}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

function BookCard({ book, take, onOpen }: { book: Book; take: Take; onOpen: (el: HTMLElement) => void }) {
  return (
    <button className="book-card press" onClick={(e) => onOpen(e.currentTarget)}>
      <Cover title={book.title} author={book.authors[0]} src={book.cover} isbn={book.isbn} />
      <span className="book-card-title">{book.title}</span>
      <span className="book-card-author">{book.authors[0] ?? '\u00a0'}</span>
      <span className="book-card-takes">
        {take.status === 'read' ? (
          take.rating ? <Hearts value={take.rating} size="sm" /> : <span className="muted small">not rated yet</span>
        ) : (
          <span className={`status-tag tag-${take.status}`}>{take.status === 'reading' ? 'reading now' : 'want to read'}</span>
        )}
      </span>
    </button>
  );
}

function Empty({ tab, filtered, onAdd }: { tab: Tab; filtered: boolean; onAdd: () => void }) {
  const copy = filtered
    ? 'Nothing on the shelf matches that.'
    : tab === 'read'
      ? 'No finished books yet. Add the last one you loved!'
      : tab === 'reading'
        ? 'Nothing on the nightstand right now.'
        : tab === 'want'
          ? 'Your to-read pile is suspiciously small.'
          : 'Your shelf is empty. Let’s fix that!';
  return (
    <div className="empty">
      <Mascot size={110} mood={filtered ? 'curious' : 'sleepy'} />
      <p>{copy}</p>
      {!filtered && (
        <button className="btn primary" onClick={onAdd}>
          Find a book
        </button>
      )}
    </div>
  );
}
