import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// The avatar pack files the viewer loads (keep in step with PACK_FILES in src/viewer.ts).
const PACK_FILES = ['body', 'tee', 'tee_v', 'tee_scoop', 'trousers', 'shorts', 'sweatshirt'];

// Dev and preview only: serves Joe's private avatar pack at /pack/joe/. It is never copied into a build.
function servePrivatePack(): Plugin {
  const root = fileURLToPath(new URL('../private/pack/joe/', import.meta.url));
  const handler = (req: { url?: string }, res: any, next: () => void) => {
    const m = new RegExp(`^/pack/joe/(${PACK_FILES.join('|')})\\.glb$`).exec((req.url ?? '').split('?')[0]);
    const file = m && root + m[1] + '.glb';
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
      const extras = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
      const urls = JSON.stringify([...new Set([...extras, ...files])]);
      const version = Date.now().toString(36);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE = 'huedrobe-${version}';
// The avatar pack lives in its own cache so it survives app updates, and it is only fetched when the avatar loads.
const PACK_CACHE = 'huedrobe-pack';
const PACK = ${JSON.stringify(PACK_FILES.map((n) => `./pack/joe/${n}.glb`))};
const isGlb = (res) => res.ok && res.headers.get('Content-Type') === 'model/gltf-binary';
const URLS = ${urls};
// Best effort: fetch the pack now, so the first visit works offline too (the page's own first request can beat the service worker).
// A missing pack (a build run without Joe's private files) is skipped, and must not stop the app installing.
async function cachePack() {
  const cache = await caches.open(PACK_CACHE);
  await Promise.all(PACK.map(async (u) => {
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
// Pages and the pack: ask the server first (so a new deploy shows up, and the browser can ask for the password), use the cache when offline.
async function networkFirst(req, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (name === PACK_CACHE ? isGlb(res) : res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && (await caches.match('./'))) || Response.error();
  }
}
// Built files have hashed names, so the cached copy is always right.
async function cacheFirst(req) {
  return (await caches.match(req, { ignoreSearch: true })) || fetch(req).catch(() => Response.error());
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.includes('/pack/')) e.respondWith(networkFirst(req, PACK_CACHE));
  else if (req.mode === 'navigate') e.respondWith(networkFirst(req, CACHE));
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
