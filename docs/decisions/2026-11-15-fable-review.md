# Fable review and handover, end of Stage 0 spike

Date: 2026-11-15. Reviewer: Claude Fable 5.2, advisory pass. Written so that Claude Code can pick the work up in a new chat without the original conversation.

Read first: `CLAUDE.md`, `docs/fable-brief.md`, `docs/bug-log.md`. This note answers the brief.

## Result

- **Body: go for Joe.** Beth is unverified.
- **Pipeline (Blender offline, glTF, three.js on the phone): go.** 60 fps and 744 KB against a 15 MB limit.
- **Trousers: go once the crotch is fixed.** The crotch failure is cloth crossing cloth, not body through cloth.
- **Tee: not passed.** The drape is wrong and the cause is the method, not the tuning.
- **Recommendation:** record "go: body and pipeline; garments: one more time-boxed day with exit numbers agreed first". This differs from the brief's conditional go. The blueprint's decision rule for "body passes, garments fail on fit" is to re-spike for one more day, and a conditional go would let Stage 1 garment features be built on a method that has not passed.

**This is advice. Joe has not yet confirmed the decision.** Do not start Stage 1 or scaffold the app until he does.

## What was done, and what was not

- Read the brief, bug log, all of `docs/decisions/`, the blueprint, `spike/blender/garment.py`, `spike/blender/body_from_measurements.py`, `spike/check_reports.py` and `spike/tolerances.json`.
- Re-ran `python spike/check_reports.py spike/out`: FAILED, 12 failures on the six synthetic bodies: 10 clipping failures (5 tees, 5 trousers) and 2 trouser calibrations that did not converge (synthetic_large, synthetic_female_large). The per-body clipping figures match the results table.
- Measured the six synthetic builds in `spike/out` (Blender 5.3.0, MPFB 2.0.18) with a throwaway headless script. Numbers are below.
- **Not done:** `private/` was not opened, so nothing here was measured on Joe's or Beth's builds. Every Joe number is quoted from the brief or bug log. No screenshots were taken. No cloth simulation was run. Repo changes from this review: this note, `spike/blender/analyse_meshes.py` and its README entry, all committed in `9211c4f`.

### The analysis script

It is in the repo as `spike/blender/analyse_meshes.py` (copied in unchanged apart from its header comment; see `spike/blender/README.md` for the run command). It is analysis code, not yet a build check. It does the following, using only `bmesh` and `mathutils.bvhtree`:

1. Import `<name>.glb`, `<name>_tee.glb`, `<name>_trousers.glb`; merge duplicate vertices (glTF export splits them); shift so the floor is z = 0.
2. **Pieces and openings:** connected face components of each garment, and closed boundary-edge loops.
3. **Intersections:** `BVHTree.overlap` for body against tee, body against trousers, tee against trousers, and each garment against itself (ignore face pairs that share a vertex).
4. **Clearance:** for every cloth vertex, distance to the nearest body point, signed by that point's normal.
5. **Shoulder gap:** the same clearance, restricted to tee vertices with z above HPS minus 7 cm, 4 to 20 cm from the centre line, and vertex normal z above 0.6; grouped in 2 cm bands of distance from the centre line. HPS comes from `hps_height_cm_estimate` in the report.
6. **Circumference by height:** bisect each mesh with a horizontal plane every 5 cm and take the loop centred on the body axis.
7. **Centre-line profile:** horizontal rays from the front and from the back at x = 0, every 4 cm of height, recording where they first meet body, trousers and tee.

Run as: `blender --background --python spike/blender/analyse_meshes.py -- spike/out <name> <hps_cm> <output_folder>`.

A camera-style visibility test was also tried (rays from 36 directions at several elevations). It is **not reliable as written**: it counts legitimate sightlines into the neck opening and up the trouser legs. Do not quote its numbers.

## Measurements (six synthetic bodies)

| Body | Stray tee island (faces, cm²) | Tee pieces / openings | Shoulder gap, worst band mean / max (cm) | Trouser self-intersecting face pairs | Tee through trousers (pairs) | Body through either garment (pairs) |
| --- | --- | --- | --- | --- | --- | --- |
| synthetic_small | 40, 5.1 | 2 / 5 | 2.11 / 3.10 | 28 | 0 | 0 |
| synthetic_medium | 44, 5.5 | 2 / 5 | 1.77 / 2.83 | 24 | 0 | 0 |
| synthetic_large | 60, 10.0 | 2 / 5 | 1.92 / 2.94 | 38 | 0 | 0 |
| synthetic_female_small | 28, 1.9 | 2 / 5 | 1.46 / 2.13 | 11 | 0 | 0 |
| synthetic_female_medium | 44, 4.6 | 2 / 5 | 1.64 / 2.21 | 23 | 0 | 0 |
| synthetic_female_large | 52, 6.7 | 2 / 5 | 1.80 / 2.55 | 28 | 40 | 0 |

