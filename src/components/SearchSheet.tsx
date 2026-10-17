import { useEffect, useRef, useState } from 'react';
import { searchBooks, type SearchResult } from '../lib/search';
import { addBook, findExisting } from '../lib/store';
import { STATUSES, type Status } from '../lib/types';
import { Cover } from './Cover';
import { celebrate, success, tick } from '../lib/feel';
import { Mascot } from './Mascot';
import { Sheet } from './Sheet';

const IDEAS = ['Tomorrow, and Tomorrow, and Tomorrow', 'Pride and Prejudice', 'Project Hail Mary', 'The House in the Cerulean Sea', 'Normal People'];

export function SearchSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [picked, setPicked] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setPhase('idle');
      setPicked(null);
      setManual(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setPhase('idle');
      return;
    }
    const ctrl = new AbortController();
    setPhase('loading');
    const t = setTimeout(async () => {
      try {
        const r = await searchBooks(query, ctrl.signal);
        setResults(r);
        setPhase('done');
        setPicked(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setPhase('error');
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const add = (r: SearchResult | Omit<SearchResult, 'key' | 'source'>, status: Status, el?: HTMLElement) => {
    const id = addBook(r, status);
    if (status === 'read') celebrate(el);
    else success();
    onAdded(id);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Find a book" wide>
      <h2 className="sheet-title">Find a book</h2>
      {manual ? (
        <ManualForm onCancel={() => setManual(false)} onAdd={add} initialTitle={q} />
      ) : (
        <>
          <label className="search-box">
            <span aria-hidden="true">🔎</span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, author or ISBN…"
              aria-label="Search for a book"
              enterKeyHint="search"
              autoComplete="off"
            />
            {phase === 'loading' && <span className="spinner" aria-label="Searching" />}
          </label>

          {phase === 'idle' && (
            <div className="search-empty">
              <Mascot size={84} mood="curious" />
              <p>Type a title and Miso will fetch it.</p>
              <div className="chips">
                {IDEAS.map((i) => (
                  <button key={i} className="chip" onClick={() => setQ(i)}>{i}</button>
                ))}
              </div>
            </div>
          )}
          {phase === 'error' && (
            <div className="search-empty">
              <Mascot size={72} mood="sleepy" />
              <p>Couldn’t reach the library right now. Check your connection, or add it by hand.</p>
            </div>
          )}
          {phase === 'done' && results.length === 0 && (
            <div className="search-empty">
              <Mascot size={72} mood="sleepy" />
              <p>No luck sniffing that one out.</p>
            </div>
          )}

          <ul className="results">
            {results.map((r) => {
              const have = findExisting(r);
              const isOpen = picked === r.key;
              return (
                <li key={r.key} className={`result ${isOpen ? 'open' : ''}`}>
                  <button className="result-main" onClick={() => (setPicked(isOpen ? null : r.key), tick())} aria-expanded={isOpen}>
                    <Cover title={r.title} author={r.authors[0]} src={r.cover} isbn={r.isbn} className="cover-xs" />
                    <span className="result-text">
                      <strong>{r.title}</strong>
                      <span>{[r.authors.slice(0, 2).join(', '), r.year].filter(Boolean).join(' · ')}</span>
                      {have && <em className="badge">on your shelf</em>}
                    </span>
                    <span className="result-plus" aria-hidden="true">{isOpen ? '–' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="result-actions">
                      {STATUSES.map((s) => (
                        <button key={s.id} className={`pill pill-${s.id} press`} onClick={(e) => add(r, s.id, e.currentTarget)}>
                          <span aria-hidden="true">{s.emoji}</span> {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <button className="link-btn" onClick={() => setManual(true)}>
            Can’t find it? Add it by hand
          </button>
        </>
      )}
    </Sheet>
  );
}

function ManualForm({ onCancel, onAdd, initialTitle }: { onCancel: () => void; onAdd: (r: Omit<SearchResult, 'key' | 'source'>, s: Status) => void; initialTitle: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<Status>('read');
  return (
    <form
      className="manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ title, authors: author.trim() ? [author.trim()] : [] }, status);
      }}
    >
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <label className="field">
        <span>Author</span>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <div className="pills">
        {STATUSES.map((s) => (
          <button type="button" key={s.id} className={`pill pill-${s.id} ${status === s.id ? 'active' : ''}`} onClick={() => setStatus(s.id)}>
            <span aria-hidden="true">{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>
      <div className="row-end">
        <button type="button" className="btn ghost" onClick={onCancel}>Back to search</button>
        <button type="submit" className="btn primary">Add to shelf</button>
      </div>
    </form>
  );
}
