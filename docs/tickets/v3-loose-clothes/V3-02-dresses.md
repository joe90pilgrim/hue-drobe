# Ticket: Dresses from the free packs (V3-02)

## Summary
- **Status:** ready once V3-06 is done.
- **Ceiling:** 1 hour. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. The pipeline work is in V3-06; this adds one pack item to the app.
- **Depends on:** V3-06

## Target Files
Edit:
- The pack build's item list or config: add `toigo_shift_dress` (Dress 01, CC0, archived in V2-09) through the V3-06 pipeline.
- The app's clothes menu, colour picker and saved-items code: add the dress.
- The app's layering code: wearing the dress takes off the top and bottom; tights stay.

Paths outside `spike/` and `docs/` (the pack build and the app) were not visible when this ticket was written; confirm them before editing.

Do NOT touch:
- The app's own garment code (`spike/blender/garment.py`) and the cloth skirt (`spike/cloth/`).
- `private/`, apart from the pack output folder.

## Scope
**Goal:** Beth can wear a dress on her avatar, in any colour.

**Scope:**
- The pack shift dress, plain colour, with the body hidden under it, through V3-06.
- Women's bodies only (on Joe's body, skin showed at the shoulders and chest in V2-07).
- About 13,600 triangles, three and a half times a tee: check the frame rate.

**Acceptance criteria:**
- Passes the "body as drawn" check on Beth and the female synthetic bodies.
- 30 fps or better on the Pixel 8 with the dress on.
- Beth's visual sign-off, front, side and back.

**Decisions needed from Joe:**
- **More dress styles?** Dress 01 to 03 hold more (Dress 02 and 03 are CC-BY and need a credits screen). Recommendation: shift dress first; one more only if Beth asks.
- **Tights with the dress?** Recommendation: yes.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.
