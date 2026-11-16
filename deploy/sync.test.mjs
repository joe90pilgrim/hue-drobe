// Tests for synced data (V2-06b): the /api/data endpoints and the stores behind them.
// Run with: node --test deploy/sync.test.mjs (or npm run check in app/). Synthetic people and emails, a key pair made here.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { IAP_ISSUER, createApp, createKeyStore, parseAllowedUsers } from './server.mjs';
import { MAX_VALUE_BYTES, createFileStore, createFirestoreStore, createMemoryStore, metadataToken } from './datastore.mjs';

const AUD = '/projects/123/locations/europe-west2/services/huedrobe';
const ALLOWED = parseAllowedUsers(JSON.stringify({ joe: 'joe@example.com', b: 'b@example.com' }));
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256' };
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(email) {
  const now = Math.floor(Date.now() / 1000);
  const h = enc({ alg: 'ES256', kid: 'k1', typ: 'JWT' });
  const p = enc({ iss: IAP_ISSUER, aud: AUD, iat: now, exp: now + 600, sub: 'accounts.google.com:1', email });
  return `${h}.${p}.${sign('sha256', Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
const as = (email) => ({ 'X-Goog-IAP-JWT-Assertion': jwt(email) });
const joe = as('joe@example.com');
const b = as('b@example.com');

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'huedrobe-sync-'));
  mkdirSync(join(dir, 'public'));
  writeFileSync(join(dir, 'public', 'index.html'), 'hi');
});
after(() => rmSync(dir, { recursive: true, force: true }));

/** A server with the given store (in memory by default). */
async function syncServer(store = createMemoryStore()) {
  const keys = createKeyStore({ fetchJwks: async () => ({ keys: [jwk] }) });
  const s = createServer(createApp({ audience: AUD, allowed: ALLOWED, root: join(dir, 'public'), keys, store }));
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${s.address().port}`, store, close: () => s.close() };
}
const putKey = (url, key, body, headers, extra = {}) =>
  fetch(`${url}/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers, ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const readAll = async (url, headers) => (await (await fetch(`${url}/api/data`, { headers })).json()).data;

test('a person writes a key and reads it back, with an update time', async () => {
  const srv = await syncServer();
  try {
    const res = await putKey(srv.url, 'wardrobe', { value: [{ id: 'a' }], baseUpdatedAt: null }, joe);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { updatedAt } = await res.json();
    assert.ok(!Number.isNaN(Date.parse(updatedAt)));
    assert.deepEqual(await readAll(srv.url, joe), { wardrobe: { value: [{ id: 'a' }], updatedAt } });
    // null is a value too: it is how the app says a key was cleared.
    assert.equal((await putKey(srv.url, 'sheer', { value: null, baseUpdatedAt: null }, joe)).status, 200);
    assert.equal((await readAll(srv.url, joe)).sheer.value, null);
  } finally {
    srv.close();
  }
});

test('each person only reads and writes their own data, and the request cannot name someone else', async () => {
  const srv = await syncServer();
  try {
    await putKey(srv.url, 'colours', { value: { tee: '#111111' } }, joe);
    await putKey(srv.url, 'colours', { value: { tee: '#bbbbbb' } }, b);
    assert.equal((await readAll(srv.url, joe)).colours.value.tee, '#111111');
    assert.equal((await readAll(srv.url, b)).colours.value.tee, '#bbbbbb');
    for (const path of ['/api/data/b/colours', '/api/data/..%2fb', '/api/data/people/b/kv/colours', '/api/data/colours/../../b']) {
      const r = await fetch(srv.url + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...joe }, body: '{"value":1}' });
      assert.notEqual(r.status, 200, path);
    }
    // A query string is ignored: the person still comes from the signed header.
    await fetch(srv.url + '/api/data/colours?person=b', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...joe }, body: '{"value":{"tee":"#000000"}}' });
    assert.equal((await readAll(srv.url, b)).colours.value.tee, '#bbbbbb');
    assert.deepEqual(Object.keys(await srv.store.list('b')), ['colours']);
  } finally {
    srv.close();
  }
});

test('no sign-in, a stranger or a bad token gets 403 on the data paths, and nothing is stored', async () => {
  const srv = await syncServer();
  try {
    for (const headers of [{}, as('stranger@example.com'), { 'X-Goog-IAP-JWT-Assertion': 'x.y.z' }]) {
      assert.equal((await fetch(srv.url + '/api/data', { headers })).status, 403);
      assert.equal((await putKey(srv.url, 'wardrobe', { value: [] }, headers)).status, 403);
    }
    assert.deepEqual(await srv.store.list('joe'), {});
  } finally {
    srv.close();
  }
});

test('unknown keys, wrong methods, other sites, non-JSON and oversized values are refused', async () => {
  const srv = await syncServer();
  try {
    assert.equal((await putKey(srv.url, 'nope', { value: 1 }, joe)).status, 404);
    assert.equal((await putKey(srv.url, '__movedTo', { value: 1 }, joe)).status, 404);
    assert.equal((await fetch(srv.url + '/api/data', { method: 'POST', headers: joe })).status, 405);
    assert.equal((await fetch(srv.url + '/api/data/wardrobe', { headers: joe })).status, 405);
    assert.equal((await putKey(srv.url, 'wardrobe', { value: [] }, joe, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await putKey(srv.url, 'wardrobe', { value: [] }, joe, { 'Sec-Fetch-Site': 'same-site' })).status, 403);
    assert.equal((await putKey(srv.url, 'wardrobe', { value: [] }, joe, { 'Sec-Fetch-Site': 'same-origin' })).status, 200);
    assert.equal((await putKey(srv.url, 'wardrobe', { value: [] }, joe, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await putKey(srv.url, 'wardrobe', '{not json', joe)).status, 400);
    assert.equal((await putKey(srv.url, 'wardrobe', { nothing: 1 }, joe)).status, 400);
    assert.equal((await putKey(srv.url, 'wardrobe', { value: 'x'.repeat(MAX_VALUE_BYTES) }, joe)).status, 413);
    assert.equal((await putKey(srv.url, 'wardrobe', 'x'.repeat(MAX_VALUE_BYTES * 2), joe)).status, 413);
    assert.deepEqual((await readAll(srv.url, joe)).wardrobe.value, []);
  } finally {
    srv.close();
  }
});

test('last write wins, and a write based on an old copy is logged as a clash, without the values', async () => {
  const srv = await syncServer();
  const warnings = [];
  const warn = console.warn;
  console.warn = (m) => warnings.push(JSON.parse(m));
  try {
    const first = (await (await putKey(srv.url, 'outfit', { value: { Top: 'tee' }, baseUpdatedAt: null }, joe)).json()).updatedAt;
    // The phone writes on top of what it last saw: no clash.
    const second = (await (await putKey(srv.url, 'outfit', { value: { Top: 'sweatshirt' }, baseUpdatedAt: first }, joe)).json()).updatedAt;
    assert.equal(warnings.length, 0);
    assert.ok(second > first);
    // The laptop still has the first copy: its write wins, and the clash is logged.
    await putKey(srv.url, 'outfit', { value: { Top: 'tee_v' }, baseUpdatedAt: first }, joe);
    assert.equal((await readAll(srv.url, joe)).outfit.value.Top, 'tee_v');
    assert.deepEqual(warnings, [{ severity: 'WARNING', message: 'sync clash', person: 'joe', key: 'outfit', base: first, stored: second }]);
  } finally {
    console.warn = warn;
    srv.close();
  }
});

test('without a store the data paths are 404, so the app keeps data on the device', async () => {
  const keys = createKeyStore({ fetchJwks: async () => ({ keys: [jwk] }) });
  const s = createServer(createApp({ audience: AUD, allowed: ALLOWED, root: join(dir, 'public'), keys }));
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${s.address().port}`;
  try {
    assert.equal((await fetch(url + '/api/data', { headers: joe })).status, 404);
    assert.equal((await putKey(url, 'wardrobe', { value: 1 }, joe)).status, 404);
  } finally {
    s.close();
  }
});

