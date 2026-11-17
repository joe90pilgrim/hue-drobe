import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// The avatar pack files the viewer loads (keep in step with PACK_FILES in src/viewer.ts).
const PACK_FILES = ['body', 'tee', 'tee_v', 'tee_scoop', 'trousers', 'shorts', 'tights', 'sweatshirt', 'skirt', 'tee_tucked', 'tee_v_tucked', 'tee_scoop_tucked'];

// Self-hosted heading font files in public/fonts/ (Bricolage Grotesque, SIL OFL 1.1). Public files are not in the bundle, so list them for the precache.
const FONT_FILES = ['bricolage-grotesque-latin-600-normal.woff2', 'bricolage-grotesque-latin-700-normal.woff2'];

// Dev and preview only: who is signed in. The real server reads IAP's header; here it is Joe, or LOCAL_PERSON when set.
const DEV_PERSON = process.env.LOCAL_PERSON ?? 'joe';

// Dev and preview only: serves the private avatar packs at /pack/<person>/, and /api/me. Packs are never copied into a build.
function servePrivatePack(): Plugin {
  const root = fileURLToPath(new URL('../private/pack/', import.meta.url));
  const handler = (req: { url?: string }, res: any, next: () => void) => {
    const url = (req.url ?? '').split('?')[0];
    if (url === '/api/me') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ person: DEV_PERSON }));
    }
    const m = new RegExp(`^/pack/([a-z][a-z0-9-]*)/(${PACK_FILES.join('|')})\\.glb$`).exec(url);
    const file = m && `${root}${m[1]}/${m[2]}.glb`;
    if (!file || !existsSync(file)) return next();
    res.setHeader('Content-Type', 'model/gltf-binary');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'huedrobe-private-pack',
    configureServer: (s) => void s.middlewares.use(handler),
    configurePreviewServer: (s) => void s.middlewares.use(handler),
  };
}

// Writes dist/sw.js with the list of built files to precache, so the app opens offline.
function precacheServiceWorker(): Plugin {
  return {
    name: 'huedrobe-precache-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).map((f) => `./${f}`);
      const extras = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', ...FONT_FILES.map((f) => `./fonts/${f}`)];
      const urls = JSON.stringify([...new Set([...extras, ...files])]);
      const version = Date.now().toString(36);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE = 'huedrobe-${version}';
// The avatar pack lives in its own cache so it survives app updates, and it is only fetched when the avatar loads.
const PACK_CACHE = 'huedrobe-pack';
const PACK_FILES = ${JSON.stringify(PACK_FILES)};
const isGlb = (res) => res.ok && res.headers.get('Content-Type') === 'model/gltf-binary';
const URLS = ${urls};
// Best effort: fetch the signed-in person's pack now, so the first visit works offline too (the page's own first request can beat the service worker).
// A missing pack (a build run without the private files) or no answer from /api/me is skipped, and must not stop the app installing.
async function cachePack() {
  let person;
  try {
    person = (await (await fetch('./api/me', { cache: 'no-store' })).json()).person;
  } catch {}
  if (typeof person !== 'string' || !/^[a-z][a-z0-9-]*$/.test(person)) return;
  const cache = await caches.open(PACK_CACHE);
  await Promise.all(PACK_FILES.map(async (n) => {
    const u = './pack/' + person + '/' + n + '.glb';
    try {
      const res = await fetch(u);
      if (isGlb(res)) await cache.put(u, res);
    } catch {}
  }));
}
self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([caches.open(CACHE).then((c) => c.addAll(URLS)), cachePack()]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PACK_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// How long a page waits for the server before the cached copy is used. A phone in aeroplane mode can leave a request
// hanging rather than failing, so waiting for the failure could take minutes (V2-06 phone check).
const PAGE_WAIT_MS = 2500;
const fallbackPage = async (req) => (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./'));
// Pages: ask the server first (so a new deploy shows up, and an expired sign-in goes to Google). Use the cache when the
// request fails, or when it is slow and a cached copy exists. A slow answer still updates the cache when it arrives.
async function pageFirst(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req).then(async (res) => {
    if (res.ok) await cache.put(req, res.clone());
    return res;
  });
  network.catch(() => {});
  if (!navigator.onLine) return (await fallbackPage(req)) || network.catch(() => Response.error());
  const slow = new Promise((resolve) => setTimeout(resolve, PAGE_WAIT_MS, 'slow'));
  const first = await Promise.race([network, slow]).catch(() => 'failed');
  if (first !== 'slow' && first !== 'failed') return first;
  return (await fallbackPage(req)) || network.catch(() => Response.error());
}
// The pack: the cached copy at once, so the avatar shows offline without waiting, then a fresh copy in the background
// for next time (packs change only when rebuilt). With nothing cached yet, it waits for the server.
async function packCacheFirst(e) {
  const req = e.request;
  const cache = await caches.open(PACK_CACHE);
  const network = fetch(req).then(async (res) => {
    if (isGlb(res)) await cache.put(req, res.clone());
    return res;
  });
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) {
    e.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network.catch(() => Response.error());
}
// Built files have hashed names, so the cached copy is always right.
async function cacheFirst(req) {
  return (await caches.match(req, { ignoreSearch: true })) || fetch(req).catch(() => Response.error());
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Who is signed in is never cached: the page falls back to the person it remembers when this fails.
  if (new URL(req.url).pathname.includes('/api/')) return;
  if (new URL(req.url).pathname.includes('/pack/')) e.respondWith(packCacheFirst(e));
  else if (req.mode === 'navigate') e.respondWith(pageFirst(req));
  else e.respondWith(cacheFirst(req));
});
`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [servePrivatePack(), precacheServiceWorker()],
});
