import { useSyncExternalStore } from 'react';
import { mergeAll } from './merge';
import { randomId } from './ids';
import { askToKeepData, readLocal, readNative, writeDurable } from './vault';
import type { SearchResult } from './search';
import { CRITTERS, type Book, type Entry, type Me, type Status, type Take } from './types';

export interface State {
  me: Me | null;
  entries: Record<string, Entry>;
}

const KEY = 'dogear:v1';
/** Dogear is made for one reader. */
export const HER_NAME = 'Kaila';

function parse(raw: string | null): State {
  try {
    if (raw) {
      const saved = JSON.parse(raw);
      return { me: saved.me ?? null, entries: saved.entries ?? {} };
    }
  } catch {
    // corrupted storage: start fresh rather than crash
  }
  return { me: null, entries: {} };
}

let state: State = parse(readLocal(KEY));

/**
 * In the Android app, the native copy wins if it's newer (or the web copy is
 * gone), so books survive even if the app's web storage gets wiped.
 */
export async function hydrate() {
  askToKeepData();
  await restoreNative();
  // Only after the native copy had its say, so a fresh profile never outranks saved books.
  if (!state.me) firstVisit = true;
  if (!state.me || state.me.name !== HER_NAME) setMe(HER_NAME, state.me?.critter ?? CRITTERS[0]);
}

let firstVisit = false;
/** True on the very first launch, so the welcome can say hello instead of welcome back. */
export function isFirstVisit() {
  return firstVisit;
}

async function restoreNative() {
  const raw = await readNative(KEY);
  if (!raw) {
    if (Object.keys(state.entries).length || state.me) persist(); // seed the native copy
    return;
  }
  const native = parse(raw);
  const savedAt = (r: string | null) => {
    try {
      return r ? JSON.parse(r).savedAt ?? 0 : -1;
    } catch {
      return -1;
    }
  };
  if (savedAt(raw) > savedAt(readLocal(KEY))) {
    state = native;
    listeners.forEach((l) => l());
  }
}
const listeners = new Set<() => void>();

function persist() {
  const { me, entries } = state;
  writeDurable(KEY, JSON.stringify({ me, entries, savedAt: Date.now() }));
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

function putEntries(list: Entry[]) {
  const entries = { ...state.entries };
  for (const e of list) entries[e.id] = e;
  set({ entries });
}

/* ---------- her ---------- */

export function setMe(name: string, critter: string) {
  const readerId = state.me?.readerId ?? randomId(8);
  const me: Me = { readerId, name: name.trim(), critter };
  set({ me });
}

export function books(s: Pick<State, 'entries'>): Book[] {
  return Object.values(s.entries).filter((e): e is Book => e.kind === 'book' && !e.deleted);
}

/* ---------- books ---------- */

function newTake(status: Status): Take {
  return {
    status,
    rating: 0,
    vibes: [],
    note: '',
    finishedOn: status === 'read' ? new Date().toISOString().slice(0, 10) : undefined,
    updatedAt: Date.now(),
  };
}

export function findExisting(r: { source?: string; key?: string; title: string; authors: string[] }): Book | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return books(state).find(
    (b) =>
      (r.key && b.sourceKey === r.key) ||
      (norm(b.title) === norm(r.title) && norm(b.authors[0] ?? '') === norm(r.authors[0] ?? '')),
  );
}

export function addBook(r: SearchResult | Omit<SearchResult, 'key' | 'source'>, status: Status): string {
  const me = state.me!;
  const existing = findExisting(r as SearchResult);
  if (existing) {
    if (!existing.takes[me.readerId]) setTake(existing.id, newTake(status));
    else setTake(existing.id, { status });
    return existing.id;
  }
  const now = Date.now();
  const sr = r as Partial<SearchResult>;
  const book: Book = {
    kind: 'book',
    id: randomId(10),
    title: r.title.trim(),
    authors: r.authors,
    cover: r.cover,
    year: r.year,
    pages: r.pages,
    isbn: r.isbn,
    description: r.description,
    source: sr.source ?? 'manual',
    sourceKey: sr.key,
    addedBy: me.readerId,
    createdAt: now,
    updatedAt: now,
    takes: { [me.readerId]: newTake(status) },
  };
  putEntries([book]);
  return book.id;
}

export function updateBook(id: string, patch: Partial<Omit<Book, 'kind' | 'id' | 'takes'>>) {
  const b = state.entries[id];
  if (!b || b.kind !== 'book') return;
  putEntries([{ ...b, ...patch, updatedAt: Date.now() }]);
}

export function setTake(id: string, patch: Partial<Take>) {
  const b = state.entries[id];
  const me = state.me;
  if (!b || b.kind !== 'book' || !me) return;
  const now = Date.now();
  const prev = b.takes[me.readerId] ?? newTake(patch.status ?? 'read');
  const next: Take = { ...prev, ...patch, updatedAt: now };
  if (patch.status === 'read' && !next.finishedOn) next.finishedOn = new Date().toISOString().slice(0, 10);
  putEntries([{ ...b, takes: { ...b.takes, [me.readerId]: next }, updatedAt: now }]);
}

export function removeBook(id: string) {
  const entries = { ...state.entries };
  delete entries[id];
  set({ entries });
}

/* ---------- backup ---------- */

export function exportBackup(): string {
  return JSON.stringify(
    { app: 'dogear', version: 1, exportedAt: new Date().toISOString(), me: state.me, entries: books(state) },
    null,
    2,
  );
}

/**
 * Bring books back from a backup file. A backup from another phone was made
 * under a different reader id, so every take in it is moved onto this reader.
 */
export function importBackup(json: string): number {
  const data = JSON.parse(json);
  const me = state.me!;
  const list: Entry[] = Array.isArray(data?.entries) ? data.entries : [];
  const incoming: Book[] = list
    .filter((e): e is Book => !!e && typeof e.id === 'string' && e.kind === 'book' && !e.deleted && typeof e.title === 'string')
    .map((b) => {
      const newest = Object.values(b.takes ?? {}).sort((x, y) => y.updatedAt - x.updatedAt)[0];
      return { ...b, takes: newest ? { [me.readerId]: newest } : {} };
    });
  const { merged } = mergeAll(Object.values(state.entries), incoming);
  set({ entries: Object.fromEntries(merged.map((e) => [e.id, e])) });
  return incoming.length;
}
