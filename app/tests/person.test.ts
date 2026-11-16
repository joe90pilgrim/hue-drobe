import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanPerson, findPerson, person } from '../src/person';

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

describe('findPerson', () => {
  const store = new Map<string, string>();
  const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const answer = (p: string) => () => Promise.resolve(new Response(JSON.stringify({ person: p })));
  const fail = () => Promise.reject(new TypeError('offline'));
  const hang = () => new Promise<Response>(() => {});
  const later = (p: string, ms: number) => () => new Promise<Response>((r) => setTimeout(() => r(new Response(JSON.stringify({ person: p }))), ms));
  const setUp = (fetch: () => Promise<Response>, remembered?: string) => {
    store.clear();
    if (remembered) store.set('huedrobe.person', remembered);
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('fetch', vi.fn(fetch));
  };
  afterEach(() => vi.unstubAllGlobals());

  it("takes the server's answer and remembers it", async () => {
    setUp(answer('b'), 'joe');
    expect(await findPerson(() => {}, 50)).toBe('b');
    expect(store.get('huedrobe.person')).toBe('b');
  });

  it('uses the remembered person when the server cannot be reached', async () => {
    setUp(fail, 'joe');
    expect(await findPerson(() => {}, 50)).toBe('joe');
  });

  it('does not wait for a server that hangs when someone is remembered', async () => {
    setUp(hang, 'joe');
    const t0 = Date.now();
    expect(await findPerson(() => {}, 50)).toBe('joe');
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it('switches when a slow server names someone else, and not when it names the same person', async () => {
    setUp(later('b', 100), 'joe');
    const changed = vi.fn();
    expect(await findPerson(changed, 20)).toBe('joe');
    await new Promise((r) => setTimeout(r, 200));
    expect(changed).toHaveBeenCalledOnce();
    expect(store.get('huedrobe.person')).toBe('b');

    setUp(later('joe', 100), 'joe');
    const same = vi.fn();
    await findPerson(same, 20);
    await new Promise((r) => setTimeout(r, 200));
    expect(same).not.toHaveBeenCalled();
  });

  it('with no one remembered, waits for the server, and gives null when it cannot say', async () => {
    setUp(later('b', 100));
    expect(await findPerson(() => {}, 20)).toBe('b');
    setUp(fail);
    expect(await findPerson(() => {}, 20)).toBeNull();
  });
});
