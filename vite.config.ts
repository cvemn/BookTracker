/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works on GitHub Pages (/BookTracker/),
// at a domain root, and inside the Android app.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'jsdom' },
});
