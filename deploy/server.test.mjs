// Tests for the IAP-checked static server. Run with: node --test deploy/server.test.mjs (or npm run check in app/).
// Uses a key pair made here to stand in for Google's IAP keys, and synthetic people and emails.
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { IAP_ISSUER, createApp, createKeyStore, parseAllowedUsers, resolvePath, verifyIapJwt } from './server.mjs';

const AUD = '/projects/123/locations/europe-west2/services/huedrobe';
const ALLOWED = parseAllowedUsers(JSON.stringify({ joe: 'Joe@Example.com', b: 'b@example.com' }));
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256' };

const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(claims = {}, { header = {}, key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = enc({ alg: 'ES256', kid: 'k1', typ: 'JWT', ...header });
  const p = enc({ iss: IAP_ISSUER, aud: AUD, iat: now, exp: now + 600, sub: 'accounts.google.com:1', email: 'joe@example.com', ...claims });
  const s = sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${p}.${s}`;
}
const keyFor = (kid) => (kid === 'k1' ? publicKey : undefined);
const check = (t) => verifyIapJwt(t, { keyFor, audience: AUD });

test('verifyIapJwt accepts a good token and lower-cases the email', () => {
  assert.deepEqual(check(jwt({ email: 'JOE@example.com' })), { email: 'joe@example.com', sub: 'accounts.google.com:1' });
});

test('verifyIapJwt rejects bad tokens', () => {
  const now = Math.floor(Date.now() / 1000);
  const good = jwt();
  const [h, p] = good.split('.');
  const cases = {
    missing: undefined,
    garbage: 'not.a.jwt',
    'two parts': `${h}.${p}`,
    'wrong key': jwt({}, { key: other.privateKey }),
    'unknown kid': jwt({}, { header: { kid: 'nope' } }),
    'alg none': `${enc({ alg: 'none', kid: 'k1' })}.${p}.`,
    'alg HS256': jwt({}, { header: { alg: 'HS256' } }),
    'tampered claims': `${h}.${enc({ ...JSON.parse(Buffer.from(p, 'base64url')), email: 'b@example.com' })}.${good.split('.')[2]}`,
    'wrong audience': jwt({ aud: '/projects/999/locations/europe-west2/services/huedrobe' }),
    'audience array': jwt({ aud: [AUD] }),
    'wrong issuer': jwt({ iss: 'https://evil.example' }),
    expired: jwt({ iat: now - 1000, exp: now - 100 }),
    'issued in the future': jwt({ iat: now + 120, exp: now + 600 }),
    'too long lived': jwt({ exp: now + 3600 }),
    'no email': jwt({ email: undefined }),
  };
  for (const [name, t] of Object.entries(cases)) assert.equal(check(t), null, name);
  assert.equal(verifyIapJwt(good, { keyFor, audience: '' }), null, 'no audience configured');
});

test('verifyIapJwt allows 30 seconds of clock skew', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.ok(check(jwt({ iat: now - 620, exp: now - 20 })));
  assert.ok(check(jwt({ iat: now + 20, exp: now + 600 })));
});

test('parseAllowedUsers needs a usable list', () => {
  assert.equal(ALLOWED.get('joe@example.com'), 'joe');
  assert.throws(() => parseAllowedUsers(undefined));
  assert.throws(() => parseAllowedUsers('{}'));
  assert.throws(() => parseAllowedUsers('{"../x":"a@b.c"}'));
  assert.throws(() => parseAllowedUsers('{"joe":"not-an-email"}'));
});

test('the key store fetches once, and again for an unknown key at most once a minute', async () => {
  let calls = 0;
  let t = 0;
  const store = createKeyStore({ fetchJwks: async () => (calls++, { keys: [jwk] }), now: () => t });
  t = 10 * 60_000;
  await store.ensure('k1');
  assert.equal(calls, 1);
  assert.ok(store.keyFor('k1'));
  await store.ensure('k1');
  await store.ensure('unknown');
  assert.equal(calls, 1, 'unknown kid within a minute does not refetch');
  t += 61_000;
  await store.ensure('unknown');
  assert.equal(calls, 2);
  t += 3601_000;
  await store.ensure('k1');
  assert.equal(calls, 3, 'refetches after an hour');
});

test('the key store keeps the old keys if a fetch fails', async () => {
  let t = 10 * 60_000;
  let fail = false;
  const store = createKeyStore({ fetchJwks: async () => { if (fail) throw new Error('down'); return { keys: [jwk] }; }, now: () => t });
  await store.ensure('k1');
  fail = true;
  t += 3601_000;
  const err = console.error;
  console.error = () => {};
  await store.ensure('k1');
  console.error = err;
  assert.ok(store.keyFor('k1'));
});

test('resolvePath stays inside the root', () => {
  const root = join(tmpdir(), 'site');
  assert.equal(resolvePath(root, '/a/b.js'), join(root, 'a', 'b.js'));
  assert.equal(resolvePath(root, '/../secret'), null);
  assert.equal(resolvePath(root, '/%2e%2e/secret'), null);
  assert.equal(resolvePath(root, '/..%2fsecret'), null);
  assert.equal(resolvePath(root, '/a%00b'), null);
  assert.equal(resolvePath(root, '/%E0%A4%A'), null);
});

let dir;
let server;
let base;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'huedrobe-'));
  for (const p of ['joe', 'b']) {
    mkdirSync(join(dir, 'public', 'pack', p), { recursive: true });
    writeFileSync(join(dir, 'public', 'pack', p, 'body.glb'), `glTF-${p}`);
  }
  writeFileSync(join(dir, 'public', 'index.html'), '<h1>hi</h1>');
  writeFileSync(join(dir, 'secret.txt'), 'outside');
  const keys = createKeyStore({ fetchJwks: async () => ({ keys: [jwk] }) });
  server = createServer(createApp({ audience: AUD, allowed: ALLOWED, root: join(dir, 'public'), keys }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' });
const as = (email) => ({ 'X-Goog-IAP-JWT-Assertion': jwt({ email }) });
const joe = as('joe@example.com');
const b = as('b@example.com');

test('no sign-in, a bad token or someone else gets 403 and nothing else, on every path', async () => {
  const headerSets = { none: {}, bad: { 'X-Goog-IAP-JWT-Assertion': 'x.y.z' }, stranger: as('stranger@example.com'), 'wrong key': { 'X-Goog-IAP-JWT-Assertion': jwt({}, { key: other.privateKey }) } };
  for (const [name, headers] of Object.entries(headerSets)) {
    for (const path of ['/', '/index.html', '/pack/joe/body.glb', '/pack/b/body.glb', '/api/me', '/nope']) {
      const res = await get(path, headers);
      assert.equal(res.status, 403, `${name} ${path}`);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(await res.text(), 'Not allowed');
    }
  }
});

test('an allowed person gets the page, their own pack and who they are', async () => {
  const page = await get('/', joe);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(await page.text(), '<h1>hi</h1>');
  const glb = await get('/pack/joe/body.glb?x=1', joe);
  assert.equal(glb.status, 200);
  assert.equal(glb.headers.get('content-type'), 'model/gltf-binary');
  assert.match(glb.headers.get('cache-control'), /private/);
  assert.equal(await glb.text(), 'glTF-joe');
  const me = await get('/api/me', b);
  assert.deepEqual(await me.json(), { person: 'b' });
  assert.equal(me.headers.get('cache-control'), 'no-store');
});

test("each person's pack is hidden from the other", async () => {
  assert.equal((await get('/pack/b/body.glb', joe)).status, 404);
  assert.equal((await get('/pack/joe/body.glb', b)).status, 404);
  assert.equal(await (await get('/pack/b/body.glb', b)).text(), 'glTF-b');
  for (const path of ['/pack/', '/pack', '/pack/joe/../b/body.glb', '/pack/joe/..%2fb/body.glb', '/pack/./b/body.glb']) {
    assert.notEqual((await get(path, joe)).status, 200, path);
  }
});

test('missing files are 404 and the folder cannot be escaped', async () => {
  assert.equal((await get('/missing.js', joe)).status, 404);
  assert.equal((await get('/..%2fsecret.txt', joe)).status, 400);
});

test('only GET and HEAD are allowed, and plain http is sent to https', async () => {
  assert.equal((await fetch(base + '/', { method: 'POST', headers: joe })).status, 405);
  // fetch will not let us set Host, so use a plain request.
  const res = await new Promise((resolve, reject) => {
    request(base + '/pack/joe/body.glb', { headers: { 'X-Forwarded-Proto': 'http', Host: 'example.run.app' } }, resolve).on('error', reject).end();
  });
  assert.equal(res.statusCode, 301);
  assert.equal(res.headers.location, 'https://example.run.app/pack/joe/body.glb');
  res.resume();
});

test('the server refuses to start without an audience or an allow list', () => {
  assert.throws(() => createApp({ audience: '', allowed: ALLOWED, root: dir }));
  assert.throws(() => createApp({ audience: AUD, allowed: new Map(), root: dir }));
  assert.throws(() => createApp({ audience: AUD, allowed: ALLOWED, root: dir, localPerson: 'stranger' }));
});

test('local trial mode acts as the named person only', async () => {
  const local = createServer(createApp({ allowed: ALLOWED, root: join(dir, 'public'), localPerson: 'b' }));
  await new Promise((r) => local.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${local.address().port}`;
  try {
    assert.deepEqual(await (await fetch(url + '/api/me')).json(), { person: 'b' });
    assert.equal((await fetch(url + '/pack/joe/body.glb')).status, 404);
  } finally {
    local.close();
  }
});
