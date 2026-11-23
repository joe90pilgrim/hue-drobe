# Ticket: Add items and outfits sheet as tiles (V7-04)

## Summary
- **Status:** built 23 Nov 2026; awaiting Joe's visual sign-off.
- **Note:** Add sheet is now Clothes/Outfits tabs, search, garment chips, a 3-column tile grid (2-column flat-lays for outfits) and a sticky "Done · N on the list" footer; `inOutfitOnly` added with tests.
- **Note:** An "In an outfit" tap sets `own: true` (decision 1 taken as recommended). `npm run check` passes (84 e2e, new 412 px test). The top-right Done from the spec is not built, so there is one Done button.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. One sheet, the same data calls as today.
- **Depends on:** V7-03 (tile styles and silhouettes in the packing block).

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 3).

Edit:
- `app/src/screens/packing.ts`: `openPicker` (lines 192-219), `pick` and `drawPicks`. Tabs Clothes and Outfits, a search box, garment chips, a three-column tile grid and a sticky footer "Done · N on the list".
- `app/src/trips.ts`: a pure `inOutfitOnly(trip, ref)` that says whether an item is on the list only because an outfit holds it. Tests in `app/tests/trips.test.ts`.
- `app/src/style.css`: `.p-pick*` rules in the packing block. Reuse `.p-tile` from V7-03.
- `app/e2e/packing.spec.ts`: update the picker steps.

Do NOT touch:
- The `PackEntry` shape and `addOutfit`, `removeOutfit`, `toggleEntry`. This ticket only calls them.
- `.w-card`, the Gemini code, `deploy/`, `pack/`, `spike/`.

## Scope
**Goal:** Adding to a trip looks like the wardrobe and needs no scrolling through a long list.

- Tabs: Clothes (with a search box and the garment chips used on the Wardrobe tab) and Outfits (flat-lay cards).
- Tiles: 3 columns, silhouette, name. A tile on the list shows a tick and "On the list". A piece that is on the list only because an outfit holds it shows "In an outfit". Tapping it sets `own: true`, so it stays when the outfit is taken off.
- Footer: sticky, full width, "Done · N on the list" (N counts entries). Closing the sheet any other way keeps what was added.
- Search and chips filter live; an empty result says "Nothing matches".
- Mock-up: the "Add items" board.

**Acceptance criteria:**
- Adding and removing from the sheet behaves as the old picker did, for items and outfits.
- Tapping an "In an outfit" tile gives that entry `own: true`; removing the outfit later leaves the item on the list.
- The footer count matches the list.
- The grid has no horizontal overflow at 412 px, and the footer does not cover the last row.
- Vitest: `inOutfitOnly` for an own item, an outfit-only item, and an item both own and in an outfit.
- All `packing.spec.ts` tests pass with updated selectors. `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. A tap on an "In an outfit" tile. Recommendation: it makes the piece its own entry (`own: true`), which is what the app does today when you tick it.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.
