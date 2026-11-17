# Ticket: Multiple top layers (V3-05)

## Summary
- **Status:** ready. Needed before jackets (V3-04).
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
