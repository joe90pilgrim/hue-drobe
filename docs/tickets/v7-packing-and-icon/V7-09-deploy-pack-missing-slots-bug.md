# Ticket: Bug: deployed app shows only Top, Bottom and Legs (V7-09)

## Summary

- **Status:** Done, not deployed (24 Nov 2026).
- **Ceiling:** 90 minutes.
- **Worker:** Sonnet · Medium.


## Target Files

Read these first and nothing else until you need to:

- `deploy/deploy.mjs` (line 35 `PACK` array; file check at lines 36-42; copy at lines 57-60)
- `app/src/viewer.ts` (line 10 `PACK_FILES`; core versus optional files; `SHOE_MESHES` and `HAT_MESHES` imports)
- `app/vite.config.ts` (line 6 `PACK_FILES`; dev server regex at lines 16-40; service-worker `cachePack` at lines 64-89)
- `app/src/wardrobe.ts` (`SHOE_MESHES`, `HAT_MESHES`, `parseUnderFiles`)
- `deploy/server.mjs` lines 315-320 (read only, to confirm it serves whatever is in `public/pack/<person>/`)
- `deploy/server.test.mjs` and `app/scripts/check-assets.mjs` (where a drift test could live)
- `deploy/README.md` (lines 6 and 122)

Do NOT touch:

- `pack/` and `pack/templates/` (the pack build is fine; dev already shows everything)
- `private/` contents (never commit; read only to see which files exist)
- `deploy/server.mjs` behaviour (it has no file filter and needs none)
- Garment rules in `app/src/wardrobe.ts` (only read the mesh lists)

## Scope

**Goal.** The deployed app, signed in with Google, shows every slot and garment that `npm --prefix app run dev:joe` shows (dress, shirts, shoes, hats, hair, tucked tees, and the layered `_under_` swaps).

**What the scout found (verify first, do not assume).** `deploy/deploy.mjs` copies a hard-coded list of 8 GLBs (`body, tee, tee_v, tee_scoop, trousers, shorts, tights, sweatshirt`) into `out/public/pack/<person>/` and does not copy `manifest.json`. The viewer treats everything beyond those 8 as optional and skips missing files without an error, and try-on hides any slot whose mesh is not loaded (`viewer.has()`). That matches the symptom exactly. The dev server uses its own, longer list in `vite.config.ts`, which is why dev works. The `deploy.mjs` comment says to keep the lists in step, but it was never updated.

**Acceptance criteria.**

1. Confirm the cause before changing code: show the file listing of `deploy/out/public/pack/joe/` and `.../b/`, and the list of files in `private/pack/joe/` and `private/pack/b/`. Say which files are in the second but not the first.
2. `deploy.mjs` copies every pack file the app can use, including `manifest.json` and the `_under_` files it names, for each person. Prefer one source of truth (a shared list module or copying the whole pack folder by pattern) over a fourth hand-kept list. If you share a list across `viewer.ts`, `vite.config.ts` and `deploy.mjs`, keep the change small.
3. `deploy.mjs` still aborts if a core file is missing, and now prints which optional files were included and which were absent.
4. A test fails when the three lists drift apart (a Vitest or Node test comparing `deploy.mjs`, `viewer.ts` and `vite.config.ts`). Show it failing against the old `deploy.mjs` and passing after.
5. Build the deploy output locally and show the new file list and total size per person. Report the size against the 15 MB limit (Joe 9.7 MB and B 14.6 MB were measured for the blazer packs; the deployed pack must not exceed it).
6. Deploy only if Joe asks. If he does, check on the live site, signed in as Joe, that the Dress, Shoes, Hat and Hair rows appear, and look at the network tab for any 404 on `pack/<person>/*.glb` or `manifest.json`. Report what you saw, with a screenshot.
7. Note in the ticket that a returning user may have a stale service-worker pack cache (`huedrobe-pack`). Say whether the fix needs a cache-version bump, and make it if so.
8. Full `npm run check` passes once before the final commit, with nothing else loading the machine. Docs-only commits need no checks.

**Decisions needed from Joe.**

1. Share one file list across the app, dev server and deploy (cleaner, touches `viewer.ts` and `vite.config.ts`), or only fix `deploy.mjs` and add the drift test (smaller). Default: share one list if it can be done in a small change, otherwise fix `deploy.mjs` and add the test.
2. Whether to deploy at the end of this ticket, or leave deploying to you.

## Execution Rules

- Read only the Target Files first, then only what a failing check points you to.
- Run Vitest, Playwright and any pack or deploy builds in a subagent and bring back only results and paths.
- Joe and B only; no synthetic bodies in builds.
- Follow the Git rules in CLAUDE.md: `git fetch origin`, confirm `master...origin/master` is 0 0, branch from `origin/master`, never push, open a pull request or deploy unless Joe asks.
- Note the start time. At the ceiling, or after three failed fixes, stop and ask Joe.
- Done means stop: when the acceptance criteria are met, commit, add a two-line note to this ticket, and put any ideas in `docs/tickets/backlog.md`.
- Add this ticket to the V7 table in `docs/tickets/README.md`.

## Note

Cause confirmed: `deploy/out/public/pack/{joe,b}/` held only the 8 hard-coded GLBs and no `manifest.json`. `deploy.mjs` now copies every `.glb` and `manifest.json` by pattern (`deploy/pack-files.mjs`), still aborts on a missing core file, and prints included and absent optional files; `pack-files.test.mjs` failed before the change and passes (4 tests). Staged: Joe 29 files 9.3 MB, B 41 files 14.0 MB (under 15 MB). No service-worker cache bump needed: it only caches OK GLB and JSON responses, so the old 404s were never stored. Deploy left to Joe.
