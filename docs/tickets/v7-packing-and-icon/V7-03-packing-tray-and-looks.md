# Ticket: Packing list as a tray of tiles, with planned looks (V7-03)

## Summary
- **Status:** designed 23 Nov 2026.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. List rendering, a flat-lay extraction and e2e updates.
- **Depends on:** V7-02 (same screen file and stylesheet), V3-17 (flat-lay cards, done).

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 2).

Edit:
- `app/src/silhouettes.ts`: export `flatLayOf(look: OutfitLook): string`, the same as the local `flatLay(o, look)` in `screens/wardrobe.ts` (lines 41-51). Test it in `app/tests/silhouettes.test.ts`.
- `app/src/screens/wardrobe.ts`: swap the local `flatLay` for the import. Change nothing else.
- `app/src/screens/packing.ts`: the list part of `detailHtml` and its row helpers: `rowHtml`, `checkRow`, `lookRow`, `goneRow` (lines 85-152). Items become tiles, outfits become planned-look cards, packed things move into a collapsed section.
- `app/src/style.css`: new `.p-tray`, `.p-tile`, `.p-look*` and `.p-packed` rules in the packing block. `.p-look` is used in `packing.ts` line 93 but has no rule today.
- `app/e2e/packing.spec.ts`: update the selectors that break.

Do NOT touch:
- The template rows (`templateRow`), their Edit and Remove buttons and the "Make me a template" flow. V7-06 replaces them. In this ticket they stay as a plain list under their own heading.
- The picker (V7-04), `app/src/trips.ts` data shapes, `.w-card` rules, `deploy/`, `pack/`, `spike/`.

## Scope
**Goal:** The list is a tray of silhouette tiles that shrinks as you pack, and outfits show as the flat-lay cards from the Outfits tab.

- **To pack:** tiles in `grid-template-columns: repeat(auto-fill, minmax(104px, 1fr))`. Each has the item's silhouette (72 x 64), name, type line and a 24 px tick ring top-right. The whole tile is the button; `aria-pressed` and an `aria-label` that says packed or not.
- **Planned looks:** flat-lay cards 140 px wide in a sideways-scrolling row. Name (two lines at most) and "N of M pieces packed". A deleted piece shows the dashed `.o-gap` outline. The cards are not buttons; there is no tick.
- **Packed:** a single 48 px button "Packed N" with a chevron, closed by default. Opens the same tiles, dimmed (opacity 0.75). Whether it is open is kept in memory only.
- A deleted item (`goneRow`) keeps its "Take off" button, styled as a dashed tile.
- Mock-up: the "Packing, phone" board.

**Acceptance criteria:**
- Ticking a tile moves it to Packed and the counts change; unticking moves it back. The state survives a reload and a sync, as today.
- The look cards show the right pieces in the right order and the right "N of M pieces packed".
- A trip with nothing packed shows no Packed button; a trip with nothing to pack shows no To pack heading.
- No horizontal overflow at 412 px.
- Vitest: `flatLayOf` for top plus bottom, dress alone and a deleted piece.
- All `packing.spec.ts` tests pass with updated selectors. `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. Packed section closed by default. Recommendation: yes, so the list shrinks as you pack.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.
