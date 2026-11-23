# Ticket: T-01 Faster checks, run at the right time

## Summary
- **Status:** done 23 Nov 2026 (branch `chore/T-01-faster-checks`, not pushed). Decisions: option B (placeholder GLBs), real-pack e2e kept as opt-in `npm run check:private`, CLAUDE.md wording approved as written.
- **Note:** `npm run check` went from 249.6 s to 79 to 83 s over three runs in a row, all passing (typecheck 5.3 to 4.0, vitest 8.9 to 7.4, check:assets 2.0 to 1.6, check:deploy 1.2 to 1.0, **e2e 232.2 to 65 s**; tsc now runs once). The 2000 ms wait in `sync.spec.ts` stays: the app exposes no "sync round finished" signal. `workers` stays 2 (3 gave 49 s but hit the flake below, no gain worth the risk) and the timeouts are unchanged.
- **Flake found and fixed (Joe asked, outside the ticket's files):** the `screenshot.spec.ts` paste-then-drop failure was an app race around the sheet's `close` event; fixed in `app/src/screens/wardrobe-photo.ts` (`closeSheet()`). 50 of 50 repeats and three more full checks (80 to 93 s) passed afterwards.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet, high. Test set-up across several files, a Windows-safe Node script, and flaky-test risk.
- **Depends on:** none. Start from an up-to-date `origin/master` (see CLAUDE.md, Git).

## Target Files
Read and edit only these first:
- `CLAUDE.MD` (repo root; the file name is upper case on disk): Testing section, the "must pass before every commit" line, and the "`npm run check` is unchanged until Joe says otherwise" clause under **Joe and B only**
- `app/package.json` (the `check` script)
- `app/scripts/check.mjs` (new)
- `app/playwright.config.ts` (service workers, `webServer` command, workers, timeouts)
- `app/vite.config.ts` (`servePrivatePack()`: where the preview server reads packs from)
- `app/e2e/offline.spec.ts` (the only spec that needs a service worker; it skips without `private/pack/joe/body.glb`)
- `app/e2e/sync.spec.ts` (`waitForTimeout(2000)` near line 91, `waitForTimeout(1500)` near line 107)
- `app/e2e/helpers.ts` (only if a shared helper for the test pack is needed)
- `app/e2e/fixtures/pack/` (new, small synthetic test pack, if Joe approves option A below)
- `app/README.md` (one short section on the check commands)

*Do NOT modify:* `app/src/**`, `deploy/**`, `pack/**`, `spike/**`, `private/**`, `app/scripts/check-assets.mjs`, any other e2e spec except to opt it into service workers or the test pack, and `spike/tolerances.json`.

## Scope

### Goal
Cut the time `npm run check` takes, and run the full check only when it is needed, without losing any coverage that matters.

### Work, in this order
1. **CLAUDE.md, Testing section.** Replace the rule with:
   - While a ticket is in progress, run only the checks for what changed: `npm --prefix app run typecheck`, `npx vitest related <files>`, and the affected Playwright specs (`npx playwright test e2e/<spec>.ts` or `--only-changed`).
   - Run the full `npm run check` once before the ticket's final commit and before any pull request, with nothing else loading the machine.
   - Commits that change only docs need no checks.
   - Reword "`npm run check` ... must pass before every commit" to match, and update the "`npm run check` is unchanged until Joe says otherwise" clause so it does not contradict this ticket. Show Joe the exact wording before moving on.
2. **Baseline timings.** Add `app/scripts/check.mjs`: runs the same five steps in the same order as today (typecheck, Vitest, `check:assets`, `check:deploy`, `test:e2e`), stops at the first failure, and prints each step's duration and the total. It must work in PowerShell and Git Bash (`spawn` with `shell: true`, no bash-only syntax). Point the `check` script at it. Run it once before any other change and record the numbers.
3. **Block service workers by default** in `playwright.config.ts` (`use: { serviceWorkers: 'block', ... }`). In `offline.spec.ts`, opt back in with `test.use({ serviceWorkers: 'allow' })`. Check that no other spec relies on a service worker (`helpers.ts` and `sync.spec.ts` mention it; `sync.spec.ts` already blocks).
4. **Remove the duplicate typecheck:** change the `webServer` command to `vite build && vite preview --port 4199 --strictPort`.
5. **Synthetic test pack** (only after Joe decides; see below). Serve the e2e tests a small synthetic pack instead of `private/pack/joe/`, so the suite no longer depends on private data. Then try `workers` 3 and 4, keeping a value only if three full runs in a row pass, and lower `timeout` and `expect.timeout` if the numbers support it.
6. **Fixed waits in `sync.spec.ts`:** replace `waitForTimeout(1500)` with a wait for the failed sync request (for example `page.waitForResponse` / `waitForRequest` on the sync route). For `waitForTimeout(2000)`, which checks that nothing happens while a panel is open, use a wait for a completed sync round if the app exposes one. If it doesn't, leave it as is and say so in the note; do not add app code for it.
7. **After timings:** run `check.mjs` again and record the per-step numbers next to the baseline.

### Acceptance criteria
- CLAUDE.md has the new Testing rule, and nothing else in the file contradicts it.
- `npm run check` prints per-step and total durations, and fails when a step fails (try it with a deliberate failing test, then remove the test).
- `tsc` runs once per `npm run check`, not twice.
- Every e2e spec passes with service workers blocked by default; `offline.spec.ts` still runs with service workers and still passes.
- `sync.spec.ts` has no `waitForTimeout(1500)`; the 2000 ms wait is either replaced or explained in the note.
- If option A or B below is approved: the e2e suite passes with no `private/` folder present (rename it for one run, then rename it back), and no private file is copied into the repo.
- Three full `npm run check` runs in a row pass on Joe's machine with nothing else loading it.
- The ticket note gives before and after timings per step, from `check.mjs`.

### Decisions needed from Joe
1. **Test pack source** (blocks step 5):
   - A. A small synthetic pack built once by `pack/build_pack.py` from a synthetic body and committed under `app/e2e/fixtures/pack/` (size to report before committing). This is allowed under "synthetic bodies remain only where committed tests need them".
   - B. Placeholder GLBs (a box per garment) made by a short Node script, no Blender. Faster and smaller, but tests no longer load a real body.
   - C. Keep the real private pack for e2e; do only steps 1 to 4, 6 and 7.
2. **Real-pack coverage:** if A or B, should `offline.spec.ts` (or a new opt-in `npm run check:private`) keep running against Joe's real pack?
3. **CLAUDE.md wording:** approve the exact text from step 1 before it is committed.

If a decision isn't made when this ticket starts, do steps 1 to 4, 6 and 7, then stop and ask about step 5.

## Execution Rules
- **Read only the Target Files first.** No broad repo search. If something outside them is needed, ask a subagent and bring back a five-line summary.
- **Run checks in a subagent.** Full `npm run check`, Playwright runs and any `build_pack.py` run go in a subagent with nothing else loading the machine; bring back only the timings, pass/fail counts and any failure messages.
- **Joe and B only:** if a pack build is needed for option A, build only the one synthetic body the tests need. Don't build, render or report on other synthetic bodies.
- **Three strikes:** if a flaky or failing test resists three fixes, stop and ask Joe.
- **Git:** one branch from `origin/master` (`git switch -c chore/T-01-faster-checks origin/master`), small commits, no push or pull request unless Joe asks.
- **Done means stop.** When the acceptance criteria are met, commit, add a two-line note with the timings, and stop. Put other ideas (for example running independent steps in parallel, or checking what is slow in `check:assets`) in `docs/tickets/backlog.md`.
