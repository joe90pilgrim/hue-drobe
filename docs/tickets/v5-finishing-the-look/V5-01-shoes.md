# V5-01 Shoes: boots, sandals, trainers

**Status:** waits for Joe's decisions below. Rewritten 23 Nov 2026 after V5-00 (`docs/decisions/2026-11-22-v5-00-asset-sources.md`). The earlier plan, boots from Shoes 01 (CC0), no longer holds: both Shoes 01 ankle boots miss the pack-item check (Joe's by 2 gap rays, B's by 3). The usable shoes are in Shoes 02 and 03, which are CC-BY and need a credit.

**Ceiling:** 3 hours (proposed; it was 2, before the work grew to three templates and a texture diagnosis). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. One unsolved look problem (the textures) plus a layering rule. If the textures aren't explained after three attempts, stop: Joe decides whether to move up to Opus.
**Depends on:** V3-07 (`pack/fit_template.py`, done; V3-06 was folded into it), V5-00 (done), V5-05 (textures shrunk to 1024 px), V3-10 (credits screen; parked, and re-opens with the first CC-BY item to ship), and the per-person garment filter (no ticket yet; Joe writes it, after the V2-06 data-model check noted in decision V5-00 (b)).

## Goal
Joe and Beth can wear shoes on their avatars, each from the shoes that fit their own body.

## What the spike found
Pass means 0 face pairs and 0 gap rays against the body as drawn, the build's check for pack items. Pass is not the same as looks right: the check passes a lumpy trainer and fails a clean-looking boot by 2 gap rays. Bodies were Joe's and B's real bodies only.

