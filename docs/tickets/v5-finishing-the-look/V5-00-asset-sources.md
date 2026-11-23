# V5-00 Spike: where shoes, hats, jewellery and hair come from

**Status:** done 22 Nov 2026 (about 1 h 20 min of the 4 h ceiling). Write-up: `docs/decisions/2026-11-22-v5-00-asset-sources.md`; scripts in `pack/v5_spike/`; renders in `private/v5_spike/out/`.
**Note:** 22 candidates fitted on Joe and B (27 fits) with the shipped loader: 5 of 10 shoe fits, 1 of 9 hair fits and 5 of 6 hat fits pass the pack-item check, the one necklace does not; the shoe textures look wrong on 8 of 10 fits, and no hair matches Joe's fringe or B's length.
Rings and watches are not worth doing in 3D at phone size (a 2 cm ring is 12 px at the default framing); Joe's decisions are listed at the end of the write-up.

**Ceiling:** 4 hours (proposed). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Loading, fitting, checking and rendering with tools that already exist. Run Blender in a subagent and bring back only the results and render paths. Three strikes on any one problem: stop and ask Joe whether to move up to Opus.
**Depends on:** V2-09 (packs archived, done), V3-06 (pack pipeline, done), V3-07a (CC-BY packs allowed with credits, done)

## Goal
Find the best community-made shoes, hats, jewellery and hair for **Joe and B, each on their own body**, and say what each would cost to ship. This is evidence for Joe's decisions on V5-01 to V5-04; it ships nothing.

## Working rule: separate clothes for each body
Joe, 22 Nov 2026: he is starting to think each body needs its own clothes, rather than small amendments to make one item work on both. The spike treats that as the working rule and gathers the evidence to confirm or reject it.
- Each item is judged on each body **on its own**. "Passes on Joe only" or "passes on B only" is a valid result, not a failure.
- **No rescuing an item.** Items are fitted as the MHCLO fit gives them. No scripted reshaping, no nudging an item that failed on one body so it passes (CLAUDE.md, garments section). If it doesn't look right as it is, record that and move on.
- Look first for items made for each body (male items for Joe, female for B). Items with no stated sex are tested on both.
- Report a **shared versus separate** count for each category: how many candidates pass on both bodies, on Joe only, on B only, on neither.

