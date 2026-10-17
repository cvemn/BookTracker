import type { Entry, SyncConfig } from './types';

/**
 * Talks to a Supabase project through two Postgres functions (see
 * supabase/schema.sql). The table itself is locked down; knowing the shelf
 * code is what lets you read and write a shelf.
 */
async function rpc(cfg: SyncConfig, fn: string, body: unknown): Promise<any> {
  const res = await fetch(`${cfg.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sync failed (${res.status}) ${text.slice(0, 200)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function pull(cfg: SyncConfig): Promise<Entry[]> {
  const rows: { data: Entry }[] = await rpc(cfg, 'dogear_pull', { p_shelf: cfg.shelf });
  return (rows ?? []).map((r) => r.data);
}

export async function push(cfg: SyncConfig, entries: Entry[]): Promise<void> {
  for (let i = 0; i < entries.length; i += 200) {
    await rpc(cfg, 'dogear_push', { p_shelf: cfg.shelf, p_entries: entries.slice(i, i + 200) });
  }
}
