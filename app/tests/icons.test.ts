import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads width and height from the PNG header (IHDR) of a generated icon.
const size = (file: string) => {
  const b = readFileSync(new URL(`../public/${file}`, import.meta.url));
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('app icons', () => {
  it.each([['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]] as const)('%s is %i px square', (file, n) => {
    expect(size(file)).toEqual([n, n]);
  });
});
