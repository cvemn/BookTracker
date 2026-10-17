import { useSyncExternalStore } from 'react';
import { mergeAll } from './merge';
import { randomId } from './ids';
import * as remote from './sync';
import type { SearchResult } from './search';
import type { Book, Entry, Me, Profile, Status, SyncConfig, Take } from './types';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

export interface State {
  me: Me | null;
  sync: SyncConfig | null;
  entries: Record<string, Entry>;
  syncState: SyncState;
  syncError?: string;
  lastSynced?: number;
}

const KEY = 'dogear:v1';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        me: saved.me ?? null,
        sync: saved.sync ?? null,
        entries: saved.entries ?? {},
        syncState: saved.sync ? 'idle' : 'off',
        lastSynced: saved.lastSynced,
      };
    }
  } catch {
    // corrupted storage: start fresh rather than crash
  }
  return { me: null, sync: null, entries: {}, syncState: 'off' };
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    const { me, sync, entries, lastSynced } = state;
    localStorage.setItem(KEY, JSON.stringify({ me, sync, entries, lastSynced }));
  } catch {
    // storage full or blocked; the in-memory state still works
  }
}

function set(patch: Partial<State>, { save = true } = {}) {
  state = { ...state, ...patch };
  if (save) persist();
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
  scheduleSync();
}

/* ---------- readers ---------- */

export function setMe(name: string, critter: string) {
  const readerId = state.me?.readerId ?? randomId(8);
  const me: Me = { readerId, name: name.trim(), critter };
  set({ me });
  const profile: Profile = { kind: 'profile', id: `profile:${readerId}`, readerId, name: me.name, critter, updatedAt: Date.now() };
  putEntries([profile]);
}

export function profiles(s: Pick<State, 'entries'>): Profile[] {
  return Object.values(s.entries).filter((e): e is Profile => e.kind === 'profile');
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

export function removeMyTake(id: string) {
  const b = state.entries[id];
  const me = state.me;
  if (!b || b.kind !== 'book' || !me) return;
  const takes = { ...b.takes };
  delete takes[me.readerId];
  // A book nobody has on their shelf any more goes away entirely.
  const deleted = Object.keys(takes).length === 0;
  putEntries([{ ...b, takes, deleted, updatedAt: Date.now() }]);
}

/* ---------- sync ---------- */

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;

export function scheduleSync(delay = 1200) {
  if (!state.sync) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  if (!state.sync) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const cfg = state.sync!;
    set({ syncState: 'syncing' }, { save: false });
    try {
      const theirs = await remote.pull(cfg);
      // Re-read local entries after the network round trip so edits made
      // while we were waiting are included.
      const { merged, toPush } = mergeAll(Object.values(state.entries), theirs);
      await remote.push(cfg, toPush);
      if (state.sync !== cfg) return; // disconnected meanwhile
      const entries = { ...state.entries };
      for (const e of merged) {
        const cur = entries[e.id];
        // Keep anything edited locally during the push; it'll go next round.
        if (!cur || cur.updatedAt <= e.updatedAt) entries[e.id] = e;
        else again = true;
      }
      set({ entries, syncState: 'idle', syncError: undefined, lastSynced: Date.now() });
    } catch (err) {
      set({ syncState: 'error', syncError: (err as Error).message }, { save: false });
    } finally {
      running = null;
      if (again) {
        again = false;
        scheduleSync(300);
      }
    }
  })();
  return running;
}

export async function connect(cfg: SyncConfig) {
  // Fail loudly before saving if the details are wrong.
  await remote.pull(cfg);
  set({ sync: cfg, syncState: 'idle', syncError: undefined });
  await syncNow();
}

export function disconnect() {
  set({ sync: null, syncState: 'off', syncError: undefined });
}

export function newShelfCode() {
  return randomId(16);
}

/* ---------- backup ---------- */

export function exportBackup(): string {
  return JSON.stringify({ app: 'dogear', version: 1, exportedAt: new Date().toISOString(), entries: Object.values(state.entries) }, null, 2);
}

export function importBackup(json: string): number {
  const data = JSON.parse(json);
  const list: Entry[] = Array.isArray(data?.entries) ? data.entries : [];
  const valid = list.filter((e) => e && typeof e.id === 'string' && (e.kind === 'book' || e.kind === 'profile'));
  const { merged } = mergeAll(Object.values(state.entries), valid);
  set({ entries: Object.fromEntries(merged.map((e) => [e.id, e])) });
  scheduleSync(100);
  return valid.filter((e) => e.kind === 'book').length;
}

/* ---------- lifecycle ---------- */

export function startBackgroundSync() {
  void syncNow();
  const tick = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 20000);
  const onFocus = () => void syncNow();
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  return () => {
    clearInterval(tick);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onFocus);
  };
}
