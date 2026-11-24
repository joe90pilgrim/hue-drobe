# Blazer templates: Suits 01 jackets, no cloth (24 Nov 2026)

Joe's decision, after a probe on Joe's and B's real bodies only (renders in `private/renders/jacket_probe/`, git-ignored).

## What shipped

- `blazer_male` (Joe) and `blazer_female` (B): the jacket island (`keep_islands` [0]) of `toigo_male_suit_3` and `toigo_female_suit_2` from `suits01` (CC0, Margaret Toigo). MHCLO fit as shipped, no cloth. Layer `outer`, over the legacy tee and trousers, `approved: true`.
- `clearance_cm: 0.4` in each template's own `meta.json` (default 0.2 left as it was). Body as drawn: 0 pairs and 0 gap rays on both bodies (at 0.2: 32 pairs on Joe at the collar, 147 on B).
- The tee is hidden completely (`hide_all`). Hiding the tee only where the jacket covers it left a sawtooth edge in the V at any margin, because the tee's triangles (mean edge 2.25 cm) are as wide as the sliver the jacket edge cuts. The pack's tee-under file has no faces; the app draws nothing of the tee while the blazer is worn.
- Trousers: B's blazer keeps a 2 cm overlap under the hem (`hide_overlap_cm`), which closes most of the pale slivers with 0 trouser pairs. Joe's has none: the overlap brought back 20 trouser pairs on him.
- `skip_clearance_min: ["trousers"]` on both. The layer check's inside-clearance minimum (written for a tee under a sweatshirt) asks every inner vertex within 5 cm of the item to lie inside it; the trousers below a hem are outside by design (-4.95 cm Joe, -4.72 cm B). The face-pair limit (0) still holds. This is a visible, per-template exception to one gate, not a change to `tolerances.json`.

## New meta fields

`hide_all`, `hide_overlap_cm` and `skip_clearance_min`, documented in `pack/templates/README.md` and tested in `pack/test_fit_template.py`. `pack/build_pack.py` now copies an approved blazer into the pack (`BLAZERS`).

## Known defects (small)

Joe: a crumpled cluster of triangles at the centre-front hem; pale skin slivers under the hem where the trousers' top edge is cut. B: a few small grey slivers at the cut edge; a jagged top edge on the breast pocket.

## Not done: the app

The app lists its pack files by hand (`app/src/viewer.ts`, `app/vite.config.ts`, `deploy/deploy.mjs`, `app/scripts/make-test-pack.mjs`) and has no outer-layer slot, so the blazers are in the pack and manifest but not yet offered in the app. That needs its own ticket (an outer slot, the tee-under file with no faces, `inner_layers_drawn` for the blazer). Not started.

## Tried and not used

- The Mindfront open-front cardigan (`shirts02`, CC-BY): long, skin-tight over the torso with the MHCLO fit, alpha net look lost in plain colour. Not a template.
- A coat variant (extending the hem): the new hem vertices would have to be re-bound to the legs with no cloth, and it would clip the thighs more. Parked.
