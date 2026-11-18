# Top sheet redesign: garment and colour picker

Read `docs/blueprints/Hue-drobe Build Blueprint.md` and `CLAUDE.md` first. Mock-up: the "Hue-drobe: garment and colour picker redesign" canvas in the Huedrobe project.

**Ticket owner:** Joe. **Ceiling and worker:** [Joe to set]. **Scope:** UI only, Top slot first. Do not touch `pack/`, `spike/`, `deploy/` or the data model.

## Problem

The Top sheet shows six garments in one segmented control. Labels wrap and collide ("Sweatshirtshort sleeves"), and each new garment type makes it worse. Three of the six options are one shirt with different sleeve lengths. Colour has three controls (a tile, "Choose a colour", "Favourite") for one job.

## Changes

1. **Garment chips.** Replace the segmented control with a horizontally scrolling row of chips, plus an "All" button.
2. **Sub-types.** Types with variants get a second row. T-shirt: Neckline (Crew, V-neck, Scoop). Shirt: Sleeves (Short, Mid, Long). Sweatshirt and other single-style types show no second row.
3. **One colour control.** A full-width row button (swatch, colour name, hex, chevron) opens a colour page. The separate tile and "Choose a colour" button go. Favourite becomes a heart toggle beside the row.

A plain dropdown was considered and rejected as the main control: it hides the options and costs two taps each time. The "All" list is the scalable version of it.

## Layout (390 px wide, 16 px side padding, sheet top radius 20)

| Part | Spec |
|---|---|
| Header | Title 26/700. "Done" 16/700, 44 × 44 target. |
| Garment label | 14/700, #555. |
| Chip | Height 44, radius 22, padding 0 16, text 15/600, gap 8, border 1 px #bdbdbd. Selected: fill #111, text #fff. Row scrolls sideways, 28 px fade at the right edge, selected chip scrolled into view on open. |
| None | First chip. |
| "All" button | 44 × 44, radius 12, right of the chips. Opens the full list (below). |
| Variant row | Only when the type has variants. Label changes with type. Track #ececec, radius 12, padding 4. Buttons 40 high, one-word labels. Selected: white, light shadow, 700. More than four variants: use chips. |
| Colour row | Button, 64 high, radius 14, border 1 px #bdbdbd. Swatch 48 × 48, radius 10, inset 1 px rgba(0,0,0,.18) edge. Name 16/700, hex 13 #5c5c5c, chevron. |
| Favourite | 64 × 64 heart toggle. Filled when the colour is saved. `aria-pressed`, label "Save colour to favourites". |
| Add to wardrobe | Unchanged behaviour. 52 high, outlined, plus icon. |

## Behaviour

- Changing garment keeps the colour. Variant is the last one used for that garment this session, else the current default (T-shirt crew, shirt mid).
- None hides the variant row, colour row and Add to wardrobe.
- Types without variants hide the variant row with no empty gap.
- Chip row shows every type while there are 8 or fewer. Beyond that it shows None plus the 6 most recently used, and "All" holds the full list.
- **All list:** sheet with search, recently used, then every type as a 56 px row (name, variants in small text, tick on the current one).
- **Colour page** (second screen inside the same sheet, back chevron, no Done; the page scrolls). In this order:
  1. Current colour with name, hex and heart.
  2. Favourites. Empty hint: "Tap the heart to keep a colour here." A small white dot (10 px, top right of the swatch) marks a colour from the user's palette; show the key "From your colour palette" only when at least one dot is visible.
  3. Your colours: 6-column grid from the colour analysis palette.
  4. Basics: one row of six (white, off-white, beige, grey, black, brown).
  5. "Fine-tune colour": a 48 px collapsed row with a chevron (`aria-expanded`). Closed every time the page opens. When open it shows a "Colour code" text field (48 high, accepts with or without #, applies as soon as it is a valid six-digit code) and three sliders: Colour (hue, full rainbow track), Strength (saturation, hint "greyer to richer"), Lightness (hint "darker to lighter"). Track 28 high, thumb 32 px white with a 3 px #111 ring, 44 px touch area. Sliders, code and the current colour stay in step. A colour set this way is named "Custom".
  - Tapping any swatch applies it to the avatar straight away.
  - This replaces the existing colour screen. Keep its colour maths and storage as they are; only the layout changes. The existing hex field and three sliders are reused, not rewritten.
- (Garment type, variant) maps to the existing garment id in one small lookup. Stored wardrobe items must keep resolving.

## Accessibility

- Real `<button>` elements. Chips and variants are a radio group (`role="radiogroup"` and `role="radio"` with `aria-checked`), arrow keys on desktop.
- Every control at least 44 × 44. Text contrast 4.5:1 or better. Focus ring 3 px #2563eb.
- Selection is shown by fill and weight, not colour alone.
- Respect reduced motion. Row collapse 150 ms otherwise.

## Open decisions for Joe (stop and ask if unanswered)

1. None first or last in the chip row? Mock-up has it first so it never scrolls out of reach.
2. Is Favourite a favourite colour? Mock-up assumes yes.
3. Does the colour analysis already give the app a palette for "Your colours"? If not, drop that section for now.
4. Is 8 the right threshold for collapsing the chips?
5. Confirm the mapping is UI only. If it needs a data model change, stop and ask.

## Done when

- No horizontal overflow at 360 and 390 px.
- Vitest: every existing garment id is reachable from exactly one (type, variant).
- Playwright at phone size: Shirt then Long updates the avatar; T-shirt shows "Neckline"; None hides colour; colour row opens the colour page; heart toggles.
- `npm run check` passes.
- Short README note and a two-line ticket note. Ideas go to `docs/tickets/backlog.md`.

## Out of scope

Other slots (Bottom, shoes), new garment types, naming custom colours, avatar changes.
