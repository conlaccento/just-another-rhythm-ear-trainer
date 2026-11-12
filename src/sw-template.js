/*
 * Service worker template: `vite.config.ts` fills in the cache name and the file list
 * at build time and emits it as `sw.js`. Not used in development.
 *
 * - Every built file is precached on install, lazy chunks included (metronome,
 *   notation), so both tools work offline after the first visit.
 * - Pages are network-first (with a timeout), so a new deploy shows up on the next
 *   load when online; hashed assets are cache-first.
 */
const CACHE_PREFIX = 'rhythm-trainer-';
const CACHE = CACHE_PREFIX + __BUILD_HASH__;
const PRECACHE = __PRECACHE__;
/** After this, a slow network falls back to the cached page. */
const NETWORK_TIMEOUT_MS = 3000;
const PAGE = new URL('./', self.location.href).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** The app is a single page: every navigation (any query or hash) is index.html. */
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok) await cache.put(PAGE, response.clone());
    return response;
  } catch {
    return (await cache.match(PAGE, { ignoreVary: true })) ?? Response.error();
  }
}

async function asset(request) {
  // ignoreVary: module scripts send an Origin header that the precache requests did not.
  const hit = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  return hit ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
