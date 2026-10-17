import type { Book, Entry, Take } from './types';

/**
 * Combine two copies of the same entry. Book-level fields follow whichever copy
 * was edited last, but each reader's take is merged separately so two people
 * reviewing the same book at the same time never clobber each other.
 */
export function mergeEntry<T extends Entry>(a: T, b: T): T {
  if (a.kind !== 'book' || b.kind !== 'book') {
    return a.updatedAt >= b.updatedAt ? a : b;
  }
  const [x, y]: [Book, Book] = [a, b];
  const newer = x.updatedAt >= y.updatedAt ? x : y;
  const takes: Record<string, Take> = {};
  for (const id of new Set([...Object.keys(x.takes), ...Object.keys(y.takes)])) {
    const ta = x.takes[id];
    const tb = y.takes[id];
    takes[id] = !ta ? tb : !tb ? ta : ta.updatedAt >= tb.updatedAt ? ta : tb;
  }
  const merged: Book = {
    ...newer,
    takes,
    // Never lose a description / cover that only one side fetched.
    description: newer.description ?? (x.description || y.description),
    cover: newer.cover ?? (x.cover || y.cover),
    updatedAt: Math.max(x.updatedAt, y.updatedAt),
  };
  return merged as unknown as T;
}

export function mergeAll(local: Entry[], remote: Entry[]): { merged: Entry[]; toPush: Entry[] } {
  const remoteById = new Map(remote.map((e) => [e.id, e]));
  const out = new Map<string, Entry>(remote.map((e) => [e.id, e]));
  for (const e of local) {
    const r = out.get(e.id);
    out.set(e.id, r ? mergeEntry(r, e) : e);
  }
  const merged = [...out.values()];
  const toPush = merged.filter((e) => {
    const r = remoteById.get(e.id);
    return !r || JSON.stringify(r) !== JSON.stringify(e);
  });
  return { merged, toPush };
}
