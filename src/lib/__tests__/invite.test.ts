import { describe, expect, it } from 'vitest';
import { makeInviteLink, readInvite } from '../invite';

describe('invite links', () => {
  it('round-trips the shelf details through the URL hash', () => {
    const cfg = { url: 'https://abc.supabase.co', key: 'eyJ.key+/=', shelf: 'x'.repeat(32) };
    const link = makeInviteLink('https://example.github.io/BookTracker/#old', cfg);
    expect(link.startsWith('https://example.github.io/BookTracker/#join=')).toBe(true);
    expect(link).not.toMatch(/[+/=]$/);
    expect(readInvite(new URL(link).hash)).toEqual(cfg);
  });

  it('ignores junk', () => {
    expect(readInvite('#join=nope!')).toBeNull();
    expect(readInvite('')).toBeNull();
  });
});
