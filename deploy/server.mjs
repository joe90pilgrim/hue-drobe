// Small static server for Cloud Run, behind Identity-Aware Proxy (IAP). No dependencies.
// IAP does the Google sign-in in front of the app. This server checks IAP's signed header on every
// request as well, and only lets in the people in ALLOWED_USERS, so it fails closed even if IAP or its
// access list were misconfigured. Each person's avatar pack (public/pack/<person>/) is served to them only.
//
// Settings come from environment variables:
//   IAP_AUDIENCE   /projects/PROJECT_NUMBER/locations/REGION/services/SERVICE (required; deploy.mjs sets it)
//   ALLOWED_USERS  JSON object of person id to Google email, e.g. {"joe":"a@example.com"} (required)
//   PUBLIC_DIR     folder to serve (default ./public next to this file)
//   PORT           port to listen on (Cloud Run sets this; default 8080)
//   LOCAL_PERSON   local trial only: act as this person without IAP. Refused on Cloud Run (K_SERVICE set).
//                  Synced data then goes to data.json next to this file.
//   FIRESTORE_PROJECT  project whose Firestore holds synced data (V2-06b; deploy.mjs sets it). Without it, no sync.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createPublicKey, verify } from 'node:crypto';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_VALUE_BYTES, SYNC_KEYS, createFileStore, createFirestoreStore } from './datastore.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

export const IAP_ISSUER = 'https://cloud.google.com/iap';
export const IAP_KEYS_URL = 'https://www.gstatic.com/iap/verify/public_key-jwk';
const SKEW = 30; // seconds, as Google's guidance says
const MAX_LIFETIME = 600 + 2 * SKEW; // IAP tokens live at most 10 minutes plus skew

const b64url = (s) => Buffer.from(s, 'base64url');

/**
 * Checks an IAP JWT (x-goog-iap-jwt-assertion). Returns { email, sub } or null.
 * keyFor(kid) returns a public KeyObject or undefined.
 */
export function verifyIapJwt(token, { keyFor, audience, now = Date.now() / 1000 }) {
  if (typeof token !== 'string' || !audience) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try {
    header = JSON.parse(b64url(parts[0]).toString('utf8'));
    claims = JSON.parse(b64url(parts[1]).toString('utf8'));
  } catch {
    return null;
  }
  if (header?.alg !== 'ES256' || typeof header.kid !== 'string') return null;
  const key = keyFor(header.kid);
  if (!key) return null;
  const sig = b64url(parts[2]);
  if (sig.length !== 64) return null;
  let ok = false;
  try {
    ok = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key, dsaEncoding: 'ieee-p1363' }, sig);
  } catch {
    return null;
  }
  if (!ok) return null;
  const { iss, aud, exp, iat, email, sub } = claims ?? {};
  if (iss !== IAP_ISSUER || aud !== audience) return null;
  if (typeof exp !== 'number' || typeof iat !== 'number') return null;
  if (exp < now - SKEW || iat > now + SKEW || exp - iat > MAX_LIFETIME) return null;
  if (typeof email !== 'string' || typeof sub !== 'string') return null;
  return { email: email.toLowerCase(), sub };
}

/** Parses ALLOWED_USERS into a Map of lower-case email to person id. Throws if it is not usable. */
export function parseAllowedUsers(json) {
  const obj = JSON.parse(json ?? '');
  const map = new Map();
  for (const [person, email] of Object.entries(obj ?? {})) {
    if (!/^[a-z0-9_-]+$/.test(person) || typeof email !== 'string' || !email.includes('@')) {
      throw new Error(`ALLOWED_USERS has a bad entry for "${person}"`);
    }
    map.set(email.toLowerCase(), person);
  }
  if (map.size === 0) throw new Error('ALLOWED_USERS is empty');
  return map;
}

/** Google's IAP signing keys, fetched once and refetched hourly, or sooner (at most once a minute) for an unknown key id. */
export function createKeyStore({ fetchJwks = defaultFetchJwks, now = () => Date.now() } = {}) {
  let keys = new Map();
  let fetchedAt = 0;
  let pending = null;
  async function refresh() {
    pending ??= (async () => {
      try {
        const jwks = await fetchJwks();
        const next = new Map();
        for (const jwk of jwks.keys ?? []) {
          try {
            next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
          } catch {}
        }
        if (next.size) keys = next;
      } catch (e) {
        console.error(`Could not fetch IAP keys: ${e.message}`);
      } finally {
        fetchedAt = now();
        pending = null;
      }
    })();
    return pending;
  }
  return {
    /** Makes sure a key for this kid is loaded if it can be. */
    async ensure(kid) {
      const age = now() - fetchedAt;
      if (age > 3600_000 || (!keys.has(kid) && age > 60_000)) await refresh();
    },
    keyFor: (kid) => keys.get(kid),
  };
}

