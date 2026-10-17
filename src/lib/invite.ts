import type { SyncConfig } from './types';

/**
 * An invite link carries everything the other person needs to join: the
 * Supabase project (its URL and public anon key) and the secret shelf code.
 * It lives in the URL hash so it never reaches any server logs.
 */
export function makeInviteLink(base: string, cfg: SyncConfig): string {
  const payload = btoa(JSON.stringify({ u: cfg.url, k: cfg.key, s: cfg.shelf }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${base.split('#')[0]}#join=${payload}`;
}

export function readInvite(hash: string): SyncConfig | null {
  const m = /join=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const obj = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    if (typeof obj.u === 'string' && typeof obj.k === 'string' && typeof obj.s === 'string') {
      return { url: obj.u, key: obj.k, shelf: obj.s };
    }
  } catch {
    // fall through
  }
  return null;
}
