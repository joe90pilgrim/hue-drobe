// Writes the app icons (the Hue-drobe colour wheel with a centre dot on a light square) with no dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const hsl = (h) => {
  // Full-saturation hue at 55% lightness, as RGB 0-255.
  const k = (n) => (n + h / 30) % 12, f = (n) => 0.55 - 0.45 * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
function png(size) {
  const bg = [0xf5, 0xf5, 0xf5], white = [255, 255, 255], ink = [0x16, 0x16, 0x16];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2, R = size * 0.3; // the wheel stays inside the maskable safe zone
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const wedge = Math.floor(((Math.atan2(y + 0.5 - c, x + 0.5 - c) * 180) / Math.PI + 360) % 360 / 60) * 60 + 30;
      const px = d < R * 0.12 ? ink : d < R * 0.36 ? white : d < R ? hsl(wedge) : bg;
      raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const s of [192, 512]) {
  writeFileSync(fileURLToPath(new URL(`../public/icon-${s}.png`, import.meta.url)), png(s));
}
