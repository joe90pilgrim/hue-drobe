# Version 1.2 redesign: developer brief

**Written:** 15 November 2026, from the designs Joe agreed on the same day.
**Designs:** open `index.html` in this folder for every screen, phone and laptop. Each screen is also its own HTML file, and the links between them work. The editable originals are on the Claude design canvas "Hue-drobe redesign – phone" (it holds the desktop page too).
**Scope:** UI and navigation only. No change to the data model, storage keys, the quiz content or scoring, the backup file format, or the viewer's colour maths. The one new piece of interface is a colour chooser built into the app, which replaces the browser's own. Joe agreed to that.

## Decisions already made

- Keep the overall look (calm, minimal, Inter, rounded cards). Change the colours to true neutrals, and give it more character through the name and logo, bolder headings and black main buttons.
- Colour accuracy comes first. Nothing coloured in the interface touches the avatar stage or a colour swatch. See "Colour accuracy rules" below.
- The tabs are **Try on**, **Wardrobe** and **My colours**. "Imagine" and "Learn" are themes of the app, not names on screen.
- Back up and restore moves out of the Wardrobe into a menu (phone) or the foot of the sidebar (laptop). That is also where the switch between Joe and Beth goes in version 2.
- All the issues below are in 1.2. The avatar lighting fix goes on the roadmap.

## The issues, ranked

Each change below is marked with the issues it fixes. The items marked "Joe" are from Joe's list; the others were found in the review.

| # | Issue | Source |
| --- | --- | --- |
| I1 | On a phone the side rail takes half the width, so the avatar is small | Review |
| I2 | Choosing a garment is in a muddled order: the arrows sit below the necklines and the colour sits between the arrows | Joe |
| I3 | "Save" means three things on Dress (save garment, star a colour, save outfit) and a fourth on the result page | Joe |
| I4 | Chrome's colour chooser on Android is a modal that covers the avatar, doesn't wrap text and is hard to use | Joe |
| I5 | Fixed Top and Bottom cards won't stretch to more garment types or layers | Joe |
| I6 | The beige stage and green selection rings change how garment colours look | Review |
| I7 | The Wardrobe becomes one long list as clothes are added | Joe |
| I8 | Rename and Delete fill every Wardrobe row, tapping a row to wear it isn't signposted, and Delete doesn't ask first | Review |
| I9 | The Colour tab is really a quiz and its results, so the name confuses | Joe |
| I10 | The palette squares are too big, with ten Save buttons under them | Joe |
| I11 | No name or logo anywhere | Joe |
| I12 | Calm but a little dull | Joe |
| I13 | The menu has no room for the pages still to come | Joe |
| I14 | The bottom bar on a phone is too tall | Joe |
| I15 | Back up sits in the middle of the Wardrobe | Review |
| I16 | A developer instruction ("Run: python pack/build_pack.py") shows when the avatar fails to load | Review |
| I17 | Favourite tiles (28 px), neckline buttons (32 px) and 11 px labels are too small | Review |
| I18 | On a laptop most of the screen is empty (content stops at 960 px) | Review |
| I19 | Quiz Back and Next sit mid-screen on a phone, and the chosen answer is shown in green | Review |

## Build order

Build in this order. Each piece is small enough for one ticket, leaves the app working, and gets Joe's visual sign-off on the Pixel 8 and the laptop before the next starts. Update the Playwright specs in the same piece whenever a label or route changes, so `npm run check` keeps passing.

| Piece | What | Fixes | Depends on | Suggested worker | Suggested ceiling |
| --- | --- | --- | --- | --- | --- |
| B1 | Look and feel foundations | I6, I12, I17 (part) | none | Haiku, high | 1.5 h |
| B2 | App shell and navigation | I9 (name), I11, I13, I14, I15 | B1 | Sonnet, medium | 3 h |
| B3 | Try on layout | I1, I5, I16, I18 (part) | B2 | Sonnet, medium | 3 h |
| B4 | Change a piece | I2, I3, I17 | B3 | Sonnet, medium | 3 h |
| B5 | Colour chooser | I4 | B4 | Sonnet, medium | 3 h |
| B6 | Wardrobe | I7, I8, I18 (part) | B2 | Sonnet, medium | 3 h |
| B7 | My colours | I9, I10, I19, I18 (part) | B2 | Sonnet, low | 2 h |

B1 to B5 come first because Try on is the screen used most and holds the worst problems. B6 and B7 can be built in either order after B2.

---

## B1. Look and feel foundations

Changes to `app/src/style.css` only, plus the font files.

