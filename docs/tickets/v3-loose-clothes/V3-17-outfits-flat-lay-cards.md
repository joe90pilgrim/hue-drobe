# Ticket: Outfits tab flat-lay cards (V3-17)

## Summary
- **Status:** done. Joe signed off the look on 23 Nov 2026.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. Layout maths for the stack, a screen change, and one e2e check to rewrite.
- **Depends on:** V3-15, V3-16 (same screen file and stylesheet).

## Target Files
Read first: `docs/decisions/2026-11-22-wardrobe-closet-redesign-spec.md`.

Edit:
- `app/src/silhouettes.ts`: add a flat-lay composer that takes the pieces of an outfit (hat, top, bottom, legs, dress, shoes if present) and returns one SVG, stacked head to toe and centred. Optionally accept an `under` piece (see decision 2) but nothing stores one yet.
- `app/src/screens/wardrobe.ts`:
  - Replace `slice`, `stacked`, `legsOf` and `pair` (lines 27-39) and their uses in the Outfits cards (lines 144-152) and the `d-swatch.o-tile` art in `detailHtml` (lines 158-177).
  - `piecesOf` (lines 95-103) stays for the text; change only what decision 1 says.
- `app/src/style.css`: replace the `.o-tile`, `.o-stack`, `.o-slice` block (lines 342-362 and 438-440) with the flat-lay card.
- `app/tests/silhouettes.test.ts`: tests for the composer.
- `app/e2e/outfits.spec.ts`: line 78 counts `.w-card .o-slice.top.o-empty`. Rewrite it for the new missing-piece marker.

Do NOT touch:
- `.o-empty` as used by `.wear-swatch` and `.cur-swatch` (Try on screen, CSS lines 80, 120 and 443), and `.w-card` rules shared with `packing.ts`.
- `app/src/outfits.ts` data shape, `app/src/screens/try-on.ts`, backup and sync code (see decision 2).
- The Clothes tab (V3-16), `pack/`, `spike/`, `deploy/`.

## Scope
**Goal:** An outfit card shows the outfit as a flat-lay of the same silhouettes, so hats, shoes and layers will read without changing the card.

- Stack order head to toe: hat, top, bottom, shoes. A dress is one tall shape. Tights show as legs under a short bottom (shorts, skirt). Everything centred, with a small gap.
- Keep the card contract: `button.w-card[data-kind=outfit][data-id][aria-pressed]`, the name, and the sub line text. The SVG is `aria-hidden` with no text.
- A piece that was deleted shows as a dashed empty outline in its place (as the `o-empty` slice does today), with a countable class so the e2e check can find it.
- The detail panel and sheet art uses the same flat-lay, larger.
- Keep the 2-column phone grid. Keep the card no taller than it needs to be: the mock-up used a 120:190 stage, so check the number of cards in view on a 412 px phone and tell Joe if it is too tall.
- Mock-up: the "Outfits" board of the canvas.

**Acceptance criteria:**
- Each outfit in the e2e fixtures shows the right silhouettes in the right colours, in order, and nothing overflows its card.
- Missing pieces show the dashed outline; the rewritten check in `outfits.spec.ts` passes. `outfits.spec.ts` line 77, the "top deleted, Light grey trousers" text check, still passes.
- Vitest: the composer's order and centring for top plus bottom, dress alone, bottom plus tights, and a missing piece.
- No horizontal overflow at 412 px. Cards open the panel or sheet, with Try it on, Rename and Delete working.
- `npm run check` passes.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. The second line of an outfit card repeats the name until it is renamed (`autoOutfitName` makes them identical). The mock-up shows "N items" instead. Recommendation: show "N items" only when the name equals the list of pieces, and keep the list when the outfit has a custom name or a deleted piece.
2. Layers. The mock-up shows a tee peeking out under a sweatshirt, but a saved outfit has no field for the under tee (`try-on.ts` line 565 says so). Showing it means adding an optional `under` to `Outfit`, which is a data model change touching `outfits.ts`, the try-on save loop, backup and sync. Recommendation: leave it out of this ticket and put it in `docs/tickets/backlog.md` as its own ticket.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

**Note (22 Nov 2026):** Outfit cards and their detail art are now a flat-lay of the garment silhouettes (`flatLayLayout` and `flatLaySvg` in `silhouettes.ts`); deleted pieces are dashed `.o-gap` outlines. Decision 1 taken (second line says "N items" while the name is automatic), decision 2 taken (under tee to backlog). `npm run check` passes apart from one flaky screenshot spec that passes alone; Joe signed off the look (23 Nov 2026), including the card height.
