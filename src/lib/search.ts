/**
 * Book lookup. Open Library first (free, no key), Google Books as a fallback
 * when Open Library is down or finds nothing.
 */

export interface SearchResult {
  key: string;
  source: 'openlibrary' | 'google';
  title: string;
  authors: string[];
  year?: number;
  pages?: number;
  cover?: string;
  isbn?: string;
  description?: string;
}

const OL = 'https://openlibrary.org';
const GB = 'https://www.googleapis.com/books/v1/volumes';

function isbnOf(q: string): string | null {
  const digits = q.replace(/[\s-]/g, '');
  return /^(\d{9}[\dXx]|\d{13})$/.test(digits) ? digits : null;
}

async function getJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchOpenLibrary(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const isbn = isbnOf(q);
  const params = new URLSearchParams({
    limit: '16',
    fields: 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn',
  });
  params.set('q', isbn ? `isbn:${isbn}` : q);
  const data = await getJson(`${OL}/search.json?${params}`, signal);
  return (data.docs ?? [])
    .filter((d: any) => d.title)
    .map(
      (d: any): SearchResult => ({
        key: d.key,
        source: 'openlibrary',
        title: d.title,
        authors: d.author_name ?? [],
        year: d.first_publish_year,
        pages: d.number_of_pages_median,
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
        isbn: isbn ?? d.isbn?.[0],
      }),
    );
}

export async function searchGoogle(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const isbn = isbnOf(q);
  const params = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : q, maxResults: '16', printType: 'books' });
  const data = await getJson(`${GB}?${params}`, signal);
  return (data.items ?? [])
    .filter((it: any) => it.volumeInfo?.title)
    .map((it: any): SearchResult => {
      const v = it.volumeInfo;
      const thumb: string | undefined = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
      const year = parseInt(String(v.publishedDate ?? '').slice(0, 4), 10);
      return {
        key: it.id,
        source: 'google',
        title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
        authors: v.authors ?? [],
        year: Number.isFinite(year) ? year : undefined,
        pages: v.pageCount || undefined,
        cover: thumb?.replace(/^http:/, 'https:').replace('&edge=curl', ''),
        isbn: v.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier,
        description: v.description ? cleanDescription(v.description) : undefined,
      };
    });
}

const JUNK = /\b(summary of|summary & analysis|study guide|sparknotes|cliffsnotes|workbook for|analysis of)\b/i;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .split(':')[0]
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9]/g, '');
}

function sameBook(a: SearchResult, b: SearchResult): boolean {
  if (norm(a.title) !== norm(b.title)) return false;
  const aa = norm(a.authors[0] ?? '');
  const ba = norm(b.authors[0] ?? '');
  // Authors are spelled differently across catalogs ("J.R.R." vs "J. R. R."), so
  // compare surnames, and let a missing author match anything.
  const last = (x: string) => x.slice(-5);
  return !aa || !ba || last(aa) === last(ba);
}

/**
 * Ask both catalogs at once and blend them. Open Library is great at titles and
 * covers; Google Books is better at series and author searches ("joe ledger").
 * Books both sources agree on rise to the top (reciprocal rank fusion).
 */
export async function searchBooks(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const query = q.trim();
  if (!query) return [];
  const [ol, gb] = await Promise.allSettled([searchOpenLibrary(query, signal), searchGoogle(query, signal)]);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (ol.status === 'rejected' && gb.status === 'rejected') throw ol.reason;

  type Scored = { book: SearchResult; score: number };
  const merged: Scored[] = [];
  const add = (list: SearchResult[], weight: number) => {
    list.forEach((r, rank) => {
      const score = (weight / (rank + 3)) * (JUNK.test(r.title) ? 0.2 : 1);
      const hit = merged.find((m) => sameBook(m.book, r));
      if (!hit) return void merged.push({ book: r, score });
      // Same book from the other catalog (or another edition): fill gaps, add score.
      hit.score += score;
      const b = hit.book;
      hit.book = {
        ...b,
        cover: b.cover ?? r.cover,
        year: b.year && r.year ? Math.min(b.year, r.year) : b.year ?? r.year,
        pages: b.pages ?? r.pages,
        isbn: b.isbn ?? r.isbn,
        description: b.description ?? r.description,
        authors: b.authors.length ? b.authors : r.authors,
      };
    });
  };
  add(ol.status === 'fulfilled' ? ol.value : [], 1);
  add(gb.status === 'fulfilled' ? gb.value : [], 1);
  return merged.sort((a, b) => b.score - a.score).slice(0, 20).map((m) => m.book);
}

/** Open Library search results don't include a blurb, so fetch it on demand. */
export async function fetchDescription(source: string | undefined, key: string | undefined): Promise<string | undefined> {
  if (source !== 'openlibrary' || !key?.startsWith('/works/')) return undefined;
  try {
    const work = await getJson(`${OL}${key}.json`);
    const d = work.description;
    const text: string | undefined = typeof d === 'string' ? d : d?.value;
    return text ? cleanDescription(text) : undefined;
  } catch {
    return undefined;
  }
}

/** Strip Open Library's markdown-ish link lists and source footers. */
export function cleanDescription(text: string): string {
  return text
    .split(/\n-{3,}|\n\s*\(\[source\]|\n\s*\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}