- Replace the variables with the tokens below. Remove every use of the green accent (`--accent`, `--accent-deep`, `#eef3f0`, `#f6f8f7`).
- The avatar stage background becomes `#E3E3E3` (equal red, green and blue).
- The chosen state everywhere is shown in ink: a 2 px border, or a ring of 2 px of the surface colour then 2 px of ink. Never a tint.
- Main buttons are ink with white text. Secondary buttons are white with a `#D6D6D6` border.
- Add **Bricolage Grotesque** (weights 600 and 700) for the wordmark and headings. Self-host the `woff2` files in `app/public/fonts/` so it works offline and adds no network call. It's a new dependency: confirm its licence first (it is published under the SIL Open Font License on Google Fonts) and note it in the ticket. Inter stays for everything else.

### Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#F5F5F5` | Page background |
| `--surface` | `#FFFFFF` | Cards, sheets, bars |
| `--sunken` | `#EBEBEB` | Track behind segmented controls, the active tab's pill, the active sidebar item |
| `--stage` | `#E3E3E3` | Behind the avatar only |
| `--line` | `#E2E2E2` | Card borders, bar borders |
| `--line-strong` | `#D6D6D6` | Control borders |
| `--ink` | `#161616` | Text, main buttons, chosen states |
| `--text-2` | `#3D3D3D` | Unchosen segment and tab labels |
| `--muted` | `#5C5C5C` | Labels and helper text (6:1 on the ground) |
| `--danger` | `#B42318` | Delete text only |
| `--scrim` | `rgba(0,0,0,.4)` | Behind sheets and dialogs |

Radii: tiles 10 px, controls 12 px, buttons 14 px, cards 16 to 20 px, stage 20 px (phone) or 24 px (laptop), sheets 24 px top corners.

Type: body 15 to 16 px, labels 13 px, the smallest text 12 px. Headings in Bricolage Grotesque 700: page titles 28 px (phone) or 32 px (laptop), sheet titles 22 px, the season name 34 px (phone) or 40 px (laptop).

Touch targets: at least 44 px on a phone and 40 px on a laptop.

### Colour accuracy rules

- No coloured interface element touches the avatar stage or sits beside a colour swatch. The multicoloured logo is the only coloured interface element, and it lives in the top bar or sidebar.
- Every swatch gets a faint inner edge (`inset 0 0 0 1px rgba(0,0,0,.1)`), so white and pale colours still show their edge against white.
- The colour shown on a swatch and on the avatar comes from the same hex value. Keep `viewer.setColour` as it is.

---

## B2. App shell and navigation

Files: `main.ts`, `route.ts`, `style.css` and the backup UI from `screens/wardrobe.ts`.

**Phone (under 900 px)**
- A 52 px top bar on every screen. The logo (a small colour wheel with a centre dot) and the word "Hue-drobe" sit on the left, and a Menu button (three lines, `aria-label="Menu"`) sits on the right. **I11**
- Remove the per-screen `<header>` titles. Wardrobe and My colours show a page title inside their content instead. Try on has none, to give the avatar the room.
- The bottom tab bar is 56 px plus the safe-area inset, with the labels Try on, Wardrobe and My colours. The active tab is ink and weight 600, with a `--sunken` pill behind its icon. **I9, I14**
- The Menu opens a bottom sheet holding "Back up and restore": the explanation, then "Save a backup" and "Restore from file". **I15**
- Before restoring, ask in an in-app sheet rather than `confirm()`: "Replace everything on this device with this backup?", with Replace and Cancel buttons.

**Laptop (900 px and wider)**
- A 232 px white sidebar on the left: the logo and wordmark at the top, then the three items (44 px high, icon and label, the active one on `--sunken`). "Back up and restore" sits at the foot of the sidebar. **I13**
- "Back up and restore" opens a centred dialog, 480 px wide.
- Remove the 960 px `max-width` on `.main`. Each screen sets its own width (see B3, B6 and B7). **I18**

**Routes:** `#/try-on`, `#/wardrobe` and `#/colours`. Keep `#/dress` and `#/colour` working by mapping them to the new routes, and update `tests/route.test.ts`.

