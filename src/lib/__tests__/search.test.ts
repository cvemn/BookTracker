import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanDescription, searchBooks } from '../search';

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

afterEach(() => vi.unstubAllGlobals());

describe('searchBooks', () => {
  it('maps Open Library results', async () => {
    const fetchMock = vi.fn(() =>
      json({ docs: [{ key: '/works/OL1W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, cover_i: 42, number_of_pages_median: 600 }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const [r] = await searchBooks('dune');
    expect(r).toMatchObject({ key: '/works/OL1W', source: 'openlibrary', title: 'Dune', authors: ['Frank Herbert'], year: 1965, pages: 600 });
    expect(r.cover).toBe('https://covers.openlibrary.org/b/id/42-L.jpg');
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('q=dune');
  });

  it('searches by ISBN when given one', async () => {
    const fetchMock = vi.fn(() => json({ docs: [{ key: '/works/OL2W', title: 'X' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await searchBooks('978-0-441-17271-9');
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('q=isbn%3A9780441172719');
  });

  it('falls back to Google Books when Open Library fails', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.includes('openlibrary')
        ? json({}, false)
        : json({ items: [{ id: 'g1', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], publishedDate: '1990-09-01', imageLinks: { thumbnail: 'http://books.google.com/x&edge=curl' }, description: '<p>Desert <b>planet</b></p>' } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const [r] = await searchBooks('dune');
    expect(r).toMatchObject({ source: 'google', title: 'Dune', year: 1990, cover: 'https://books.google.com/x', description: 'Desert planet' });
  });
});

describe('blending both catalogs', () => {
  const route = (ol: unknown, gb: unknown) =>
    vi.fn((url: string) => (url.includes('openlibrary') ? (ol instanceof Error ? json({}, false) : json(ol)) : gb instanceof Error ? json({}, false) : json(gb)));

  it('merges the same book from both sources and ranks agreed books first', async () => {
    vi.stubGlobal(
      'fetch',
      route(
        { docs: [
          { key: '/works/A', title: 'Joe Ledger: The Missing Files', author_name: ['Jonathan Maberry'] },
          { key: '/works/B', title: 'Patient Zero', author_name: ['Jonathan Maberry'], cover_i: 7, first_publish_year: 2009 },
        ] },
        { items: [
          { id: 'g1', volumeInfo: { title: 'Patient Zero', subtitle: 'A Joe Ledger Novel', authors: ['Jonathan Maberry'], pageCount: 421, description: 'Zombies.' } },
          { id: 'g2', volumeInfo: { title: 'The Dragon Factory', authors: ['Jonathan Maberry'] } },
          { id: 'g3', volumeInfo: { title: 'Summary of Patient Zero', authors: ['Quick Reads'] } },
        ] },
      ),
    );
    const r = await searchBooks('joe ledger');
    expect(r[0]).toMatchObject({ key: '/works/B', title: 'Patient Zero', pages: 421, description: 'Zombies.', year: 2009 });
    expect(r[0].cover).toContain('/7-L.jpg');
    expect(r.filter((b) => b.title.startsWith('Patient Zero'))).toHaveLength(1);
    expect(r.map((b) => b.title)).toContain('The Dragon Factory');
    expect(r[r.length - 1].title).toBe('Summary of Patient Zero');
  });

  it('still answers when one catalog is down, and fails only when both are', async () => {
    vi.stubGlobal('fetch', route({ docs: [{ key: '/works/C', title: 'Circe', author_name: ['Madeline Miller'] }] }, new Error()));
    expect((await searchBooks('circe')).map((b) => b.title)).toEqual(['Circe']);
    vi.stubGlobal('fetch', route(new Error(), new Error()));
    await expect(searchBooks('circe')).rejects.toThrow();
  });
});

describe('cleanDescription', () => {
  it('strips Open Library link footers', () => {
    expect(cleanDescription('A story.\n----------\n[Also](https://x)')).toBe('A story.');
    expect(cleanDescription('See [this](http://a) book')).toBe('See this book');
  });
});