test('a failing store gives 503, not a crash', async () => {
  const down = async () => {
    throw new Error('down');
  };
  const error = console.error;
  console.error = () => {};
  const srv = await syncServer({ list: down, get: down, put: down });
  try {
    assert.equal((await fetch(srv.url + '/api/data', { headers: joe })).status, 503);
    assert.equal((await putKey(srv.url, 'wardrobe', { value: [] }, joe)).status, 503);
  } finally {
    console.error = error;
    srv.close();
  }
});

test('the file store keeps data between restarts, per person', async () => {
  const path = join(dir, 'data.json');
  const one = createFileStore(path);
  const t = await one.put('joe', 'wardrobe', [1]);
  await one.put('b', 'wardrobe', [2]);
  const two = createFileStore(path);
  assert.deepEqual(await two.get('joe', 'wardrobe'), { value: [1], updatedAt: t });
  assert.deepEqual(Object.keys(await two.list('b')), ['wardrobe']);
  assert.equal(await two.get('joe', 'nope'), null);
});

test('the Firestore store makes the right REST calls and reads documents back', async () => {
  const calls = [];
  const doc = (key, value, time) => ({
    name: `projects/p/databases/(default)/documents/people/joe/kv/${key}`,
    fields: { value: { stringValue: JSON.stringify(value) }, updatedAt: { timestampValue: time } },
  });
  const fake = async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body && JSON.parse(init.body) });
    if (url.includes(':commit')) return Response.json({ writeResults: [{ transformResults: [{ timestampValue: '2026-11-16T20:00:00.123456Z' }] }] });
    if (url.includes('/kv?'))
      return url.includes('pageToken')
        ? Response.json({ documents: [doc('outfit', { Top: 'tee' }, 't2')] })
        : Response.json({ documents: [doc('wardrobe', [{ id: 'a' }], 't1')], nextPageToken: 'n 1' });
    if (url.endsWith('/kv/colours')) return Response.json(doc('colours', { tee: '#123456' }, 't3'));
    return new Response('{}', { status: 404 });
  };
  const fs = createFirestoreStore({ project: 'p', getToken: async () => 'tok', fetch: fake });

  assert.equal(await fs.put('joe', 'outfit', { Top: 'tee' }), '2026-11-16T20:00:00.123456Z');
  assert.equal(calls[0].url, 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents:commit');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].auth, 'Bearer tok');
  assert.deepEqual(calls[0].body.writes[0], {
    update: { name: 'projects/p/databases/(default)/documents/people/joe/kv/outfit', fields: { value: { stringValue: '{"Top":"tee"}' } } },
    updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
  });
  assert.deepEqual(await fs.list('joe'), { wardrobe: { value: [{ id: 'a' }], updatedAt: 't1' }, outfit: { value: { Top: 'tee' }, updatedAt: 't2' } });
  assert.match(calls.at(-1).url, /pageToken=n%201$/);
  assert.deepEqual(await fs.get('joe', 'colours'), { value: { tee: '#123456' }, updatedAt: 't3' });
  assert.equal(await fs.get('joe', 'sheer'), null);
  assert.throws(() => createFirestoreStore({ project: '' }));
});

test('the metadata token is asked for with the metadata header and kept until near expiry', async () => {
  let n = 0;
  let clock = 0;
  const fake = async (url, init) => {
    assert.equal(init.headers['Metadata-Flavor'], 'Google');
    n++;
    return Response.json({ access_token: `t${n}`, expires_in: 3600 });
  };
  const token = metadataToken({ fetch: fake, now: () => clock });
  assert.equal(await token(), 't1');
  clock = 3000_000;
  assert.equal(await token(), 't1');
  clock = 3550_000;
  assert.equal(await token(), 't2');
});
