# V2-06b Sync between devices

**Ceiling:** 3 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. A small backend; mistakes could show one person's data to the other.
**Depends on:** V2-06

## Goal
Each person's data follows them between the phone and the laptop.

## Scope
Build the Firestore part of `docs/decisions/2026-11-16-v2-06-data-model.md`, as approved:
- Firestore database `people/{person}/kv/{key}` with `value` and `updatedAt`; security rules deny all.
- `GET /api/data` and `PUT /api/data/{key}` on the Cloud Run server, person from IAP's header only, known keys only, 256 KB limit. REST API with a metadata-server token, no new dependency.
- Outbox in IndexedDB, sent in the background; pull on start; last write wins per key; clashes logged on the server.
- `deploy.mjs`: Firestore API, database, rules, `roles/datastore.user` for the service account.
- Update the blueprint and `CLAUDE.md` ("IndexedDB synced through our own server", "a small backend on Cloud Run").

## Acceptance criteria
- A change on one device shows on the other after a reload.
- A change made offline is sent once back online.
- One person can never read or write the other's data (server tests with forged and swapped people).
- The app still works fully offline.
