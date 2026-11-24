# blazer_male

- Source: `toigo_male_suit_3` (Margaret Toigo, CC0) from the archived `suits01` pack, jacket island only (`keep_islands` [0], 4256 vertices; island 1 is the trousers, 2 and 3 the shirt collar and tie). MHCLO fit as shipped, no cloth. Closed tailored jacket, notch lapel, flap and chest pockets.
- Layers: over the legacy tee and trousers. The tee is hidden completely (`hide_all`); trousers are hidden where the jacket covers them, no overlap (an overlap brought back 20 trouser pairs on Joe).
- `clearance_cm` 0.4: with the default 0.2 the build had 32 body pairs at the collar (z about 145 cm) on Joe; at 0.4, 0.
- Status: `approved: true` on Joe's instruction of 24 Nov 2026 after the round-2 close-ups (`private/renders/jacket_probe/round2_joe/`). Known: a small ragged notch at the front hem; pale grey slivers under the hem on both thighs on Joe.
- Checks: `skip_clearance_min: [trousers]` (Joe's decision, 24 Nov 2026). The layer check's inside-clearance minimum failed for the trousers (-4.95 cm Joe, -4.72 cm B at its 5 cm search limit): trousers below the hem are outside the jacket by design. Intersecting pairs against the trousers stay held at 0.
