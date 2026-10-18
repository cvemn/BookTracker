import { useEffect, useRef, useState } from 'react';
import { fetchDescription } from '../lib/search';
import { removeBook, setTake, updateBook, useStore } from '../lib/store';
import { STATUSES, VIBES, type Book, type Take } from '../lib/types';
import { ConfirmButton } from './ConfirmButton';
import { Cover } from './Cover';
import { celebrate, success, tick } from '../lib/feel';
import { Hearts } from './Hearts';
import { Sheet } from './Sheet';

export function BookSheet({ bookId, onClose }: { bookId: string | null; onClose: () => void }) {
  const entry = useStore((s) => (bookId ? s.entries[bookId] : undefined));
  const me = useStore((s) => s.me);
  const book = entry?.kind === 'book' && !entry.deleted ? entry : undefined;
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [bookId]);

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
  if (editing) return (
    <Sheet open onClose={onClose} label={`Edit ${book.title}`} wide>
      <EditDetails book={book} onDone={() => setEditing(false)} />
    </Sheet>
  );

  return (
    <Sheet open onClose={onClose} label={book.title} wide>
      <div className="book-hero">
        <Cover key={book.cover ?? ''} title={book.title} author={book.authors[0]} src={book.cover} isbn={book.isbn} className="cover-lg" />
        <div className="book-hero-text">
          <h2>{book.title}</h2>
          {book.authors.length > 0 && <p className="by">by {book.authors.join(', ')}</p>}
          <p className="meta">{[book.year, book.pages && `${book.pages} pages`].filter(Boolean).join(' · ')}</p>
          {book.description && <Blurb text={book.description} />}
          <button className="btn tiny ghost press edit-details" onClick={() => (setEditing(true), tick())}>
            ✏️ Edit details
          </button>
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

/** Fix anything the book search got wrong, or fill in what it missed. */
function EditDetails({ book, onDone }: { book: Book; onDone: () => void }) {
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors.join(', '));
  const [year, setYear] = useState(book.year ? String(book.year) : '');
  const [pages, setPages] = useState(book.pages ? String(book.pages) : '');
  const [cover, setCover] = useState(book.cover ?? '');
  const [description, setDescription] = useState(book.description ?? '');
  const [photoError, setPhotoError] = useState('');

  const num = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const save = () => {
    updateBook(book.id, {
      title: title.trim() || book.title,
      authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
      year: num(year),
      pages: num(pages),
      cover: cover.trim() || undefined,
      description: description.trim() || undefined,
    });
    success();
    onDone();
  };

  return (
    <form
      className="edit-details-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2 className="sheet-title">Edit details</h2>
      <div className="edit-cover">
        <Cover key={cover} title={title || book.title} author={authors.split(',')[0]?.trim()} src={cover || undefined} isbn={cover ? undefined : book.isbn} className="cover-md" />
        <div className="edit-cover-actions">
          <label className="btn tiny ghost press">
            📷 Use a photo
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  setCover(await shrinkPhoto(file));
                  setPhotoError('');
                } catch {
                  setPhotoError('That photo didn’t work. Try another one?');
                }
              }}
            />
          </label>
          {cover && (
            <button type="button" className="link-btn" onClick={() => setCover('')}>
              Remove cover
            </button>
          )}
          {photoError && <p className="muted small">{photoError}</p>}
        </div>
      </div>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span>Author</span>
        <input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Separate several with commas" />
      </label>
      <div className="field-pair">
        <label className="field">
          <span>Year</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2024" />
        </label>
        <label className="field">
          <span>Pages</span>
          <input value={pages} onChange={(e) => setPages(e.target.value)} inputMode="numeric" placeholder="320" />
        </label>
      </div>
      <label className="field">
        <span>Cover image link</span>
        <input value={cover.startsWith('data:') ? '' : cover} onChange={(e) => setCover(e.target.value)} placeholder={cover.startsWith('data:') ? 'Using your photo' : 'https://…'} inputMode="url" />
      </label>
      <label className="field">
        <span>About the book</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
      </label>
      <div className="row-end">
        <button type="button" className="btn ghost press" onClick={onDone}>
          Cancel
        </button>
        <button className="btn primary press">Save</button>
      </div>
    </form>
  );
}

/** Turn a phone photo into a small JPEG that fits comfortably in storage. */
function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad image'));
    };
    img.src = url;
  });
}
