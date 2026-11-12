/* global self, caches, fetch, URL, Response */
/**
 * WineLog's service worker: the small program a browser keeps on the phone so
 * the app can start with no signal.
 *
 * It keeps a copy of the app itself (the page, its scripts and its styles),
 * never of anyone's data. Everything under /api/ and /maps/ goes straight to
 * the network exactly as it did before this file existed, so sign-in,
 * permissions and wine data are never answered from a stale copy here.
 *
 * The build fills in SHELL below with the list of files and a version made
 * from their names, which is what makes a new release replace the old copy.
 */
// eslint-disable-next-line no-undef -- the build swaps this word for the real list
const SHELL = __SHELL__;
const SHELL_CACHE = `winelog-shell-${SHELL.version}`;
/** Parts of the app fetched on demand (the big map and evidence files), kept once seen. */
const RUNTIME_CACHE = `winelog-runtime-${SHELL.version}`;
/**
 * The one page every address in the app is. Asked for as "/" on purpose: the
 * host answers "/index.html" with a redirect, and a browser refuses to open a
 * page from a saved answer that was redirected.
 */
const PAGE = '/';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/** What to do with one request. Kept as a plain function so it can be tested. */
function plan(request) {
  if (request.method !== 'GET') return 'network';
  const url = new URL(request.url);
  if (FONT_HOSTS.includes(url.hostname)) return 'cache-first';
  if (url.origin !== self.location.origin) return 'network';
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/maps/')) return 'network';
  if (request.mode === 'navigate') return 'page';
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) return 'cache-first';
  if (url.pathname === '/manifest.webmanifest') return 'cache-first';
  return 'network';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([PAGE, ...SHELL.files]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('winelog-') && name !== SHELL_CACHE && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const saved = await caches.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  // Opaque answers (the fonts) report status 0 and are still worth keeping.
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/** Any address in the app is the same page; with no signal, hand back the saved one. */
async function page(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const saved = await caches.match(PAGE);
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const action = plan(event.request);
  if (action === 'page') event.respondWith(page(event.request));
  else if (action === 'cache-first') event.respondWith(cacheFirst(event.request).catch(() => Response.error()));
});
