# Ticket: Review Gemini's matches in bulk, with Undo (V7-08)

## Summary
- **Status:** built 23 Nov 2026; awaiting Joe's visual sign-off.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. One sheet and one snapshot-based undo, using functions from V7-07.
- **Depends on:** V7-07.

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 4, "Review matches").

Edit:
- `app/src/screens/packing-match.ts`: add the Review sheet. One row per line that has `matches`: the suggestion, the piece Gemini picked, and a tick (on by default). Footer "Match N". Lines with several picks use the first that is not already matched; the rest stay manual through the Match sheet.
- `app/src/trips.ts`: `matchMany(trip, pairs)` applying `matchLine` for each ticked pair, in one change.
- `app/src/screens/packing-suggest.ts`: enable the banner's Review button.
- `app/src/screens/packing.ts`: the toast "Matched 4 suggestions to your clothes. K suggestions left." with an Undo button, kept for 8 seconds. Undo restores the whole trip from a snapshot taken just before the change; it lives in memory only.
- `app/src/style.css`: `.p-review*` and toast rules (reuse the app's existing toast if there is one).
- `app/tests/trips.test.ts`, `app/e2e/packing.spec.ts`.

Do NOT touch:
- `match.ts` ranking (V7-07), the server, `.w-card`, `deploy/`, `pack/`.

## Scope
**Goal:** Accept everything Gemini matched in one step, and take it back in one step.

- Unticked rows are left as suggestions.
- The banner counts only lines that still have a usable match; once matched or removed, it goes.
- Undo restores the trip exactly as it was, including the suggestions and their order. After the toast goes, there is no undo; unticking and removing still work by hand.
- Sync: the matched trip and the undone trip are both normal saves, so they sync as any edit does.
- Mock-up: the "Review" board and the toast on "Packing, matched".

**Acceptance criteria:**
- Vitest: `matchMany` for all ticked, some unticked, a piece picked by two lines (added once, both suggestions removed) and an empty set (no change).
- e2e: Review, untick one, Match, check the list and the toast count; press Undo and check the trip is back as it was, line for line.
- No toast and no banner when nothing is matched.
- `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. Undo window of 8 seconds. Decided: yes, 8 seconds (23 Nov 2026). The spec's "until you leave the tab" is superseded.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Note (23 Nov 2026)
Built the Review sheet (`Match N`, tick per row), `matchMany`, the enabled Review buttons and the toast with an 8-second in-memory Undo, which also ends on the next edit or trip change. `npm run check` passes (vitest 233, e2e 93); not yet looked at on the phone, so Joe's visual sign-off is open.