## Bodies
Joe's and B's real bodies only (Joe's decision of 18 Nov 2026): `--private --only joe`, then `--only b`. No synthetic bodies and no MPFB default-body control. Photos, measurements, renders and body files stay in the git-ignored `private/` folder.

## Where to look (in this order, per CLAUDE.md)
1. **Archived packs already held:** Shoes 01, Hair 01, Hats 01 (all CC0; `assets/packs/MANIFEST.md`).
2. **MakeHuman community CC-BY packs not yet archived** (listed on the community's asset-pack page on 22 Nov 2026): Shoes 02 (low shoes, sneakers, sandals), Shoes 03 (boots), Hair 02 (high-poly, Elvaerwyn), Hair 03, Hats 03 (hats and caps). Hats 02 and 04 are helmets and are out of scope. Download each whole from one mirror only (the V2-07 spike got a corrupt zip by mixing mirrors), record the sha256 in `MANIFEST.md`, and keep a copy in the cloud bucket as V2-09 did. Check the site's status again: V2-07 noted it was shutting down, but the pack page itself says nothing about that.
3. **Jewellery.** The community page lists no jewellery pack. Look at other community sources, such as OpenGameArt, which holds CC0 and CC-BY necklaces and rings. Take an item only if its licence is CC0 or CC-BY and its page allows the download. Anything with no clear licence, "don't re-upload" or paid items are out.
4. **Modelling it ourselves.** Do not model anything in this spike. For jewellery, give a rough estimate of what one simple necklace, ring and watch would cost to model against the MPFB base body and convert with MakeClothes, so Joe can compare it with the community options.

Out of scope, but note in the write-up if seen: glasses (Glasses 01 and 02), beards and moustaches (Bodyparts 05 and 06, relevant to Joe), nails (Bodyparts 04) and socks (Underwear 04).

## What to test, per category
Use the V3-06 pack pipeline (`pack/pack_items.py`) as the loader where it can load the item, so the numbers match what would ship. Put new scripts in `pack/v5_spike/` with a short README, reusing the V2-07 code in `spike/assets/` without editing it (`spike/` is history).

- **Hair:** 3 styles per body from Hair 01 to 03, short and messy to long for each. Record the colour behaviour as in V2-07 (area-weighted texture mean, and ΔE after a red and a blue tint), and a **hair check** by script: the number of hair vertices inside the body's eye, face and ear regions.
- **Shoes:** 3 per body from Shoes 01 to 03 (Joe: trainers, boots, low shoes; B: ankle boots, low shoes or sandals, boots). Run the body-as-drawn check with and without the app's trousers, and report the trouser-hem clash count. Report whether the pale, sock-like render from V2-07 appears; diagnosing it stays in V5-01.
- **Hats:** 3 per body from Hats 01 and 03 (a cap, a soft hat such as a beanie, a brimmed hat). Test each on its own and **over that body's best hair**. Where a hat covers hair, use the permitted layering rule (hide the covered hair faces) and report the hair-through-hat count before and after.
- **Jewellery:** as many as exist, up to 3 per body (B: necklace, ring, bracelet; Joe: watch, ring, necklace). Check each for clipping with the body and with the app's tops. Because these are tiny, report each item's **projected size in pixels** on a Pixel 8 screen at the app's default full-body framing and at its closest zoom, and judge from phone-sized renders.
- **Non-MakeHuman items** need converting to MHCLO with MakeClothes to fit per body. Convert at most one, to learn the effort and the result, and report both.

For every candidate on every body, record:
1. **Fit:** loads and attaches to the body with no manual work.
2. **Checks:** body-as-drawn pairs (limit 0 for the body shown), self pairs, clearance, with the limits read from `spike/tolerances.json`. Report numbers only. Nothing is forced to pass.
3. **Weight:** triangles, GLB size with texture and with plain colour, texture size, against the 15 MB pack limit.
4. **Colour:** can the picker recolour it (ΔE as in V2-07)?
5. **Look:** front, three-quarter and back renders from `spike/blender/render_closeup.py`, in `private/`. One render round per candidate. No tuning.
6. **Licence:** from the item's own `mhclo` header and the pack's JSON, with author, source URL and, for CC-BY, the credit line needed. The known exception is `culturalibre_heroine_boots_4` in Shoes 01, which is CC-BY.

## Decisions needed from Joe (before starting)
1. **Ceiling and worker:** 4 hours on Sonnet, high, as proposed? Recommendation: yes; move a stuck step up to Opus only after three strikes.
2. ~~**Downloads:** archive the five CC-BY packs named above (Hair 01 alone is 228 MB, so expect large files), locally and in the cloud bucket?~~ **Decided 22 Nov 2026:** yes.
3. ~~**Rigid items (hats, jewellery) and size:** may a rigid item have one uniform size per body, with no change of shape (a hat for a bigger head is simply bigger)?~~ **Decided 22 Nov 2026:** yes. The spike reports any scale it uses.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Decisions for Joe afterwards (from the write-up, not made by the spike)
Lettered as in the write-up. The tickets that need each one are V5-01 to V5-04 (updated 23 Nov 2026); each stops until its decisions are made.
- **(a) Open.** Per category and per body: which item, or none. Asked again in V5-01, V5-02, V5-03 and V5-04.
- **(b) Decided 22 Nov 2026 (Joe):** a mix of shared and per-person. Garments are shared by default; a garment type is restricted to one person (or kept for both) case by case, when it is added or amended, and the ticket for that type says which. There is no category rule. The app should offer each person only the garments in their own pack (this also fixes skirts and dresses being offered to Joe, whose pack has neither, found in V4-01). **The V2-06 data model is to be checked for saved outfits and sync before the ticket for that filter is written; that ticket does not exist yet, and V5-01, V5-02 and V5-04 depend on it for any item limited to one person.**
- **(c) Open.** A hat over hair: accept the leftover hair tips, hide the hair under any hat, or limit hats to the styles that leave none. Asked in V5-02.
- **(d) Open.** Is the pack json enough for items whose header says AGPL3 (`dressupdoc_sandals1`, `punkduck_alpha7_long`, `jujube_newsboy_cap`)? V3-07a took the json as the authority. Asked in V5-01 and V5-04.
- **(e) Open.** Hair that matches neither Joe nor B: the nearest style recoloured, or modelled. Asked in V5-04.

## Acceptance criteria
- [x] A write-up in `docs/decisions/` (dated the day it is done), with, for each of shoes, hats, jewellery and hair, a table of every candidate on Joe and on B against the six points above. Every number comes from a committed script and every look claim has a render path.
- [x] The shared-versus-separate count for each category.
- [x] A recommendation per category per body: use this item, keep the baseline, or none found. Include what it would cost to ship (build steps, checks and credits needed).
- [x] For jewellery: the projected pixel sizes, and a plain statement of whether rings and watches are worth doing at phone size.
- [x] A plain note of what this means for V5-01 to V5-05, as proposals only. Only Joe writes or changes tickets.
- [x] Any newly archived pack is in `assets/packs/MANIFEST.md` with its sha256 and licence. `CREDITS.md` is untouched, because nothing ships.
- [x] No change to the app, `pack/` outputs or any shipped asset. No synthetic bodies. `npm run check` passes before the commit, and the work is committed cleanly.
- [x] Stop at the ceiling, whatever state the work is in, and write up what was found and what is left.
