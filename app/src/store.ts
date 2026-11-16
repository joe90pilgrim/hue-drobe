// Small key-value store in IndexedDB, shared by the screens. The device copy is always the one the app reads and writes;
// V2-06b sends it to the server in the background (src/sync.ts).
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

// Sync bookkeeping (V2-06b) lives beside the data, under reserved keys, so a save and its "not yet sent" mark commit together:
//   __dirty:<key>   set by every local save; a number that changes each time. Cleared once that exact save reaches the server.
//   __synced:<key>  the server's update time for the copy this device last sent or took.
const DIRTY = '__dirty:';
const SYNCED = '__synced:';
let stamp = 0;
const nextStamp = () => (stamp = Math.max(Date.now(), stamp + 1));

let onLocalWrite: (() => void) | undefined;
/** Called after every local save or delete (the sync module uses it to send soon). */
export function setLocalWriteListener(fn: (() => void) | undefined) {
  onLocalWrite = fn;
}

/** Runs one read-write transaction on the signed-in person's store. */
async function write(fn: (kv: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function kvDelete(key: string): Promise<void> {
  try {
    await write((kv) => {
      kv.delete(key);
      kv.put(nextStamp(), DIRTY + key);
    });
    onLocalWrite?.();
  } catch {
    /* storage unavailable */
  }
}

/** Resolves once the write has committed, so a reload straight after will not lose it. */
export async function kvPut(key: string, value: unknown): Promise<void> {
  try {
    await write((kv) => {
      kv.put(value, key);
      kv.put(nextStamp(), DIRTY + key);
    });
    onLocalWrite?.();
  } catch {
    /* storage unavailable: nothing is remembered */
  }
}

export interface SyncState {
  values: Map<string, unknown>;
  /** Keys saved here and not yet sent, with the stamp of the latest save. */
  dirty: Map<string, number>;
  /** The server update time of each key as this device last knew it. */
  synced: Map<string, string>;
}

/** Everything the sync needs, read in one go. */
export async function readSyncState(): Promise<SyncState> {
  const all = await readAll(await openDb());
  const state: SyncState = { values: new Map(), dirty: new Map(), synced: new Map() };
  for (const [k, v] of all) {
    const key = String(k);
    if (key.startsWith(DIRTY)) state.dirty.set(key.slice(DIRTY.length), v as number);
    else if (key.startsWith(SYNCED)) state.synced.set(key.slice(SYNCED.length), v as string);
    else if (!key.startsWith('__')) state.values.set(key, v);
  }
  return state;
}

/** Marks a key as needing to be sent, without changing it (data saved before sync existed). */
export async function markDirty(key: string): Promise<void> {
  await write((kv) => kv.put(nextStamp(), DIRTY + key));
}

/** A save reached the server. Clears the mark only if no newer save happened meanwhile, so that one is still sent. */
export async function markSent(key: string, sentStamp: number, updatedAt: string): Promise<void> {
  await write((kv) => {
    const q = kv.get(DIRTY + key);
    q.onsuccess = () => {
      if (q.result === sentStamp) kv.delete(DIRTY + key);
    };
    kv.put(updatedAt, SYNCED + key);
  });
}

/**
 * Takes the server's copy of a key (null means cleared). Skipped if the key was saved here in the meantime, since that
 * save will be sent and win. Resolves true when the local copy changed.
 */
export async function takeRemote(key: string, value: unknown, updatedAt: string): Promise<boolean> {
  let taken = false;
  await write((kv) => {
    const q = kv.get(DIRTY + key);
    q.onsuccess = () => {
      if (q.result !== undefined) return;
      if (value === null) kv.delete(key);
      else kv.put(value, key);
      kv.put(updatedAt, SYNCED + key);
      taken = true;
    };
  });
  return taken;
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
