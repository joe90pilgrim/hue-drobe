# Ticket: Garment chips and variant row in the slot sheet (V3-11)

## Summary
- **Status:** ready once the decisions below are answered. Stop and ask if they aren't.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. One shared sheet, a small lookup, CSS, and several e2e specs to keep green.
- **Depends on:** none. V3-12 and V3-13 depend on this one.

## Target Files
Read first: `docs/decisions/2026-11-18-top-sheet-redesign-spec.md` (the spec and mock-up link).

Edit:
- `app/src/screens/try-on.ts`: the garment selector (`<div class="seg" role="radiogroup" data-garment>`), the `SLOTS` option lists, the garment click handler (around line 458), the selection sync, and the existing tee-only neckline row (`[data-necklines]`).
- `app/src/wardrobe.ts`: add a small lookup from (type, variant) to the existing `GarmentId` and option string, next to `GARMENTS`.
- `app/src/style.css`: the chip row (reuse `.chip-btn`), the variant row (reuse `.seg`), and a 28 px fade at the right edge of the chip row.
- `app/e2e/helpers.ts`: keep `garment(page, name)` working for today's names (for example `'Shirt, long sleeves'` clicks Shirt, then Long) so the other specs don't all change.
- `app/e2e/necklines.spec.ts`, `app/e2e/try-on.spec.ts`, `app/e2e/wardrobe.spec.ts`: change only what breaks.
- `app/tests/wardrobe.test.ts`: a test for the lookup.

Do NOT touch:
- `app/src/colour-chooser.ts` and the colour row in `try-on.ts` (V3-12).
- `app/src/store.ts`, `app/src/sync.ts`, `deploy/`, `pack/`, `spike/`.
- Garment ids, stored option strings and the stored shape of outfits and wardrobe items.

## Scope
**Goal:** Replace the six-button garment control with scrolling chips plus a second row for variants, so new garment types fit and "Shirt, short/mid/long sleeves" becomes one Shirt with a Sleeves choice. UI only: nothing that is stored changes.

- Garment row: horizontally scrolling chips (44 high, radius 22, text 15/600, gap 8, selected = ink fill and white text, 28 px fade at the right edge, selected chip scrolled into view on open). Keep radiogroup semantics and `bindRadioKeys` arrow-key handling.
- Variant row, shown only when the chosen type has variants. Segmented control, one-word labels, label above it:
  - T-shirt: **Neckline** (Crew, V-neck, Scoop). This reuses the existing neckline row.
  - Shirt: **Sleeves** (Short, Mid, Long). Maps to `shirt_short`, `shirt_mid`, `shirt_long`.
  - Sweatshirt and every other type: no variant row, and no empty gap.
- Choosing (type, variant) must set the same outfit option string and garment id the old button did.
- Changing type keeps the colour. The variant is the last one used for that type this session; otherwise the default the app uses today.
- "Nothing" (stored as `None`) hides the variant row, the colour row and Add to wardrobe.
- The sheet is shared by Top, Bottom, Legs, Dress and Under, so every slot gets the chip row. Only Top has variants.
- Mock-up: the "Hue-drobe: garment and colour picker redesign" canvas (Main board is interactive).

**Acceptance criteria:**
- Top slot shows chips and a variant row exactly as above. Nothing is cut off or overlapping at 360 and 390 px, and there is no horizontal page overflow.
- Every control is at least 44 × 44 px. Selection is shown by fill and weight, not colour alone. Focus ring is visible.
- Vitest: every stored Top option string maps from exactly one (type, variant) and back to the same `GarmentId`.
- An outfit or wardrobe item saved with `'Shirt, long sleeves'` opens with Shirt and Long selected.
- Playwright at phone size: Shirt then Long updates the avatar; T-shirt shows Neckline; Sweatshirt shows no variant row; Nothing hides colour and Add to wardrobe.
- `npm run check` passes, with the existing specs updated only where the control changed.
- Phone check on the Pixel 8: smooth scrolling, no frame-rate drop.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. Label for the empty option: keep today's "Nothing" or change to "None" (mock-up)? Recommendation: keep "Nothing", so visible text and tests stay the same.
2. Position of that chip: first (mock-up, never scrolls out of reach) or last (today)? Recommendation: first.
3. Apply the chip row to every slot now (the sheet is shared), or Top only? Recommendation: every slot. It is one component and other slots simply have no variants.
4. Show the "All" button now? There are fewer than 8 types in every slot today. Recommendation: leave it out until V3-13.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Parked (18 Nov 2026, Joe)
Version 3 is closed. Kept, not deleted, so the design work isn't lost; Joe re-opens it when wanted.
