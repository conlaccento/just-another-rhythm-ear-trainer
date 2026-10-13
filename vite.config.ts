/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the build works under any sub-path (e.g. GitHub Pages).
  base: './',
  build: {
    // The lazily loaded notation chunk is ~730 kB because VexFlow embeds the Bravura
    // music font; the initial chunk stays well below this limit.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
