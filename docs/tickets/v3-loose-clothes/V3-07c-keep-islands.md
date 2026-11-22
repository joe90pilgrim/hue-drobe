# Ticket: Use part of a pack item: `keep_islands` for templates (V3-07c)

## Summary
- **Status:** ready. V3-09 (blazer) is paused until this is done.
- **Ceiling:** 1.5 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Opus · Medium. This changes the pipeline (`pack/fit_template.py`), which V3-09 may not touch.
- **Depends on:** V3-07

## Problem
Every item in Suits 01 (`assets/packs/zips/suits01_cc0.zip`, CC0) is a whole suit in one `.obj`: jacket, trousers, and in some a waistcoat, tie or bow tie, as separate connected pieces ("islands") of the same mesh. V3-09 needs the jacket only. `fit_template.py` attaches the whole `.mhclo`, and the ticket forbids splitting meshes by hand.
Checked on 18 Nov 2026 (connected components of each `.obj`, y range in MakeHuman units):

| Item | Vertices | Islands | Largest islands (vertices, y from-to) |
| --- | ---: | ---: | --- |
| toigo_male_suit_3 | 8527 | 15 | 4256 (-0.3 to 7.1, jacket), 2053 (-7.6 to 1.8, trousers), 766, 675, 96 |
| toigo_male_suit_tie_and_jacket | 9980 | 7 | 6425 (-0.2 to 7.1), 1129 (-7.6 to 2.6, trousers), 731, 691, 426 |
| toigo_male_double-breasted_suit | 5393 | 17 | 1717 (-7.5 to 2.2, trousers), 1694 (0.5 to 7.0, jacket), 530, 480, 130 |
| toigo_female_suit_2 | 8509 | 15 | 4238 (-1.5 to 5.7), 2053 (-7.8 to 1.0), 766, 675, 96 |

(Which island is which is a guess from the height; the first job is a listing that shows it.)

## Target Files
Edit:
- `pack/fit_template.py` and `pack/test_fit_template.py`: the new field and its validation, tests.
- `pack/templates/README.md`: document it.

Create:
- `pack/list_islands.py` and a short README entry: prints each island of a template's mesh (index, vertex count, height range, centroid) so a person can choose which to keep. Plain Python, no Blender.

Read:
- `docs/tickets/v3-loose-clothes/V3-09-blazer-template.md`, `docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`.

Do NOT touch:
- The legacy offset garments and `spike/blender/garment.py` (CLAUDE.md), and `pack/templates/full/shift_dress/`, whose report must stay byte-for-byte the same in its numbers (the regression test). `shirt_untucked_bd` is not to change either.
- `private/`, apart from the pack output folders.

## Scope
**Goal:** a template's `meta.json` can name which islands of the source mesh to keep, so a pack item that is several garments in one file can be used as one of them. No custom geometry: only deleting whole islands.

- New optional meta field `keep_islands`: a list of island indices (islands numbered by size, largest first, as `list_islands.py` prints them), default `null` (keep everything, as now). Validated in `validate_meta` (ints, unique, non-empty, in range checked at build time) and tested.
- Delete the other islands' faces and vertices from the attached garment before the fit, so they take no part in the loose fit, push-out, settle, checks or export. Keep the `.mhclo` untouched on disk.
- Think through `delete_group`: MPFB hides the body under everything the `.mhclo` lists in `delete_verts`, which for a suit includes the trousers' area. Either restrict the hidden area to the kept islands or require `delete_group: false` when `keep_islands` is set; say which and why in the README.
- Report the kept island indices and counts in the template's report entry.
- Set the choice rule for Joe to see in the README: a list of indices is brittle if the pack is re-archived, so the check should also record the vertex count of the kept islands in `meta.json` and refuse a mismatch (your call if a simpler rule works).

**Acceptance criteria:**
- `python pack/list_islands.py <pack> <asset>` prints the islands of `toigo_male_suit_3` and one other Suits 01 item, and a render or description shows which island is the jacket (use the pipeline's own render path on one body, not a new renderer).
- A scratch template (not committed) with `keep_islands` set to the jacket builds on `synthetic_medium`, with no trousers or other pieces in the output GLB, and its report shows the kept islands.
- Unit tests for the field: valid, wrong type, duplicates, empty list, and the vertex-count refusal if you add it.
- The shift dress's report is unchanged; `npm run check` passes.

**Decisions needed from Joe:** none to start. If the jacket islands cannot be told apart from the rest by island alone (for example the jacket and trousers share one island), stop and say so: the next route is to model the jacket in Blender and convert it with MakeClothes (CLAUDE.md, sources in order).

## Execution Rules
- Read only the Target Files above first.
- Run Blender builds in a subagent and bring back only the numbers and render paths. Try one body first (`python pack/build_pack.py --only synthetic_medium`), with the real Python (see `pack/README.md`).
- Three failed attempts at the same problem, or the ceiling: stop, write down what was done and what is left, and ask Joe.
- When done: commit, add a two-line note here, and stop. Then V3-09 resumes (Sonnet) with `keep_islands` in the blazer's `meta.json`.

## Done (18 Nov 2026)
`keep_islands` + `keep_islands_vertices` in `fit_template.py`, `pack/list_islands.py`; scratch jacket of `toigo_male_suit_3` (islands 0, 2, 4-14, 5799 vertices) built on synthetic_medium: no trousers (GLB 0.79-1.56 m), body as drawn 0 pairs, 0 gap rays; the delete group's legs come back through the existing restore (1366 vertices). Island 2 likely fills the lapel V (high neck panel): V3-09 should try 0 and 4-14 (5033 vertices).
Committed with `npm run check` failing on flaky Playwright timeouts (a different 1-3 tests each of three runs; no app files changed), on Joe's say-so.
