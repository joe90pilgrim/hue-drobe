# blazer_female

- Source: `toigo_female_suit_2` (Margaret Toigo, CC0) from the archived `suits01` pack, jacket island only (`keep_islands` [0], 4238 vertices). MHCLO fit as shipped, no cloth. A-line jacket with a back slit, deep V neckline and a soft rolled collar (no real lapels), flap and chest pockets.
- Layers: over the legacy tee and trousers. The tee is hidden completely (`hide_all`); trousers keep a 2 cm overlap under the hem (`hide_overlap_cm`), which closed the pale slivers at the hem with 0 trouser pairs on B.
- `clearance_cm` 0.4: with 0.2 the build had 147 body pairs (collar, shoulders, bust at 125 cm, thighs) on B; at 0.4, 0.
- Status: `approved: true` on Joe's instruction of 24 Nov 2026 after the round-2 close-ups (`private/renders/jacket_probe/round2_b/`).
- Checks: `skip_clearance_min: [trousers]` (Joe's decision, 24 Nov 2026). The layer check's inside-clearance minimum failed for the trousers (-4.95 cm Joe, -4.72 cm B at its 5 cm search limit): trousers below the hem are outside the jacket by design. Intersecting pairs against the trousers stay held at 0.