| Body | Item (pack, licence) | Check | Look, plain colour | Weight | Trouser pairs |
| --- | --- | --- | --- | --- | --- |
| Joe | `mindfront_shoes_biker_boots_male` (Shoes 03, CC-BY) | Pass | Clean | 15,844 triangles (4.2 times the app's tee); 294 KB plain, 6,474 KB with texture | 406 |
| B | `mindfront_shoes_oxford_female` (Shoes 02, CC-BY) | Pass | Neat low lace-up | 5,192 triangles | 148 |
| B | `dressupdoc_sandals1` (Shoes 02, CC-BY) | Pass | Reads as a closed shoe in plain colour; correct only with its transparent texture | 1,384 triangles; texture 362 KB | 48 |
| Both | `culturalibre_sneakers` (Shoes 02, CC-BY) | Pass on both | A lumpy high-top that reads as a trainer; 4,580 and 4,881 self pairs | 9,042 triangles | 782 (Joe), 276 (B) |
| Joe | `toigo_ankle_boots_male` (Shoes 01, CC0) | Fails: 2 gap rays | Clean | 4,120 triangles | 362 |
| Joe | `mindfront_shoes_oxford_male` (Shoes 02) | Fails: 9 gap rays | White holes over the toe cap | | |
| B | `toigo_ankle_boots_female` (CC0), `punkduck_female_half_boots`, `punkduck_female_knee_boots` | Fail: 3, 9 and 101 gap rays | Bare toes show through the front | | |

- **Nothing found** for Joe's low shoes, or for B's boots.
- **Textures.** Rendered with their own textures, 8 of 10 fits look wrong. Pale, sock-like uppers (the V2-07 look, reproduced) on B's baseline boots and B's Oxfords; patchy, blocky or scrambled texture on the sneakers, the biker boots, the knee boots and Joe's baseline boots. Only B's sandals and half boots look right. **Joe's recommended boots are among the wrong ones with their texture.** The cause is not diagnosed.
- **Trousers.** Trouser legs and shoes overlap by 48 to 782 face pairs with the app's current trousers. The spike measured trousers only, not shorts, tights, skirts or dresses.
- **Licence headers.** `dressupdoc_sandals1` is CC-BY by its pack's json, but the item's own header carries the MakeClothes default `AGPL3`. Decision V5-00 (d) covers this.

## Scope
1. **First, the textures.** Find why the pale and the patchy textures come out wrong (likely how the texture or its maps export to glTF, or how the UV layout survives the fit). Do it on Joe's biker boots first, then B's Oxfords. V5-05 only resizes; it does not diagnose. At most three attempts. Report with before-and-after renders.
2. **One template per shoe** in `pack/templates/shoes/<template_id>/`, each with a `meta.json` (licence, credit, source, delete group, `approved: false`), fitted by `pack/fit_template.py` as it is. No scripted reshaping. If the fitter needs a change, for example a layer value for shoes, say so and stop for Joe. Items proposed, subject to decision (a): Joe biker boots; B sandals and Oxfords; the sneakers on both only if Joe wants them.
3. **Body hiding over the feet** through the delete group, as the dress does, with the body-as-drawn check.
4. **Layering with trousers.** Hide the covered shoe faces under the hem rather than pushing one garment off the other (CLAUDE.md). If the fitter cannot take a shoe as an inner layer, report it and stop. Re-measure against whichever trousers ship: V3.1-04 may add a template trousers.
5. **Texture or plain colour** for each shoe, once the diagnosis is in (decision below). Textured shoes use the 1024 px textures from V5-05. The sandals cannot be plain.
6. **In the app:** a shoes slot in the clothes menu and in saved items and outfits, showing each person only the shoes in their own pack (needs the per-person filter).
7. **Credits** for every CC-BY shoe recorded in `assets/packs/CREDITS.md`: Mindfront (biker boots, Oxfords), DressUpDoc (sandals), culturalibre (sneakers, if used). The credits screen is V3-10.

## Decisions needed from Joe
**Decided 23 Nov 2026 (Joe, after seeing every shoe on both bodies; renders in `private/v5_01_compare/sheets/`, git-ignored):**
- **Which shoe, per body:** Joe: trainers (`culturalibre_sneakers`), Oxfords (`mindfront_shoes_oxford_male`), sandals (`dressupdoc_sandals1`). B: trainers (`culturalibre_sneakers`), ankle boots (`toigo_ankle_boots_female`, CC0), Oxfords (`mindfront_shoes_oxford_female`), sandals (`dressupdoc_sandals1`). Joe has no boots, so the biker boots (and the 15,844-triangle weight) drop out. B has no biker, half or knee boots. This supersedes the spike's proposal.
- **Who sees which:** each person sees exactly the list above; trainers and sandals are on both, Oxfords and ankle boots as listed.
- **Trouser hems:** over all shoes except the boots, which the trousers tuck into.
- **Known from the spike, still to be handled:** Joe's male Oxfords failed the check by 9 gap rays; B's female ankle boots by 3; the sandals need their transparent texture; the trainers are lumpy. These are reported in the render rounds, not forced to pass (visual first, gates second).

- **Ceiling:** 3 hours, Sonnet high. **Sandals licence:** the pack json (CC-BY) is enough despite the AGPL3 header; record the credit and the mismatch (V5-00 (d)). **Recolour:** offer a tint; the colour may not be exact. **Credits:** record in `assets/packs/CREDITS.md` only; V3-10 re-opens later as its own ticket.
- **Texture diagnosis target:** the biker boots no longer ship, so the diagnosis runs on what does: Joe's trainers and Oxfords, then B's Oxfords and ankle boots (the same pale and patchy looks).

**Texture diagnosis, attempt 1 of 3 (23 Nov 2026):** the patchy and shard-like looks are the exported GLB material's `alphaMode: BLEND` (the shoe PNGs have an alpha channel). Overlapping triangles of a blended material draw in arbitrary order, so inner surfaces show through the outer one. Checked: the exported UVs match the source OBJ's (centroid distance 1e-8, same seam count), the embedded texture is the source at 1024 px, and the unfitted source renders clean. Re-rendering the same GLBs with dithered (not blended) transparency makes the trainers, Oxfords and Toigo boots render clean; the sandals keep their cut straps. The **pale, sock-like** look is not a bug: the artists' own thumbnails show a pale grey-blue Toigo boot and Oxfords with a white sock, so it is the source art (a tint is the answer, as decided). Before-and-after sheets: `private/v5_01_compare/sheets/<joe|b>_before_after.png` (git-ignored). **Fix made 23 Nov 2026 (Joe approved the change):** in `pack/fit_template.py`, a shoe that keeps its texture gets a Round node on its alpha before export, so the exporter writes `alphaMode: MASK` (alpha clip) instead of `BLEND`; the report records `alpha_links_clipped`. Rebuilt on Joe's body: trainers, male Oxfords and sandals all export MASK, render clean with the unchanged `render_textured.py` (trainers) and keep the cut straps (sandals); `private/v5_01_compare/sheets/joe_alphafix.png` (before left, after right). Geometry is untouched. Still wrong, and a fit problem not a texture one: white patches over the toe cap of Joe's male Oxfords (the spike's 9 gap rays) and bare toes on B's ankle boots (3 gap rays). The app has no shoes slot yet, so the in-app look is not checked; three.js treats MASK as alpha test, not sorted transparency. `python -m unittest discover -s pack -p test_fit_template.py`: 32 tests pass; the full `npm run check` is for the ticket's final commit.

**Shoes slot shape, approved by Joe 23 Nov 2026:** an outfit and a saved outfit gain a Shoes slot (`Shoes` in the stored outfit map, option Trainers, Oxfords, Sandals or Ankle boots; a saved outfit gains an optional `shoes` id like `legs` and `dress`, so older records need no upgrade). Four new garments in the shoes slot; the saved-item record is unchanged (no version bump) and its `colour` is a tint over the texture, white meaning as made. No new stored key, so backup and sync are unchanged. Which shoes a person is offered comes from their pack's manifest (as the layer combinations and the skirt and dress already do), so there is no separate per-person garment filter for shoes. **Dress:** every shoe can be worn with the dress (B only; each combination needs its own body file). **Hems:** the covered faces are hidden, as CLAUDE.md says: trousers over trainers, Oxfords and sandals (covered shoe faces hidden), and tucked into B's ankle boots (covered trouser faces hidden inside the boot).

