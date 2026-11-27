// Where each person's synced data lives (V2-06b). No dependencies.
// Shape, as approved in docs/decisions/2026-11-16-v2-06-data-model.md:  people/{person}/kv/{key} -> { value, updatedAt }
// Three stores share one interface, so the server and its tests do not care which is used:
//   createMemoryStore()     tests
//   createFileStore(path)   local trials (LOCAL_PERSON); a JSON file in git-ignored deploy/out/
//   createFirestoreStore()  Cloud Run; Firestore's REST API with a token from the metadata server
// Interface:  list(person) -> { [key]: { value, updatedAt } }
//             get(person, key) -> { value, updatedAt } | null
//             put(person, key, value) -> updatedAt (an RFC 3339 time set by the store)
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/** The keys the app syncs. Keep in step with KEYS in app/src/backup.ts. Anything else is refused. */
export const SYNC_KEYS = ['wardrobe', 'outfits', 'favourites', 'colourQuiz', 'outfit', 'colours', 'patterns', 'neckline', 'sheer', 'trips'];

/** The largest value accepted, as JSON. Two people's wardrobes without photos are a few kilobytes. */
export const MAX_VALUE_BYTES = 256 * 1024;

/** An update time that is always later than the last one given out, even within the same millisecond. */
function clock() {
  let last = 0;
  return () => {
    last = Math.max(Date.now(), last + 1);
    return new Date(last).toISOString();
  };
}

export function createMemoryStore() {
  const data = new Map(); // person -> Map(key -> { value, updatedAt })
  const tick = clock();
  const mine = (person) => data.get(person) ?? data.set(person, new Map()).get(person);
  return {
    async list(person) {
      return Object.fromEntries(mine(person));
    },
    async get(person, key) {
      return mine(person).get(key) ?? null;
    },
    async put(person, key, value) {
      const updatedAt = tick();
      mine(person).set(key, { value, updatedAt });
      return updatedAt;
    },
  };
}

export function createFileStore(path) {
  const tick = clock();
  const load = () => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {});
  return {
    async list(person) {
      return load()[person] ?? {};
    },
    async get(person, key) {
      return load()[person]?.[key] ?? null;
    },
    async put(person, key, value) {
      const all = load();
      const updatedAt = tick();
      (all[person] ??= {})[key] = { value, updatedAt };
      writeFileSync(path + '.tmp', JSON.stringify(all));
      renameSync(path + '.tmp', path);
      return updatedAt;
    },
  };
}

const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** An access token for the Cloud Run service account, from the metadata server, kept until a minute before it expires. */
export function metadataToken({ fetch = globalThis.fetch, now = () => Date.now() } = {}) {
  let token = null;
  let expires = 0;
  return async () => {
    if (token && now() < expires - 60_000) return token;
    const res = await fetch(METADATA_TOKEN, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!res.ok) throw new Error(`metadata token: HTTP ${res.status}`);
    const body = await res.json();
    token = body.access_token;
    expires = now() + body.expires_in * 1000;
    return token;
  };
}

/**
 * Firestore through its REST API. `value` is kept as a JSON string, so any value the app stores round-trips exactly
 * without mapping it to Firestore's typed fields. `updatedAt` is Firestore's own commit time.
 */
export function createFirestoreStore({ project, database = '(default)', getToken = metadataToken(), fetch = globalThis.fetch }) {
  if (!project) throw new Error('FIRESTORE_PROJECT is not set');
  const root = `projects/${project}/databases/${database}/documents`;
  const api = 'https://firestore.googleapis.com/v1/';
  const docName = (person, key) => `${root}/people/${person}/kv/${key}`;

  async function call(method, path, body) {
    const res = await fetch(api + path, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok) throw new Error(`Firestore ${method} ${path.split('?')[0]}: HTTP ${res.status}`);
    return res.json();
  }

  const fromDoc = (doc) => ({ value: JSON.parse(doc.fields.value.stringValue), updatedAt: doc.fields.updatedAt.timestampValue });

  return {
    async list(person) {
      const out = {};
      let pageToken = '';
      do {
        const page = await call('GET', `${root}/people/${person}/kv?pageSize=100${pageToken && `&pageToken=${encodeURIComponent(pageToken)}`}`);
        for (const doc of page?.documents ?? []) out[doc.name.split('/').pop()] = fromDoc(doc);
        pageToken = page?.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },
    async get(person, key) {
      const doc = await call('GET', docName(person, key));
      return doc ? fromDoc(doc) : null;
    },
    async put(person, key, value) {
      const result = await call('POST', `${root}:commit`, {
        writes: [
          {
            update: { name: docName(person, key), fields: { value: { stringValue: JSON.stringify(value) } } },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
      });
      return result.writeResults[0].transformResults[0].timestampValue;
    },
  };
}
