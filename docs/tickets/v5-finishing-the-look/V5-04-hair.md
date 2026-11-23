# V5-04 Hair styles

**Status:** waits for Joe's decisions below. Rewritten 23 Nov 2026 after V5-00 (`docs/decisions/2026-11-22-v5-00-asset-sources.md`). The earlier plan said the styles already sit well and hair looked the best of everything tested. The spike found the opposite: 1 of 9 hair fits passes the pack-item check, and no style matches Joe's or B's real hair.

**Ceiling:** 2 hours (proposed; it was 1.5, before the hair check needed a limit and a fringe test). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high (proposed; it was medium). Setting a new check's limits is easy to get subtly wrong. If it isn't settled after three attempts, stop: Joe decides whether to move up to Opus.
**Depends on:** V3-07 (`pack/fit_template.py`, done), V5-00 (done), V5-05 (textures shrunk), V3-10 (credits screen, for any CC-BY style), and the per-person garment filter (no ticket yet).

## Goal
Joe and Beth can choose a hair style and colour, each from the styles that suit their own head.

## What the spike found
Joe's real hair (his description, 22 Nov 2026): short, a fringe sweeping slightly to either side, dark brown. B's: long, below the shoulders, no fringe, dark brown. **No candidate matches Joe's; B's is matched only roughly.** Joe's and B's real bodies only.

| Body | Item (pack, licence) | Pack-item check (0 pairs) | Hair check as fitted: face / ear (exported) | Look | Weight |
| --- | --- | --- | --- | --- | --- |
| B | `toigo_blunt_bob` (Hair 01, CC0) | **Pass** | 68 / 4 (72) | Clean; ends at the shoulders, not below | 2,858 triangles; **texture 10,303 KB, file 20,399 KB, over the 15 MB limit alone**; 61 KB plain |
| B | `elvs_lady_hippy_hair` (Hair 02, CC-BY, Elvaerwyn) | 54 pairs | 9 / 15 (24) | Long and parted, side sweep over one eye; the nearest to B's | 5,003 triangles |
| B | `elvs_wavy_bob` (Hair 02) | 4 pairs | 12 / 44 (16) | Curly and short; near black texture | 2,138 triangles |
| B | `punkduck_alpha7_long` (Hair 03, CC-BY) | 1,525 pairs | 10 / 3 (13) | A hood over the forehead | 3,888 triangles; texture 4,074 KB |
| Joe | `elvs_maxwell_hair` (Hair 02, CC-BY) | 6 pairs | 25 / 12 (37) | Neat short spiky cut, no fringe; the nearest to Joe's | 1,468 triangles; **texture is red** (mean 125, 5, 4) |
| Joe | `cortu_short_messy_hair` (Hair 01, CC0) | 825 pairs | 18 / 8 (26) | A fringe over the eyes | 1,092 triangles |
| Joe | `elvs_grump_hair` (Hair 02) | 198 pairs | 62 / 72 (135) | Swept to the side | 12,332 triangles; texture 3,467 KB |
| Both | `culturalibre_hair_11` (Hair 03) | Fails on both | 643 / 195 on Joe | Brings its own eyebrows, goatee and top knot; not usable as hair | 44,039 triangles |

- **The spike's hair check has no limit yet.** It counts hair vertices inside the skin or within 2 mm of it, by region: eye (within 1.5 cm of an eye helper), ear, face (head skin above the mouth joint less 2 cm, front half) and scalp. It does **not see a fringe covering the eyes**: the lowest-count hair for Joe has exactly that. So a count alone cannot pass a style; the renders have to.
- **Colour.** After a dark-brown tint the mean colour is 9 to 22 ΔE away from the target (about 2 is barely visible, above 10 clearly different), and Maxwell's texture is red. Hair either needs plain colour or a brightness fix.
- **Hair is the biggest file in the pack.** The bob's 3,600 px texture alone is over the limit. V5-05 fixes the size.
- **The packs hold beard parts** (the Hair 03 style above has a goatee), which matters for Joe. Out of scope here.

## Scope
1. **A hair check with limits.** Turn the spike's hair check (`pack/v5_spike/session.py`) into a build check, set the limits from the table above with Joe, and add a test that sees a fringe over the eyes. The limits go into `spike/tolerances.json`, a visible reviewed edit. The pack-item check (0 face pairs with the body as drawn) is what told the styles apart in the spike; say in the ticket's note whether it stays as the gate for hair.
2. **The styles Joe chooses,** per person, as templates in `pack/templates/hair/<template_id>/`, fitted by `pack/fit_template.py` as it is. No scripted reshaping. If none looks right, report and stop.
3. **A hair colour picker**, with plain colour or a tint, as decided below.
4. **Chosen style and colour saved per person** (V2-06 profiles). If that needs a new field in the data model, backup or sync, stop and ask first.
5. **Credits** for any CC-BY style in `assets/packs/CREDITS.md`: Elvaerwyn (Hair 02), punkduck and culturalibre (Hair 03). The credits screen is V3-10.

