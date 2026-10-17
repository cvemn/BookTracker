import { useEffect, useRef, useState } from 'react';
import { fetchDescription } from '../lib/search';
import { removeBook, setTake, updateBook, useStore } from '../lib/store';
import { STATUSES, VIBES, type Book, type Take } from '../lib/types';
import { ConfirmButton } from './ConfirmButton';
import { Cover } from './Cover';
import { celebrate, tick } from '../lib/feel';
import { Hearts } from './Hearts';
import { Sheet } from './Sheet';

export function BookSheet({ bookId, onClose }: { bookId: string | null; onClose: () => void }) {
  const entry = useStore((s) => (bookId ? s.entries[bookId] : undefined));
  const me = useStore((s) => s.me);
  const book = entry?.kind === 'book' && !entry.deleted ? entry : undefined;

  // Fill in the blurb the first time a book is opened.
  useEffect(() => {
    if (!book || book.description) return;
    let live = true;
    fetchDescription(book.source, book.sourceKey).then((d) => {
      if (live && d) updateBook(book.id, { description: d });
    });
    return () => {
      live = false;
    };
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!book || !me) return <Sheet open={false} onClose={onClose} label="Book">{null}</Sheet>;

  const mine = book.takes[me.readerId];

  return (
    <Sheet open onClose={onClose} label={book.title} wide>
      <div className="book-hero">
        <Cover title={book.title} author={book.authors[0]} src={book.cover} isbn={book.isbn} className="cover-lg" />
        <div className="book-hero-text">
          <h2>{book.title}</h2>
          {book.authors.length > 0 && <p className="by">by {book.authors.join(', ')}</p>}
          <p className="meta">{[book.year, book.pages && `${book.pages} pages`].filter(Boolean).join(' · ')}</p>
          {book.description && <Blurb text={book.description} />}
        </div>
      </div>

      <section className="take take-mine">
        <header>
          <span className="avatar">{me.critter}</span>
          <h3>My take</h3>
        </header>
        {mine ? (
          <TakeEditor key={book.id} book={book} take={mine} />
        ) : (
          <div className="pills">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                className={`pill pill-${s.id}`}
                onClick={(e) => {
                  setTake(book.id, { status: s.id });
                  if (s.id === 'read') celebrate(e.currentTarget);
                  else tick();
                }}
              >
                <span aria-hidden="true">{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {mine && (
        <ConfirmButton
          className="link-btn danger"
          confirmText="Tap again to remove it"
          onConfirm={() => {
            removeBook(book.id);
            onClose();
          }}
        >
          Remove from my shelf
        </ConfirmButton>
      )}
    </Sheet>
  );
}

function Blurb({ text }: { text: string }) {
  const [more, setMore] = useState(false);
  const long = text.length > 280;
  return (
    <p className="blurb">
      {long && !more ? `${text.slice(0, 260).trimEnd()}… ` : `${text} `}
      {long && (
        <button className="link-btn inline" onClick={() => setMore(!more)}>
          {more ? 'less' : 'more'}
        </button>
      )}
    </p>
  );
}

function TakeEditor({ book, take }: { book: Book; take: Take }) {
  const [note, setNote] = useState(take.note);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);

  // Pick up edits from another device unless we're mid-typing.
  useEffect(() => {
    if (!dirty.current) setNote(take.note);
  }, [take.note]);

  const flush = (value: string) => {
    clearTimeout(saveTimer.current);
    dirty.current = false;
    if (value !== take.note) setTake(book.id, { note: value });
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const toggleVibe = (id: string) => {
    tick();
    setTake(book.id, { vibes: take.vibes.includes(id) ? take.vibes.filter((v) => v !== id) : [...take.vibes, id] });
  };

  return (
    <div className="take-editor">
      <div className="pills" role="radiogroup" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={take.status === s.id}
            className={`pill pill-${s.id} ${take.status === s.id ? 'active' : ''}`}
            onClick={(e) => {
              if (s.id === take.status) return;
              setTake(book.id, { status: s.id });
              if (s.id === 'read') celebrate(e.currentTarget);
              else tick();
            }}
          >
            <span aria-hidden="true">{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>

      {take.status !== 'want' && (
        <>
          <div className="field-row">
            <span className="field-label">Rating</span>
            <Hearts value={take.rating} onChange={(rating) => setTake(book.id, { rating })} size="lg" />
          </div>
          <div className="field-row wrap">
            <span className="field-label">Vibes</span>
            <div className="vibes">
              {VIBES.map((v) => (
                <button key={v.id} className={`vibe ${take.vibes.includes(v.id) ? 'on' : ''}`} onClick={() => toggleVibe(v.id)} aria-pressed={take.vibes.includes(v.id)}>
                  <span aria-hidden="true">{v.emoji}</span> {v.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {take.status === 'read' && (
        <label className="field-row">
          <span className="field-label">Finished</span>
          <input type="date" className="date" value={take.finishedOn ?? ''} onChange={(e) => setTake(book.id, { finishedOn: e.target.value || undefined })} />
        </label>
      )}
      <label className="scribbles">
        <span className="field-label">Scribbles</span>
        <textarea
          value={note}
          placeholder={take.status === 'want' ? 'Why this one? Who recommended it?' : 'Favorite bits, hot takes, quotes, feelings…'}
          onChange={(e) => {
            setNote(e.target.value);
            dirty.current = true;
            clearTimeout(saveTimer.current);
            const v = e.target.value;
            saveTimer.current = setTimeout(() => flush(v), 700);
          }}
          onBlur={(e) => flush(e.target.value)}
          rows={5}
        />
        <span className="saved-hint">{note === take.note ? 'Saved ✓' : 'Saving…'}</span>
      </label>
    </div>
  );
}
