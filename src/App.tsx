import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BookSheet } from './components/BookSheet';
import { Cover } from './components/Cover';
import { Hearts } from './components/Hearts';
import { Mascot } from './components/Mascot';
import { Onboarding } from './components/Onboarding';
import { SearchSheet } from './components/SearchSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { readInvite } from './lib/invite';
import { tick } from './lib/feel';
import { books as booksOf, connect, profiles as profilesOf, startBackgroundSync, syncNow, useStore } from './lib/store';
import { type Book, type Profile, type Status, type SyncConfig } from './lib/types';

type Tab = Status | 'all';
type Sort = 'recent' | 'rating' | 'title';

export default function App() {
  const me = useStore((s) => s.me);
  const sync = useStore((s) => s.sync);
  const [invite, setInvite] = useState<SyncConfig | null>(() => readInvite(location.hash));
  const [joinError, setJoinError] = useState('');

  // Accept an invite link once we know who's joining.
  useEffect(() => {
    if (!invite || !me) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (sync?.shelf === invite.shelf) return setInvite(null);
    connect(invite)
      .catch((e) => setJoinError((e as Error).message))
      .finally(() => setInvite(null));
  }, [invite, me]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => (sync ? startBackgroundSync() : undefined), [sync?.shelf]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return <Onboarding invited={!!invite} onInvite={setInvite} />;
  return <Shelf joinError={joinError} />;
}

function Shelf({ joinError }: { joinError: string }) {
  const me = useStore((s) => s.me)!;
  const entries = useStore((s) => s.entries);
  const syncState = useStore((s) => s.syncState);
  const all = useMemo(() => booksOf({ entries }), [entries]);
  const people = useMemo(() => profilesOf({ entries }), [entries]);
  const partners = people.filter((p) => p.readerId !== me.readerId);

  const [tab, setTab] = useState<Tab>('read');
  const [whose, setWhose] = useState<string>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [safeHidden, setSafeHidden] = useState(false);
  const sync = useStore((s) => s.sync);

  const readerIds = whose === 'all' ? null : [whose === 'me' ? me.readerId : whose];
  const takesFor = (b: Book) => Object.entries(b.takes).filter(([id]) => !readerIds || readerIds.includes(id));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all.filter((b) => {
      const takes = takesFor(b);
      if (!takes.length) return false;
      if (tab !== 'all' && !takes.some(([, t]) => t.status === tab)) return false;
      if (needle && !`${b.title} ${b.authors.join(' ')}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const best = (b: Book) => Math.max(0, ...takesFor(b).map(([, t]) => t.rating));
    const touched = (b: Book) => Math.max(...takesFor(b).map(([, t]) => t.updatedAt));
    return list.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : sort === 'rating' ? best(b) - best(a) || touched(b) - touched(a) : touched(b) - touched(a),
    );
  }, [all, tab, whose, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, read: 0, reading: 0, want: 0 };
    for (const b of all) {
      const takes = takesFor(b);
      if (!takes.length) continue;
      c.all++;
      for (const s of new Set(takes.map(([, t]) => t.status))) c[s]++;
    }
    return c;
  }, [all, whose]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { id: Tab; label: string }[] = [
    { id: 'read', label: 'Read' },
    { id: 'reading', label: 'Reading' },
    { id: 'want', label: 'To read' },
    { id: 'all', label: 'All' },
  ];
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
      <PullToRefresh />
      <header className="topbar">
        <div className="brand">
          <Mascot size={40} />
          <span className="wordmark">
            Dog<span>ear</span>
          </span>
        </div>
        <div className="topbar-right">
          {(syncState === 'syncing' || syncState === 'error') && (
            <span className={`sync-dot ${syncState}`} title={syncState === 'error' ? 'Couldn’t sync' : 'Syncing'} />
          )}
          <button className="avatars press" onClick={() => setSettingsOpen(true)} aria-label="You and your person">
            <span className="avatar">{me.critter}</span>
            {partners.map((p) => (
              <span key={p.id} className="avatar">{p.critter}</span>
            ))}
            {partners.length === 0 && <span className="avatar add" title="Invite your person">+</span>}
          </button>
        </div>
      </header>

      <main onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Hello me={me} partners={partners} all={all} onInvite={() => setSettingsOpen(true)} />
        {joinError && <p className="error banner">Couldn’t join that shelf: {joinError}</p>}
        {!sync && all.length > 0 && !safeHidden && (
          <div className="safe-banner">
            <span aria-hidden="true">🛟</span>
            <p>Your books only live on this phone right now. Start a shared shelf to keep a copy safe in the cloud.</p>
            <div className="safe-actions">
              <button className="btn tiny primary" onClick={() => setSettingsOpen(true)}>Set it up</button>
              <button className="btn tiny ghost" onClick={() => setSafeHidden(true)}>Later</button>
            </div>
          </div>
        )}

        <nav className="seg" role="tablist" style={{ ['--i' as string]: tabIndex }}>
          <span className="seg-pill" aria-hidden="true" />
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t.id)}>
              {t.label}
              <b>{counts[t.id]}</b>
            </button>
          ))}
        </nav>

        <div className="toolbar">
          {partners.length > 0 && (
            <div className="whose" role="group" aria-label="Whose books">
              <button className={whose === 'all' ? 'on' : ''} onClick={() => (setWhose('all'), tick())}>Ours</button>
              <button className={whose === 'me' ? 'on' : ''} onClick={() => (setWhose('me'), tick())}>{me.critter} Mine</button>
              {partners.map((p) => (
                <button key={p.readerId} className={whose === p.readerId ? 'on' : ''} onClick={() => (setWhose(p.readerId), tick())}>
                  {p.critter} {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="toolbar-right">
            {all.length > 4 && (
              <input className="filter" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter shelf…" aria-label="Filter shelf" />
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="recent">Newest</option>
              <option value="rating">Most loved</option>
              <option value="title">A → Z</option>
            </select>
          </div>
        </div>

        <div key={`${tab}-${whose}`} className={`shelf-page ${slide ? `from-${slide}` : ''}`}>
          {shown.length ? (
            <ul className="grid">
              {shown.map((b, i) => (
                <li key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                  <BookCard book={b} people={people} meId={me.readerId} readerIds={readerIds} onOpen={(el) => open(b.id, el)} />
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
          <span aria-hidden="true">💞</span>
          Us
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

/** Pull down from the top of the shelf to sync with your person. */
function PullToRefresh() {
  const sync = useStore((s) => s.sync);
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('Pull to sync');
  useEffect(() => {
    let startY = -1;
    let dy = 0;
    const el = ref.current!;
    const setPull = (d: number, animate: boolean) => {
      el.style.transition = animate ? 'height .3s cubic-bezier(.2,1.2,.4,1)' : 'none';
      el.style.height = `${d}px`;
      el.style.setProperty('--p', String(Math.min(1, d / 80)));
    };
    const start = (e: TouchEvent) => {
      startY = window.scrollY <= 0 && !document.body.classList.contains('no-scroll') ? e.touches[0].clientY : -1;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY < 0) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) return setPull(0, false);
      const d = Math.min(110, dy * 0.5);
      setPull(d, false);
      setLabel(d >= 70 ? (sync ? 'Let go to sync' : 'Let go') : sync ? 'Pull to sync' : 'Pull');
    };
    const end = async () => {
      if (startY < 0) return;
      startY = -1;
      if (dy * 0.5 >= 70) {
        tick('medium');
        setPull(64, true);
        setLabel(sync ? 'Syncing…' : 'All up to date');
        el.classList.add('busy');
        await Promise.all([syncNow(), new Promise((r) => setTimeout(r, 700))]);
        el.classList.remove('busy');
      }
      setPull(0, true);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [sync]);
  return (
    <div ref={ref} className="ptr" aria-hidden="true">
      <div className="ptr-inner">
        <Mascot size={36} mood="curious" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function Hello({ me, partners, all, onInvite }: { me: { readerId: string; name: string }; partners: Profile[]; all: Book[]; onInvite: () => void }) {
  const year = new Date().getFullYear();
  const mine = all.map((b) => b.takes[me.readerId]).filter(Boolean);
  const readThisYear = mine.filter((t) => t.status === 'read' && (t.finishedOn ?? '').startsWith(String(year))).length;
  const pages = all.reduce((n, b) => (b.takes[me.readerId]?.status === 'read' ? n + (b.pages ?? 0) : n), 0);
  const rated = mine.filter((t) => t.rating > 0);
  const avg = rated.length ? rated.reduce((n, t) => n + t.rating, 0) / rated.length : 0;
  const both = partners.length ? all.filter((b) => b.takes[me.readerId]?.status === 'read' && partners.some((p) => b.takes[p.readerId]?.status === 'read')).length : 0;
  const hour = new Date().getHours();
  const hi = hour < 5 ? 'Up late reading' : hour < 12 ? 'Good morning' : hour < 18 ? 'Hey there' : 'Cozy evening';

  return (
    <section className="hello">
      <h1>
        {hi}, {me.name}!
      </h1>
      <div className="stats">
        <Stat n={readThisYear} label={`read in ${year}`} tone="tomato" />
        <Stat n={pages.toLocaleString()} label="pages turned" tone="butter" />
        <Stat n={avg ? avg.toFixed(1) : '–'} label="avg hearts" tone="pink" />
        {partners.length > 0 ? (
          <Stat n={both} label="read by you both" tone="sage" />
        ) : (
          <button className="stat stat-sky invite-stat" onClick={onInvite}>
            <b>💞</b>
            <span>invite your person</span>
          </button>
        )}
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

function BookCard({ book, people, meId, readerIds, onOpen }: { book: Book; people: Profile[]; meId: string; readerIds: string[] | null; onOpen: (el: HTMLElement) => void }) {
  const takes = Object.entries(book.takes)
    .filter(([id]) => !readerIds || readerIds.includes(id))
    .sort(([a], [b]) => (a === meId ? -1 : b === meId ? 1 : 0));
  return (
    <button className="book-card press" onClick={(e) => onOpen(e.currentTarget)}>
      <Cover title={book.title} author={book.authors[0]} src={book.cover} />
      <span className="book-card-title">{book.title}</span>
      <span className="book-card-author">{book.authors[0] ?? ' '}</span>
      <span className="book-card-takes">
        {takes.map(([id, t]) => {
          const p = people.find((x) => x.readerId === id);
          return (
            <span key={id} className="mini-take" title={p?.name}>
              <span className="mini-avatar">{p?.critter ?? '🐾'}</span>
              {t.status === 'read' ? (
                t.rating ? <Hearts value={t.rating} size="sm" /> : <span className="muted">unrated</span>
              ) : (
                <span className={`status-tag tag-${t.status}`}>{t.status === 'reading' ? 'reading' : 'wants it'}</span>
              )}
            </span>
          );
        })}
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