Other figures:

- Smallest cloth-to-body clearance on every tee: 0.30 to 0.31 cm, which is the designed 3 mm floor.
- Shoulder gap falls to about 0.4 cm at 16 to 20 cm from the centre line (the shoulder point) on every body. The float is on the slope between neck and shoulder point, 8 to 12 cm out.
- Stray island sits 12 to 16 cm in front of the neck centre, 0 to 4.7 cm above HPS, within 2.2 cm of the centre line.
- Trouser self-intersections are all within about 10 cm of crotch height. No trouser boundary edges near the crotch (`boundary_verts_near_crotch` is 0), so there is no hole.
- synthetic_female_medium tee has 3 self-intersecting face pairs.
- Tee circumference on synthetic_medium (target chest 106 cm): 105.2 cm at chest height (z 129), 91.0 cm at the waist (z 109), 114.6 cm at the hem (z 79). The body is 99.3 and 84.1 cm at the same two heights. A real tee is roughly the same circumference from chest to hem.
- Tee back profile on synthetic_female_medium, distance behind the centre line: 7.6 cm at the shoulder blades, 4.9 cm at the waist, 10.5 cm over the buttocks. The cloth dips 2.7 cm inwards below its widest point above, then goes out 5.6 cm. Across the six bodies the back dip is 0.9 to 2.7 cm.
- Crotch ray test on synthetic_medium, repeated with positions: 267 covered, 12 "front face first", 4 "no hit". The front-face hits are at x within 2 cm of the centre, with the nearest cloth 1.3 to 3.9 cm away: one leg's shell crossing the other.

## Findings

### F1. The clipping test does not measure body through cloth

- Body and cloth triangles never intersect, on any body, for either garment, and clearance never drops below 3 mm. By that measure the "no body through cloth" criterion passes on the synthetic bodies. **Not checked on Joe's build.**
- What the ray test counts at the crotch is mostly the two leg shells crossing each other in the fold (the self-intersection column above). That is a real defect, but it is cloth through cloth.
- On the tee, flagged samples sit at the sleeve ends (x 28 to 36 cm, z 122 to 128 cm on medium) and the armpit (x 18 to 19 cm, z 131 to 132 cm). That is consistent with open-edge effects and sightlines up the sleeve. **Not proven.**
- The 0.5% limit is noise: a 0.48% pass and a 0.54% fail differ by two samples in about 3,300.
- `garment_clipping_max_depth_cm` in `spike/tolerances.json` is never read by `check_reports.py`, and `worst_cm` is 0.0 in every report because `clipping_report_ray` only updates it with values that are negative.

### F2. B24, stray fragment under the chin: cause confirmed on all six synthetic bodies

- `define_tee(ref, collar_drop=-0.04)` keeps head faces up to 4 cm above the neck joint (`garment.py:97`, called at `body_from_measurements.py:331`).
- `neckline_drop` returns `None` once a point is more than `b + 0.04` (12.5 cm) from the neck centre in y (`garment.py:62`), so `in_neckline` never removes faces further forward than that. The underside of the chin is left as an island.
- I did not step through the code in a debugger; the island's position matches this exactly on all six bodies.

### F3. B23, floating shoulders: now measured

- Cause: the calibrated chest ease (1.8 to 2.8 cm on these builds) is applied along the vertex normal everywhere (`garment.py:143`). Where the surface faces up, that lifts the cloth by the full ease. Smoothing then bridges the hollow between neck and shoulder. On the convex shoulder point smoothing pulls the cloth back to the minimum gap, which is why that part is fine.

### F4. B22, tee drape: the method is the cause

- An offset shell takes its size from the body at each height. So the tee gets narrower at the waist and wider at the hips, which no real tee does.
- The reverted "hang" step took the widest point at every angle independently, so it did not keep the garment's circumference and grew into an oversized tube (28.3 cm deep at Joe's hip against a 20.4 cm body, per the bug log).
- The tee fixture has no hem width, so the hem circumference is not even an input.

