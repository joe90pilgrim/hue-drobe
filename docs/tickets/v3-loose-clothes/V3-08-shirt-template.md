# Ticket: First template: a shirt from Shirts 02/03 (V3-08)

## Summary
- **Status:** ready once V3-07 and V3-07a are done.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. Data work on the V3-07 pipeline: choose the item, write `meta.json`, tune within three render rounds. If the pipeline itself needs changing, stop: that belongs in a V3-07 follow-up on Opus.
- **Depends on:** V3-07, V3-07a

## Target Files
Create:
- `pack/templates/mid/<shirt_id>/meta.json` and `notes.md`.

Read:
- `pack/templates/README.md` (schema), `assets/packs/MANIFEST.md`, the Shirts 02 and 03 items' thumbnails and licences.
- `docs/tickets/v3-loose-clothes/V3-03-shirts.md`: the procedural shirt, for comparison.

Do NOT touch:
- `pack/fit_template.py` and `pack/author_template.py` (report pipeline problems instead).
- The procedural shirts in `spike/blender/`: they stay as they are.
- `private/`, apart from the pack output folders.

## Scope
**Goal:** Prove the template route on a shirt, side by side with the existing procedural shirt.

- Pick one long-sleeved collared shirt from Shirts 02 or 03 (CC-BY), most like the procedural shirt. List the candidates and why you chose one.
- `layer: mid`, `allowed_bodies: both` if it looks right on both, `inner_layers: [base]` so it can go over the tee.
- Build on synthetic medium first, then Joe, B and the other synthetic bodies.
- Render each round with `render_closeup.py`, next to the procedural shirt. At most three rounds.

**Acceptance criteria:**
- Renders of the template shirt and the procedural shirt side by side, front, three-quarter and back, on Joe and B, in `private/` (and on the synthetic bodies in `pack/out/renders/`).
- The report numbers for every body, with any check that would fail once approved.
- A short comparison in `notes.md`: time spent, look, and check numbers, against the procedural shirt.
- **Joe's visual sign-off.** Only then set `approved: true` and make the checks pass.

**Decisions needed from Joe:**
- **Which shirt wins?** From the side-by-side renders: keep the procedural shirt, switch to the template, or offer both.
- Credits: the shirt is CC-BY, so it needs a credit line in the app (V3-10) before it ships.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Try changes on one body first (`python pack/build_pack.py --only synthetic_medium`, or a female body for women-only items). Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake.
- Use the real Python, not the Microsoft Store `python` alias (see `pack/README.md`).
- **Visual first, gates second:** while tuning a template, render with `spike/blender/render_closeup.py` and report the check numbers without trying to force them to pass. At most three render rounds, then stop and ask Joe.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.
