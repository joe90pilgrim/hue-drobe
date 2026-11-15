# Spike bug log

Open problems at the end of the Stage 0 spike, with the evidence for each. To be reviewed with Fable (advisor) at the end of the spike. All numbers are from `spike/check_reports.py` on builds made on 2026-11-15 unless stated. Tolerances are in `spike/tolerances.json`.

Status: **open** = fails a tolerance or is visibly wrong; **unverified** = no measurement yet; **limit** = a known limit of the method.

## Fails a tolerance

| ID | Status | Problem | Evidence | Likely cause and next step |
| --- | --- | --- | --- | --- |
| B1 | open | Trousers show the body through them at the crotch, on every body | 0.67 to 0.97% of samples (limit 0.50%). Joe 0.86%, synthetic small 0.67%, medium 0.92%, large 0.97%, female medium 0.68% | Offset-shell method struggles in the fold between the thighs; the body also self-intersects there. Was 0.7 to 1.0% before today. Try a dedicated crotch gusset or relax the limit with a reasoned argument. |
| B2 | open | Tee shows the body through it near the armpit and sleeve root | Joe 0.67% (0.20% before the looser 108 cm chest spec), 0.56% (synthetic medium), 0.56% (small), 0.71% (large). Baseline before today: 0.53% medium, 0.65% large. Misses cluster at x of 30 to 36 cm, z 120 to 132 cm | Rays from arm vertices just inside the sleeve miss the cloth. Check whether it is a real gap or a test artefact next to the open sleeve edge. |
| B3 | open | Joe's jeans leg opening is too wide | 35.5 cm against 32 cm (error +3.5, tolerance 2.0), hem at 6.7 cm above the floor | The body is already about 35 cm round at 7.7 cm up (heel and instep), and ease is at its floor. Either measure the leg opening above the foot, or model the jeans as tapering over the foot. Appeared when the inside-leg fix lowered the hem from 11.7 cm. |
| B4 | open | Calibration does not converge for some garments, so the landmark match is only true by construction | Joe trousers waist (+0.38 cm, ease at floor). Joe's tee chest now converges since the re-measure (pit to pit 54 cm flat, so a 108 cm chest, replacing 94); synthetic large trousers hip (-1.69 cm) | Real garments smaller than body plus 3 mm; stretch is not modelled. Decide whether to model stretch or accept and say so in the results table. |
| B5 | open | Beth has no garment measurements, so there is no landmark comparison, and her tee clips | Tee clipping 0.99% (limit 0.50%), clustered at z 112 cm (under the bust). Checker also fails for missing calibration and missing landmark records | Need Beth's measurements, or a fixture. The under-bust gap suggests the tee template does not drape over a bust. |

## Visibly wrong or inaccurate

| ID | Status | Problem | Evidence | Next step |
| --- | --- | --- | --- | --- |
| B6 | open | Garment colours are rough | Tee (62, 78, 96) and jeans (36, 34, 30) are medians of lit patches from one dim, warm-lit photo, with no white balance. Jeans render almost black. Spread within a patch was up to 20 levels | Agree a colour tolerance (none is set). Try a white reference in the photo, or a colour picker for manual correction. |
| B7 | open (reduced) | Tee hem: back is probably longer than the front, which is not modelled | Joe confirmed top of collar = highest point at back of neck, bottom = lowest point at front, no shrinkage or riding up. Front hem now driven by collar bottom to hem 63 cm (model 64.1), front neck drop 5 cm (photo shows about 3 to 6). Hem at 79.6 cm against 83 cm read off the photo (3.4 cm apart, near the photo reading error). The 73 cm (back neck top to hem) implies a back hem about 3.5 cm longer | Ask Joe to measure the front and back hem separately. Model a curved hem if it matters. |
| B8 | open | Faint chest ripple and highlight streak on the tee | Seen in the torso close-up on the right of the chest. Nipples faintly show through | More smoothing over the chest was tried and broke calibration (chest 3 to 6 cm short). Needs a smoothing that does not shrink the tee. |
| B9 | open | Inside leg overshoots slightly | 78.71 cm against 78 cm (within the 1.5 cm limit) | Solver stops at 0.4 cm after four rounds; the leg control is at -0.94 of -1, so there is little headroom for bodies with a larger gap. |

## Not yet measured

| ID | Status | Problem | Next step |
| --- | --- | --- | --- |
| B10 | unverified | Joe's likeness to his photos from the front and side | Joe to compare `?view=front` and `?view=side` with the photos. Front comparison done; side not yet. |
| B11 | unverified | Frame rate and download size on the real phone | Needs a reading on Joe's phone. The pane reading (about 8 fps early on, 57 to 60 later) is a desktop browser and does not count. Model size is about 740 KB. |
| B12 | unverified | Loose clothing (skirt or dress) | Not attempted. The offset-shell method may not suit it. |
| B13 | unverified | Blended in-between sizes | Pass criterion 5 has no recorded result in this log's builds. |
| B14 | unverified | Beth's body against her real measurements | Needs her tape measurements. |

## Gaps in the test set-up (CLAUDE.md asks for these)

| ID | Status | Problem |
| --- | --- | --- |
| B15 | open | No visual baseline renders (fixed front, side and back) to compare against. |
| B16 | open | No unit tests for the measurement-to-body solver or colour maths. |
| B17 | open | Other cross-section measurements (`circ_loop`, `circ_cm`) can also merge loops at the armpit or crotch. Only the tee chest measurement has been made robust. |
| B18 | limit | The MPFB body licence for exported meshes is unconfirmed (personal use only, low risk). See `docs/decisions/block1-body-generators.md`. |

## Fixed on 2026-11-15 (for reference)

Belly-button bumps, frayed sleeves, tee covering the crotch, marks on the buttock, V-shaped back neckline, wrong colour, chest measurement merging loops, legs 5.7 cm too long. See `docs/decisions/2026-11-15-photo-review-fixes.md`.
