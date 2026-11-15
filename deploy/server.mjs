// Small static server for Cloud Run: serves the built app behind HTTP basic auth.
// No dependencies. Settings come from environment variables:
//   BASIC_AUTH_USER      username (default "huedrobe")
//   BASIC_AUTH_PASSWORD  password (required; on Cloud Run it comes from Secret Manager)
//   PUBLIC_DIR           folder to serve (default ./public next to this file)
//   PORT                 port to listen on (Cloud Run sets this; default 8080)
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { timingSafeEqual, createHash } from 'node:crypto';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
};

/** Compares two strings in constant time (hashing first so lengths do not leak). */
function same(a, b) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when the Authorization header carries the right username and password. */
export function authorised(header, user, password) {
  const m = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header ?? '');
  if (!m) return false;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  // Evaluate both so the time taken does not show which one was wrong.
  const userOk = same(decoded.slice(0, i), user);
  const passOk = same(decoded.slice(i + 1), password);
  return userOk && passOk;
}

/** Maps a request path to a file inside root, or null if it would leave root. */
export function resolvePath(root, urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  const full = normalize(join(root, p));
  const base = normalize(root + sep);
  if (full !== normalize(root) && !full.startsWith(base)) return null;
  return full;
}

export function createApp({ user, password, root }) {
  if (!password) throw new Error('BASIC_AUTH_PASSWORD is not set');
  return async function handle(req, res) {
    const send = (code, headers, body) => {
      res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(body);
    };

    // Cloud Run ends HTTPS at its front door and tells us which scheme the visitor used.
    if (req.headers['x-forwarded-proto'] === 'http') {
      return send(301, { Location: `https://${req.headers.host}${req.url}` });
    }

    // Everything is behind the password, including the manifest, icons, service worker and avatar files.
    if (!authorised(req.headers.authorization, user, password)) {
      // A wrong guess waits half a second, which makes guessing the password slow. The browser's first request has no header and is not delayed.
      if (req.headers.authorization) await new Promise((r) => setTimeout(r, 500));
      return send(401, { 'WWW-Authenticate': 'Basic realm="Hue-drobe", charset="UTF-8"', 'Cache-Control': 'no-store' }, 'Password needed');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { Allow: 'GET, HEAD' });

    const urlPath = (req.url ?? '/').split('?')[0];
    let file = resolvePath(root, urlPath);
    if (!file) return send(400, {}, 'Bad request');
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file);
      }
      const ext = extname(file);
      res.writeHead(200, {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': info.size,
        'X-Content-Type-Options': 'nosniff',
        // Private: the avatar is personal. Revalidate so a redeploy shows up; hashed assets are cached by the service worker anyway.
        'Cache-Control': 'private, no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    } catch {
      send(404, {}, 'Not found');
    }
  };
}

// Start listening only when run directly, so the tests can import the functions above.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.env.PUBLIC_DIR ?? fileURLToPath(new URL('./public', import.meta.url));
  const app = createApp({ user: process.env.BASIC_AUTH_USER ?? 'huedrobe', password: process.env.BASIC_AUTH_PASSWORD, root });
  const port = Number(process.env.PORT ?? 8080);
  createServer(app).listen(port, () => console.log(`Serving ${root} on port ${port}`));
}
