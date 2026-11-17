# Ticket: Skirt in the app (V3-01b)

## Summary
- **Status:** ready once V3-01a is done (or Joe accepts Beth only).
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. Moves a proven spike build into the pack build and adds one layering rule across several files.
- **Depends on:** V3-01a

## Target Files
Edit:
- The pack build script (`build_pack.py`) and its fit config (`pack/fit_config.json`): add the skirt as a build step per body, calling the cloth build from `spike/cloth/skirt_cloth.py` (move it into the pack build's folder if that's the pattern there).
- The app's clothes menu, colour picker and saved-items code: add the skirt as a bottom.
- The app's layering code: the top-over-skirt rule below.
- The checks run by `npm run check`: add the skirt on the synthetic female bodies.

Paths outside `spike/` and `docs/` (the pack build and the app) were not visible when this ticket was written; confirm them before editing.

Do NOT touch:
- `spike/blender/body_from_measurements.py` and `spike/blender/garment.py`.
- `private/`, apart from the pack output folder the build already writes to.

## Scope
**Goal:** Beth can wear the A-line midi skirt in any colour, with a top.

**Scope:**
- Build each person's skirt at asset time, on their own body: blended in-between sizes are untested, so there are none.
- Women's bodies only, like the dress.
- Plain colour, in the clothes menu, colour picker and saved items, as a bottom (it replaces trousers or shorts).
- **Top over skirt:** the app's tee over the skirt clipped by 658 to 1,008 face pairs in the experiment. Implement the rule Joe picks below.
- Tights (V2-04) can be worn with the skirt.

**Acceptance criteria:**
- Passes the hard checks on Beth and the bodies V3-01a passed, inside `npm run check`.
- Top and skirt together pass the agreed rule's check, with no visible clipping front, side and back.
- 30 fps or better on the Pixel 8 with skirt and top on (about 6,000 triangles and 110 KB per skirt, similar to the tee).
- Beth's visual sign-off.

**Decisions needed from Joe:**
- **How should a top sit with the skirt?** (a) Tucked in: the top is cut at the skirt's waistband. (b) Worn over: the skirt's top edge is hidden under the top. Recommendation: (a) tucked in first; it's the simpler build and the common look with an A-line skirt.
- **Lengths and more styles later?** Recommendation: midi only now; add a second length or style only once this one is in use.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.

## Done (17 November 2026)
Skirt and tucked tees (Joe: tucked in, midi only) are built per woman's body by `build_pack.py` and shown in the app; every hard check passes on B and all three synthetic women inside `npm run check`. The Pixel 8 frame rate is still to measure. Beth's sign-off is deferred until V6 is complete (Joe tests everything until then). Record: `docs/decisions/2026-11-17-v3-01b-skirt-in-app.md`.
