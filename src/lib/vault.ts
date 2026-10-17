/**
 * Where the shelf is kept on the device. Every save goes to the browser's
 * storage, and in the Android app also to the app's own native storage
 * (which Android backs up with the phone, and which a cleared web cache
 * can't touch). On the web we ask the browser to never evict our data.
 */
type Prefs = { get(o: { key: string }): Promise<{ value: string | null }>; set(o: { key: string; value: string }): Promise<void> };

let prefs: Promise<{ api: Prefs } | null> | null = null;

/**
 * The plugin is boxed because Capacitor plugins answer every property, `then`
 * included, so resolving a promise with one directly never settles.
 */
function nativePrefs(): Promise<{ api: Prefs } | null> {
  prefs ??= import('@capacitor/core')
    .then(async ({ Capacitor }) => (Capacitor.isNativePlatform() ? { api: (await import('@capacitor/preferences')).Preferences as Prefs } : null))
    .catch(() => null);
  return prefs;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function writeDurable(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // full or blocked; the native copy below still lands
  }
  clearTimeout(timer);
  timer = setTimeout(() => void nativePrefs().then((p) => p?.api.set({ key, value })), 250);
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function readNative(key: string): Promise<string | null> {
  const p = await nativePrefs();
  if (!p) return null;
  try {
    return (await p.api.get({ key })).value;
  } catch {
    return null;
  }
}

export function askToKeepData() {
  navigator.storage?.persist?.().catch(() => {});
}
