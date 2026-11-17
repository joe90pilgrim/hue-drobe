# Ticket: Skirt: fix the waistband and the small body (V3-01a)

## Summary
- **Status:** done 17 Nov 2026. Passes on B, small and large (0 body pairs, 0 self pairs, 0.62 cm clearance, identical rebuilds, hem 1.1–1.3 cm low).
  Small-body cause was self-collision distance (0.6 → 0.3 cm), not the legs; see `docs/decisions/2026-11-17-v3-01a-skirt-fixes.md`.
- **Ceiling:** 2 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Opus · High. Cloth behaviour on the small body isn't understood, and this is 3D work where reworks are expensive.
- **Depends on:** V3-00 (go)

## Target Files
Edit:
- `spike/cloth/skirt_cloth.py`: start shape and waistband outline (the large-body fix), and anything the small-body cause needs.
- `spike/cloth/README.md`: record what changed and why.

Read, don't change:
- `spike/cloth/run_all.py` (run with `--only` to build one body at a time).
- `spike/blender/mesh_checks.py`, `spike/tolerances.json`, `spike/fixtures/`.
- `docs/decisions/2026-11-17-v3-00-cloth-skirt.md`.

Do NOT touch:
- `spike/blender/body_from_measurements.py` and `spike/blender/garment.py`: the bodies and the app's own garments.
- `private/`, apart from writing new renders under `private/cloth_spike/`.
- The pack build and the app.

## Scope
**Goal:** The A-line midi skirt passes the hard checks on Beth and both synthetic female bodies.

**Scope:**
- **Large body:** fix the waistband outline in the start shape, so the top edge no longer dips into the belly (28 of the 30 body pairs exist before the cloth runs). Check the small step at each side near the hip.
- **Small body:** find why the hem rides up and bubbles. The untested guess is that the A-pose legs catch the hem. Test that first.
- Don't retune the cloth settings for one body at a time: one set of settings must work on all three.
- Re-run Beth after each change to make sure she still passes.

**Acceptance criteria:**
- 0 body pairs, 0 self pairs and clearance of at least 0.2 cm on Beth, synthetic female small and synthetic female large.
- Two builds of each body identical (0.0 cm variation), as in the experiment.
- Hem within 2 cm of the target height on all three.
- Front, side and back renders of all three in `private/cloth_spike/`, and a short write-up in `docs/decisions/`.

**Decisions needed from Joe:**
- **If the small body can't be fixed within the ceiling:** ship the skirt for Beth only (she passes) and leave the small body as a known limit, or hold the skirt. Recommendation: ship for Beth only; she's the only real user who'll wear it.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.
