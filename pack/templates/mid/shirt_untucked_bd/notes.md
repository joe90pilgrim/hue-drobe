# shirt_untucked_bd

- Source: `elvs_male_shirt_untucked_bd1` (Elvaerwyn, CC-BY) from the archived `shirts02` pack, used as shipped. Chosen because it is the only long-sleeved, collared, buttoned, untucked shirt in Shirts 02 and 03 (the others are tank tops, tees, jumpers, blouses or tied/tucked).
- Status: `approved: false`. Waiting for Joe's sign-off on the side-by-side renders (`private/renders/v3-08/`, `pack/out/renders/v3-08/`, procedural on the left, template on the right). Credit line is in `meta.json`; it must go in `assets/packs/CREDITS.md` and the app (V3-10) before it ships.

## Rounds (render rounds used: 2 of 3, about 1 hour)

1. `inner_layers: ["tee"]`: sleeves torn at the upper arm, 1854 layer pairs over the tee, push-off up to 21 cm. The pipeline pushes the shirt off the tee's short sleeve edge. That is a V3-07 pipeline problem, so not fixed here.
2. `inner_layers: []`: sleeves clean. The shirt cannot be checked over the tee, so the app must not offer them together (V3-05 only offers a layer where it passed).

## Numbers, template vs procedural `shirt_long` (cm)

| Body | Template pairs vs body (gap rays) | Template hem to top (z) | Procedural pairs vs body | Procedural hem to top (z) |
| --- | --- | --- | --- | --- |
| synthetic_small | 7 (0) | 81.3-147.2 | 0 | 79.4-144.4 |
| synthetic_medium | 9 (0) | 86.2-154.6 | 0 | 83.7-151.7 |
| synthetic_large | 16 (0) | 90.6-162.0 | 0 | 87.8-158.9 |
| synthetic_female_small | 5 (0) | 75.1-138.5 | 0 | 72.6-134.4 |
| synthetic_female_medium | 9 (0) | 79.2-144.8 | 0 | 76.4-141.0 |
| synthetic_female_large | 29 (0) | 83.3-151.2 | 0 | 80.1-147.2 |
| b | 17 (0) | 71.3-133.2 | 0 | 70.2-130.2 |
| joe | 10 (0) | 92.5-164.3 | 0 | 92.7-161.2 |

Minimum clearance 0.2 cm on every body. Once approved, every body would fail the body-as-drawn limit (max 0 pairs); the procedural shirt passes with 0. The template is 65 pieces and 68 openings against 1 and 4.

## Look

- Joe and the male bodies: clean, no tears. Real buttons, chest pockets and a point collar; fitted, a little shorter than the procedural shirt.
- Women (B, female bodies): clings, shows the bust as two cups and the belly outline; hem 3-5 cm shorter and curved; worst on female large (29 pairs at 125 cm). It is a men's shirt, so `allowed_bodies: both` is probably wrong: `male` is the safer setting.
- Over the tee: not usable until the pipeline's push-off against short sleeves is fixed.

## Decision for Joe

Which shirt wins: keep the procedural shirt, switch, or offer both. Nothing is enforced until `approved: true`.
