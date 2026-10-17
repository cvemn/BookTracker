import { useEffect, useMemo, useState } from 'react';
import { BookSheet } from './components/BookSheet';
import { Cover } from './components/Cover';
import { Hearts } from './components/Hearts';
import { Mascot } from './components/Mascot';
import { Onboarding } from './components/Onboarding';
import { SearchSheet } from './components/SearchSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { readInvite } from './lib/invite';
import { books as booksOf, connect, profiles as profilesOf, startBackgroundSync, useStore } from './lib/store';
import { STATUSES, type Book, type Profile, type Status, type SyncConfig } from './lib/types';

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

  if (!me) return <Onboarding invited={!!invite} />;
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Mascot size={44} />
          <span className="wordmark">
            Dog<span>ear</span>
          </span>
        </div>
        <div className="topbar-right">
          {(syncState === 'syncing' || syncState === 'error') && (
            <span className={`sync-dot ${syncState}`} title={syncState === 'error' ? 'Couldn’t sync' : 'Syncing'} />
          )}
          <button className="avatars" onClick={() => setSettingsOpen(true)} aria-label="Settings and sharing">
            <span className="avatar">{me.critter}</span>
            {partners.map((p) => (
              <span key={p.id} className="avatar">{p.critter}</span>
            ))}
            {partners.length === 0 && <span className="avatar add" title="Invite your person">+</span>}
          </button>
        </div>
      </header>

      <main>
        <Hello me={me} partners={partners} all={all} onInvite={() => setSettingsOpen(true)} />
        {joinError && <p className="error banner">Couldn’t join that shelf: {joinError}</p>}

        <nav className="tabs" role="tablist">
          {[...STATUSES, { id: 'all' as const, label: 'Everything', emoji: '✨' }].map((s) => (
            <button key={s.id} role="tab" aria-selected={tab === s.id} className={tab === s.id ? 'on' : ''} onClick={() => setTab(s.id)}>
              <span aria-hidden="true">{s.emoji}</span> {s.label} <b>{counts[s.id]}</b>
            </button>
          ))}
        </nav>

        <div className="toolbar">
          {partners.length > 0 && (
            <div className="whose" role="group" aria-label="Whose books">
              <button className={whose === 'all' ? 'on' : ''} onClick={() => setWhose('all')}>Ours</button>
              <button className={whose === 'me' ? 'on' : ''} onClick={() => setWhose('me')}>{me.critter} Mine</button>
              {partners.map((p) => (
                <button key={p.readerId} className={whose === p.readerId ? 'on' : ''} onClick={() => setWhose(p.readerId)}>
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

        {shown.length ? (
          <ul className="grid">
            {shown.map((b, i) => (
              <li key={b.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <BookCard book={b} people={people} meId={me.readerId} readerIds={readerIds} onOpen={() => setOpenBook(b.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty tab={tab} filtered={!!q} onAdd={() => setSearchOpen(true)} />
        )}
      </main>

      <button className="fab" onClick={() => setSearchOpen(true)}>
        <span aria-hidden="true">＋</span> Add a book
      </button>

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

function BookCard({ book, people, meId, readerIds, onOpen }: { book: Book; people: Profile[]; meId: string; readerIds: string[] | null; onOpen: () => void }) {
  const takes = Object.entries(book.takes)
    .filter(([id]) => !readerIds || readerIds.includes(id))
    .sort(([a], [b]) => (a === meId ? -1 : b === meId ? 1 : 0));
  return (
    <button className="book-card" onClick={onOpen}>
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
