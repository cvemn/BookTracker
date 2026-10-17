import { describe, expect, it, vi } from 'vitest';

// Capacitor plugins are Proxies that answer every property, `then` included,
// so awaiting one directly never settles. Mimic that.
const store = new Map<string, string>();
const plugin = new Proxy(
  {},
  {
    get: (_, prop) => {
      if (prop === 'get') return async ({ key }: { key: string }) => ({ value: store.get(key) ?? null });
      if (prop === 'set') return async ({ key, value }: { key: string; value: string }) => void store.set(key, value);
      return () => new Promise(() => {});
    },
  },
);

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: plugin }));

describe('vault on Android', () => {
  it('reads the native copy without hanging on the plugin proxy', async () => {
    store.set('k', 'saved');
    const { readNative } = await import('../vault');
    const result = await Promise.race([readNative('k'), new Promise((r) => setTimeout(() => r('hung'), 500))]);
    expect(result).toBe('saved');
  });
});
