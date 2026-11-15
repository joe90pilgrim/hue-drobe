// Small key-value store in IndexedDB, shared by the screens. Data stays on the device.

const DB = 'huedrobe';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
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
