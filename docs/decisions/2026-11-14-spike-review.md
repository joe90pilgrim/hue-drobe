# Spike review (independent, for Claude Code)

Date: 14 November 2026, Saturday evening. Reviewer: Claude Opus 5.5, acting as principal developer.
Reviews: `docs/decisions/2026-11-14-spike-writeup.md` and the two decision notes from the same day, `spike/tolerances.json`, `spike/check_reports.py`, `spike/blender/garment.py`, `spike/blender/body_from_measurements.py`, `spike/viewer/main.js`, and the blueprint.
Not read: `private/` (not granted). Anything about Joe's or Beth's real numbers below is inferred from the write-up and the code, and is labelled as a hypothesis.

Spike deadline: Sunday 15 November, evening. The time-box is not extended. Work the tasks in the order given; tasks 1 and 2 matter most.

## Verdict

Provisional go, with a narrower scope than the draft proposes:

- **Body pipeline: go.** It is fast, scripted and repeatable. Its accuracy is less proven than the table suggests (see finding 2), but nothing points to a showstopper.
- **Garment pipeline: go for close-fitting garments only** (tees, shirts, jeans, leggings, fitted knits). It has not been shown to work for anything that hangs away from the body, and milestone 1 in the blueprint includes a midi dress and a jumper.
- The two clipping failures probably share one root cause (finding 3), not two separate bugs.

## Re-run result

`python spike/check_reports.py spike/out` → ALL PASSED (0 failures) on synthetic small, medium and large.

This confirms the arithmetic only. The script re-reads numbers the pipeline wrote and compares them with limits. It does not recompute geometry, and the synthetic runs do not use the code path that fails (finding 1).

## Findings

### 1. The synthetic tests don't use the path that fails

Without a real garment (`G` absent), `body_from_measurements.py` uses default fitting: 1.8 cm room for the trousers and 2.2 cm for the tee, with a minimum 6 mm gap (lines 345–348 and 386–390). With a real garment, it switches to calibrated fitting with a 3 mm gap (`tr_gap = 0.003`, `tee_gap = 0.003`) and room that can fall to 3 mm (lines 350–379 and 393–415).

So the committed tests show 0% clipping because they run the easier path. Joe's real run fails on the tighter one. All three fixtures are also male (`sex_base: "male"`), so nothing committed tests a female body.

Also in `check_reports.py`:

- Line 13 checks body measures against `m["tolerance"]` from the report, not against `tolerances.json`. An old report keeps passing if a tolerance is tightened.
- It does not fail when an expected measure or garment is missing.

### 2. The fit "passes" are mostly circular

Every garment row marked Pass in the write-up is either an input or a calibration target:

| Measure | How the model gets it | Independent? |
| --- | --- | --- |
| Jeans rise, inseam | Waist and hem cuts are placed at crotch ± the real value (lines 351–352) | No, true by construction |
| Tee length | Hem placed at shoulder point minus the real length (line 394) | No |
| Tee neckline width | Neck cut-out ellipse is sized from the real width (lines 391–392) | No |
| Jeans waist, hip, leg opening | Calibration loop until within 0.5 cm (lines 365–379) | No, only shows convergence |
| Tee chest, sleeve | Calibration loop (lines 401–415) | No |

Two of these did not converge. The loop stops within 0.5 cm, but the jeans waist ended at +1.3 and the tee chest at +1.1.

**Hypothesis:** room hit its 3 mm floor (`max(0.003, …)`, lines 379 and 415). That would mean the real garment is smaller than the body plus 3 mm, which you'd expect from stretch denim and a slim-fit tee. Offset shells cannot represent stretch. Confirm from the `CAL trousers` and `CAL tee` lines in the build output.

The body has the same pattern. Chest, waist and hips are solved by bisection to the target at our own landmark heights, so errors of 0.04–0.08 cm only show that the solver converged. Thigh is not solved, only reported (line 451), and it is the largest error at 1.2 cm. Use thigh as the honest estimate of real body accuracy.

Hips are reached partly through `hip-scale-horiz`, which widens the hips without adding depth. That can match the circumference while distorting the side profile. Only the side photo will show it.

### 3. Crotch and neckline clipping: likely a single cause

Both the push-out step (`garment.py` lines 124–135) and the clipping check (lines 234–244) use the **nearest point** on a surface plus that point's normal to decide inside or outside. That breaks down wherever two surfaces come close together:

- **Crotch (hypothesis):** if Joe's inner thighs touch or overlap on the MPFB2 mesh, the nearest cloth to an inner-thigh vertex can be the other leg's shell, facing the opposite way. The point is then reported as showing through. Push-out can be fooled the same way, and the shell can also fold through itself.
- **Neckline:** a 3 mm gap over the hollow at the base of the neck. The failing points sit just past the 1.2 cm near-edge skip (line 237), so the skip is hiding the band where problems are most likely.

The check also only samples body vertices that have a matching garment vertex. Cloth faces passing between vertices are not caught.

### 4. Offset shells have a ceiling, and milestone 1 hits it

A garment here is the body surface pushed outwards. It cannot:

- span the gap between the legs (skirts, dresses, wide-leg trousers)
- add bulk or a separate drape (jumpers, coats, hoods, collars)
- show stretch (finding 2)

The tee hem tube (lines 188–196) is already a workaround for the first of these. Blueprint milestone 1 lists "tee, shirt, trousers, midi dress, jumper". The blueprint also asked for a dress among the spike garments, and none was attempted.

