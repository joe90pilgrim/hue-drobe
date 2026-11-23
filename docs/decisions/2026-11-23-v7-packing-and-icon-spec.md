# V7 spec: new app icon and the Packing redesign

**Date:** 23 November 2026
**Status:** Accepted design, for tickets V7-01 to V7-08
**Mock-ups:**
- Packing: canvas "Hue-drobe: Packing tab redesign" (https://claude.ai/artifact/6aRSz9BpRxpUJt6EkgTsg7). Boards: Packing phone, Add items and outfits, Packing laptop, Suggest a list, Review matches, Match one suggestion, Match (needs two), Match (nothing close), Packing after matching.
- Icon: canvas "Hue-drobe: app icon options" (https://claude.ai/artifact/TLx6C8vTvXgYgDpk7r9eqn). Joe chose option **A2, hanger inside the tee**.

The mock-ups are the look; this file is the rules behind them. If they disagree, ask Joe.

## Why

1. The home-screen icon is a colour wheel, which says "colour" but not "clothes".
2. The Packing tab stretches on a laptop, the trip selector is plain, and the list edit screen scrolls a long way. It still uses colour squares where the Wardrobe now has silhouettes and flat-lay outfit cards.
3. Gemini now makes a packing list, but its lines and your wardrobe do not meet. You cannot swap a suggested "navy trousers" for the navy trousers you own.

## 1. App icon (A2)

- A dark tile (`#16161A`), full bleed. On it, a tee in the colour wheel, with a white hanger hook rising from the neckline. The hanger is inside the tee, so only the hook shows. A dark back-collar opening (`#2E2E36`) sits behind the hook.
- Wheel colours, clockwise from the right: `#FF8C1A` orange, `#8CFF1A` lime, `#19FF8C` green, `#1A8CFF` blue, `#8C1AFF` purple, `#FF1F8E` pink. These are the current icon's colours.
- Safe zone: nothing but the tile colour may sit outside a circle of radius 0.4 x the icon size, centred. The artwork measures about 0.39. This keeps it valid as a maskable icon (Android circle and squircle masks).
- Source SVG (512 x 512). Commit it as `app/public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#16161A"/><defs><clipPath id="tee"><path d="M226 166 Q186 178 140 211 L96 272 L136 296 L172 262 L172 400 L340 400 L340 262 L376 296 L416 272 L372 211 Q326 178 286 166 Q256 190 226 166 Z"/></clipPath></defs><g transform="translate(256 256) scale(1.08) translate(-256 -256) translate(0 21)"><path d="M226 166 Q256 148 286 166 Q256 190 226 166 Z" fill="#2E2E36"/><path d="M256 206 V150 C256 130 286 126 286 100 C286 80 270 70 254 76 C242 80 238 90 240 100" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><g clip-path="url(#tee)"><path d="M256 300 L356.0 126.8 A200 200 0 0 1 456.0 300.0 Z" fill="#FF1F8E" stroke="#FF1F8E" stroke-width="1"/><path d="M256 300 L456.0 300.0 A200 200 0 0 1 356.0 473.2 Z" fill="#FF8C1A" stroke="#FF8C1A" stroke-width="1"/><path d="M256 300 L356.0 473.2 A200 200 0 0 1 156.0 473.2 Z" fill="#8CFF1A" stroke="#8CFF1A" stroke-width="1"/><path d="M256 300 L156.0 473.2 A200 200 0 0 1 56.0 300.0 Z" fill="#19FF8C" stroke="#19FF8C" stroke-width="1"/><path d="M256 300 L56.0 300.0 A200 200 0 0 1 156.0 126.8 Z" fill="#1A8CFF" stroke="#1A8CFF" stroke-width="1"/><path d="M256 300 L156.0 126.8 A200 200 0 0 1 356.0 126.8 Z" fill="#8C1AFF" stroke="#8C1AFF" stroke-width="1"/></g></g></svg>
```

- Sizes: 192 and 512 PNG (manifest), 180 PNG (Apple touch icon), the SVG itself as the browser tab icon.
- Header logo (28 px, on the white top bar): the same tee and wheel with the hook drawn in ink (`#16161A`) and no dark tile. It replaces the six-wedge wheel in `app/src/main.ts`.

## 2. Packing page

Phone first. On a laptop the content stops at 1100 px wide and centres.

**Trip cards.** One per trip. Name (16 px, bold), dates, up to four overlapping silhouette circles of the trip's clothes (34 px circles, 22 px silhouettes), a progress bar, and "N of M packed". The selected card has a 2 px `#111` border; others 1 px `#e3e3e3`. A small ring in the top-right corner is decoration. On a phone the cards sit above the trip. When there is room, they form a column on the left (`max-width: 360px`) and the trip fills the rest.

**Summary card** (one card replaces the three repeats of name, dates and count):
- Trip name, dates, "Edit trip" button.
- Progress: "N of M packed", "K to go", a bar. "All packed" when done.
- Buttons: "Add items and outfits" (filled) and "Suggest a list" (outline, sparkle icon). After a list exists the second reads "Suggest again".
- Caption under the buttons (13 px, grey), exact text in section 6.
- **Delete trip** moves inside Edit trip (see decisions). It no longer sits beside the main actions.

**Sections, in order:**
1. Match banner (only when Gemini matched some lines, section 4).
2. **To pack**: a tray of tiles, `grid-template-columns: repeat(auto-fill, minmax(104px, 1fr))`. Tile: silhouette (72 x 64), name, type line, tick circle (24 px) top-right. Tap toggles packed. A packed tile leaves To pack and goes to Packed.
3. **Suggested**: dashed rows (section 4).
4. **Planned looks**: flat-lay outfit cards (`flatLaySvg`), 140 px wide, in a row that scrolls sideways. Under the name: "N of M pieces packed". These are the V3-17 cards.
5. **Packed**: one collapsed button "Packed N" with a chevron; opens the same tiles, dimmed (opacity 0.75, grey ground).

Colours: page `#f4f4f4`, cards `#fff` with `1px #e3e3e3`, text `#111`, secondary `#5c5c5c`. Buttons 44 px tall minimum, 48 px for the two summary buttons.

## 3. Add items and outfits sheet

A bottom sheet on a phone (a centred dialog about 640 px wide on a laptop).
- Title "Add to {trip}", "Done" top-right.
- Two tabs, **Clothes · N** and **Outfits · N**.
- A slim search box (one line, 44 px).
- On Clothes: category chips (All, then each category with its count), then a 3-column grid of silhouette tiles with a tick badge. States: *On the list* (2 px dark outline, filled tick) and *In an outfit* (lighter tick, grey outline; the piece is on the list only because an outfit brought it).
- On Outfits: a 2-column grid of flat-lay cards with the same tick badge.
- A sticky footer: "Done · N on the list".

## 4. Gemini suggestions and matching

### What is sent and what comes back
- **Sent to Gemini:** trip name and dates; colour season and palette (only when the quiz is complete); and the **wardrobe list**: for each saved piece its id, garment type, name and colour (hex). **No photos, no measurements.** Joe decided on 23 Nov 2026 that the wardrobe list may go, because the pieces are not real photos.
- **Comes back**, for each line: `label`, `quantity` (optional), `group` (optional, as today), and new fields: `colour` (hex, optional), `type` (one garment id from the fixed list, optional) and `matches` (up to `quantity` wardrobe ids, optional). The server drops any id that was not in the request, any invalid hex and any unknown type.
- Gemini picks the matches. The app does not need to guess.

### Lines on a trip
Today a template line is plain text with the quantity baked in. For matching it needs structure. A template entry keeps `text` (so old trips still work) and gains optional `label`, `quantity`, `colour`, `type` and `matches`. The ticket V7-05 decides the exact names with Joe, because this changes the data model.

### Suggested section
- Heading "Suggested", count, and "tap one to match it to your wardrobe".
- A row (min height 64 px, dashed `1.5px #b4b4b4` border, `#fafafa` ground): tick button (48 px hit area, 24 px ring) on the left, then a link to the Match sheet: ghost silhouette (40 px), name (14 px bold), a line with the group and "N in your wardrobe" in green `#1f5a33` when Gemini matched it, a quantity chip ("x 2"), and "Match" with a chevron.
- **Ghost silhouette:** the garment silhouette for the line's `type`, drawn with a dashed `#7a7a7a` outline and a fill of the line's colour at 40% opacity (no fill if no colour). With no `type`, use the line's group to choose (Tops: tee, Bottoms: trousers, Layers: sweatshirt, Shoes: boot) and fall back to a plain dashed hanger.
- **Match banner** (green `#e8f1ea`, border `#b9d2bf`): "Gemini matched N suggestions to clothes you own", the sentence "Swap them in and they become your own pieces. You can change any of them.", and a "Review matches" button.

### Suggest sheet
Opens from "Suggest a list". Three steps in one sheet:
1. **Confirm.** Says what is sent and what stays on the phone (copy in section 6), then "Ask Gemini" and "Cancel".
2. **Loading.** Spinner, "Asking Gemini...", three skeleton rows, "Cancel". Honour reduced motion.
3. **Done.** "N suggestions added", "Gemini matched M of them to clothes you own. Want to swap those in?", "Review matches" and "See the list".

The long paragraph on the page goes: the sheet carries the privacy statement at the moment of action, and the page keeps one short caption.

### Match sheet (one suggestion)
- Shows the suggestion (ghost, name, group and colour name, colour dot, quantity chip).
- A hint line, two chips (the line's category, and "All clothes"), and a 3-column grid of the wardrobe pieces: the chosen category first, **closest colour first**. The first piece is tagged "Closest" and chosen already when Gemini matched it or it is within the closeness threshold.
- Status under each name: "On the list", "In an outfit", or blank.
- Footer: a note, a primary button, and "Not now", "Edit", "Remove".
- **Cases:**
  - *One piece.* Choose a piece, then "Use {name}". The line becomes that piece.
  - *Already on the list.* The note reads "Already on your list, so this suggestion is removed." No second copy is added.
  - *Needs more than one* (quantity 2 or more). Pick up to the quantity. The button reads "Use N pieces". The note says how many stay: "1 more stays on your suggestions."
  - *Nothing close.* The hint says "Nothing in your wardrobe is close to this colour. Pick something similar, or leave it as a note to buy or borrow." Nothing is chosen, and the button is disabled and reads "Choose a piece".
- A piece that replaces a line is added as an item the user put there by hand (`own: true`), so removing an outfit later never drops it.

### Review matches (all at once)
- A sheet listing each Gemini-matched suggestion: "Suggested: {line}", the dashed ghost, an arrow, the matched piece, a one-line note, a "Change" link (opens the Match sheet) and a tick (on by default).
- Footer: "Swap in N matches" (disabled and reading "Tick at least one" when none), and "Not now".
- After applying: the page shows a dark toast, "Matched N suggestions to your clothes. K suggestions left." with **Undo**. Undo restores every line and removes the pieces it added. It lasts until the user leaves the Packing tab or edits the trip.

## 5. Demo data used in the mock-up
Real trip: Prague Weekend, 11 Dec to 14 Dec 2026. Real pieces: Blue sweatshirt, Red sweatshirt, Green tee, Charcoal trousers, Blue trousers. Real looks: Blue sweatshirt + Blue trousers; Red sweatshirt + Blue trousers; Blue sweatshirt + Charcoal trousers. Gemini lines: Thermal base layer tops (x2), Thermal base layer leggings (x2), Soft taupe knit sweater, Dusty rose wool jumper, Slate blue long-sleeve shirts (x2), Muted navy wool-blend trousers, Charcoal straight-leg jeans, Waterproof ankle boots. Six extra wardrobe pieces and the second trip ("Peak District Walk") in the mock-up are placeholders.

## 6. Exact copy
- Caption under the summary buttons: "Suggestions come from Gemini. It gets the trip name and dates, your colour season and palette, and a list of your clothes (names, types and colours). No photos or measurements."
- Suggest sheet, title: "Suggest a packing list". Intro: "Gemini suggests pieces for {trip}, {dates}, in colours from your palette."
- "Sent to Gemini": "The trip name and dates, your colour season and palette, and a list of your clothes: names, types and colours."
- "Stays on your phone": "Your photos and measurements. Gemini sees your clothes as names, types and colours, never as pictures."
- Footnote: "New suggestions replace the ones already on this trip. Clothes and outfits you added are never touched."
- If the colour quiz is not complete, drop "your colour season and palette" from both the caption and the sheet, as the current sentence does.
- **The text on screen must match what the request really sends.** The ticket checks the payload builder against this copy.
- Naming: "Make me a template" becomes "Suggest a list" and "template lines" become "suggestions", because "template" already means garment templates in this app.

## 7. Decisions recorded
- **Wardrobe list goes to Gemini** (Joe, 23 Nov 2026): ids, garment types, names and colours; never photos or measurements. V7-05 adds an amendment to the V4-00 decision.
- **Gemini picks matches**; the app ranks candidates itself for the manual Match sheet.
- **Tapping an "In an outfit" piece** in the Add sheet puts it on the list in its own right (`own: true`). Proposed, to confirm in V7-04.
- **Delete trip moves inside Edit trip.** Proposed, to confirm in V7-02.
- **Rename to "Suggest a list" and "suggestions".** Proposed, to confirm in V7-06.
