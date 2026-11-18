# Ticket: All garments list with search (V3-13)

## Summary
- **Status:** parked. Start it when any slot has more than 8 garment types. Today none does, so the chip row from V3-11 is enough.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. A new view with search, plus a pure filter function and tests.
- **Depends on:** V3-11

## Target Files
Read first: `docs/decisions/2026-11-18-top-sheet-redesign-spec.md`.

Edit or add:
- `app/src/garment-list.ts` (new): the full-list view with a search field and one 56 px row per type.
- `app/src/screens/try-on.ts`: the "All" button next to the chip row, and opening and closing the list. The `SLOTS` options must still be filtered by what the person's pack contains.
- `app/src/wardrobe.ts`: a pure filter function for the search.
- `app/src/style.css`: list rows, search field.
- `app/tests/wardrobe.test.ts`: tests for the filter.
- `app/e2e/all-garments.spec.ts` (new).

Do NOT touch:
- `app/src/colour-chooser.ts`, `pack/`, `spike/`, `deploy/`, `app/src/store.ts`, `app/src/sync.ts`.
- Garment ids, stored option strings and anything that is saved.

## Scope
**Goal:** Keep the garment row usable once a slot has many types. Past 8 types the chip row shows Nothing plus the first 6 types, and an "All" button (44 × 44, radius 12) opens the full list.

- List: title "All" plus the slot name, Close button, search field (48 high), then one row per type: name, its variants in small grey text (for example "Short, mid or long sleeves"), a tick on the current one. Choosing a row closes the list and selects the type.
- Search filters by name as you type, ignoring case.
- Below the threshold, the "All" button is not shown.
- "Recently used" is not part of this ticket (see decision 1).
- Mock-up: the "Proposed: All garments picker" board. Types after Sweatshirt there are placeholders.

**Acceptance criteria:**
- With 8 or fewer types in a slot, nothing changes. With more, the chip row collapses as described and "All" opens the list.
- Vitest: the filter returns the right types for partial, mixed-case and empty searches.
- Playwright at phone size: open the list, search, pick a type, the sheet shows it selected. Use a test slot with more than 8 types, not real data.
- Every control is at least 44 × 44 px. No horizontal overflow at 360 and 390 px.
- `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. "Recently used" needs new stored data, which changes the data model. Recommendation: leave it out. Use library order for the 6 chips until we decide to store recents.
2. Is 8 the right threshold?

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Parked (18 Nov 2026, Joe)
Version 3 is closed. Kept, not deleted; Joe re-opens it when wanted.
