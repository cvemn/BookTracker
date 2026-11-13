import { afterEach, describe, expect, it, vi } from 'vitest';
import { editionPages, lookUpDetails, wantsLookup } from '../enrich';
import { searchBooks } from '../search';
import type { Book } from '../types';

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) } as Response);
afterEach(() => vi.unstubAllGlobals());

const book = (over: Partial<Book> = {}): Book => ({
  kind: 'book', id: 'b1', title: 'Project Hail Mary', authors: ['Andy Weir'], addedBy: 'r', createdAt: 0, updatedAt: 0, takes: {}, ...over,
});

describe('editionPages', () => {
  it('reads number_of_pages and pagination strings', () => {
    expect(editionPages({ number_of_pages: 476 })).toBe(476);
    expect(editionPages({ pagination: 'xii, 320 p.' })).toBe(320);
    expect(editionPages({ pagination: '320 pages ; 21 cm' })).toBe(320);
    expect(editionPages({ number_of_pages: 1 })).toBeUndefined();
    expect(editionPages({})).toBeUndefined();
  });
});

describe('lookUpDetails', () => {
  it('takes the median page count of the English editions of an Open Library work', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      url.includes('/editions.json')
        ? json({ entries: [
            { number_of_pages: 476, languages: [{ key: '/languages/eng' }], isbn_13: ['9780593135204'] },
            { number_of_pages: 496, languages: [{ key: '/languages/eng' }] },
            { pagination: '480 p.', languages: [{ key: '/languages/eng' }] },
            { number_of_pages: 640, languages: [{ key: '/languages/ger' }] },
          ] })
        : json({ description: { value: 'Space!' }, covers: [-1, 99] }),
    ));
    const { found, reached } = await lookUpDetails(book({ source: 'openlibrary', sourceKey: '/works/OL1W' }));
    expect(reached).toBe(true);
    expect(found).toMatchObject({ pages: 480, description: 'Space!', isbn: '9780593135204' });
    expect(found.cover).toContain('/99-L.jpg');
  });

  it('never replaces details the book already has', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      url.includes('/editions.json') ? json({ entries: [{ number_of_pages: 500 }] }) : json({ description: 'New blurb' }),
    ));
    const { found } = await lookUpDetails(book({ source: 'openlibrary', sourceKey: '/works/OL1W', description: 'Mine', year: 2021, cover: 'x', isbn: '1' }));
    expect(found).toEqual({ pages: 500 });
  });

  it('asks the Google Books volume when a Google book is missing its page count', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ volumeInfo: { printedPageCount: 368, publishedDate: '2011-02-11' } })));
    const { found } = await lookUpDetails(book({ source: 'google', sourceKey: 'g1', year: 2011, description: 'd', cover: 'c', isbn: '1' }));
    expect(found.pages).toBe(368);
  });

  it('finds a book added by hand through a search, then its editions', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('search.json')) return json({ docs: [{ key: '/works/OL9W', title: 'Project Hail Mary', author_name: ['Andy Weir'], first_publish_year: 2021, cover_i: 5 }] });
      if (url.includes('googleapis')) return json({}, false);
      if (url.includes('/editions.json')) return json({ entries: [{ number_of_pages: 496 }] });
      return json({ description: 'Space!' });
    }));
    const { found } = await lookUpDetails(book({ source: 'manual' }));
    expect(found).toMatchObject({ pages: 496, year: 2021 });
    expect(found.cover).toContain('/5-L.jpg');
  });

  it('reports when no catalog could be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    const { found, reached } = await lookUpDetails(book({ source: 'openlibrary', sourceKey: '/works/OL1W' }));
    expect(reached).toBe(false);
    expect(found).toEqual({});
  });
});

describe('wantsLookup', () => {
  const full = { pages: 300, year: 2000, cover: 'c', description: 'd' };
  it('skips complete books and books she edited by hand', () => {
    expect(wantsLookup(book(full))).toBe(false);
    expect(wantsLookup(book({ detailsEditedAt: 1 }))).toBe(false);
    expect(wantsLookup(book())).toBe(true);
  });
  it('retries a missing page count after a few days, but not other gaps', () => {
    const now = 10 * 86400000;
    expect(wantsLookup(book({ ...full, pages: undefined, lookedUpAt: now - 86400000 }), now)).toBe(false);
    expect(wantsLookup(book({ ...full, pages: undefined, lookedUpAt: now - 4 * 86400000 }), now)).toBe(true);
    expect(wantsLookup(book({ ...full, description: undefined, lookedUpAt: 1 }), now)).toBe(false);
  });
});

describe('search page counts', () => {
  it('ignores impossible page counts and uses Google’s printed count', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      url.includes('openlibrary')
        ? json({ docs: [{ key: '/works/A', title: 'Dune', author_name: ['Frank Herbert'], number_of_pages_median: 1 }] })
        : json({ items: [{ id: 'g', volumeInfo: { title: 'Dune', subtitle: 'A Novel', authors: ['Frank Herbert'], pageCount: 0, printedPageCount: 617 } }] }),
    ));
    const [r] = await searchBooks('dune');
    expect(r).toMatchObject({ title: 'Dune', pages: 617 });
  });
});
