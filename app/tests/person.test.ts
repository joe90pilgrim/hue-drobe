import { describe, expect, it } from 'vitest';
import { cleanPerson, person } from '../src/person';

describe('cleanPerson', () => {
  it('accepts the ids the server sends', () => {
    expect(cleanPerson('joe')).toBe('joe');
    expect(cleanPerson('b')).toBe('b');
  });
  it('refuses anything that could escape a database name or a URL path', () => {
    for (const bad of ['', 'Joe', '../joe', 'joe/b', 'b%2f', ' joe', '1joe', 'a'.repeat(33), null, undefined, 7, {}]) {
      expect(cleanPerson(bad)).toBeNull();
    }
  });
});

describe('person', () => {
  it('throws before anyone is signed in, so nothing is stored without an owner', () => {
    expect(() => person()).toThrow();
  });
});
