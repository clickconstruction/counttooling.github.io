/*
 * CountTooling service worker — installable PWA + offline app shell.
 *
 * Strategy (two-tier, same-origin only):
 *   - Navigations / HTML  → network-first (fresh shell when online), cache fallback offline.
 *   - Other static assets → cache-first against a version-stamped precache installed
 *     atomically, so the offline shell is always a coherent single version.
 * Cross-origin (Supabase REST/auth/realtime/storage range-requests/TUS/functions) and
 * all non-GET requests are passed straight through to the network, untouched.
 *
 * CACHE_VERSION below is GENERATED — do not edit by hand. It is a content hash of every
 * file in PRECACHE_URLS, stamped by `npm run build:sw` (and verified by `npm run build:sw
 * -- --check` in CI). Change any precached asset and the hash changes, so the browser
 * installs a fresh SW, precaches the new asset set, and purges the old cache on activate —
 * no manual bump to forget. The app's admin "global force reload" clears caches as a backstop.
 */
const CACHE_VERSION = 'c77275a076c8';
const CACHE_NAME = `counttooling-shell-${CACHE_VERSION}`;

// The full same-origin app shell. Source of truth = the <script>/<link> tags in
// app/index.html, plus the vendored libs/fonts/icons and the manifest. config.local.js is
// intentionally excluded (gitignored / localhost-only — would 404 the install). The app
// lives at /app/ (the marketing site at / is plain static HTML, outside the SW scope).
const PRECACHE_URLS = [
  '/app/',
  '/app/index.html',
  '/config.js',
  '/styles.css',
  '/manifest.webmanifest',
  // head pure-modules (load order)
  '/icons.js',
  '/icons-custom.js',
  '/icon-render.js',
  '/geometry.js',
  '/line-metrics.js',
  '/canvas-draw.js',
  '/constants.js',
  '/idb.js',
  '/format.js',
  '/save-utils.js',
  '/annotation-model.js',
  '/save-engine.js',
  // main app
  '/app.js',
  // feature-file splits (window.App registry)
  '/features/canvas-repair.js',
  '/features/view-only.js',
  '/features/save-project.js',
  '/features/pdf-intake.js',
  '/features/line-color.js',
  '/features/custom-icon-upload.js',
  '/features/note.js',
  '/features/zoom.js',
  '/features/zoom-rail.js',
  '/features/manage-icons.js',
  '/features/multiply-zone-settings.js',
  '/features/export-pdfs.js',
  '/features/legend-settings.js',
  '/features/page-settings.js',
  '/features/counter-settings.js',
  '/features/line-type-settings.js',
  '/features/choose-create-line-type.js',
  '/features/scale.js',
  '/features/groups.js',
  '/features/grid.js',
  '/features/quick-line.js',
  '/features/counter.js',
  '/features/save-status.js',
  '/features/manage-projects.js',
  '/features/user-admin.js',
  '/features/load-project.js',
  '/features/prepare-pdf.js',
  '/features/quick-modals.js',
  '/features/pdf-bundle.js',
  '/features/item-details.js',
  '/features/output.js',
  '/features/share-links.js',
  '/features/import-clear.js',
  '/features/zone-modals.js',
  '/features/restore-last-session.js',
  '/features/summary-detail.js',
  '/features/room-sizer.js',
  '/features/burger-menu.js',
  '/features/canvas-layers.js',
  '/features/my-settings.js',
  '/features/user-activity.js',
  '/report.js',
  // vendored runtime libraries (incl. the lazily-fetched pdf.js worker — required for offline render)
  '/vendor/pdf.min-3.11.174.js',
  '/vendor/pdf.worker.min-3.11.174.js',
  '/vendor/pdf-lib-1.17.1.min.js',
  '/vendor/html2canvas-1.4.1.min.js',
  '/vendor/jspdf.umd-2.5.1.min.js',
  '/vendor/supabase-js-2.108.0.min.js',
  '/vendor/tus-js-client-4.3.1.min.js',
  // self-hosted fonts
  '/vendor/fonts/fonts.css',
  '/vendor/fonts/dmsans-300-normal-latin.woff2',
  '/vendor/fonts/dmsans-300-normal-latin-ext.woff2',
  '/vendor/fonts/dmsans-400-normal-latin.woff2',
  '/vendor/fonts/dmsans-400-normal-latin-ext.woff2',
  '/vendor/fonts/dmsans-500-normal-latin.woff2',
  '/vendor/fonts/dmsans-500-normal-latin-ext.woff2',
  '/vendor/fonts/dmsans-600-normal-latin.woff2',
  '/vendor/fonts/dmsans-600-normal-latin-ext.woff2',
  '/vendor/fonts/dmmono-400-normal-latin.woff2',
  '/vendor/fonts/dmmono-400-normal-latin-ext.woff2',
  '/vendor/fonts/dmmono-500-normal-latin.woff2',
  '/vendor/fonts/dmmono-500-normal-latin-ext.woff2',
  '/vendor/fonts/instrumentserif-400-normal-latin.woff2',
  '/vendor/fonts/instrumentserif-400-normal-latin-ext.woff2',
  '/vendor/fonts/instrumentserif-400-italic-latin.woff2',
  '/vendor/fonts/instrumentserif-400-italic-latin-ext.woff2',
  // PWA icons
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('counttooling-shell-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Non-GET (Supabase writes, TUS PATCH/POST, etc.) → straight to network.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Cross-origin (Supabase REST/auth/realtime/storage range-requests/functions, etc.) → network.
  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  event.respondWith(isHtml ? networkFirst(req) : cacheFirst(req));
});

// Network-first for the entry document: always boot the freshest shell online, fall back
// to the precached HTML offline.
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await withTimeout(fetch(req), 4000);
    if (fresh && fresh.ok) { cache.put(req, fresh.clone()).catch(() => {}); return fresh; }
    if (fresh) return fresh;
    throw new Error('no-response');
  } catch {
    return (await cache.match(req))
      || (await cache.match('/app/index.html'))
      || (await cache.match('/app/'))
      || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Cache-first against the version-stamped precache: guarantees a coherent shell version
// offline; only hits the network for a precache miss.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type === 'basic') cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
