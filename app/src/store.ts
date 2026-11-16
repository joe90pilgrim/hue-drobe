// Small key-value store in IndexedDB, shared by the screens. Data stays on the device.
// One database per person (V2-06): `huedrobe-joe`, `huedrobe-b`. The owner of a record is the database it lives in.

import { person } from './person';

/** The single database used before V2-06. Its data belongs to Joe and is moved to him on his first start. */
export const LEGACY_DB = 'huedrobe';
export const LEGACY_OWNER = 'joe';
/** Written into the legacy database once its data has been moved, so it is never moved twice. Kept for one version, then removed. */
const MOVED_KEY = '__movedTo';

export const dbName = (who: string) => `huedrobe-${who}`;

function openDb(name = dbName(person())): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const q = db.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => resolve((q.result as T) ?? fallback);
      q.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

export async function kvDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage unavailable */
  }
}

/** Resolves once the write has committed, so a reload straight after will not lose it. */
export async function kvPut(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage unavailable: nothing is remembered */
  }
}

/** Every key and value in a database, as a map. */
function readAll(db: IDBDatabase): Promise<Map<IDBValidKey, unknown>> {
  return new Promise((resolve, reject) => {
    const store = db.transaction('kv').objectStore('kv');
    const keys = store.getAllKeys();
    const values = store.getAll();
    values.onsuccess = () => resolve(new Map(keys.result.map((k, i) => [k, values.result[i]])));
    values.onerror = () => reject(values.error);
  });
}

/**
 * Moves the data saved before V2-06 (one shared database) into Joe's database, the first time Joe starts the app.
 * Only when Joe's database is still empty, so nothing of his is overwritten. Anyone else starting first gets an empty profile,
 * and the old data waits for Joe. The old database is marked, not deleted.
 */
export async function moveLegacyData(who: string): Promise<'moved' | 'nothing'> {
  if (who !== LEGACY_OWNER) return 'nothing';
  try {
    // Do not create the old database on a device that never had one.
    if (indexedDB.databases && !(await indexedDB.databases()).some((d) => d.name === LEGACY_DB)) return 'nothing';
    const legacy = await openDb(LEGACY_DB);
    const old = await readAll(legacy);
    if (old.size === 0 || old.has(MOVED_KEY)) return 'nothing';
    const mine = await openDb(dbName(who));
    if ((await readAll(mine)).size > 0) return 'nothing';
    await new Promise<void>((resolve, reject) => {
      const tx = mine.transaction('kv', 'readwrite');
      for (const [k, v] of old) tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = legacy.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(who, MOVED_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return 'moved';
  } catch {
    return 'nothing';
  }
}