Because fitting happens offline in one fixed pose, Blender's cloth simulation, run headlessly and starting from the offset shell, is a realistic second technique for loose garments. The shell would remain the method for close-fitting ones.

### 5. Garment sizing in the product differs from the spike

The spike sizes each garment from its own flat measurements. The blueprint's wardrobe input is one photo per item, with shape taken from the nearest template, which means no measurements. The product needs a decision:

- (a) users measure every item, or
- (b) each template and cut has a default room profile (for example, slim jeans = body + X cm at hip and Y cm at hem), with flat measurements optional.

The spike tested only (a).

### 6. Runtime blending

Dropping it is reasonable for two users with an offline build. It still has to be written down as a decision, and the blueprint data model updated: `GarmentTemplate.fittedShapes (per body shape)` becomes fitted per profile. The accepted cost is that any change in measurements needs a rebuild on the laptop. The "in-between sizes" criterion is then withdrawn, not passed.

### 7. Privacy

`spike/viewer/public/models/personal/` holds `joe*.glb` and `beth*.glb`. The viewer runs `vite --host` (see `spike/vite.log`), which serves those files to any device on the home network while it is running.

- Confirm the folder is git-ignored. The reviewer could not see `.gitignore`.
- Use `--host` only while testing on the phone.

### 8. Phone performance

60 fps on the Pixel 8 is probably the screen's refresh-rate cap, so it is a pass. It has not been measured on the final models with both garments. Record frame time (ms) as well as fps.

## Tasks for Claude Code

### Task 1: Diagnose the crotch clipping before changing the fit

1. Add a body self-intersection check across the crotch band (crotch −10 cm to +5 cm). Use `BVHTree.overlap` of the body with itself, ignoring faces that share a vertex. Report the count of intersecting face pairs in the report JSON as `body_self_intersections_crotch`.
2. Add a second clipping test, `clipping_report_ray`, alongside the existing one. From each covered body vertex, cast a ray outward along the body normal against the garment. If the first hit is a back face, or there is no hit within 5 cm, the point is showing through. Also sample face centres, not only vertices. Report both tests side by side.
3. Add a "from below" camera to the viewer (a URL parameter such as `?view=below`), and save a front, side, back and below render for Joe's jeans.
4. Write up which cause it is. If it's body self-intersection, fix it on the body (for example a thigh-gap correction or an inner-thigh push), not on the garment.

**Done when:** the cause is named with evidence, and either the jeans and tee pass the limits in `tolerances.json` under the ray test, or the write-up explains why they cannot this weekend.

### Task 2: Get independent evidence of fit

1. Joe, and Beth if possible: front and side avatar renders at the same camera height as the photos, placed side by side with them. A written checklist answer: "looks like my shape, front and side: yes/no, notes".
2. In Blender, measure the avatar's waist and hips with a "tape" at the height Joe would actually place it (he points to it on the render), and compare with the solved landmark heights.
3. Add a female synthetic fixture (`spike/fixtures/synthetic_female_medium.json`) with bust, waist and hips, and make it pass.
4. Beth's real measurements replace the placeholders when she can supply them. This is not blocking if she can't do it by Sunday.

**Done when:** the photo comparison and checklist are in `docs/decisions/` (images stay in `private/`), and the female fixture is in `spike/out` and passing.

### Task 3: Make the checks test what fails

1. Add a synthetic garment fixture (made-up flat measurements, one tee and one pair of slim jeans) so that every build runs the calibrated, 3 mm path on the synthetic bodies.
2. `check_reports.py`: read every tolerance from `tolerances.json`; fail on missing measures or garments; fail when calibration did not converge (have the pipeline write `calibration_converged: true/false` per garment); fail on the ray clipping test once it exists.
3. Log in the report whether room hit its floor for each calibration knot (`ease_at_floor: [...]`).
4. Change the write-up table so the garment landmark rows read "calibration converged (not independent evidence)", and correct jeans waist and tee chest to "did not converge".

**Done when:** `python spike/check_reports.py spike/out` exercises the calibrated path and still reports the true state.

### Task 4: Test the ceiling (if time allows by Sunday)

Attempt one A-line skirt or midi dress on synthetic medium. Start from a tube or cone shell hung from the hips, run Blender cloth simulation headlessly in A-pose, and bake the result. Record time spent, clipping (ray test) and a render.

If there isn't time, the go decision must explicitly move the dress and jumper out of milestone 1 until this is done.

### Task 5: Decisions to record (no code)

Write these up in `docs/decisions/` for Joe to confirm:

- Runtime blending dropped; data model changed to fitting per profile; rebuild on measurement change accepted.
- How garments get their size in the product: option (a) or (b) from finding 5. Reviewer leans to (b), with flat measurements as an optional refinement.
- Milestone 1 garment scope, depending on Task 4.

### Task 6: Housekeeping

- Confirm `spike/viewer/public/models/personal/` is git-ignored; add it if not.
- Re-record Pixel 8 frame rate and frame time on the final Joe models with both garments.

## Revised go conditions

Go to milestone 1 on this pipeline when:

1. The crotch clipping is fixed or explained (Task 1), and the neckline passes the ray test.
2. Joe has judged his avatar against his photos, and the female fixture passes (Task 2). Beth's real check follows as soon as she supplies her numbers.
3. Milestone 1 either includes a working skirt or dress, or excludes loose garments until one works (Task 4).
4. The decisions in Task 5 are recorded.
