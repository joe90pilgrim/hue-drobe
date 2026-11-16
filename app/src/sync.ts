// Sync between devices (V2-06b), in the background. The device copy in IndexedDB is always what the app uses; this
// sends local saves to the server and takes newer copies from it. Last write to reach the server wins, per key.
// Approved design: docs/decisions/2026-11-16-v2-06-data-model.md.
//
// One round: read the server's copy of everything, send every key saved here and not yet sent, then take each server copy
// that is newer than what this device last knew (skipping keys saved here meanwhile). A round runs at start, soon after
// each save, when the browser comes back online and when the app comes back into view. A failed round is tried again next time.
import { SYNCED_KEYS } from './backup';
import { markDirty, markSent, readSyncState, setLocalWriteListener, takeRemote } from './store';

const SEND_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 10_000;

type ServerCopy = { value: unknown; updatedAt: string };

/** What the server holds, or 'off' when this server does not sync (the dev server), or throws when it cannot be reached. */
async function fetchServer(): Promise<Record<string, ServerCopy> | 'off'> {
  const res = await fetch('./api/data', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 404) return 'off';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // A dev server answers unknown paths with the app's own page: no sync there.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) return 'off';
  return ((await res.json()) as { data: Record<string, ServerCopy> }).data ?? {};
}

async function send(key: string, value: unknown, baseUpdatedAt: string | null): Promise<string> {
  const res = await fetch(`./api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ value: value ?? null, baseUpdatedAt }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { updatedAt: string }).updatedAt;
}

/** One round. Resolves true when something here changed because of the server, so the screen can reload its data. */
export async function syncOnce(): Promise<boolean | 'off'> {
  const server = await fetchServer();
  if (server === 'off') return 'off';
  const state = await readSyncState();

  // Data saved before sync existed (or before this device ever synced) and not on the server yet: send it.
  for (const key of SYNCED_KEYS) {
    if (state.values.has(key) && !state.synced.has(key) && !state.dirty.has(key) && !server[key]) {
      await markDirty(key);
    }
  }
  const fresh = await readSyncState();

  for (const [key, sentStamp] of fresh.dirty) {
    if (!SYNCED_KEYS.includes(key)) continue;
    const updatedAt = await send(key, fresh.values.get(key) ?? null, fresh.synced.get(key) ?? null);
    await markSent(key, sentStamp, updatedAt);
  }

  let changed = false;
  for (const key of SYNCED_KEYS) {
    const copy = server[key];
    if (!copy || fresh.dirty.has(key) || fresh.synced.get(key) === copy.updatedAt) continue;
    if (await takeRemote(key, copy.value, copy.updatedAt)) changed = true;
  }
  return changed;
}

/**
 * Starts background sync for the signed-in person. `onRemoteChange` runs when the server's copy changed something here.
 * Returns a function that runs a round now and resolves when it is done; the caller runs the first round.
 */
export function startSync(onRemoteChange: () => void): () => Promise<void> {
  let off = false;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const round = (): Promise<void> => {
    if (off) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          const result = await syncOnce();
          if (result === 'off') off = true;
          else if (result) onRemoteChange();
        } catch {
          /* offline, signed out or the server is busy: the marks stay, and the next round sends them */
        }
      } while (again && !off);
    })().finally(() => {
      running = null;
    });
    return running;
  };
  const soon = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void round(), ms);
  };

  setLocalWriteListener(() => soon(SEND_DELAY_MS));
  window.addEventListener('online', () => soon(0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon(0);
  });
  return round;
}
