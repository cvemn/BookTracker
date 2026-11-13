/**
 * Filling in what a book is missing (page count first of all, then the year,
 * cover, ISBN and blurb). Catalog search results are thin: Open Library only
 * gives a page count when its editions agree on one, and Google Books often
 * leaves it out. So for a book that's missing details we ask more specific
 * places, best first, and stop as soon as we have everything:
 *
 *   1. the Open Library work and its editions (median page count)
 *   2. the Open Library edition for the book's ISBN
 *   3. the Google Books volume itself (richer than its search result)
 *   4. a fresh search for "title author" in both catalogs
 *
 * Only fields the book doesn't have are ever filled; nothing she typed is
 * overwritten.
 */
import { cleanDescription, getJson, plausiblePages, sameBook, searchBooks, type SearchResult } from './search';
import { books, fillDetails, getState } from './store';
import type { Book } from './types';

const OL = 'https://openlibrary.org';
const GB = 'https://www.googleapis.com/books/v1/volumes';

export type Details = Partial<Pick<Book, 'pages' | 'year' | 'cover' | 'isbn' | 'description'>>;
const FIELDS = ['pages', 'year', 'cover', 'isbn', 'description'] as const;

const missing = (b: Details) => FIELDS.filter((f) => b[f] === undefined || b[f] === '');

