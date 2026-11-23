// Writes the placeholder avatar pack the e2e tests use (T-01): one coloured box per pack file, no Blender, no private data.
//   node scripts/make-test-pack.mjs
// Output: e2e/fixtures/pack/<person>/<name>.glb, committed. The boxes are only big enough to give the viewer something to
// load and draw; the tests check the app's behaviour, not the fit. The real pack is checked by `npm run check:private`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Each person's pack has the same files as the real one: Joe's has no skirt, dress or tucked tees (skirt.spec.ts relies on that).
const WOMANS_ONLY = ['skirt', 'dress', 'body_dress', 'tee_tucked', 'tee_v_tucked', 'tee_scoop_tucked'];
const PEOPLE = { joe: (name) => !WOMANS_ONLY.includes(name), b: () => true };
// name -> [width, height, centre height] in metres. Keep the names in step with PACK_FILES in src/viewer.ts.
const PARTS = {
  body: [0.4, 1.7, 0.85],
  body_dress: [0.4, 1.7, 0.85],
  tee: [0.46, 0.6, 1.3],
  tee_v: [0.46, 0.6, 1.3],
  tee_scoop: [0.46, 0.6, 1.3],
  tee_tucked: [0.46, 0.6, 1.3],
  tee_v_tucked: [0.46, 0.6, 1.3],
  tee_scoop_tucked: [0.46, 0.6, 1.3],
  sweatshirt: [0.5, 0.65, 1.3],
  shirt_short: [0.46, 0.65, 1.3],
  shirt_mid: [0.46, 0.65, 1.3],
  shirt_long: [0.46, 0.65, 1.3],
  dress: [0.46, 1.1, 1.0],
  trousers: [0.42, 0.95, 0.55],
  shorts: [0.42, 0.45, 0.75],
  tights: [0.4, 0.95, 0.55],
  skirt: [0.5, 0.5, 0.8],
  sweatshirt_over_tee: [0.5, 0.65, 1.3],
  shirt_short_over_tee: [0.46, 0.65, 1.3],
  shirt_mid_over_tee: [0.46, 0.65, 1.3],
  shirt_long_over_tee: [0.46, 0.65, 1.3],
};

/** A binary glTF holding one box (24 vertices, 12 triangles) with a plain grey material, which the app repaints. */
function boxGlb(width, height, centreY) {
  const hx = width / 2;
  const hy = height / 2;
  const hz = 0.12;
  const faces = [
    [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
    [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
  ];
  const pos = [];
  const nor = [];
  const idx = [];
  faces.forEach(([n, corners], f) => {
    for (const c of corners) {
      pos.push(c[0], c[1] + centreY, c[2]);
      nor.push(...n);
    }
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const posBuf = Buffer.from(new Float32Array(pos).buffer);
  const norBuf = Buffer.from(new Float32Array(nor).buffer);
  const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
  const bin = Buffer.concat([posBuf, norBuf, idxBuf]);
  const min = [-hx, -hy + centreY, -hz];
  const max = [hx, hy + centreY, hz];
  const json = {
    asset: { version: '2.0', generator: 'huedrobe make-test-pack' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.6, 0.6, 0.6, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length },
      { buffer: 0, byteOffset: posBuf.length, byteLength: norBuf.length },
      { buffer: 0, byteOffset: posBuf.length + norBuf.length, byteLength: idxBuf.length },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json));
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPad.length, 8);
  const chunk = (len, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(len, 0);
    h.write(type, 4, 'ascii');
    return h;
  };
  return Buffer.concat([header, chunk(jsonBuf.length, 'JSON'), jsonBuf, chunk(binPad.length, 'BIN\0'), binPad]);
}

const root = fileURLToPath(new URL('../e2e/fixtures/pack/', import.meta.url));
let total = 0;
let count = 0;
for (const [person, has] of Object.entries(PEOPLE)) {
  const dir = `${root}${person}/`;
  mkdirSync(dir, { recursive: true });
  for (const [name, [w, h, y]] of Object.entries(PARTS).filter(([n]) => has(n))) {
    const glb = boxGlb(w, h, y);
    writeFileSync(`${dir}${name}.glb`, glb);
    total += glb.length;
    count++;
  }
}
console.log(`wrote ${count} files, ${(total / 1024).toFixed(0)} KB, to ${root}`);
