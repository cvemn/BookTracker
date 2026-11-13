/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * Publish the service worker with a version made from the build's own files,
 * so each release is a byte-different sw.js and installed apps pick it up.
 */
function serviceWorker(): Plugin {
  return {
    name: 'dogear-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) hash.update(name);
      const version = hash.digest('hex').slice(0, 12);
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8').replace('__DOGEAR_BUILD__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Relative base so the same build works on GitHub Pages (/BookTracker/),
// at a domain root, and inside the Android app.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: {
    rollupOptions: { input: { main: 'index.html', get: 'get.html' } },
  },
  test: { environment: 'jsdom' },
});
