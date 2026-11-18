# Cloth, garment-side pins and inner-layer hiding (V3-14)

Date: 18 November 2026. Experiment: `pack/experiments/v3-14/run.py` (README there). Blender 5.3.0, MPFB 2.0.18, one thread.
Tested on `synthetic_female_large` only. The ticket says to go on to the other bodies only if it works there, and it does not.

## Recommendation: partial

- **Works: hiding the covered inner layer.** Over the tee, removing the tee faces the outer garment covers takes the shirt's layer
  pairs from 376 against the whole tee to **0** against the tee as drawn. Only the tee's neckline, hem and cuff edges are left to check.
  Recommend it as the standard way to layer.
- **Works, but adds no volume: cloth with collision from the MHCLO fit, pinned on the garment.** It is stable and clean against the body
  (0 face pairs, 0 gap rays, 0.26 cm minimum clearance, no push needed). But the shirt alone moved 0.27 cm (median), and the bust still shows
  as two cups. The cloth's rest lengths and bend angles are the MHCLO fit itself, and that fit already follows the bust. Gravity and
  collision cannot take out a shape the cloth is made in. So cloth does not answer "the shirt clings to female bodies".
- **Does not work: the blazer.** The Suits 01 jacket is modelled closed: the two fronts meet edge to edge, joined only by separate button
  pieces. Under cloth the fronts swing apart over the tee, and a button piece is dragged across the gap. This happened in all three rounds,
  including round 3, where 11 sewing-spring pairs joined the fronts. The tears of V3-09 are gone, but the jacket is not wearable.
- Joe's call: whether to take hiding the inner layer on its own (its fit_template changes are listed below), and what to try for looseness.
  The scripted reshaping that CLAUDE.md now rules out is the only thing tried so far that changed the shape at all.

## Numbers (synthetic_female_large; cm; V3-08 and V3-09 for comparison)

| Case | Body as drawn: pairs / gap rays | Min clearance | Hem z | Layer pairs: whole tee (deepest) | Tee faces hidden | Layer pairs: tee as drawn | Body + tee as drawn: pairs / gap rays | Cloth time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shirt alone, V3-08 | 29 / 0 | 0.2 | 83.3 | - | - | - | - | - |
| Shirt alone, V3-14 r2 | **0 / 0** | 0.26 | 83.0 | - | - | - | - | 56 s |
| Shirt over tee, V3-08 r1 (push-off) | (not kept) | | | 1854, sleeves torn | - | - | - | - |
| Shirt over tee, V3-14 r2 | **0 / 0** | 0.26 | 85.5 | 376 (-4.77) | 3348 / 3704 | **0** | 0 / 72 | 85 s |
| Female blazer over tee, V3-09 r3 | 0 / 0 | 0.3 | 73.5 | 463 (-3.20) | - | - | - | - |
| Female blazer over tee, V3-14 r1 / r2 / r3 | 0 / 2, 0 / 0, 0 / 0 | 0.3 | 77.5-78.6 | 459 / 458 / 444 (-4.7 to -5.0) | about 3,150-3,190 / 3704 | 12 / 12 / 12 | 12 / 1172, 12 / 952, 12 / 961 | 113-125 s |

- A full build of the body plus the three cases takes about 9 minutes in Blender: 3.5 minutes for the body and the app's own garments,
  the rest for the three cloth passes and checks. The blazer's cloth pass alone is about 2 minutes.
- Variation between two builds (the repeat build `r3b` against `r2` and `r3`, the same settings): **none**. All five output GLBs are byte-identical (the three garments and the two tees as drawn; 0.000 cm), on one
  thread.
- Shirt over the tee: 30 shirt vertices end up still inside the tee (out of 760 at the start). The 72 gap rays look through where the tee
  was hidden but the shirt does not quite cover.
- Blazer: after the cloth, 100 vertices are still inside the tee, and 92 of them are pinned (between 119 and 146 cm high). A pin holds a
  vertex where the MHCLO fit put it, so a pin that starts inside the inner garment stays inside it. The large moves (p99 17-20 cm) are the
  fronts swinging open.
