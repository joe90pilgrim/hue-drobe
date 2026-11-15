// Tests for the basic-auth static server. Run with: node --test deploy/server.test.mjs (or npm run check in app/).
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { authorised, createApp, resolvePath } from './server.mjs';

const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

test('authorised accepts the right pair only', () => {
  assert.equal(authorised(basic('joe', 'pw'), 'joe', 'pw'), true);
  assert.equal(authorised(basic('joe', 'wrong'), 'joe', 'pw'), false);
  assert.equal(authorised(basic('other', 'pw'), 'joe', 'pw'), false);
  assert.equal(authorised(basic('joe', ''), 'joe', 'pw'), false);
  assert.equal(authorised(undefined, 'joe', 'pw'), false);
  assert.equal(authorised('Bearer abc', 'joe', 'pw'), false);
  assert.equal(authorised('Basic !!!', 'joe', 'pw'), false);
  assert.equal(authorised('Basic ' + Buffer.from('nocolon').toString('base64'), 'joe', 'pw'), false);
});

test('authorised allows colons in the password', () => {
  assert.equal(authorised(basic('joe', 'a:b:c'), 'joe', 'a:b:c'), true);
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
  mkdirSync(join(dir, 'public', 'pack', 'joe'), { recursive: true });
  writeFileSync(join(dir, 'public', 'index.html'), '<h1>hi</h1>');
  writeFileSync(join(dir, 'public', 'pack', 'joe', 'body.glb'), 'glTFfake');
  writeFileSync(join(dir, 'secret.txt'), 'outside');
  server = createServer(createApp({ user: 'joe', password: 'pw', root: join(dir, 'public') }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' });
const ok = { Authorization: basic('joe', 'pw') };

test('no password gets 401 with a challenge and no content', async () => {
  for (const path of ['/', '/index.html', '/pack/joe/body.glb', '/nope']) {
    const res = await get(path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get('www-authenticate'), /^Basic /);
    assert.equal(await res.text(), 'Password needed');
  }
});

test('wrong password gets 401, including for the avatar files', async () => {
  const res = await get('/pack/joe/body.glb', { Authorization: basic('joe', 'nope') });
  assert.equal(res.status, 401);
  assert.equal(await res.text(), 'Password needed');
});

test('right password serves the page and the pack with the right types', async () => {
  const page = await get('/', ok);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(await page.text(), '<h1>hi</h1>');
  const glb = await get('/pack/joe/body.glb?x=1', ok);
  assert.equal(glb.status, 200);
  assert.equal(glb.headers.get('content-type'), 'model/gltf-binary');
  assert.match(glb.headers.get('cache-control'), /private/);
});

test('missing files are 404 and the folder cannot be escaped', async () => {
  assert.equal((await get('/missing.js', ok)).status, 404);
  assert.equal((await get('/..%2fsecret.txt', ok)).status, 400);
});

test('only GET and HEAD are allowed, and plain http is sent to https', async () => {
  assert.equal((await fetch(base + '/', { method: 'POST', headers: ok })).status, 405);
  // fetch will not let us set Host, so use a plain request.
  const res = await new Promise((resolve, reject) => {
    request(base + '/pack/joe/body.glb', { headers: { 'X-Forwarded-Proto': 'http', Host: 'example.run.app' } }, resolve).on('error', reject).end();
  });
  assert.equal(res.statusCode, 301);
  assert.equal(res.headers.location, 'https://example.run.app/pack/joe/body.glb');
  res.resume();
});

test('the server refuses to start without a password', () => {
  assert.throws(() => createApp({ user: 'joe', password: '', root: dir }));
});
