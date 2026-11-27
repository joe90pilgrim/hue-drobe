import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from '../src/backup';
import { newItem } from '../src/wardrobe';

describe('backup', () => {
  it('round-trips through text and drops unknown keys', () => {
    const item = newItem('tee', '#1f2a5a', 1);
    const b = buildBackup({ wardrobe: [item], favourites: [{ hex: '#aabbcc', fromPalette: true }], colours: { tee: '#1f2a5a' }, junk: 1 });
    expect(parseBackup(JSON.stringify(b))).toEqual({ ok: true, data: b.data });
    expect(Object.keys(b.data)).not.toContain('junk');
    expect(b.data.wardrobe).toEqual([item]);
  });
  it('carries patterns, cleaning them, and a plain item gains no new fields (V9-01)', () => {
    const striped = newItem('tee', '#1f2a5a', 1, 'crew', false, { pattern: 'hstripes', colour: '#ffffff' });
    const plain = newItem('trousers', '#d6d6d6', 2);
    const b = buildBackup({ wardrobe: [striped, plain], patterns: { tee: { pattern: 'hstripes', colour: '#ffffff' }, trainers: { pattern: 'spots', colour: '#000000' } } });
    expect(b.data.wardrobe).toEqual([striped, plain]);
    expect(b.data.patterns).toEqual({ tee: { pattern: 'hstripes', colour: '#ffffff' } });
    expect(Object.keys((b.data.wardrobe as object[])[1])).not.toContain('pattern');
  });
  it('rejects files it does not recognise', () => {
    expect(parseBackup('nope').ok).toBe(false);
    expect(parseBackup('{"format":"other","version":1,"data":{}}').ok).toBe(false);
    expect(parseBackup('{"format":"huedrobe-backup","version":99,"data":{}}').ok).toBe(false);
  });
});
