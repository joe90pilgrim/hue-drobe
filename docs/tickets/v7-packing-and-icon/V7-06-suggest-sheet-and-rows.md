# Ticket: "Suggest a list" sheet and Suggested rows (V7-06)

## Summary
- **Status:** designed 23 Nov 2026.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. New sheet, a silhouette mode and copy changes.
- **Depends on:** V7-03 (tiles and sections), V7-05 (new fields and the wardrobe request).

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (sections 4 and 6).

Edit:
- `app/src/screens/packing-suggest.ts` (new): the Suggest sheet (what is sent and what stays on the phone, season note, Send button, loading and error states) and the Suggested rows.
- `app/src/screens/packing.ts`: replace the "Make me a template" button and the long privacy paragraph (line ~145, `p-tpl-note`) with a "Suggest a list" button that opens the sheet. Move `templateRow`, `makeTemplate` and the line edit and remove actions out to the new file or keep them thin here. The banner "Gemini matched N suggestions to clothes you own" appears here, driven by `matches`.
- `app/src/silhouettes.ts`: a `'ghost'` mode for `SilhouetteMode`: dashed `#7a7a7a` outline, the suggested colour at 40% opacity. A test in `app/tests/silhouettes.test.ts`.
- `app/src/style.css`: `.p-sug*` rules (dashed row, ghost silhouette).
- `app/e2e/packing.spec.ts`: line 142 asserts `/Sends the trip name and dates to Gemini/`. Rewrite it to the new sheet text (below) and keep the rest of the template test. Add the happy path and the error path through the Suggest sheet.

Do NOT touch:
- The server and the request code (V7-05), the Match sheet (V7-07), `.w-card`, `pack/`, `spike/`.

## Scope
**Goal:** The consent for sending your wardrobe list is asked at the point of action, and Gemini's suggestions look different from things you own.

- Rename in all visible text: "Make me a template" becomes "Suggest a list"; "template lines" becomes "suggestions". Code names may stay.
- Sheet text, exactly:
  - Sent to Gemini: "The trip name and dates, your colour season and palette, and a list of your clothes: names, types and colours."
  - Stays on your phone: "Your photos and measurements. Gemini sees your clothes as names, types and colours, never as pictures."
- Suggested rows: dashed border, ghost silhouette (colour from the line's `colour`, or neutral if missing), label, quantity as "× 2", and a "Match" button (opens V7-07; until then it is disabled). Rows keep Edit and Remove.
- Banner when any line has `matches`: "Gemini matched N suggestions to clothes you own" with a "Review" button (V7-08; disabled until then).
- The error and loading states of V6-01 stay.
- Mock-up: the "Suggest" board and the Suggested part of the "Packing, phone" board.

**Acceptance criteria:**
- The page no longer carries the long privacy paragraph; the sheet does, with the exact text above, and the Send button is the only way to send.
- With a mocked response containing colours and types, rows show ghost silhouettes in those colours; a line with no colour shows a neutral ghost.
- Cancelling the sheet sends nothing (asserted in e2e by counting requests).
- The old tests for edit, remove and replace-the-template still pass.
- Vitest: the `'ghost'` mode returns an SVG with the dashed outline and the colour.
- `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. The button name "Suggest a list" (proposed in the spec). Say if you prefer another.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.
