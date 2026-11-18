# Ticket: Credits screen for CC-BY assets (V3-10)

## Summary
- **Status:** ready once any CC-BY item is approved to ship (for example the V3-08 shirt).
- **Ceiling:** 45 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Low. One simple screen that reads a list.
- **Depends on:** V3-07a

## Target Files
Edit:
- The app's settings or about area (find it in `app/`): add a "Credits" screen.
- The build: copy `assets/packs/CREDITS.md` (or a JSON made from it) into the app's assets.

Do NOT touch:
- Garment or pack build code.

## Scope
**Goal:** Credit the authors of the CC-BY assets the app ships, as their licence requires.

- List each shipped CC-BY item: name, author, licence (with a link to the licence) and source.
- Also thank MakeHuman and MPFB generally (CC0 needs no credit, but it's courteous).
- Works offline.

**Acceptance criteria:**
- The screen lists every CC-BY item in the pack and nothing that isn't shipped.
- The end-to-end test opens it.
- Joe's visual sign-off.

**Decisions needed from Joe:**
- Where should it live? Recommendation: under settings, as "About and credits".

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Try changes on one body first (`python pack/build_pack.py --only synthetic_medium`, or a female body for women-only items). Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake.
- Use the real Python, not the Microsoft Store `python` alias (see `pack/README.md`).
- **Visual first, gates second:** while tuning a template, render with `spike/blender/render_closeup.py` and report the check numbers without trying to force them to pass. At most three render rounds, then stop and ask Joe.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.
