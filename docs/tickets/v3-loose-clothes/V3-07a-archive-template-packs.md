# Ticket: Archive Suits 01 and Shirts 02/03, and allow CC-BY with credits (V3-07a)

## Summary
- **Status:** ready. Do before V3-08 and V3-09.
- **Ceiling:** 45 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Low. Extends an existing download script and the build's licence guard; no geometry.
- **Depends on:** V2-09 (done)

## Target Files
Edit:
- `assets/packs/fetch_packs.py`: add `suits01` (CC0), `shirts02` and `shirts03` (CC-BY). Find each CC-BY pack's exact download URL on the asset-packs page; the CC0 URL pattern may not apply.
- `assets/packs/MANIFEST.md`: add the three packs (size, sha256, licence, author for CC-BY items).
- `pack/build_pack.py` (`prepare_items`): allow `CC-BY` as well as `CC0`, but only when the item's template `meta.json` has a `credit`; refuse anything else.
- `assets/packs/CREDITS.md` (new): one line per CC-BY item the app ships (item, author, licence, source), for the app's credits screen (V3-10).

Do NOT touch:
- The existing archived zips and their hashes.
- `private/`.

## Scope
**Goal:** Keep verified copies of the packs the first two templates come from, and make CC-BY items usable with their credit recorded.

- Download whole from one mirror (`files.makehumancommunity.org`), CRC-test, record the full sha256, and upload to the existing bucket (`gs://huedrobe-joe-4821-asset-packs/asset-packs/`), as V2-09 did.
- Read each item's licence from the pack's own json, not the page.

**Acceptance criteria:**
- The three zips are stored locally and in the bucket, and match `MANIFEST.md`.
- The build refuses a CC-BY item with no credit and accepts one with a credit (a small test proves both).
- `assets/packs/CREDITS.md` exists (empty table until an item ships).

**Decisions needed from Joe:**
- None expected.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Try changes on one body first (`python pack/build_pack.py --only synthetic_medium`, or a female body for women-only items). Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake.
- Use the real Python, not the Microsoft Store `python` alias (see `pack/README.md`).
- **Visual first, gates second:** while tuning a template, render with `spike/blender/render_closeup.py` and report the check numbers without trying to force them to pass. At most three render rounds, then stop and ask Joe.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.

## Done
Archived suits01, shirts02 and shirts03 (CRC pass, sha256 in MANIFEST.md, uploaded to the bucket); `fit_template.pack_licence_error` lets the build accept CC-BY only with a credit (tested).
Authors and the CC-BY credit rule are in MANIFEST.md; CREDITS.md is an empty table until an item ships.
