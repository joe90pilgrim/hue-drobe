# Ticket: Multiple top layers (V3-05)

## Summary
- **Status:** ready, app side only. Joe decided on 17 Nov 2026 to ship only the layer combinations that pass on each body, with no further procedural geometry work. The remaining scope is under "Remaining work after Joe's decision" at the end of this ticket; the sections in between are the original scope, kept as history.
- **Ceiling:** 1 hour. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. App-side state plus a per-body list from the existing build; no geometry.
- **Depends on:** V3-01b (the first layering rule, top over skirt)

## Target Files
Edit:
- `pack/build_pack.py`: record, per body, which layered combinations passed, in the pack the app loads. Leave failing combinations out of that body's pack.
- The app's clothes state and outfit screen in `app/`: a base top plus one mid top at once, offering only the passing combinations for the signed-in person.
- The end-to-end test: wear one passing combination.

Do NOT touch (Joe's decision of 17 Nov 2026):
- `spike/blender/garment.py`, `spike/blender/body_from_measurements.py`, the layer check in `spike/blender/mesh_checks.py`, and `spike/tolerances.json`. No changes to make more combinations pass.
- `spike/cloth/`.
- `private/`, apart from the pack output folder.

## Scope (original, kept as history; the current scope is at the end)
**Goal:** Wear more than one top at once, such as a tee under the sweatshirt or a shirt under the sweatshirt.

**Scope:**
- Layer order: base (tee), mid (shirt, sweatshirt), outer (jacket, from V3-04).
- Each outer layer is built over the inner one per allowed combination, at asset time.
- The app only offers combinations that were built and checked.

**Acceptance criteria:**
- Every allowed combination passes the hard mesh checks and the layer check on all bodies.
- 30 fps or better on the Pixel 8 with the heaviest allowed combination.
- Joe's visual sign-off on each combination.

**Decisions needed from Joe:**
- **How many layers at most?** Recommendation: three (base, mid, outer).
- **Which combinations?** Recommendation: tee under shirt, tee under sweatshirt, shirt under sweatshirt; jackets added in V3-04.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.

## Note
Stopped after repeated failed attempts at one problem: the pack build makes the layered tops (sweatshirt and the three shirts over the tee, built over all three necklines) and the layer check runs, with 0 face pairs and every other check passing on the synthetic medium man, but 12 checks fail by about 1 mm where a tee vertex sits within 0.1 cm of the outer top at the side of the shoulder (limit 0.2 cm). The app is not started, only one body was built, and the work is on branch `feat/V3-05-layers`; see `docs/decisions/2026-11-17-v3-05-layers.md`.

Second pass (17 Nov 2026): the medium man's 1 mm shoulder failure was a sign error in the layer check (fixed; the medium and small men now pass everything), but the first build of all six bodies fails for real on the other four (crossings, self-intersections, the tee through the top by up to 0.64 cm). Still stopped; see the decision record's second-pass section for the next step to choose.
Third pass (17 Nov 2026): a pinned cloth settle over the tee (`drape.settle_over`) removed the tee crossings on female large (28 to 17 failures; the medium man still passes), but the tee stays uncovered by up to 1 cm at the A-pose armpit on every top. Still stopped; options in the decision record.
Fourth pass (17 Nov 2026): starting the outer top from the tee at tight spots made it worse (27 failures) and was reverted. The fold is in the tee's own shape at the A-pose armpit. Handed to Fable; see the decision record.
Fifth pass (17 Nov 2026): the tee's armpit was diagnosed as a folded pocket in the A-pose slot. Opening it with a patch (`armpit_open`, off by default) keeps the tee passing on its own, removes most of the tops' self-intersections and cuts the gap from 1.19 to 0.80 cm, but female large still fails 17 checks.
Stopped after three attempts; the six-body rebuild and `npm run check` were not run. See the decision record's fifth-pass section.
Fifth pass, follow-up (17 Nov 2026): on all six bodies the opened armpit gave 106 failures against 56 without it (it breaks the medium and small men, which pass without it), so Joe kept it off. Still stopped: female large, female medium, female small and the large man fail the layered tops.

## Direction after the template decision (17 Nov 2026)
Joe approved the template pipeline (`docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`). No more procedural work goes into layering the legacy tops. New layered garments (V3-08 shirt, V3-09 blazer) get their layering from `pack/fit_template.py` (V3-07).

**Decided by Joe (17 Nov 2026): (a).** The question was: what happens to the legacy layered combinations (sweatshirt and shirts over the tee)?
- (a) Ship only the combinations that pass on each body (the build already checks every combination per body, and the app offers only what was built and checked), and stop there.
- (b) Drop legacy layering and wait for template tops.
- Recommendation: (a). It costs one short ticket (app side only) and no more geometry work. If (a), the remaining work is the app's layer state and offering only passing combinations: Sonnet · Medium, 1 hour.

## Remaining work after Joe's decision (17 Nov 2026)
- **Status:** ready, app side only.
- **Ceiling:** 1 hour. The most this ticket may take, not a target. Stop as soon as the criteria below are met.
- **Worker:** Sonnet · Medium.
- **No more geometry work.** Don't change `spike/blender/garment.py`, `body_from_measurements.py`, the layer check or the tolerances to make more combinations pass.
- **Build side:** the pack build already builds and checks every allowed combination per body (tee under shirt, tee under sweatshirt). Make it record, per body, which combinations passed, in the pack the app loads. A combination that fails on a body is left out of that body's pack, not fixed.
- **App side:** allow a base top plus one mid top at once, in a fixed order. Offer only the combinations listed as passing for the signed-in person's body.

**Acceptance criteria:**
- For each body, the pack lists the passing combinations, and the app offers exactly those and no others.
- `npm run check` passes, and the end-to-end test wears one passing combination.
- Joe's visual sign-off on each combination offered to him and to B.

## Note (17 Nov 2026, app side done)
`check_reports.py --layers` now leaves a failing layered top out (`OMIT`) instead of failing the build and writes `<body>_layers_pass.json`; `build_pack.py` puts only the passing tops in the pack and lists them in `manifest.json` (`garments.layers.combinations`: top -> necklines). The app (new `Under` row, `viewer.layers()`) offers a tee under a sweatshirt or shirt only for those; unit and e2e tests added; `npm run check` passes (the e2e stubs the manifest). On the six synthetic bodies the passing set is, e.g., all three shirts on female medium and the sweatshirt on the medium man.
Not done: the private packs for Joe and B are not rebuilt (`python pack/build_pack.py --private`), so there is no real-body render or phone frame rate yet for Joe's sign-off, and a saved outfit does not record the tee under (it needs a data-model field; ask Joe).
