# Garment fitting: offset shells on a shared body mesh

Date: 2026-11-14. Status: working in the spike, not yet compared with real garments.

## Decision
Garments are templates defined once as a set of body faces, then rebuilt per person as a smoothed offset shell of that person's own MPFB2 body (2.2 cm ease for the tee, 1.8 cm for trousers, minimum 0.6 cm gap), with straight hem and sleeve cuts.

## Why
Every MPFB2 body shares its vertex layout, so one template re-fits to any body the script generates. Each person's garment is fitted offline, so the phone loads a finished pack.

## Consequence for the blueprint
The blueprint planned pre-fitted small, medium and large shapes blended at runtime. For two users, fitting per person offline looks simpler and more accurate. Runtime blending is untested and may not be needed. The blueprint criterion "blended in-between sizes look plausible" is therefore NOT yet tested.

## Results (synthetic small, medium, large male bodies, plus Joe and Beth; placeholders for most of Joe's and Beth's values)
All circumferences within 2 cm, height within 0.1 cm, no body showing through either garment. Check: `python spike/check_reports.py spike/out`.

## Caveats
- The clipping check skips body points within 1.2 cm of an open fabric edge (about 10% of covered points), because inside/outside is not meaningful there.
- Hips and waist solving needed the body-weight macro and a hip-scale control as well as the measure controls, because those saturate near +/-1.
- Landmarks (waist, hips, chest) are our own definitions; they may differ from where a tape is placed.
- Garment hem, sleeve and inseam are untested against real garments.
