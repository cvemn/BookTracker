import { describe, expect, it } from 'vitest';
import { mergeAll, mergeEntry } from '../merge';
import type { Book, Take } from '../types';

const take = (rating: number, updatedAt: number, note = ''): Take => ({ status: 'read', rating, vibes: [], note, updatedAt });
const book = (over: Partial<Book>): Book => ({
  kind: 'book', id: 'b1', title: 'Dune', authors: ['Frank Herbert'], addedBy: 'a', createdAt: 1, updatedAt: 1, takes: {}, ...over,
});

describe('mergeEntry', () => {
  it('keeps both readers’ takes when they edit the same book at once', () => {
    const mine = book({ updatedAt: 10, takes: { me: take(5, 10, 'loved it') } });
    const hers = book({ updatedAt: 12, takes: { her: take(3, 12, 'too much sand') } });
    const m = mergeEntry(mine, hers);
    expect(m.takes.me.note).toBe('loved it');
    expect(m.takes.her.note).toBe('too much sand');
    expect(m.updatedAt).toBe(12);
  });

  it('picks the newer version of the same reader’s take', () => {
    const a = book({ updatedAt: 5, takes: { me: take(2, 5) } });
    const b = book({ updatedAt: 9, takes: { me: take(4, 9) } });
    expect(mergeEntry(a, b).takes.me.rating).toBe(4);
    expect(mergeEntry(b, a).takes.me.rating).toBe(4);
  });

  it('does not drop a description only one side fetched', () => {
    const a = book({ updatedAt: 5, description: 'Spice!' });
    const b = book({ updatedAt: 9 });
    expect(mergeEntry(a, b).description).toBe('Spice!');
  });

  it('propagates deletes when they are newest', () => {
    const a = book({ updatedAt: 5 });
    const b = book({ updatedAt: 9, deleted: true });
    expect(mergeEntry(a, b).deleted).toBe(true);
  });
});

describe('mergeAll', () => {
  it('only pushes entries the server does not already have', () => {
    const same = book({ id: 'same' });
    const changed = book({ id: 'changed', updatedAt: 20, takes: { me: take(5, 20) } });
    const remote = [same, book({ id: 'changed', updatedAt: 3 }), book({ id: 'theirs' })];
    const { merged, toPush } = mergeAll([same, changed], remote);
    expect(merged.map((e) => e.id).sort()).toEqual(['changed', 'same', 'theirs']);
    expect(toPush.map((e) => e.id)).toEqual(['changed']);
  });
});
