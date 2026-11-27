# Ticket: Try On: 2D paper-doll as the default view, 3D one toggle away (V8-01)

## Summary
- **Status:** Done (27 Nov 2026).
- **Ceiling:** 3 hours maximum. Stop the moment the acceptance criteria are met.
- **Worker:** Sonnet · High. The shapes and rules already exist in the app; this is assembly and wiring, not invention. Move to Opus only if the layering rules need repeated rework.
- **Depends on:** Nothing open. Builds on the garment shapes in `app/src/silhouettes.ts` (V3-15).

## Target Files
Read these first, and only these:

**Edit**
- `app/src/screens/try-on.ts` (add the toggle and a 2D stage; feed the doll from `refresh()` and the colour changes; pause the 3D view while hidden)
- `app/src/style.css` (the toggle, the 2D stage, show/hide of the canvas; Try On CSS is ~65-133, ~231-253, ~560-573)
- `app/src/viewer.ts` (small: an optional `setActive(bool)` or `pause()`/`resume()` on the render loop at ~231)
- NEW `app/src/paper-doll.ts` (the SVG body figure and the layered garments)
- NEW `app/tests/paper-doll.test.ts`
- `app/e2e/try-on.spec.ts`, `app/e2e/offline.spec.ts`, `app/e2e/layers.spec.ts` (see "What the scout found")
- `docs/tickets/README.md` (add this ticket to the table)

