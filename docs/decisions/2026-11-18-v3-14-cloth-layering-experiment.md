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

## Follow-up: the template's rest shape (18 November 2026, one round)

Blender 5.3.0, `synthetic_female_large`, `shirt_alone` only. Started 14:17, stopped 14:28 (ceiling 30 minutes).

- **`rest_shape_key` is ignored headless (confirmed).** `pack/experiments/v3-15/rest_key_check.py`: a 1 m grid, no gravity or pins, rest key 1.2
  times larger. Edge length after 40 frames: control 1.00; key set before the modifier 1.00; key set after 1.00. Blender's own
  `shrink_min = -0.2` gives 1.20, so the solver does respond. **Dynamic base mesh** (`use_dynamic_mesh`, with the input mesh keyed to the
  larger shape) gives **1.20**: the rest lengths follow the input mesh. That is the route used below.
- **The run** (`run.py ... --cases shirt_alone --round v3-15-r1 --rest template`): the cloth starts at the MHCLO fit as before. Over 20
  frames its rest shape moves to the template's own .obj, scaled once and uniformly (0.990) so the pinned shoulder span matches the fit
  (52.4 cm), and moved so the pins' centres line up. Pinned vertices keep the fit. Same cloth settings, pins and colliders as V3-14 r2.

| | V3-14 r2 (rest = fit) | V3-15 r1 (rest = template) |
| --- | --- | --- |
| Body as drawn: pairs / gap rays | 0 / 0 | **0 / 0** |
| Min clearance (cm) | 0.26 | 0.26 (median 1.12, max 5.52) |
| Moved by cloth, cm (median / p99 / max) | 0.27 / - / - | **1.62 / 6.29 / 8.61** |
| Hem z (cm) | 83.0 | 87.8 (4.8 cm shorter) |
| Cloth inside trousers after (vertices, deepest) | - | 7, 4.09 cm, at 108.5-109 cm (not visible) |
| Self pairs (info) | 2,021 | 2,198 |
| Cloth time | 56 s | 70 s |

Edge length against the template's rest length: the fit is p10 0.83, median 1.00, p90 1.27 (the fit stretches the shirt by up to a
quarter, over the bust, and squeezes it elsewhere). After the cloth: p10 0.97, median 1.00, p90 1.10. So the shirt does go back to its
own lengths.

Renders: `pack/out/renders/v3-14/synthetic_female_large_shirt_alone_v3-15-r1_{front,q34,back}.png` (r2 and V3-08 beside them).

- Front: the two cups are softer and the cloth now bridges between them (the centre front no longer dips in under the bust), but the
  bust shape still shows, with a horizontal crease running across it. It does not yet hang straight down from the bust points.
- Three-quarter: rumpled across the bust and the side seam; crumpled cuffs.
- Back: a horizontal step across the shoulder blades where the 8 cm yoke pin band ends. The pins hold the fitted shape while the cloth
  below them goes back to the template's lengths, and the step is the join.

**Result: partial.** The mechanism works (Blender's own dynamic base mesh, no vertex maths on the garment's positions), and it is the first
cloth change that alters the shape: it moves six times as much as r2, and the bust bridges. But it is not a natural hang yet: the cups
are reduced, not gone, and it adds a crease at the pin edge and a shorter hem. Likely next levers, untried: a narrower back pin band (the
yoke seam only), more frames or lower bending so the folds settle, and starting the morph before the pins take hold. Nothing in
`pack/fit_template.py` or `app/` was changed.

## Follow-up: tuning the template rest shape (18 November 2026, two rounds)

Blender 5.3.0, `synthetic_female_large`, `shirt_alone`, `--rest template`. Started 14:34, stopped 14:53 (ceiling 20 minutes, 2 rounds).
New `run.py` options, all off by default: `--back-band` (back pin band, MakeHuman units), `--pin-cuffs` (pin the cloth within 4 cm of the
two sleeve openings, chosen on the template), `--frames`, `--bending`, `--grow-trousers` (the trousers collider grows out from the skin,
as the tee's does). The trousers inside count now ignores cloth above the trousers' top (105.4 cm): there the nearest point is the open
rim, so the sign means nothing. **The V3-15 "7 vertices inside the trousers" at 108.5-109 cm were that error, not clipping.**

| | V3-15 r1 | V3-16 r1 | V3-16 r2 |
| --- | --- | --- | --- |
| Back band / cuff pins / frames / bending | 8 cm / no / 60 / 0.3 | 1.5 cm / 96 vertices / 90 / 0.2 | 1.5 cm / 96 / 90 / 0.1 |
| Body as drawn: pairs / gap rays | 0 / 0 | **5 / 0** (all at z 100 cm) | **5 / 0** (z 100 cm) |
| Min clearance (cm) | 0.26 | 0.20 | 0.20 |
| Inside trousers after (below their top) | (7, all above the top) | (6, all above the top) | **0** (deepest -0.64 cm) |
| Moved, cm (median / p99 / max) | 1.62 / 6.29 / 8.61 | 1.63 / 5.88 / 7.91 | 1.61 / 5.87 / 8.16 |
| Edge / rest after (p10 / median / p90) | 0.97 / 1.00 / 1.10 | 0.97 / 1.00 / 1.10 | 0.98 / 1.00 / 1.09 |
| Hem z (cm) / self pairs / cloth s | 87.8 / 2,198 / 70 | 87.5 / 2,338 / 103 | 87.6 / 2,306 / 102 |

Renders: `pack/out/renders/v3-14/synthetic_female_large_shirt_alone_v3-16-r{1,2}_{front,q34,back}.png`.

- Back: the step across the shoulder blades is gone in both rounds. A faint soft line remains at the sides, at bust height.
- Cuffs: round and neat in both rounds.
- Bust: the horizontal crease across the centre front is still there in both rounds. Bending 0.2 to 0.1 made no visible change.
- New: 5 shirt-body intersecting pairs at z 100 cm (V3-15 r1 had 0). The closest point to the body is at the wrist (x -47, z 106 cm), so
  the cuff pins, which hold the sleeve end at the fit, are the likely cause. Not confirmed: the check gives only the height.

**Result: partial.** Two of the three defects are fixed (back step, cuffs); the trousers clipping was a measuring error. The bust crease is
unchanged by bending or frames, and the cuff pins add 5 body pairs. Untried: pinning only the outer cuff ring instead of 4 cm, and
starting the rest morph before the pins take hold (for the crease). Nothing in `pack/fit_template.py` or `app/` was changed.