async function defaultFetchJwks() {
  const res = await fetch(IAP_KEYS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

/** Reads the key id from a JWT header without trusting it (it is only used to pick a key). */
function kidOf(token) {
  try {
    return JSON.parse(b64url(String(token).split('.')[0]).toString('utf8')).kid;
  } catch {
    return undefined;
  }
}

/** Reads a request body as text, or null once it passes `limit` bytes. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    // Past the limit the rest is read and dropped (not kept), so the 413 answer can still be sent.
    req.on('data', (c) => {
      size += c.length;
      if (size <= limit) chunks.push(c);
    });
    req.on('end', () => resolve(size > limit ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** `store` (deploy/datastore.mjs) holds synced data; without one, /api/data is 404 and the app keeps data on the device only. */
export function createApp({ audience, allowed, root, keys = createKeyStore(), localPerson, store }) {
  if (!localPerson && !audience) throw new Error('IAP_AUDIENCE is not set');
  if (!(allowed instanceof Map) || allowed.size === 0) throw new Error('ALLOWED_USERS is not set');
  if (localPerson && ![...allowed.values()].includes(localPerson)) throw new Error(`LOCAL_PERSON "${localPerson}" is not in ALLOWED_USERS`);

  /** The signed-in person's id, or null. */
  async function personFor(req) {
    if (localPerson) return localPerson;
    const token = req.headers['x-goog-iap-jwt-assertion'];
    if (typeof token !== 'string') return null;
    await keys.ensure(kidOf(token));
    const who = verifyIapJwt(token, { keyFor: keys.keyFor, audience });
    return (who && allowed.get(who.email)) ?? null;
  }

  const json = (send, code, body) => send(code, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(body));

  /** GET /api/data: every synced key. PUT /api/data/{key} with { value, baseUpdatedAt }: writes one key, last write wins. */
  async function handleData(req, urlPath, person, send) {
    if (!store) return send(404, {}, 'Not found');
    // Writes only from the app's own pages. Browsers send this header; a request from another site says so.
    const site = req.headers['sec-fetch-site'];
    if (req.method !== 'GET' && site !== undefined && site !== 'same-origin') return send(403, {}, 'Not allowed');
    try {
      if (urlPath === '/api/data') {
        if (req.method !== 'GET') return send(405, { Allow: 'GET' });
        return json(send, 200, { data: await store.list(person) });
      }
      const key = urlPath.slice('/api/data/'.length);
      if (!SYNC_KEYS.includes(key)) return send(404, {}, 'Not found');
      if (req.method !== 'PUT') return send(405, { Allow: 'PUT' });
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return send(415, {}, 'JSON only');
      const text = await readBody(req, MAX_VALUE_BYTES + 1024);
      if (text === null) return send(413, {}, 'Too large');
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return send(400, {}, 'Bad JSON');
      }
      if (!body || typeof body !== 'object' || !('value' in body)) return send(400, {}, 'No value');
      if (Buffer.byteLength(JSON.stringify(body.value)) > MAX_VALUE_BYTES) return send(413, {}, 'Too large');
      const base = typeof body.baseUpdatedAt === 'string' ? body.baseUpdatedAt : null;
      const stored = await store.get(person, key);
      if (stored && stored.updatedAt !== base) {
        // Someone else's write reached the server since this device last synced this key. Last write wins; logged to see if it matters.
        console.warn(JSON.stringify({ severity: 'WARNING', message: 'sync clash', person, key, base, stored: stored.updatedAt }));
      }
      return json(send, 200, { updatedAt: await store.put(person, key, body.value) });
    } catch (e) {
      console.error(JSON.stringify({ severity: 'ERROR', message: 'sync store failed', person, error: e.message }));
      return send(503, {}, 'Try again later');
    }
  }

  return async function handle(req, res) {
    const send = (code, headers, body) => {
      res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers });
      res.end(body);
    };

    // Cloud Run ends HTTPS at its front door and tells us which scheme the visitor used.
    if (req.headers['x-forwarded-proto'] === 'http') {
      return send(301, { Location: `https://${req.headers.host}${req.url}` });
    }

    // Everything needs a signed-in, allowed person, including the manifest, icons, service worker and avatar files.
    const person = await personFor(req);
    if (!person) return send(403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not allowed');

    const urlPath = (req.url ?? '/').split('?')[0];

    // Synced data (V2-06b). Always the signed-in person's own: the person comes from the checked header, never the request.
    if (urlPath === '/api/data' || urlPath.startsWith('/api/data/')) {
      return handleData(req, urlPath, person, send);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { Allow: 'GET, HEAD' });

    // Who is signed in, for the app (V2-06 uses this to load the right person's data).
    if (urlPath === '/api/me') {
      return send(200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ person }));
    }

    let file = resolvePath(root, urlPath);
    if (!file) return send(400, {}, 'Bad request');

    // Avatar packs are private to their owner. Someone else's pack looks the same as a missing file.
    const packRoot = normalize(join(root, 'pack') + sep);
    if (file.startsWith(packRoot) || file === normalize(join(root, 'pack'))) {
      const owner = file.slice(packRoot.length).split(sep)[0];
      if (owner !== person) return send(404, {}, 'Not found');
    }

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
  const localPerson = process.env.LOCAL_PERSON;
  if (localPerson && process.env.K_SERVICE) {
    console.error('LOCAL_PERSON is for local trials only and is refused on Cloud Run.');
    process.exit(1);
  }
  const app = createApp({
    audience: process.env.IAP_AUDIENCE,
    allowed: parseAllowedUsers(process.env.ALLOWED_USERS),
    root,
    localPerson,
    store: localPerson
      ? createFileStore(fileURLToPath(new URL('./data.json', import.meta.url)))
      : process.env.FIRESTORE_PROJECT
        ? createFirestoreStore({ project: process.env.FIRESTORE_PROJECT })
        : undefined,
  });
  const port = Number(process.env.PORT ?? 8080);
  createServer(app).listen(port, () => console.log(`Serving ${root} on port ${port}${localPerson ? ` as ${localPerson} (local trial, no sign-in)` : ''}`));
}
