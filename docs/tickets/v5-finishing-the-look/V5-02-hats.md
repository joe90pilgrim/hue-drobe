# V5-02 Hats

**Status:** waits for Joe's decisions below, and for V5-04. Written 23 Nov 2026 from V5-00 (`docs/decisions/2026-11-22-v5-00-asset-sources.md`); it was an outline.

**Ceiling:** 2 hours (proposed). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Hats are fitted to each head by `pack/fit_template.py` like any other template; the hard part is the layering over hair.
**Depends on:** V3-07 (`pack/fit_template.py`, done), V5-00 (done), V5-04 (hair styles, so there is hair to sit under a hat), V3-10 (credits screen, for the CC-BY beanie and trilby; the CC0 cap needs no credit), and the per-person garment filter if any hat is limited to one person (no ticket yet).

## Goal
Hats on Joe's and Beth's avatars, over their hair.

## What the spike found
Hats are rigid, but they were fitted like any template: the MHCLO fit binds each hat to the body's own surface, so a hat follows each head with no scale choice. Joe's decision that a rigid item may have one uniform size per body was not needed. Hats are unisex in these packs. Joe's and B's real bodies only.

| Item (pack, licence) | Joe | B | Weight (plain colour) | Credit |
| --- | --- | --- | --- | --- |
| `jujube_newsboy_cap` (Hats 01, CC0) | Pass | Pass | 996 triangles, 19 KB | None |
| `elvs_slouchy_beanie1` (Hats 03, CC-BY, Elvaerwyn) | Pass | Pass | 1,180 triangles, 22 KB | Elvaerwyn |
| `elvs_male_trilby_hat` (Hats 03, CC-BY) | Pass | Not tried | **28,602 triangles (7.5 times the app's tee)**, 518 KB | Elvaerwyn |
| `aethelraed_unraed_cloche_hat` (Hats 01, CC0) | Not tried | **Fails: 54 face pairs with B's head** | 771 triangles | None |

- Alone, all hats that pass are clean on both bodies. **B has no brimmed hat**: the only one tried fails.
- **Over hair is not solved by hiding.** Using the permitted rule (hide the hair faces the hat covers), 71 to 99 per cent of the hair-through-hat pairs go, but 5 to 230 remain, and the layer check fails every time. Spiky or short hair still shows its tips through the crown (Joe, `elvs_maxwell_hair` under the cap and the trilby), and the cap's band shows a jagged row of hair edges. Over long hair (B) it reads as a cap over loose hair with a jagged edge where the hidden hair stops. Pairs left after hiding, for example: cap on Joe 67 to 186 depending on the hair; beanie on B 19 to 80; the full table is in the write-up.
- Hair is the sticking point, and no hair in the packs matches either of them (see V5-04).

## Scope
1. **Hats alone first.** One template per hat in `pack/templates/hats/<template_id>/` with a `meta.json` (licence, credit where CC-BY, `approved: false`), fitted by `pack/fit_template.py` as it is. Plain colour. Proposed: the cap and the beanie for both, the trilby for Joe only if the phone copes (decision below).
2. **Over the hair** the person actually has in the app (V5-04), with the rule chosen in decision (c) of V5-00. If hair is hidden under the hat the way V3.1-01 hides an inner top layer, there is one hair file per hat and hair style, so count the extra files against the 15 MB pack limit.
3. **In the app:** a hat slot in the clothes menu and in saved items and outfits, with a plain colour picker. A new slot changes the data model, so agree the shape first.
4. **Credits** for the beanie and trilby in `assets/packs/CREDITS.md`.

## Decisions needed from Joe
Open: all of these.
- **Which hats, per body, or none.** Spike recommendation, not an answer: cap and beanie for both; trilby for Joe if the frame rate allows; nothing brimmed for B. This is decision V5-00 (a). If you want a brimmed hat for B, a new source is needed (V5-00 looked only at Hats 01 and 03; Hats 02 and 04 are helmets).
- **A hat over hair (V5-00 (c)):** accept the leftover hair tips, hide the hair completely under any hat, or limit hats to the styles that leave none?
- **The trilby:** is 28,602 triangles acceptable? Measure the frame rate on the Pixel 8 first.
- **Shared or separate:** hats are unisex, so proposed shared for both. Confirm.
- **A hat slot changes the data model** (saved items, outfits, backup and sync).
- **Credits:** the beanie and trilby re-open V3-10. The cap is CC0 and could ship first with no credit.
- **Is the pack json enough for items whose header says AGPL3** (V5-00 (d))? The cap is CC0 by its pack, but its own header carries the MakeClothes default `AGPL3`. The beanie header has no licence line.

**Decided by Joe, 23 Nov 2026 (asked when the ticket started):**
- **Which hats:** the newsboy cap (CC0) and the slouchy beanie (CC-BY, Elvaerwyn), for both. No trilby, nothing brimmed for B.
- **A hat over hair:** hide the hair under any hat (the hair faces the hat covers are removed, as V3.1-01 hides an inner top layer; one hair file per hat).
- **Shared or separate:** shared, both packs. **The slot:** a new optional `hat` on saved items and outfits (a plain-colour hat, template id and colour), the same shape as `shoes`; missing means no hat, so old data, backup and sync stay valid.
- **Licences:** yes to both. The pack json is enough for the cap's AGPL3 header (V5-00 (d)); the beanie's CC-BY credit goes in `assets/packs/CREDITS.md` now. The credits screen (V3-10) follows separately.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Rules for this ticket
- Joe's and B's real bodies only (`--private --only joe`, then `--only b`); no synthetic bodies in builds, renders or acceptance numbers.
- Visual first, gates second: `spike/blender/render_closeup.py` front, three-quarter and back; report the numbers without forcing them; at most three render rounds, then stop and ask Joe. Checks are enforced only after Joe approves the look (`approved: true`).
- No scripted reshaping to make a hat sit on hair. Run Blender in a subagent. Don't create follow-up tickets.

## Acceptance criteria
- Each approved hat passes "body as drawn" (0 face pairs, 0 gap rays) on Joe and on B, alone.
- Over each person's hair, the leftover hair-through-hat pairs are reported before and after hiding, and the result matches the rule chosen in V5-00 (c).
- No clipping into the body or garments (tops, collars) on Joe or B.
- Joe's and Beth's visual sign-off, front, side and back, with and without hair.
- The pack stays under 15 MB; frame rate and download size measured on the Pixel 8 if the trilby is included.

## Progress note (23 Nov 2026, branch `feat/V5-02-hats`)
Built and checked on Joe's and B's real bodies; **waiting for Joe's visual sign-off** (`approved` is still `false` on both templates, so the checks report and do not enforce). About 1 hour of the 2-hour ceiling, round 1 of 3 renders.
- **Done:** templates `pack/templates/hats/newsboy_cap` (CC0) and `slouchy_beanie` (CC-BY, credited in `assets/packs/CREDITS.md`), plain colour, worn over the hair with `hide_inner`. A Hat control for both people (a pill on the stage, like Hair, because a sixth list row pushed B's Save outfit under the tab bar), saved items, outfits (optional `hat`, same shape as `shoes`), wardrobe shelf and flat-lay. Pack: `cap.glb`, `beanie.glb`, `hair_under_cap.glb`, `hair_under_beanie.glb`, listed in `manifest.json`. Packs: Joe 9,274 KB, B 14,103 KB (limit 15 MB).
- **Numbers (body as drawn, alone):** both hats 0 face pairs, 0 gap rays on Joe and on B (cap 996 triangles, beanie 1,180). **Hair-through-hat pairs, before hiding then after:** Joe cap 195 to 47, beanie 588 to 5; B cap 730 to 57, beanie 1,193 to 42. So hiding covered hair faces does not reach 0 (the layer check would fail if enforced); the renders show a jagged hair edge where the hidden hair stops, and on B's cap the hair under the brim is cut in a ragged line. This is the "hide the hair under any hat" rule as the pipeline does it; going further (hiding all hair, or hiding more faces) is Joe's call.
- **Checks run:** `npm run check` full, passed (typecheck, vitest, assets, deploy, 80 Playwright). The new `hats.spec.ts` (Joe and B, real packs) passed; try-on, hair, shoes and outfits specs passed on the real packs.
- **Not done:** `approved: true`; Joe's and Beth's front, side and back sign-off with and without hair (Beth's waits until V6); no trilby, so no Pixel 8 measurement. `decisions-needed.md` not updated (it holds Joe's uncommitted edits).
