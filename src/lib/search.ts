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

export async function searchBooks(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const query = q.trim();
  if (!query) return [];
  try {
    const results = await searchOpenLibrary(query, signal);
    if (results.length) return results;
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
  }
  return searchGoogle(query, signal);
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
