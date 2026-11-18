# Ticket: Colour row and colour page, one control and a collapsed Fine-tune (V3-12)

## Summary
- **Status:** ready once V3-11 is done and the decisions below are answered.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. Reshapes an existing screen and updates several e2e specs that rely on it.
- **Depends on:** V3-11 (both edit `try-on.ts`, `style.css` and `e2e/helpers.ts`; run them one after the other).

## Target Files
Read first: `docs/decisions/2026-11-18-top-sheet-redesign-spec.md`.

Edit:
- `app/src/colour-chooser.ts`: reorder the page, move the "Colour code" field and the three sliders (`SLIDERS`) into a collapsed Fine-tune section. Keep the colour maths and handlers as they are.
- `app/src/screens/try-on.ts`: the `.colour-row` on the sheet (current swatch, "Choose a colour", "Favourite"), and the Favourites label, `.fav-row`, `.legend` and `[data-more]` beneath it. The chooser is mounted around line 193.
- `app/src/style.css`: colour row, heart toggle, Fine-tune disclosure.
- `app/e2e/helpers.ts`: update `chooseButton` and `favourite` for the new accessible names.
- `app/e2e/colour-chooser.spec.ts`, `app/e2e/favourites.spec.ts`, `app/e2e/try-on.spec.ts` (the check on the order of Favourite and Add to wardrobe): update only what breaks. The chooser specs must open Fine-tune before using the code field or sliders.

Do NOT touch:
- `app/src/colour-maths.ts`, `app/src/favourites.ts`, the colour naming in `app/src/wardrobe.ts`, and how favourites are stored.
- The garment row (V3-11), `pack/`, `spike/`, `deploy/`.

## Scope
**Goal:** One colour control instead of three, and a colour page that shows swatches first and fine controls only on request. Same data, cleaner layout.

On the sheet:
- Replace the swatch tile and "Choose a colour" with one row button: swatch 48 × 48, colour name, hex, chevron (64 high, radius 14). It opens the colour page. Accessible name starts with "Colour" and includes the current colour name.
- Replace the "Favourite" text button with a 64 × 64 heart toggle beside the row. `aria-pressed`, label "Save colour to favourites".
- "Add to wardrobe" is unchanged.

On the colour page (same sheet, back chevron, no Done, page scrolls), in this order:
1. Current colour: swatch, name, hex, heart toggle.
2. Favourites, with the small palette dot and the key "From your colour palette" only when a dot is showing. Empty hint: "Tap the heart to keep a colour here."
3. Basics (the existing six tiles).
4. "Fine-tune colour": a 48 high row with a chevron (`aria-expanded`), closed every time the page opens. Open, it shows the "Colour code" field and the Colour, Strength ("greyer to richer") and Lightness ("darker to lighter") sliders, with the existing behaviour and keyboard support.

Tapping any swatch applies it to the avatar straight away. The mock-up has Colour, Colour (fine-tune open) and the interactive Main board.

**Acceptance criteria:**
- On the sheet there is one colour row and one heart toggle. The old tile, "Choose a colour" and "Favourite" buttons are gone.
- On the colour page the code field and sliders are hidden until Fine-tune is opened, and are in step with the current colour and each other once open.
- The heart toggles from both the sheet and the colour page, and favourites still save and show across slots.
- Keyboard: sliders still work with arrow keys; Fine-tune opens with Enter or Space.
- Works for every slot that uses the sheet.
- Every control is at least 44 × 44 px. No horizontal overflow at 360 and 390 px. The page scrolls when Fine-tune is open on a small screen.
- `npm run check` passes with the specs updated as listed.
- Joe's visual sign-off.

**Decisions needed from Joe:**
1. Favourites currently show as tiles on the sheet itself. The mock-up moves them to the colour page only, which costs one extra tap. Recommendation: move them (that is where most of the clutter was).
2. The mock-up has a "Your colours" grid from the colour analysis. If the app has no list of the user's palette colours to show, leave it out of this ticket and keep only the dot on favourites. Does that list exist?
3. Is the dot on a favourite meant as "from your colour palette"? The current legend says so.

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
