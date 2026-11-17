# V3-01a Skirt fixes: waistband, hip step and the small body

Date: 17 November 2026. Result: **the A-line midi skirt now passes every hard mesh check on B, synthetic female small and synthetic female large, with one set of settings, and two full builds of each body are identical.** The hem's lowest point is 1.1 to 1.3 cm below the target on all three. The skirt can move on to V3-01b for all three bodies.

Joe's answer to the ticket's open decision (17 November 2026): if the small body could not be fixed, ship for B only. It was fixed, so that fallback is not needed.

Code: `spike/cloth/skirt_cloth.py` (README in `spike/cloth/`). Blender 5.3.0, MPFB 2.0.18, Blender's own cloth only. Run: `run_all.py --jobs 3 --runs 2 --out private/cloth_spike/v301a/final`. About 40 minutes of the 2-hour ceiling.

## Results

| | B | Synthetic female small | Synthetic female large |
| --- | --- | --- | --- |
| **Passes hard checks** (both builds) | **Yes** | **Yes** (was no) | **Yes** (was no) |
| Body face pairs (limit 0) | 0 | 0 | 0 (was 30) |
| Self pairs (limit 0) | 0 | 0 (was 1) | 0 |
| Min clearance, cm (limit 0.2) | 0.62 | 0.62 | 0.62 (was -0.27) |
| Pieces / openings | 1 / 2 | 1 / 2 | 1 / 2 |
| Body pairs in the start shape | 0 | 0 | 0 (was 28) |
| Hem target, cm above floor | 32.0 | 33.2 | 36.1 |
| Hem after cloth: lowest point / mean, cm | 30.8 / 31.5 | 32.1 / 32.9 (was 48.9) | 34.8 / 36.1 |
| Hem lowest point vs target (limit 2 cm) | -1.2 | -1.1 | -1.3 |
| Variation between two full builds | 0.0 cm | 0.0 cm | 0.0 cm |
| Skirt waist / hip / hem circumference, cm | 90.3 / 112.0 / 168.0 | 77.0 / 102.1 / 153.2 | 103.0 / 131.1 / 196.3 |
| Build time: body + cloth, s | 85 + 28 | 83 + 33 | 80 + 32 |
| Triangles / GLB (plain colour) | 5,760 / 105 KB | 5,952 / 108 KB | 6,528 / 118 KB |
| App tee over the skirt, face pairs (information only) | 558 | 705 | 683 |

Renders (front, side, back): `private/cloth_spike/v301a/final/run1/<body>/renders/<body>__skirt.png` and `__skirt_tee.png`. Diagnostic runs are alongside them in `private/cloth_spike/v301a/d1_*` to `d6_*`.

What the renders show: a clean A-line midi on all three. The large body's waistband no longer dips into the belly and the side steps at the hip are gone. The small body's hem hangs evenly at mid-calf with soft flare and no bubble.

## What changed and why

1. **Small body, hem riding up: self-collision, not the legs.** A new per-frame hem track showed the hem falling inward (radius 24 to 15 cm) and rising 10 to 13 cm within the first 10 frames. The legs were not the cause: with the legs taken out of the collider, the hem still rose 11 cm. Gravity was not the cause either: it happened with gravity ramped in and at only 13% by frame 10. With self-collision off, the hem held at 31.4 cm. With the self-collision distance halved from 0.6 to 0.3 cm, it held too, with self-collision still on. This body's waist ring has vertices 0.8 cm apart, close to the old 0.6 cm distance, which is the likely trigger. `SELF_DIST` is now 0.003.
2. **Large body, waistband edge:** the top ring's outline now also clears the body up to 4 cm above the waist (`WAIST_LOOK_UP`). Start-shape body pairs 28 → 0.
3. **Large body, hip step:** the hip ring was 6.6 cm wider in circumference than the ring 2 cm above it, because the hip outline takes in the thigh tops. Between the waist and the hip, no ring is now narrower than a straight line from the waistband to the hip ring.
4. **Hem length:** after the fixes above, the hem hung 1.8 to 2.6 cm below target (large body over the 2 cm limit). Doubling tension from 15 to 30 changed nothing, so it is not stretch. The flared wall swings nearly vertical as it settles, so it gets taller. Pattern rule: the bottom ring is raised so the cloth length from hip to hem, along the wall, equals the hip-to-target height (+0.6 to +1.2 cm).
5. **Gravity ramp:** gravity rises from 0 to full over 40 frames, then 60 frames to settle (100 frames, up from 80). On its own it did not fix the small body. I kept it as a safeguard against swing, and cloth time is still about 30 s per body because the smaller self distance is cheaper.

No cloth setting was tuned for one body. Bending, mass, friction, tension and hem ratio are unchanged from V3-00.

## Not done or not reliable

- **Hem checked against a pattern target, not a garment.** The target is 21% of height above the floor, as in V3-00. There is still no real skirt of Beth's to compare against.
- **Hem lowest point vs mean.** The limit is checked on the lowest point, the stricter of the two (the folds dip about 1 cm below the mean).
- **No phone test.** At 105 to 118 KB and about 6,000 triangles per skirt, it should match the tee.
- **Tee with skirt still clips** (558 to 705 pairs). That needs the layering rule in V3-01b.
- **Blended in-between sizes not tested**, as in V3-00: build and check each body at asset time.
- **Joe's body not run** (not in scope).
