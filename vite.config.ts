/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Files in `public/`, copied as they are into the build. */
function publicFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path, root) : [relative(root, path).split('\\').join('/')];
  });
}

/**
 * Emits `sw.js` from `src/sw-template.js` with the list of every built file, so the
 * service worker can precache them (lazy chunks included) for offline use.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', ...Object.keys(bundle).filter((f) => !f.endsWith('.map')), ...publicFiles('public')].sort();
      const hash = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('src/sw-template.js', 'utf8')
        .replace('__BUILD_HASH__', JSON.stringify(hash))
        .replace('__PRECACHE__', JSON.stringify(files, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
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
