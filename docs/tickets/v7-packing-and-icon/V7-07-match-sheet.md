# Ticket: Match a suggestion to a piece you own (V7-07)

## Summary
- **Status:** designed 23 Nov 2026. Needs Joe's closeness threshold, measured in this ticket.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. Ranking logic with edge cases, measured with numbers.
- **Depends on:** V7-06.

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 4, "Match sheet").

Edit:
- `app/src/match.ts` (new): pure functions. `slotOf(line)` maps a line's `type` (or, failing that, its `group`) to a slot; `rankCandidates(line, items, trip)` returns wardrobe pieces of that slot, with those Gemini listed in `matches` first and the rest ordered by colour distance using `deltaEHex` from `app/src/delta-e.ts`; `isClose(distance)` applies the threshold.
- `app/src/trips.ts`: `matchLine(trip, lineId, itemIds)` removes the suggestion (or, when `quantity` is more than the pieces picked, lowers it by that number) and adds each piece as `{kind:'item', own: true}`; a piece already on the list is not added twice, and the suggestion is still removed. Returns the new trip.
- `app/src/screens/packing-match.ts` (new): the Match sheet. Cases: one piece; the piece is already on the list ("Already on your list", suggestion removed, no duplicate); several needed (pick up to the quantity, the leftover stays as a suggestion); nothing close ("Nothing close in your wardrobe", with "Keep as a suggestion").
- `app/src/screens/packing-suggest.ts`: enable the Match button.
- `app/src/style.css`: `.p-match*` rules.
- `app/tests/match.test.ts` (new), `app/tests/trips.test.ts`, `app/e2e/packing.spec.ts`.
- `spike/tolerances.json`: add `matchCloseDeltaE` only once Joe has agreed the number. Check first how the file is read; if the app does not read it, say so and put the constant in `match.ts` with a comment.

Do NOT touch:
- `app/src/delta-e.ts` (use it as it is), the Review sheet (V7-08), `deploy/`, `pack/`.

## Scope
**Goal:** Tap Match on a suggestion, see your own pieces that fit, and swap the suggestion for one in a tap.

- Closeness is colour distance (CIEDE2000) within the same slot. Pieces Gemini matched are shown first with a "Gemini's pick" tag; the rest are sorted by distance. Say in the code why the order is that way.
- Measure before choosing the threshold: run `rankCandidates` on the demo pairs in the spec (section 5) and report the distances in the ticket note. Propose a number from them; do not guess.
- Undo is not in this ticket; V7-08 adds it for the bulk action. A single match shows a toast "Matched to Blue sweatshirt" and nothing more.
- Mock-up: the "Match" boards (one piece, shirts with several, none).

**Acceptance criteria:**
- Vitest, with fixed items: a slot map for each `type` and `group` the prompt can return; ordering with Gemini's picks first; ordering by distance; `isClose` just under and just over the threshold; `matchLine` for a single piece, a piece already on the list, quantity 2 with one piece (suggestion becomes quantity 1), quantity 2 with two pieces (suggestion removed), nothing picked (no change).
- e2e: match a suggestion on a seeded trip and check the list; match one that is already on the list and check there is no duplicate; open Match with nothing close and see the empty state.
- The reported distances for the demo pairs are in the ticket note.
- `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. The closeness threshold. Recommendation: Claude Code reports the measured distances and proposes a value; you agree it before it is committed.
2. Where tolerances live, if the app cannot read `spike/tolerances.json`. Recommendation: a named constant in `match.ts` until colour tolerances are set up properly.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.
