import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// Dev and preview only: serves Joe's private avatar pack at /pack/joe/. It is never copied into a build.
function servePrivatePack(): Plugin {
  const root = fileURLToPath(new URL('../private/pack/joe/', import.meta.url));
  const handler = (req: { url?: string }, res: any, next: () => void) => {
    const m = /^\/pack\/joe\/(body|tee|trousers|sweatshirt)\.glb$/.exec((req.url ?? '').split('?')[0]);
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
const URLS = ${urls};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match('./')))
  );
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