- "Self pairs" (intersecting face pairs within the garment, reported for information only): shirt 2,021, blazer about 720. Most of them are
  buttons and pockets lying on the panel, as shipped.

## Renders

`pack/out/renders/v3-14/`: `synthetic_female_large_<case>_<round>_{front,q34,back}.png`, next to `..._before_...` (V3-08's side by side for
the shirt, V3-09 round 3 for the blazer; there is no before for the shirt over the tee). In the renders the tee as drawn is light grey.
No renders of B or Joe: the experiment stopped on the first body, as the ticket says.

## What was done (three render rounds)

1. Garment-side pins, chosen once on each template's own .obj (MakeHuman base space, so the same vertex indices on every body). In each
   2 cm column out to the shoulder tip, the top band of the front (3.5 cm) and back (8 cm, the shirt's yoke; 5 cm on the blazer). Shirt:
   254 vertices; blazer: 523. Blender cloth from the MHCLO fit (no inflate), gravity on, 60 frames, colliding with the body, the trousers
   and the tee. Single-sided colliders push out cloth that starts on the wrong side. Small pieces (buttons, pockets, cuffs) follow the
   main cloth through a Surface Deform modifier. Shared settings: shirt mass 0.15, tension 15, bending 1; blazer mass 0.3, tension 40,
   bending 10. Result: the shirt is unchanged in shape; over the tee, its sleeves crumple; the blazer is torn open (760 shirt and 1,062
   blazer vertices start inside the tee, up to 5 cm deep).
2. The tee's collider starts on the skin and moves out to its real place over 25 frames (a shape key on the collider, not the garment).
   Friction 5 to 1, shirt bending 1 to 0.3, Surface Deform falloff 16. Result: the shirt over the tee is smoother and covers the tee
   (0 visible layer pairs); the cups are unchanged; the blazer is unchanged.
3. Blazer only: sewing springs between the two front edges, chosen on the template (11 pairs, open-edge vertices within 1.5 cm across the
   centre front). Result: unchanged; the fronts still open.

There is no female-cut version of `elvs_male_shirt_untucked_bd1` in the archived packs. Shirts 02 and 03 hold only blouses, tees and tops,
so the fourth case was not run.

## If Joe takes the parts that work: changes to fit_template.py (list only; nothing changed)

- **Hide the covered inner layer** (replaces `inner_push`, both `shrinkwrap` and `body_normal`, and the Shrinkwrap push-off against
  `inner_layers`). After export, for each inner layer, cast a ray from 3 cm under each inner face out along its normal. Remove every face
  where the ray meets the outer garment, and write `<name>_<inner>_under_<pack_file>.glb`. Then run `mesh_checks.layers` against it
  (pairs at the visible edges only), and `body_as_drawn` with the body and inner layer together (gap rays). **This changes the data model
  and the app:** the app must draw that file in place of the tee while the outer garment is worn, as it draws `body_dress.glb` for the dress.
  That is Joe's decision.
- **Cloth with garment-side pins** (would replace `settle.pinned` with body groups and `settle.pin_above_armpit_cm`): a `settle.pin`
  rule computed on the template's own .obj, as above, and the inner layers as colliders animated out from the skin. This is worth adding
  only if a way is found to make the cloth looser. On its own it changes too little to be worth the build time.
- `loose` (V3-07b) is not replaced by anything here: nothing in the experiment adds room over the bust.

## Proposed next steps (for Joe; no tickets written)

- **Rest shape from the garment as made.** Give the cloth the template's lengths on the base body (unstretched) instead of its fitted
  lengths. That would let a men's shirt hang off a bust instead of being cut to it. `drape.py` found that Blender 5.3 ignored
  `rest_shape_key` headless, so first re-test that on its own (15 minutes).
- **Blazer front.** Make the Suits 01 jacket's fronts one piece in a template made with MakeClothes (the second source in CLAUDE.md), or
  choose an open-front jacket. Pins and sewing on the pack mesh did not hold it closed.
- **Pins that start inside the inner layer:** the 92 pinned blazer vertices inside the tee show that the inner garment has to be fitted
  first, or that pins should go only on cloth that already clears it.
