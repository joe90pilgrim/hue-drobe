# Ticket: Packing page, trip cards and summary (V7-02)

## Summary
- **Status:** designed 23 Nov 2026.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. A screen change, scoped CSS and several e2e selectors to update.
- **Depends on:** V3-15 (silhouettes, done).

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 2).

Edit:
- `app/src/silhouettes.ts`: export `itemSilhouette(item: SavedItem, mode)`, the same as the local `silhouetteOf` in `screens/wardrobe.ts` (lines 32-33). Add a test in `app/tests/silhouettes.test.ts`.
- `app/src/screens/wardrobe.ts`: replace the local `silhouetteOf` with the import. Change nothing else there.
- `app/src/screens/packing.ts`:
  - Trip cards in `draw()` (lines 154-171): name, dates, up to four silhouette circles, a progress bar and "N of M packed" (or "Nothing added yet").
  - The summary card in `detailHtml` (lines 130-152): name, dates, Edit trip, progress, and the two buttons. The "Make me a template" button and its note stay as they are until V7-06.
  - Delete trip moves into the Edit trip form (`openForm`, lines 221-240; `askDelete`, lines 284-294).
- `app/src/trips.ts`: a pure `peekItems(trip, items): SavedItem[]` (the first four item entries that still exist). Tests in `app/tests/trips.test.ts`.
- `app/src/style.css`: new `.p-trip*` and `.p-summary` rules in the packing block (lines 402-433) and in the laptop block (lines 436-447).
- `app/e2e/packing.spec.ts`: update the selectors that break.

Do NOT touch:
- `.w-card`, `.w-card-text`, `.w-name`, `.w-sub` and `.w-name-input` rules. The trip cards stop using `.w-card`; Wardrobe still does.
- The To pack list, planned looks and the picker (V7-03, V7-04), the Gemini code, `deploy/`, `pack/`, `spike/`.

## Scope
**Goal:** The Packing page stops looking stretched. Trips are cards that show progress and a peek at what is in them, and the trip detail is one summary card.

- Trip card: name (16 px bold), dates, up to four overlapping silhouette circles (34 px, silhouettes 22 px), a 6 px progress bar, the text. Selected card: 2 px `#111` border; others 1 px `#e3e3e3`. A small ring in the corner is decoration (decision 2).
- Summary card replaces the repeated name, dates and count. Buttons at least 48 px tall, wrapping on narrow screens.
- Laptop: the page is at most 1100 px wide and centred. Trip cards form a left column (`max-width: 360px`) and the trip fills the rest. On a phone the cards sit above the trip.
- Mock-up: the "Packing, phone" and "Packing, laptop" boards.

**Acceptance criteria:**
- Each trip card shows the right silhouettes in the right colours; a trip with no clothes shows "Nothing added yet" and no circles.
- No horizontal overflow at 412 px. At 1280 px the content is at most 1100 px wide.
- Edit trip opens the form with a Delete trip button at the bottom. It opens the existing confirm dialog, and deleting still works. The old Delete trip button is gone.
- Vitest: `peekItems` for no items, fewer than four, more than four, and a deleted item.
- All seven `packing.spec.ts` tests pass with updated selectors. No assertion about behaviour is weakened.
- `npm run check` passes.
- Joe's visual sign-off, phone and laptop.

**Decisions needed from Joe:**
1. Delete trip. Recommendation: inside Edit trip, as a text button at the bottom, because it is destructive and should not sit beside the main actions.
2. The ring in the corner of each trip card (the mock-up's luggage-tag hole). Recommendation: keep it; it costs nothing. Say if you want it gone.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Note (23 Nov 2026)
Done: trip cards with silhouette peek, progress bar and corner ring; one summary card; Delete trip moved into Edit trip; laptop two-column layout (max 1100 px). Joe chose both recommendations. `npm run check` passes (83 e2e); awaiting Joe's phone and laptop sign-off.