**Built 23 Nov 2026 (not yet signed off):** five templates in `pack/templates/shoes/` (`approved: false`), the Shoes slot in the app (outfits, saved items, wardrobe shelf, Dress screen row, flat-lay shapes), a body file per shoe and, for B, per shoe with the dress (`pack/fit_template.py`, `pack/build_pack.py`), credits in `assets/packs/CREDITS.md`. Checks on the real bodies, `python pack/build_pack.py --private --only joe`, then `--only b` (numbers reported, not enforced):
- **Joe:** trainers 0 face pairs, 0 gap rays; Oxfords 9 gap rays; sandals 7 gap rays. Pack 7,701 KB.
- **B:** trainers, Oxfords and sandals 0 gap rays; ankle boots 3 gap rays (bare toes show through the front). Pack **15,034 KB against the 15 MB (15,360 KB) limit**, before V5-05 shrinks the textures (Oxfords 3,064 KB and ankle boots 3,601 KB are the 2048 px textures). With the dress, B's combined bodies: trainers 2, Oxfords 3, sandals 7, ankle boots 7 gap rays (the dress alone has 0); no combination has a visible-body face pair.
- **Trouser overlap (face pairs with the app's trousers, hem over the shoe, no rule yet; from the V5-01 comparison build):** Joe: trainers 782, Oxfords 332, sandals 176. B: trainers 276, Oxfords 148, sandals 48. **The fitter cannot hide shoe faces under a hem** (`hide_inner` hides the inner layer's faces under a template worn over it, and the trousers are a legacy garment, not a template), so those numbers stand and the hem rule for those three shoes is **not built; it needs a fitter change Joe decides**. B's ankle boots, tucked in: the covered trouser faces are hidden (48 pairs before, 0 after; `trousers_under_ankle_boots.glb`).
- **Not done:** Pixel 8 frame rate and download size; Joe's and Beth's visual sign-off (`approved: true`); the trouser hem rule above; deploy (`deploy/deploy.mjs` copies only eight pack files, so none of the V3 garments or the shoes would reach the phone; separate from this ticket).

**Still open:** the texture fallback (plain colour if the diagnosis fails after three attempts) and the shoes slot in the data model (agree the shape before the app part is built). The app part also still waits for the per-person garment filter, which has no ticket yet.
- **Which shoe, per body, or none.** The spike's recommendation, not an answer: Joe biker boots; B sandals and Oxfords; trainers only if you want the lumpy sneakers. This is decision V5-00 (a).
- **Who sees which shoe.** The sex-matched items (biker boots, Oxfords, sandals) are proposed as one person each, and the sneakers for both. Decision V5-00 (b) is that this is settled case by case in the ticket for each type, so this ticket says which once you have chosen.
- **Trouser hems over the shoes, or tucked in?** The spike measured hems over.
- **Texture or plain colour** if the diagnosis fails after three attempts. In plain colour the biker boots and Oxfords look clean; the sandals cannot be plain.
- **Can shoes be recoloured, given they keep their texture?** Recommendation: offer a tint, but accept the colour may not be exact.
- **A shoes slot changes the data model** (saved items, outfits, backup and sync). Agree the shape before building it.
- **Is the pack json enough for items whose header says AGPL3** (decision V5-00 (d))? Needed for the sandals.
- **Credits:** the first CC-BY shoe re-opens V3-10. Does V3-10 go before this ticket, or does this ticket stop with the credit recorded in `CREDITS.md`?

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Rules for this ticket
- Joe's and B's real bodies only, as CLAUDE.md says (`--private --only joe`, then `--only b`). No synthetic bodies in builds, renders or acceptance numbers. Joe first.
- Visual first, gates second: render with `spike/blender/render_closeup.py` (front, three-quarter, back), report the check numbers without forcing them, at most three render rounds, then stop and ask Joe. The template's checks are enforced only after Joe approves the look (`approved: true`).
- Run Blender builds, checks and tests in a subagent and bring back only the results and render paths.
- Don't create follow-up tickets. Propose them in the ticket's note.

## Acceptance criteria
- The cause of the pale and patchy textures is stated with a render, or three logged attempts are reported and the ticket stops.
- Each shoe you approved looks like that shoe on its body, front, side and back (Joe's and Beth's visual sign-off).
- Passes the "body as drawn" check on Joe and B, with the app's trousers and without, once `approved: true`. The trouser overlap before and after the hem rule is reported.
- Each person is offered only their own shoes.
- The pack stays under 15 MB for Joe and for B, with textures shrunk. Frame rate and download size are measured on the Pixel 8 (the biker boots are 4.2 times the app's tee in triangles).
- Credits recorded in `assets/packs/CREDITS.md`.