### F5. Other test and criteria problems

- Garment landmark passes are inputs or calibration targets (already noted in the 14 November review). The blueprint asked for a comparison with the garment as worn. The only one is Joe's tee hem: model 79.6 cm against 83 cm read from the photo, a 3.4 cm miss with about ±3 cm reading error.
- No independent body measure remains: thigh is now solved as well. Neck, upper arm, wrist, shoulder width, arm length and back length are on the blueprint's list and are not used by the solver, so they can serve as hold-outs.
- `check_reports.py:39` applies the 2.0 cm circumference limit to `inside_leg_cm`; it should use the 1.5 cm length limit. Joe's +0.71 cm passes either way.
- Joe's jeans leg opening is +5.3 cm in the brief and results table but 35.5 against 32 cm (+3.5) in the bug log (B3). One of them is wrong or stale.
- The blueprint's recognisability criterion is missing from the results table. Joe's side view (B10) is not done; Beth has judged nothing.
- Arm lengths are not measured, so "height and limb lengths" is only partly shown (the brief says so).
- Phone result is one device, model and browser not recorded for the final scene; 60 fps is probably the display cap, so record frame time too.

## Answers to the brief's five questions

1. **Method.** Cloth simulation is the right next step for the tee, with two changes to the plan in the bug log:
   - Build the cloth's **rest shape from the garment's own flat measurements** (chest width, hem width, length, sleeve), not from the body shell. The shell can still supply the starting position.
   - **Do not pin the shoulders.** Pinning would freeze the float. Let the cloth land on the body by collision, with enough friction that it does not slide off.
   - Fallback if the test fails its box: a geometric tube that keeps the garment's circumference at every height and is pushed out only where the body or trousers protrude.
   - It will **not** settle B1. Jeans sit at their ease floor and tight cloth in a fold is where simulation is weakest. B1 needs a geometry fix (task 4).
   - Unverified: whether Blender 5.3 cloth behaves well headlessly at 3 mm clearances, and whether the bake is repeatable. The three-hour test settles both.
2. **Clipping limit.** Drop the 0.5% fraction. Replace it with hard zeros (task 1).
3. **Leg opening.** Measure above the foot. Put the hem at the lowest height where body girth plus minimum ease fits the opening, and report the leftover inseam as a separate number. Do not model the taper over the heel yet.
4. **Colour.** A white reference is not enough as the main route: it corrects white balance but not exposure, shadow or the phone's processing, and the screen is uncalibrated. Use the photo with a white and a mid-grey reference as the first guess, then have the user confirm against the real item and nudge lightness, warmth and strength. Unverified what error this achieves; ten items shot in daylight and in warm light would let Joe set a delta E limit, as the blueprint plans for Stage 2.
5. **Go or no-go.** See Result.

## Tasks for Claude Code, in order

Work only inside `spike/`. Each task reports its numbers. Nothing here needs a new dependency or a network call.

### Task 0: Joe confirms the decision

Ask Joe to confirm or reject the recommendation in Result, and the exit numbers in task 5. Record his answer in `docs/decisions/`. Also ask him the three open decisions at the end of this note.

### Task 1: Replace the clipping test (about 1 to 2 hours)

1. Fold the checks in `spike/blender/analyse_meshes.py` into the build so their results are written into `<name>_report.json` (drop or repair the camera visibility part).
2. In `spike/tolerances.json` and `spike/check_reports.py`, add hard limits:
   - body-to-garment intersecting face pairs: 0
   - garment self-intersecting face pairs: 0
   - garment-to-garment intersecting face pairs: 0
   - minimum cloth clearance: at least 0.2 cm
   - tee: 1 piece, 4 openings; trousers: 1 piece, 3 openings
3. Keep the ray fraction as information only. Remove or wire up `garment_clipping_max_depth_cm`. Changing the tolerance file needs Joe's review.
4. Fix `check_reports.py:39` so `inside_leg_cm` uses `length_cm`.
5. Run on Joe's build in `private/out` and report whether body-to-cloth intersections are also 0 there.

**Done when:** the checker fails today's builds for the right reasons (stray island, trouser self-intersection, female large tee through trousers) and no longer on the ray fraction.

### Task 2: B24 (under an hour)

After the neck cut in `build_tee`, keep only the largest connected component. Optionally also delete any face above the neckline height regardless of its y position.

