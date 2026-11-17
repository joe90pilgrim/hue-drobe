# Ticket: Jackets and coats (V3-04)

## Summary
- **Status:** ready once V3-05 is done. Rewritten after the cloth experiment.
- **Ceiling:** 2 hours (hard stop) for the first jacket. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Opus · High. An outer layer over other garments, with an open front, is the hardest garment geometry on the roadmap.
- **Depends on:** V3-05

## Target Files
Edit:
- The garment code in the pack build: a jacket built as an offset shell over the inner garment (the spike's `build_tee` already supports an inner layer via `extra_mesh`).
- For the long coat only: the hem below the hips may use the cloth build from `spike/cloth/skirt_cloth.py`, as the skirt does.
- The app's clothes menu and layering code.

Paths outside `spike/` and `docs/` (the pack build and the app) were not visible when this ticket was written; confirm them before editing.

Do NOT touch:
- `spike/blender/body_from_measurements.py`.
- `private/`, apart from the pack output folder.

## Scope
**Goal:** Joe and Beth can wear one jacket over a tee or shirt; a coat follows if the jacket works.

**Scope:**
- One hip-length jacket first, on Joe, over the tee, then over the shirt and sweatshirt.
- Built over the inner garment, never through it, using the layering rules from V3-05.
- A coat only after the jacket passes; its lower part may use cloth simulation, like the skirt.
- Plain colour.

**Acceptance criteria:**
- The jacket passes the hard mesh checks on Joe, Beth and the synthetic bodies, and the layer check over each allowed inner top.
- 30 fps or better on the Pixel 8 with tee, jacket and trousers on.
- Joe's and Beth's visual sign-off.

**Decisions needed from Joe:**
- **Open or closed front?** Recommendation: closed first; an open front shows the inner layer and its edges, which is much harder.
- **Which jacket first?** Recommendation: a plain zip-up or bomber-style jacket, with no lapels.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.