**Room to grow (don't build):** a fourth tab fits on the phone bar and in the sidebar. In version 2 the menu button, and the foot of the sidebar, become the person switcher. See `00-map-of-screens.html`.

---

## B3. Try on layout

Files: `screens/dress.ts` (rename it to `try-on.ts` if you like), `viewer.ts` (status text only) and `style.css`.
See `phone-01-try-on.html` and `desktop-01-try-on.html`.

**Phone**
- The stage fills the full width and all the height left over. **I1**
- Under the stage is a white card titled "What you're wearing" (the visible title is optional on a phone). It has one row per slot: a 40 px colour swatch, a small label (Top or Bottom), the garment name ("T-shirt, crew neck", "Trousers" or "Nothing"), and "Change ›" on the right. Each row is one button, at least 64 px high. Build the rows from the `SLOTS` list, so each new garment type or layer in version 3 adds a row and nothing else. **I5**
- Under the card is "Save outfit", a full-width main button 50 px high. It's disabled while nothing is worn, and shows "Outfit saved" for 1.5 seconds after saving, as now.
- The hint "Drag to turn · pinch to zoom" sits at the foot of the stage in `--muted`. Hide it after the first drag.

**Laptop**
- The stage on the left fills the height (24 px padding all round). A panel on the right, 360 to 420 px wide, holds "What you're wearing", the rows and "Save outfit" at the bottom. The piece being changed opens inside this panel (B4). **I18**
- The hint reads "Drag to turn · scroll to zoom".

**Messages** **I16**
- While the avatar is loading, show "Getting your avatar ready…".
- If it fails, show "The avatar couldn't load. Try reloading the page."
- Show the developer instruction only with `?debug`.

---

## B4. Change a piece

Files: `screens/dress.ts` and `style.css`.
See `phone-02-try-on-change-a-piece.html` and `desktop-01-try-on.html` (whose Top section is open).

**Phone:** tapping a row opens a bottom sheet for that slot.
- The stage shrinks to the space above the sheet rather than being covered by it. The viewer's `ResizeObserver` already scales the avatar to fit.
- The sheet has a grab handle and the title (e.g. "Top"), with "Done" on the right. Done, the Android back gesture, or tapping the stage closes it.
- Treat it as a dialog (`role="dialog"`, focus moves into it and returns to the row when it closes).

**Laptop:** the same controls open inside the right-hand panel, in place of that slot's row. The other slots stay as collapsed rows.

**Contents, top to bottom:** **I2, I3, I17**
1. **Garment:** a segmented control (radio group) with T-shirt, Sweatshirt and **Nothing** ("None" is renamed). The controls are 40 px high, on a `--sunken` track. The chosen one is white with a soft shadow and ink text.
2. **Neckline:** Crew, V-neck and Scoop, the same control. Show it only for the T-shirt, as now.
3. **Colour:**
   - The current colour as a 48 px swatch, then "Choose a colour" (opens B5), then a **Favourite** toggle: a heart and the word, with `aria-pressed`. A filled heart and an ink border mean the colour is a favourite.
   - Below that, the favourite tiles at 44 px. Tapping one applies it, and the chosen one gets the ink ring. Tiles that came from the palette keep the small white dot, with the legend "From your colour palette" underneath.
   - Show up to 12, then a "Show all" link.
   - To remove a favourite, choose it and turn Favourite off. This replaces the Edit, More and Fewer controls and the star.
4. **Add to wardrobe:** a full-width secondary button. After saving it reads "In your wardrobe" with a tick until the garment, neckline or colour changes. It uses `ensureItem` as now. It's hidden when the garment is "Nothing".

Remove the old per-slot star, the Edit, More and Save buttons, the arrows, and the inline `<input type="color">`.

---

## B5. Colour chooser

Files: a new `colour-chooser.ts` and `style.css`.
See `phone-03-try-on-choose-a-colour.html` and `desktop-02-try-on-choose-a-colour.html`. Both work: try them.

- **Phone:** it replaces the sheet's contents, with "‹ Top colour" (back to B4) and "Done". **Laptop:** it replaces the slot's controls inside the panel, in the same way. It never opens a modal over the avatar. **I4**
- **Contents, top to bottom:**
  - The chosen colour (48 px swatch). Next to it, **Colour code**, a text field showing the hex value; typing a valid six-digit code applies it. Then the Favourite toggle from B4.
  - **Favourites:** the same tiles as B4.
  - **Basics:** `#FFFFFF` white, `#F2EDE3` cream, `#C8B89A` beige, `#8C8C8C` mid grey, `#1A1A1A` black and `#5B4636` brown. These replace Chrome's preset colours.
  - **Three sliders** (native `<input type="range">` with labels, so the keyboard and screen readers work):
    - **Colour** (hue 0 to 359), with a rainbow track.
    - **Strength** (saturation 0 to 100), with "greyer to richer" on the right and a track from grey to the full colour.
    - **Lightness** (HSV value 0 to 100), with "darker to lighter" on the right and a track from black to the colour at full lightness.
  - Thumbs are white with a 3 px ink border. Tracks are 32 px high on a phone and 28 px on a laptop.
- The avatar updates live as a slider moves (call `viewer.setColour` on `input`). Save to storage when the slider is released or the chooser closes, as the current `change` handler does.
- Convert HSV to an sRGB hex with the same maths as the design files (`hsvToHex` and `hexToHsv` in `phone-03-try-on-choose-a-colour.html`). Store and apply the hex exactly as now.

---

## B6. Wardrobe

Files: `screens/wardrobe.ts` and `style.css`. Back up has already moved out (B2).
See `phone-05` to `phone-07` and `desktop-04` and `desktop-05`.

- The page title is "Wardrobe". Below it is a two-part switch, **Clothes · 6** and **Outfits · 3**, with live counts. **I7**
- **Clothes:**
  - Filter chips: **All**, **Tops · n** and **Bottoms · n**. Tops are the tee and sweatshirt, bottoms are trousers and shorts; take this from the garment's slot so new types sort themselves. The chosen chip is ink with white text, and the chips are 44 px high on a phone.
  - A grid of cards: two columns on a phone, and on a laptop as many as fit at 170 px or wider. Each card has the colour (78 px high on a phone, 104 px on a laptop), the name, and the kind ("T-shirt, crew neck").
- **Outfits:** the same grid. Each card shows the outfit as stacked swatches on a `#EFEFEF` tile: the top above a narrower bottom. A slot whose item was deleted shows as a dashed outline. Under that are the name and the pieces ("Navy tee, brown trousers").
- **Tapping a card:** **I8**
  - On a phone it opens a sheet with the swatch, name and kind, then **Try it on** (main button), and **Rename** and **Delete** side by side, with Delete in `--danger` text.
  - On a laptop the same actions appear in a panel to the right of the grid, 280 to 340 px wide, and the chosen card gets a 2 px ink border.
  - Try it on calls `wearItem` or `wearOutfit` and goes to Try on, as now.
  - Rename turns the name into a text field in the sheet or panel, with Done; Enter saves and Escape cancels.
  - Delete asks first, with "Delete Navy tee? Outfits that use it will show a gap where it was." and Delete and Cancel buttons.
- **When there's nothing yet:**
  - Clothes: "Nothing here yet. On Try on, change a piece and tap Add to wardrobe."
  - Outfits: "No outfits yet. On Try on, put a look together and tap Save outfit."

---

## B7. My colours

Files: `screens/quiz.ts` and `style.css`.
See `phone-08` to `phone-10` and `desktop-06` to `desktop-08`.

- **Before the quiz:** **I9**
  - The page title is "My colours". A card reads "Find the colours that suit you", then "Answer {n} short questions about your skin, hair and eyes. You'll get your colour season, a palette of colours to wear, and some general advice."
  - Below that, a grey tip box with a sun icon reads "Do it in daylight, by a window rather than under a lamp, with a mirror to hand."
  - Then the **Take the quiz** main button. On a phone it sits at the bottom of the screen, within thumb reach.
- **A question:** **I19**
  - "Colour quiz · question 3 of 11", then an ink progress bar, the question in Bricolage 24 px (30 px on a laptop), and the help text.
  - Answers are 52 px rows. The chosen one has a 2 px ink border, weight 600 and a tick on the right.
  - **Back** and **Next** are pinned to the bottom of the screen on a phone, with Back taking a third of the width and Next two thirds. Next stays disabled until there's an answer, and the last question's button reads "See my result", as now.
- **Your result:** **I10**
  - A card with "Your season", then the season name and its description.
  - The close-second block (V1.1-07) comes next and keeps its behaviour. The designs don't show it: style it as a bordered box with a secondary button, like the advice text.
  - **Your palette** card: "Tap a colour to add it to your favourites. Favourites are offered when you choose a garment colour." ("Select" on a laptop.)
    - Swatches are 44 px in rows of 6 on a phone, and 52 px on a laptop. Each swatch is the toggle button itself (`aria-pressed`, `aria-label` = the hex code as now), and a favourite shows a white heart badge on its bottom-right corner.
    - Under the swatches is the line "♥ 3 in your favourites". This removes the ten Save buttons.
  - Then the three advice sections, and **Retake the quiz** as a secondary button.
  - **Laptop:** two columns, with the season and palette on the left (from 420 px wide) and the advice and Retake on the right (from 340 px wide). The intro and the questions sit in a centred column up to 640 px wide.

---

## Not in 1.2: for the roadmap

- **Neutral avatar lighting.** The hemisphere light's ground colour (`0xb8b2a8`) is warm and tints the lower part of each garment. This is a viewer change.
- **Wardrobe search** and more filters, once there are enough clothes to need them.
- **Undo after deleting**, in place of the confirmation.
- **The person switcher** (version 2), in the menu and the foot of the sidebar.
- **A fourth tab**, kept free for a large new area such as Trips.
