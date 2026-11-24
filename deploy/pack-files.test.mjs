// V7-09: the pack file lists must not drift apart. Run with: node --test deploy/pack-files.test.mjs (also part of npm run check in app/).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CORE_PACK, KNOWN_PACK, selectPackFiles } from './pack-files.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const deploySrc = read('./deploy.mjs');
const viteSrc = read('../app/vite.config.ts');
const viewerSrc = read('../app/src/viewer.ts');

// The dev server's list, evaluated from its source line.
const viteList = new Function(`return ${/const PACK_FILES = (\[.*\]);/.exec(viteSrc)[1]}`)();
// The viewer's core files are the literals at the start of its PACK_FILES, before the first optional one (shirt_short).
const viewerLiteral = /const PACK_FILES = \[(.*?), 'shirt_short\.glb'/.exec(viewerSrc)[1].split(',').map((s) => s.trim().replace(/'/g, '').replace(/\.glb$/, ''));

test('deploy.mjs has no hand-kept pack list and uses the shared one', () => {
  assert.doesNotMatch(deploySrc, /const PACK = \[/);
  assert.match(deploySrc, /from '\.\/pack-files\.mjs'/);
});

test('the core files match the ones the viewer must have, and the dev server list starts with them', () => {
  assert.deepEqual([...CORE_PACK], viewerLiteral);
  assert.deepEqual(viteList.slice(0, CORE_PACK.length), [...CORE_PACK]);
});

test('every file the dev server serves, the manifest, and every _under_ swap is copied by a deploy', () => {
  const dir = [...viteList.map((n) => `${n}.glb`), 'manifest.json', 'tee_under_blazer_male.glb', 'hair_under_cap.glb'];
  assert.deepEqual(selectPackFiles([...dir, 'notes.txt', 'x.blend', '../evil.glb']).sort(), dir.sort());
});

test('the report list equals the dev server list', () => {
  assert.deepEqual([...KNOWN_PACK], viteList);
});
