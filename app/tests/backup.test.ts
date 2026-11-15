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
  it('rejects files it does not recognise', () => {
    expect(parseBackup('nope').ok).toBe(false);
    expect(parseBackup('{"format":"other","version":1,"data":{}}').ok).toBe(false);
    expect(parseBackup('{"format":"huedrobe-backup","version":99,"data":{}}').ok).toBe(false);
  });
});
