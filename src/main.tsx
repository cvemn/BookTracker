import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { closeTopSheet } from './components/Sheet';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Android app: the hardware back button closes the open sheet first.
import('@capacitor/core').then(async ({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  const { App: NativeApp } = await import('@capacitor/app');
  NativeApp.addListener('backButton', () => {
    if (!closeTopSheet()) NativeApp.minimizeApp();
  });
});

// Installable + offline on the web (Android "Install app", iPhone "Add to Home Screen").
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:' && location.hostname !== 'localhost') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
