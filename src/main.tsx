import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { hydrate } from './lib/store';
import { closeTopSheet } from './components/Sheet';
import './styles.css';

// Restore from the phone's native storage first (Android app), then draw.
// Never wait on it for long: a stuck read must not leave a blank screen.
Promise.race([hydrate(), new Promise((r) => setTimeout(r, 2500))]).finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

// Android app: the hardware back button closes the open sheet first.
import('@capacitor/core').then(async ({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  const { App: NativeApp } = await import('@capacitor/app');
  NativeApp.addListener('backButton', () => {
    if (!closeTopSheet()) NativeApp.minimizeApp();
  });
});

// Fix up books that are missing their page count, cover or blurb, once the
// hello animation is out of the way, and again whenever the phone gets online.
import('./lib/enrich').then(({ enrichShelf }) => {
  setTimeout(() => void enrichShelf(), 4000);
  window.addEventListener('online', () => void enrichShelf());
});

// Installable + offline on the web (Android "Install app", iPhone "Add to Home Screen").
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:' && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => keepUpToDate(reg))
      .catch(() => {});
  });
}

/**
 * Updates arrive on their own. An installed app can sit open in the
 * background for days without reloading, so check for a new version whenever
 * it comes back to the front (and every hour while open). When one lands, it
 * swaps in while the app is in the background or as she comes back to it,
 * never while she's in the middle of something. Her books live in the phone's
 * storage, not in the app files, so they carry straight over.
 */
function keepUpToDate(reg: ServiceWorkerRegistration) {
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false;
  const swap = () => {
    if (!pending) return;
    pending = false;
    location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install isn't an update: nothing to swap.
    if (!hadController) return;
    pending = true;
    if (document.visibilityState === 'hidden') swap();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') return swap();
    // Back in front: if an update was waiting, the "welcome back" covers the swap.
    if (pending) return swap();
    reg.update().catch(() => {});
  });
  setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
}