## Decisions needed from Joe
Open: all of these. The ticket stops at the first one not made.
- **Which styles, per person, or none** (V5-00 (a)). The nearest are `elvs_maxwell_hair` (Joe) and `elvs_lady_hippy_hair` (B). The bob is the only one that passes, as a stopgap for B.
- **Hair that matches neither Joe nor B** (V5-00 (e)): use the nearest style and recolour it, or model one? Modelling hair is a different job from the clothes templates and CLAUDE.md allows no new procedural geometry. Joe or B could also choose to accept a style that is close enough.
- **If a style fails the pack-item check** (Maxwell by 6 pairs, the hippy hair by 54): do you accept the numbers on the strength of the render, or do these styles stay out?
- **Hair colour:** chosen freely, or suggested from the colour quiz result? Recommendation: chosen freely, with the quiz's hair answer as the starting value.
- **Plain colour or a tinted texture** for hair, given the 9 to 22 ΔE and the red Maxwell texture.
- **Separate lists for Joe and B** (decision V5-00 (b), case by case): hair is mostly sex-specific, so proposed one list each.
- **Is the pack json enough for items whose header says AGPL3** (V5-00 (d))? It applies to `punkduck_alpha7_long`.
- **Credits:** any CC-BY style re-opens V3-10. Before or after this ticket?

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Rules for this ticket
- Joe's and B's real bodies only (`--private --only joe`, then `--only b`); no synthetic bodies in builds, renders or acceptance numbers.
- Visual first, gates second: `spike/blender/render_closeup.py` front, three-quarter and back; report the numbers without forcing them; at most three render rounds, then stop and ask Joe. Checks are enforced only after Joe approves the look (`approved: true`).
- Run Blender builds, checks and tests in a subagent. Don't create follow-up tickets.

## Acceptance criteria
- A hair check with agreed limits runs in the build, including a test that sees a fringe over the eyes.
- Each style Joe approves passes the hair check on its body.
- Joe's and Beth's visual sign-off on their own styles, front, side and back.
- The pack stays under 15 MB for Joe and for B, with the shrunk textures (V5-05).
- Style and colour are saved per person.
- Credits recorded in `assets/packs/CREDITS.md`.

## Progress note (23 Nov 2026, stopped at the 2-hour ceiling)
Branch `feat/V5-04-hair` (3 commits on `origin/master`). **Joe chose:** `culturalibre_hair_02` for Joe and `culturalibre_hair_01` for B (both CC0, from the pack thumbnails and renders in `private/v5_04/run/out/`; 7 candidates fitted, the spike's 9 had missed most of the packs). Hair is **plain colour** (textured, B's pack would be about 19.8 MB), a colour picker saves under `hair` in the existing `colours` map (no new key, so no server, backup or sync change).
- **Done:** templates `pack/templates/hair/*` (`approved: false`); `hair.glb` in each pack (Joe's pack 9,188 KB, B's 13,924 KB); the viewer draws it in `#3b2a1f` by default; a Hair row on the Try on screen sets the colour; `e2e/hair.spec.ts`. Pack tests and typecheck pass; hair, shoes and outfits specs pass on both the placeholder and the real packs.
- **Layout (Joe chose a small pill on the stage, 23 Nov 2026):** the Hair control is a pill at the top left of the stage, so it takes no room from the list and Save outfit stays on screen for B. Hair, try-on, shoes and outfits specs pass on the real packs (14 passed, 2 skipped) and the placeholder pack (12 passed, 4 skipped).
- **Not done:** the hair check with limits and the fringe test (Joe has not yet said whether it replaces the 0-pair check as the gate: Joe's hair has 0 pairs with the body as drawn, B's 473); `approved: true` on the templates; the full `npm run check`; a CC0 line in `assets/packs/CREDITS.md`; Joe's and B's front, side and back sign-off of the final look.

**Signed off by Joe, 23 Nov 2026, and merged as it stands.** Credits: both styles are CC0, so nothing goes in `assets/packs/CREDITS.md` (it lists CC-BY items only). **Left out on purpose, not done:** the hair check with limits and the fringe test, and `approved: true` on the two templates (B's hair has 473 pairs with the body as drawn, so enforcing the 0-pair check would fail her build). The look is signed off by Joe; Beth's sign-off waits until V6. One style each, so no style picker.