**Done when:** every tee has 1 piece and 4 openings (now 2 and 5), and `?view=neckfront` shows nothing under the chin.

### Task 3: B23 (about 1 hour; skip if task 5's simulation lands first and fixes it)

In `build_tee`, fade the ease to `min_gap` where the body normal points up (for example, full ease at normal z below 0.3, minimum gap at normal z above 0.8), above armpit height only. Re-run chest calibration.

**Done when:** shoulder gap is at most 0.5 cm mean and 1.0 cm maximum between the neck edge and the shoulder point on all six synthetic bodies and Joe (now 1.5 to 2.1 cm mean, up to 3.1 cm), and tee chest calibration still converges.

### Task 4: B1 crotch (about 1 to 2 hours)

Stop the two leg shells crossing the centre plane: in the fork zone, keep shell vertices that came from the left leg on the left of the plane and those from the right leg on the right, with a small gap between.

**Done when:** trouser self-intersecting pairs are 0 on all bodies (now 11 to 38) and calibrations are unchanged.

### Task 5: B22 tee drape, time-boxed to 3 hours

1. Add `hem_circ_cm` to the tee fixtures (and front and back length if Joe measures them; see B7).
2. Build a tee rest shape from the garment's measurements, start it from the current shell position, and run Blender cloth headlessly in A-pose with body and trousers as collision objects, no shoulder pins. Bake and export.
3. Try synthetic_medium and synthetic_female_large first, then Joe.
4. If the box runs out, stop and report, then build the circumference-keeping tube as the fallback.

**Done when (exit numbers, to be confirmed by Joe):**

- tee is one piece with four openings
- shoulder gap at most 0.5 cm mean, 1.0 cm maximum
- tee circumference (path length round the section, folds included) within 2 cm of the garment's own at waist and hem (now 15 cm short at the waist on synthetic_medium)
- zero body-to-cloth, cloth-to-cloth and tee-to-trousers intersections
- silhouette depth at chest, waist and hem within 2 cm of Joe's side photo
- Joe says yes by eye, front and side
- same result from two consecutive builds

Record the bake time and the download size afterwards, and re-run the phone check.

### Task 6: smaller items

- B3: move the leg-opening measurement above the foot as in answer 3, and resolve the +5.3 against +3.5 disagreement.
- Female large: the tee passes through the trousers (40 pairs). Task 1 will flag it; fix after task 5, since the tee method changes.
- B15: add fixed front, side and back baseline renders. They would have caught B24 on the first day.
- Hold-out body measures: report neck, upper arm, shoulder width and arm length for Joe against his tape, without solving for them.
- B18: read the licence file inside the installed MPFB add-on (local, no network) and record what it says about exported meshes. My recollection, unverified, is that MakeHuman places exported models under CC0.
- Beth: real measurements and her own by-eye check (B5, B14) before the body is called a go for her.

### Can wait

B2 (goes away with task 1 if it is a test artefact), B4 (record a stretch flag), B6 colour, B7 curved hem, B8 chest ripple (likely goes with task 5), B9, B16, B17.

## Disagreements with decisions already made

Flagged for Joe; none has been acted on.

1. **Offset shell as the garment method** (`2026-11-14-garment-fitting-method.md`). Right for jeans, leggings and fitted knits. Wrong for anything with real ease, because the garment's size must come from the garment.
2. **"Close-fitting" scope for milestone 1** (`2026-11-14-decisions-to-confirm.md`, decision 3). A tee and a shirt are not close-fitting in the shell's sense, so milestone 1 needs two methods, not one.
3. **Default ease profiles** (decision 2). Sound, but define a profile as garment circumference at chest and hem (body plus X), not as an offset from the body at every height, or the waist cling returns. Allow ease below zero for stretch items and keep the true garment size in the data.
4. **Optional measured refinement** (Joe's addition to decision 2). Refitting needs Blender on the laptop, so this cannot happen on the phone. Needs a decision on whether it is laptop-only.
5. **MPFB output licence.** Still unconfirmed, against the "check licences first" rule in `CLAUDE.md`.
6. **No runtime blending** (decision 1). Agreed.

## Open decisions for Joe

1. Go wording: accept "go on body and pipeline, one more boxed garment day", or keep the brief's conditional go?
2. Are the exit numbers in task 5 the right ones, including the 2 cm silhouette limit against the side photo?
3. May the clipping tolerance in `spike/tolerances.json` be replaced by the hard zeros in task 1?
