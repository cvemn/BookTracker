import { describe, expect, it, vi } from 'vitest';

// A shelf exactly as the previous version saved it.
const OLD = {
  me: { readerId: 'r1', name: 'Kaila', critter: '🐶' },
  entries: {
    b1: {
      kind: 'book', id: 'b1', title: 'Normal People', authors: ['Sally Rooney'], source: 'openlibrary', sourceKey: '/works/OL1W',
      addedBy: 'r1', createdAt: 1, updatedAt: 1,
      takes: { r1: { status: 'read', rating: 4, vibes: ['cried'], note: 'Ouch.', finishedOn: '2026-01-02', updatedAt: 5 } },
    },
  },
  savedAt: 5,
};

describe('updating Dogear keeps her shelf', () => {
  it('loads a shelf saved by the previous version and fills gaps without touching her take', async () => {
    localStorage.setItem('dogear:v1', JSON.stringify(OLD));
    vi.resetModules();
    const store = await import('../store');
    await store.hydrate();
    const before = store.getState().entries.b1;
    expect(before).toMatchObject({ title: 'Normal People' });

    store.fillDetails('b1', { pages: 273, description: 'Two people.', title: 'WRONG' } as never);
    const after = store.getState().entries.b1 as typeof OLD.entries.b1 & { pages?: number; lookedUpAt?: number };
    expect(after.pages).toBe(273);
    expect(after.title).toBe('Normal People');
    expect(after.lookedUpAt).toBeGreaterThan(0);
    expect(after.takes).toEqual(OLD.entries.b1.takes);
    expect(store.getState().me?.readerId).toBe('r1');

    const saved = JSON.parse(localStorage.getItem('dogear:v1')!);
    expect(saved.entries.b1.takes.r1.note).toBe('Ouch.');
    expect(saved.entries.b1.pages).toBe(273);
  });
});
