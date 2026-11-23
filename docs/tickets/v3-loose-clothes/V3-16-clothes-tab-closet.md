# Ticket: Clothes tab as a closet (V3-16)

## Summary
- **Status:** built 22 Nov 2026. Waits on the Pixel 8 scroll check and Joe's visual sign-off (see the note at the end).
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. One screen, scoped CSS, and e2e layout checks that must change on purpose.
- **Depends on:** V3-15. Run before V3-17 (both edit `screens/wardrobe.ts` and `style.css`).

## Target Files
Read first: `docs/decisions/2026-11-22-wardrobe-closet-redesign-spec.md`.

Edit:
- `app/src/screens/wardrobe.ts`:
  - `GROUPS` (lines 17-22): give each group a storage kind, `rail` (Top, Dress, Bottom, Legs) or `shelf` (later hats and shoes), and put the groups in closet order.
  - `drawGrid` (lines 117-154): the item cards (lines 133-140) and the "All" and per-group layout.
  - `detailHtml` (lines 158-177): the `d-swatch` art for an item becomes its silhouette.
- `app/src/style.css`: new rules for the closet (bay, rail, shelf, card), all scoped under a new class on the Clothes grid. Wardrobe block is lines 290-381, laptop block lines 416-444.
- `app/e2e/wardrobe.spec.ts`: the layout assertions that change on purpose (below).
- `app/src/silhouettes.ts`: use it, do not change it.

Do NOT touch:
- The Outfits tab code (`stacked`, `slice`, `pair`, `legsOf`, the outfit cards): V3-17.
- `app/src/screens/packing.ts` and `app/src/screens/wardrobe-photo.ts`. `packing.ts` shares `.w-card`, `.w-card-text`, `.w-name`, `.w-sub` and `.w-name-input`, so do not restyle those classes globally.
- `.o-empty`, `.wear-swatch`, `.cur-swatch`, `.chip-btn` and `.seg` (shared with other screens).
- `app/src/wardrobe.ts` data, `store.ts`, `sync.ts`, `pack/`, `spike/`, `deploy/`.

## Scope
**Goal:** The Clothes tab looks like a closet. Hanging items hang on a rail, each drawn as its own silhouette in its own colour.

- Keep `button.w-card[data-kind][data-id][aria-pressed]` and the `.on` state. The grid click handler uses `closest('.w-card')`, and the e2e helpers find cards by `.w-card` plus their visible name.
- Keep the name and the sub line text (`item.name`, `itemKind(item)`) exactly as they are. The silhouette is `aria-hidden` and has no text.
- Layout:
  - Each group is a labelled "bay" (group name plus count) with a rail line behind the items. Empty groups are hidden.
  - "All" on a phone: one rail per group that slides sideways, with the next item peeking in.
  - Choosing a chip shows only that group, wrapped into rows of three on a phone, each row with its own rail.
  - 900 px and wider (side panel open): rails wrap rather than slide, with as many items per row as fit.
  - Chips, tabs, the count labels and the side panel and sheet stay as they are.
- The `d-swatch` in the detail panel shows the silhouette for an item.
- Hat and shoe groups are not added here. Support the `shelf` kind in the layout so V5 can use it, but add no data.
- Mock-up: the "Clothes" board of the canvas, interactive (chips filter, tap to select).

**Acceptance criteria:**
- Phone (412 px): no horizontal page overflow (`scrollWidth <= 412`). Each group slides sideways inside its bay only.
- Every item shows its own silhouette and colour; pale colours (white, cream, light grey) are visible on the bay.
- Tap targets are at least 44 × 44 px. Focus ring visible. Selected card shows a clear highlight, and `.w-card.on` still has the 2 px border the spec checks, or the spec is changed to the new highlight with a note.
- Playwright: `wardrobe.spec.ts` keeps its chip, count, selection, panel-width and sheet checks. Update on purpose only these: the "2 columns" phone check (cards in a rail share a row), the "cards in view" count, and the laptop "4 on the first row" check, to match the new layout. Say in the ticket note what each now asserts.
- Opening a card still opens the panel (laptop) or sheet (phone) with Try it on, Rename and Delete working.
- `npm run check` passes.
- Phone check on the Pixel 8: smooth sideways scrolling.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. Group order. Recommendation: Tops, Dresses, Bottoms, Tights now (today's chip order is Top, Bottom, Dress, Legs), with Hats first and Shoes last when they arrive.
2. Sliding rails in "All" on a phone, as in the mock-up, or wrapped rows everywhere? Recommendation: sliding in "All", wrapped when a chip is chosen.
3. OK to change the three layout assertions in `wardrobe.spec.ts` listed above?

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Note (22 Nov 2026)
Built the closet: bays with rails (`rail`/`shelf` storage), sliding rails in All on a phone, rows of three per chip, wrapping rails at 900 px+, silhouettes on cards and in the detail panel. Order Tops, Dresses, Bottoms, Tights. `npm run check` passes (140 unit, 77 e2e). Bay and shelf colours are neutral greys (#ebebeb, #cdcdcd), not the spec's warm tints, because `style.test.ts` allows only neutrals.
E2E changed on purpose: "2 columns" now asserts cards in a rail share a row, the rail overflows sideways and the next group sits below; "cards in view" now needs at least 6 fully in view; laptop "4 on first row" also asserts rails wrap and do not scroll. Not yet done: Pixel 8 scroll check and Joe's visual sign-off.
