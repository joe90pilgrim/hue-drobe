# Ticket: Multiple top layers (V3-05)

## Summary
- **Status:** stopped, not finished (17 Nov 2026). Needed before jackets (V3-04).
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. Rules and checks across the pack build and the app; the geometry support (building one shell over another) already exists from the spike.
- **Depends on:** V3-01b (the first layering rule, top over skirt)

## Target Files
Edit:
- The pack build: build an outer top over the inner one (the spike's `build_tee` supports this with `extra_mesh` and `extra_gap`).
- The checks: a layer check that the outer garment never passes through the inner one.
- The app's clothes state: more than one top at once, in a fixed order.

Paths outside `spike/` and `docs/` (the pack build and the app) were not visible when this ticket was written; confirm them before editing.

Do NOT touch:
- `spike/cloth/` (skirts and coats keep their own build).
- `private/`, apart from the pack output folder.

## Scope
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