/** Pull a page count out of an Open Library edition ("xii, 320 p." counts too). */
export function editionPages(e: { number_of_pages?: unknown; pagination?: unknown }): number | undefined {
  const n = plausiblePages(e.number_of_pages);
  if (n) return n;
  const text = String(e.pagination ?? '');
  const marked = text.match(/(\d{2,4})\s*(?:pages?|pgs?|pp?|seiten|páginas)(?![a-z])/i);
  if (marked) return plausiblePages(marked[1]);
  const nums = (text.match(/\d{2,4}/g) ?? []).map(Number).map(plausiblePages).filter((x): x is number => !!x);
  return nums.length ? Math.max(...nums) : undefined;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

async function fromOpenLibraryWork(key: string): Promise<Details> {
  const [work, eds] = await Promise.allSettled([getJson(`${OL}${key}.json`), getJson(`${OL}${key}/editions.json?limit=100`)]);
  if (work.status === 'rejected' && eds.status === 'rejected') throw work.reason;
  const out: Details = {};
  if (work.status === 'fulfilled') {
    const d = work.value.description;
    const text: string | undefined = typeof d === 'string' ? d : d?.value;
    if (text) out.description = cleanDescription(text);
    const cover = (work.value.covers ?? []).find((c: number) => c > 0);
    if (cover) out.cover = `https://covers.openlibrary.org/b/id/${cover}-L.jpg`;
  }
  if (eds.status === 'fulfilled') {
    const entries: any[] = eds.value.entries ?? [];
    // Prefer English editions' page counts; translations run longer or shorter.
    const english = entries.filter((e) => (e.languages ?? []).some((l: any) => l?.key === '/languages/eng'));
    const counts = (list: any[]) => list.map(editionPages).filter((n): n is number => !!n);
    out.pages = median(counts(english)) ?? median(counts(entries));
    const withIsbn = [...english, ...entries].find((e) => e.isbn_13?.[0] || e.isbn_10?.[0]);
    if (withIsbn) out.isbn = withIsbn.isbn_13?.[0] ?? withIsbn.isbn_10?.[0];
  }
  return out;
}

async function fromIsbn(isbn: string): Promise<Details> {
  const e = await getJson(`${OL}/isbn/${encodeURIComponent(isbn)}.json`);
  const year = parseInt(String(e.publish_date ?? '').match(/\d{4}/)?.[0] ?? '', 10);
  const cover = (e.covers ?? []).find((c: number) => c > 0);
  return {
    pages: editionPages(e),
    year: Number.isFinite(year) ? year : undefined,
    cover: cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : undefined,
  };
}

async function fromGoogleVolume(id: string): Promise<Details> {
  const v = (await getJson(`${GB}/${encodeURIComponent(id)}`)).volumeInfo ?? {};
  const year = parseInt(String(v.publishedDate ?? '').slice(0, 4), 10);
  const thumb: string | undefined = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
  return {
    pages: plausiblePages(v.printedPageCount) ?? plausiblePages(v.pageCount),
    year: Number.isFinite(year) ? year : undefined,
    cover: thumb?.replace(/^http:/, 'https:').replace('&edge=curl', ''),
    description: v.description ? cleanDescription(v.description) : undefined,
  };
}

/**
 * Look up whatever `book` is missing. `reached` says whether any catalog
 * answered at all, so an offline attempt isn't remembered as "nothing found".
 */
export async function lookUpDetails(book: Book): Promise<{ found: Details; reached: boolean }> {
  const found: Details = {};
  let reached = false;
  const need = () => missing({ ...found, ...pick(book) });
  const take = (d: Details) => {
    for (const f of FIELDS) if (found[f] === undefined && d[f] !== undefined && d[f] !== '' && isMissing(book, f)) (found as any)[f] = d[f];
  };
  const attempt = async (fn: () => Promise<Details>) => {
    if (!need().length) return;
    try {
      take(await fn());
      reached = true;
    } catch {
      // that catalog is down or doesn't know the book; try the next one
    }
  };

  const olWork = (k?: string) => (k?.startsWith('/works/') ? k : undefined);
  if (book.source === 'openlibrary' && olWork(book.sourceKey)) await attempt(() => fromOpenLibraryWork(book.sourceKey!));
  const isbn = book.isbn ?? found.isbn;
  if (isbn && found.pages === undefined && isMissing(book, 'pages')) await attempt(() => fromIsbn(isbn));
  if (book.source === 'google' && book.sourceKey) await attempt(() => fromGoogleVolume(book.sourceKey!));

  // Still short (or added by hand): search for it and use the best match.
  if (need().some((f) => f === 'pages' || f === 'cover' || f === 'year')) {
    let match: SearchResult | undefined;
    try {
      const results = await searchBooks([book.title, book.authors[0]].filter(Boolean).join(' '));
      reached = true;
      const me = { key: '', source: 'openlibrary' as const, title: book.title, authors: book.authors };
      match = results.find((r) => sameBook(me, r));
    } catch {
      // offline
    }
    if (match) {
      take(match);
      if (found.pages === undefined && isMissing(book, 'pages')) {
        if (match.source === 'openlibrary' && olWork(match.key)) await attempt(() => fromOpenLibraryWork(match!.key));
        else if (match.source === 'google') await attempt(() => fromGoogleVolume(match!.key));
        const mIsbn = match.isbn ?? found.isbn;
        if (mIsbn && found.pages === undefined) await attempt(() => fromIsbn(mIsbn));
      }
    }
  }
  return { found, reached };
}

function pick(b: Book): Details {
  return { pages: b.pages, year: b.year, cover: b.cover, isbn: b.isbn, description: b.description };
}
function isMissing(b: Book, f: (typeof FIELDS)[number]) {
  return b[f] === undefined || b[f] === '';
}

const DAY = 86400000;

/**
 * Whether to go looking for this book's details now. Books she edited by hand
 * are left alone; a book still missing its page count gets another try every
 * few days, since catalogs keep improving.
 */
export function wantsLookup(b: Book, now = Date.now()): boolean {
  if (b.detailsEditedAt) return false;
  const gaps = missing(pick(b)).filter((f) => f !== 'isbn');
  if (!gaps.length) return false;
  if (!b.lookedUpAt) return true;
  return gaps.includes('pages') && now - b.lookedUpAt > 3 * DAY;
}

const inFlight = new Set<string>();

/** Fill in one book's missing details in the background. True if anything was found. */
export async function enrichBook(id: string): Promise<boolean> {
  const b = getState().entries[id];
  if (!b || b.kind !== 'book' || b.deleted || !wantsLookup(b) || inFlight.has(id)) return false;
  inFlight.add(id);
  try {
    const { found, reached } = await lookUpDetails(b);
    const any = Object.keys(found).length > 0;
    if (reached || any) fillDetails(id, found);
    return any;
  } finally {
    inFlight.delete(id);
  }
}

let sweeping = false;

/**
 * Quietly fix up the whole shelf: every book that's missing its page count
 * (or cover, year, blurb) gets looked up, one at a time so the catalogs
 * aren't hammered. Runs when the app opens and when the phone comes online.
 */
export async function enrichShelf(limit = 40) {
  if (sweeping || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  sweeping = true;
  try {
    const todo = books(getState())
      .filter((b) => wantsLookup(b))
      .slice(0, limit);
    for (const b of todo) {
      if (navigator.onLine === false) break;
      await enrichBook(b.id);
      await new Promise((r) => setTimeout(r, 350));
    }
  } finally {
    sweeping = false;
  }
}
