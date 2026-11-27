# Ticket: Patterns: draw them on the 2D paper-doll and garment tiles (V9-02)

## Summary
- **Status:** Ready once V9-01 is done and its decisions are settled.
- **Ceiling:** 3 hours maximum, including at most three visual rounds. Stop the moment the acceptance criteria are met.
- **Worker:** Sonnet · High. It is SVG work with fixed rules; move to Opus only if the layering (tucked tee, sleeves, sheer) needs repeated rework.
- **Depends on:** V9-01 (`app/src/patterns.ts`, the `pattern` and `patternColour` fields, and the Try On pattern state).

## Target Files
Read these first, and only these:

**Edit**
- `app/src/silhouettes.ts` (optional pattern on `SilhouetteOptions`, `shapeParts`, `FlatPiece.item`; `itemSilhouette` and `flatLayOf` forward the item's pattern fields)
- `app/src/paper-doll.ts` (`paperDollSvg` ~330, `partsSvg`, the tuck clip ~358; optional `pattern?(garmentId)` callback on `PaperDollOptions`)
- `app/src/screens/try-on.ts` (`drawDoll` ~446 only: pass the pattern state beside the existing `colour:` callback ~453)
- `app/tests/silhouettes.test.ts`, `app/tests/paper-doll.test.ts`
- `app/e2e/try-on.spec.ts` (one new test), `app/e2e/wardrobe.spec.ts` (one new check)
- `docs/tickets/README.md` (mark this row done)

**Read-only reference:** `app/src/patterns.ts`, `app/src/wardrobe.ts`, and the callers, which should need no edits: `app/src/screens/wardrobe.ts` (142, 163, 179, 180), `app/src/screens/packing.ts` (129, 144, 211, 285, 291), `app/src/screens/packing-match.ts` (64, 138), `app/src/screens/packing-suggest.ts` (22, ghost, stays plain). Also `docs/designs/2026-11-27-try-on-2d-gemini-prototype/huedrobe_stylized_avatar_explorer.html` lines 207-216 and 593-627 (Gemini's SVG `<pattern>` approach).

**Do NOT touch:** `app/src/viewer.ts` (3D keeps base colour), `app/src/wardrobe.ts` data code, `outfits.ts`, `backup.ts`, `sync.ts`, `deploy/`, `packing-template.ts`, `pack/`, `private/`, `CLAUDE.MD`.

## Scope

### Goal
Patterns chosen in Try On show on the 2D paper-doll, and saved patterned pieces show on the wardrobe and packing tiles. The 3D avatar is unchanged.

### What the scout found
- `silhouettes.ts` fills paths with plain `fill="#hex"` and uses no `<defs>`, ids or clip paths. Sheer is `fill-opacity="0.55"` on the body path. Ghost mode is a dashed outline filled with the colour.
- `paper-doll.ts` builds parts with `partsSvg(DRAW[key](m), colour, sheer)`. Its only `<defs>` is `clipPath#doll-tuck` when a tee is tucked in. Sleeves and body are separate paths, so a pattern must use `patternUnits="userSpaceOnUse"` or the stripes will break at the seams.
- Least-change plan: add an optional `pattern?: {id, colour}` to the options; emit a `<defs><pattern>` inside the SVG only when the pattern is not plain; derive the pattern's element id from the pattern id plus both colours (for example `pat-stripes-h-1f2a5a-ffffff`). Many tiles on the closet page then repeat identical definitions, which is harmless. Keep plain output byte-identical.
- If `itemSilhouette` and `flatLayOf` carry the new fields, no wardrobe or packing screen needs editing.
- Hidden SVGs (`display:none`) may not resolve patterns in some browsers. Check the wardrobe sheet and panel.
- Existing test contracts: `silhouettes.test.ts` asserts `fill="#1f2a5a"` appears for every id and mode, that stripping tags leaves no text, that `itemSilhouette` equals `silhouetteSvg`, the ghost and edge colours (`#6b6b6b`, `#b3b3b3`) and sheer `fill-opacity="0.55"`. `paper-doll.test.ts` matches `<g data-layer ... data-garment=...>` and asserts the garment's `fill` and the sheer opacity. Plain cases must pass unchanged.
- Shoes are slot `Shoes`; hats are slot `Hat`; tights are `tights` in slot `Legs`. "Everything except shoes" means every garment id whose slot is not Shoes (use `isPatternable` from V9-01). Hair is never patterned.

### Acceptance criteria
- [ ] All five patterns draw in two colours: horizontal stripes, vertical stripes, spots, and flowers (petals in the pattern colour with a small centre in the base colour, unless Joe prefers otherwise).
- [ ] Every patternable garment id draws every pattern on the doll and in each tile mode (hang, flat, shelf), and a test loops over `GARMENTS` to prove it. A shoe ignores any pattern it is given. Ghost suggestions stay plain.
- [ ] Patterns are continuous across body and sleeves, and stay inside the garment outline. A tucked tee is clipped correctly. Tights keep their sheer look with a pattern on top.
- [ ] A patterned piece in Try On changes the doll straight away. A saved patterned piece shows its pattern on the wardrobe closet, the wardrobe sheet and panel, and the packing tiles and flat-lay, with no screen edits unless the check shows one is needed.
- [ ] Plain output is byte-identical to before: every existing assertion in the two test files passes unchanged. New assertions cover the pattern definition, the fill reference and the unique-id rule (same inputs give the same id and content).
- [ ] The 3D avatar still shows base colour and nothing else about it changes.
- [ ] Joe signs off the look on phone and laptop for Joe and B: stripe width, spot size and flower size read clearly on the doll and on a small tile. At most three visual rounds, then stop and ask.
- [ ] Targeted checks pass while working; the full `npm run check` passes once before the final commit.

### Decisions needed from Joe
1. **Pattern size.** Fixed per pattern, sized to read on the doll and on a tile, with no size control. *Recommend: fixed; tell me after the first look if it needs changing.*
2. **Flowers.** A simple five-petal flower in the pattern colour with a base-colour centre. *Recommend: yes.*

## Execution Rules
- Read only the Target Files first. No broad repo search.
- Start from an up-to-date `master` with V9-01 merged; branch as `CLAUDE.MD` describes; never commit on `master`. Do not push, open a pull request or deploy unless Joe asks.
- Run Playwright, full checks and any renders in a subagent and bring back results and screenshot paths only.
- No new dependency and no external pattern assets: hand-written SVG only.
- Done means stop: when the acceptance criteria are met, commit, add a two-line note below, and stop. Ideas go in `docs/tickets/backlog.md`.
- Three strikes: if a fix fails three times, stop and ask Joe.

## Note
Built 27 Nov 2026 on branch `feat/V9-02-2d-patterns`, stacked on V9-01 (Joe's choice). Patterns are SVG `<pattern>` fills in user space, painted over the base colour on the doll (size 2) and every tile mode (size 1); plain output is unchanged, shoes and ghosts ignore patterns, and no wardrobe or packing screen needed an edit. One visual round done (renders: `app/test-results/shots/`, git-ignored).
Joe still to sign off the look on phone and laptop for Joe and B (stripe width, spot size, flower size are fixed per pattern; say if any needs changing). Do not deploy until V9-01 and V9-02 go out together.