**Read-only reference**
- `docs/designs/2026-11-27-try-on-2d-gemini-prototype/huedrobe_stylized_avatar_explorer.html` (Gemini's prototype; only `render2DPaperDoll()`, ~lines 629-852, is of interest)
- `app/src/silhouettes.ts` (reuse its exports; additive changes only if unavoidable), `app/src/wardrobe.ts`, `app/src/outfits.ts`, `app/src/person.ts`, `app/src/store.ts`, `app/src/main.ts`, `app/src/route.ts`, `app/e2e/helpers.ts`, `app/tests/silhouettes.test.ts`, `app/scripts/screenshots.mjs`, `app/vite.config.ts`

**Do NOT touch:** `pack/`, `private/`, `spike/`, `assets/`, `deploy/` (including `deploy/datastore.mjs`), `app/src/backup.ts`, `app/src/sync.ts`, `app/src/data/`, the avatar pack, and the viewer's garment logic. Add no new synced storage key.

## Scope

### Goal
Opening Try On shows a 2D paper-doll of the current outfit. A 2D | 3D toggle on the stage switches to the existing 3D avatar. Same outfit, same colours, same person in both. The 3D avatar stays the accurate view; the doll is a quick, approximate preview.

### Gemini prototype: what to use and what not to
Reviewed by reading the code, not by running it.
- **Use the idea, not the code.** The useful part is the body figure (head, hair, neck, torso, arms, legs, shoes) drawn as SVG from a few proportions, and its layer order (body, bottoms, top, outerwear, headwear).
- **Do not use its garments.** It draws only a V-neck or crew tee, sweatshirt, shorts, trousers, blazer, long coat and cap. Hue-drobe has five shirt/top types, a dress, a skirt, tights, five shoe types, two hats and two blazers, and `silhouettes.ts` already has a shape for each.
- **Do not copy** the Tailwind and three.js CDN scripts, the global state and inline `onclick` handlers, the body sliders, the Joe/B switcher, the Split Compare view, the stripes/dots fabrics or the height ruler (it doesn't match the drawing scale).
- Known weaknesses to avoid: widths and heights use different pixel-per-cm scales, so the figure comes out slightly slim; no hands; identical shoes; B uses the same silhouette as Joe.

### What the scout found
- `renderTryOn` in `try-on.ts` builds `#stage`, a panel of `.wear-row[data-row=<slot>]` rows (Hat, Outer, Dress, Top, Bottom, Legs, Under, Shoes, Hair) and the `#editor` sheet. `createViewer(stage, onStatus)` is called eagerly (~250).
- **The viewer must keep running in 2D mode.** The slot rows depend on `viewer.has()`, `viewer.layers()` and `viewer.ready` (what this person's pack offers). So create it as now, and pause its render loop while 2D is showing.
- `viewer.ts`'s loop (`renderer.setAnimationLoop`, ~231) never pauses. A hidden canvas would drain the phone battery, so a pause/resume hook is needed. `touch-action: none` on the canvas is set at ~74; it only matters while 3D is showing.
- `silhouettes.ts` is pure SVG on a 100x100 grid, with no DOM or store. `silhouetteSvg({garment, neckline, sheer, colour, mode})` and `SHAPES` cover every garment id in `GARMENTS`. It draws garments only: no body, head or hair. The doll needs a new module that places these shapes on a figure.
- Outfit state in Try On: `outfit: Record<slotName, option>`, `colours: Record<meshName, hex>`, `neckline`, `sheer`; hair colour is `colours['hair']` (default `DEFAULT_HAIR_COLOUR`). Layer rules already exist in `wardrobe.ts` (`keepLayers`, `isTucked`, `TIGHTS_BLOCKED_BY`, `layeredOk`, `MID_TOPS`). The doll must call these, not re-implement them.
- There are no body measurements in `app/` (they live in git-ignored `private/`), so the doll uses a fixed generic figure per person, chosen from `person()`.
- Toggle pattern to reuse: `.seg` (`role=radiogroup`, buttons `role=radio` with `aria-checked`) and `bindRadioKeys(group)` (~131). Place it top-right of `#stage`, mirroring the hair pill at top-left (`.stage-pill`, 44px touch target). It must not use the `.wear-row` class or the word "Save" (a test asserts "Save" appears once).
- Per-device preferences go in `localStorage` (as `huedrobe-pack-seen-<person>` does), never in the synced IndexedDB keys.
- three.js is statically bundled in the main chunk (~729 KB). Lazy-loading it is out of scope here.
- **Tests this will break or silence:**
  - `e2e/offline.spec.ts` (lines 14, 20, 26) uses the text "Drag to turn" as the signal that the avatar loaded. In 2D it never appears: switch to 3D first, or add a 2D signal.
  - `e2e/layers.spec.ts` (~17, 87-101) reads `.stage-status` and `.stage[data-under=...]`: switch to 3D first.
  - `e2e/try-on.spec.ts`: the `.stage-hint` check is wrapped in `if (isVisible())`, so it silently does nothing when the hint is hidden; run it in 3D. Keep the 9-row count and row heights.
  - `app/scripts/screenshots.mjs` blocks the pack, so the Try On docs screenshots will now show the doll. Leave regenerating them until the next screenshot refresh.

### Acceptance criteria
- [ ] Opening Try On shows the 2D doll, drawn from the current outfit, colours, neckline and sheer settings for the logged-in person (Joe or B).
- [ ] A 2D | 3D toggle sits top-right of `#stage`, is operable by keyboard and touch (44px), and uses the existing `.seg` pattern.
- [ ] Every garment id in `GARMENTS`, every neckline and the sheer tights render in 2D, in the correct layer order. Dress, tucked tee plus skirt, tee under a top, tights and outer blazer all look right. A test fails if a garment id has no doll shape.
- [ ] Changing a piece or a colour in the editor updates whichever view is showing, and the other view is correct when switched to.
- [ ] While the doll is showing, the 3D render loop is paused (no frame callbacks). Switching to 3D resumes it with the avatar and outfit unchanged.
- [ ] The slot rows, the "offered" logic and the editor behave exactly as before in both views.
- [ ] No new synced key, no new dependency, no CDN script. Any per-device preference sits in `localStorage` inside `try/catch`.
- [ ] `offline.spec.ts`, `layers.spec.ts` and `try-on.spec.ts` pass, with a new test that the toggle switches views.
- [ ] Joe signs off the doll visually on phone and laptop, for both Joe and B. At most three visual rounds, then stop and ask.
- [ ] `npm --prefix app run typecheck`, `npx vitest related <files>` and the affected Playwright specs pass while working; the full `npm run check` passes once before the final commit.

### Decisions needed from Joe
Work stops if any is open. Recommendations are marked.
1. **Honest status of the doll.** It is a generic figure per person with no real measurements, so it is an approximate preview; the 3D avatar remains the accurate view. *Recommend: yes, and no extra on-screen caption.*
2. **Which view opens.** Always 2D each time Try On opens, or remember the last view on this device. *Recommend: always 2D (simplest, no stored state).*
3. **Viewer in 2D mode.** Keep it created and paused (simple, slot logic keeps working) or lazy-load three.js so the first load is lighter (a separate, larger ticket). *Recommend: keep and pause.*
4. **Body figures.** One figure each for Joe and B with simple proportion and hair differences, or a single neutral figure for both. *Recommend: one each, kept simple; you judge the look.*
5. **Docs screenshots.** Regenerate the Try On screenshots in this ticket or at the next refresh. *Recommend: next refresh.*

## Execution Rules
- Read only the Target Files first. No broad repo search.
- Start from an up-to-date `master` and branch as `CLAUDE.MD` describes; never commit on `master`. Do not push or open a pull request unless Joe asks.
- Run builds, Playwright and any visual rendering in a subagent and bring back results and screenshot paths only.
- Lift the layer rules from `wardrobe.ts`; do not copy or re-derive them in `paper-doll.ts`.
- No new dependency. If one seems needed, stop and say why.
- Done means stop: when the acceptance criteria are met, commit, add a two-line note below, add the row to the `docs/tickets/README.md` table, and stop. Ideas go in `docs/tickets/backlog.md`.
- Three strikes: if a fix fails three times, stop and ask Joe.

## Note
Built 27 Nov 2026 (Opus 5.5, Joe accepted all five recommendations). Round 1 laid the `silhouettes.ts` hanger shapes over a figure, and Joe rejected it: it read as a small tee over trousers, with no body. Round 2 follows Gemini's prototype instead: `paper-doll.ts` builds a body from landmarks and draws every garment id fitted to it, outlined, with a ground shadow. Try On opens in 2D, and the 3D loop is paused there: 0 animation frames in 600 ms in 2D, 38 in 3D (`e2e/try-on.spec.ts`). Unit tests: 12 in `tests/paper-doll.test.ts`. Full `npm run check` passes.
Done: Joe signed off the round 2 look on 27 Nov 2026. The Try On docs screenshots are left for the next refresh, as decided.
