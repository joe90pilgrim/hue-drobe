# Ticket: Archive the free MakeHuman CC0 asset packs (V2-09)

## Summary
- **Status:** ready. Do soon: the MakeHuman community site is shutting down and moving to Discord, so the download links may stop working.
- **Ceiling:** 30 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Low. Download, verify and record; no app code and nothing to design.
- **Depends on:** V2-07 (done). Blocks V3-06.

## Target Files
New:
- `assets/packs/MANIFEST.md`: the committed record of every archived pack.
- `assets/packs/fetch_packs.py`: a small script that downloads each pack, CRC-tests it and computes its full sha256, so the archive can be rebuilt or checked later.

Read first (do not change):
- `spike/assets/README.md`: the download URL pattern (`https://files.makehumancommunity.org/asset_packs/<pack>/<pack>_cc0.zip`), the mirror rules and the CRC test.
- `docs/decisions/2026-11-16-v2-07-asset-pack-spike.md`, section 6: download date and the 8-character sha256 prefixes to match.

May change:
- `.gitignore` (repo root): add the local zip folder if it isn't already ignored.
- `docs/tickets/decisions-needed.md`: mark the V2-09 storage decision as decided once Joe answers.

Do NOT touch:
- `private/`: real bodies; the spike's unzipped packs in `private/assetpacks/` stay where they are.
- `spike/assets/*.py` and `spike/assets/items.json`: the spike's code, kept as history.
- `docs/decisions/` write-ups: history.
- `app/` and `pack/`: no app or build changes in this ticket.

## Scope
**Goal:** keep our own verified copies of the CC0 packs the app may use, with a record of where they came from.

**Scope:**
- Packs: the six from the spike (shirts01, pants01, skirts01, dress01, shoes01, hair01) plus hats01 and underwear01 for later tickets. All CC0.
- Download each zip whole from `files.makehumancommunity.org` only. Avoid the slow `files2` mirror, and never resume a partial file on a different mirror (that produced corrupt zips in the spike).
- CRC-test each zip (`zipfile.testzip()`, run with `python -I`) and compute its full sha256. The spike recorded only 8-character prefixes, so full hashes must be computed here.
- For the six spike packs, check the new sha256 starts with the spike's prefix. If one doesn't, stop and report: the file on the server has changed.
- Keep the zips outside git, in the two places Joe chooses below.
- `MANIFEST.md` lists for each pack: name, source URL, download date, full sha256, size, licence (CC0, confirmed from the pack's own `packs/<pack>.json`), and which items the app uses or may use.

**Acceptance criteria:**
- All eight zips pass the CRC test and are stored in both chosen places.
- Each stored copy's sha256 matches the manifest; the six spike packs also match the spike's prefixes.
- `MANIFEST.md` and `fetch_packs.py` are committed; no zip is committed.
- `git status` shows no files from `private/` or the zip folder.

**Decisions needed from Joe:**
- **Where to keep the zips.** Recommendation: a private Google Cloud Storage bucket in the app's existing project, plus a copy on Joe's machine in a git-ignored folder (for example `assets/packs/zips/`).
- If the bucket is chosen: its name and region. Recommendation: the same region as the Cloud Run service.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run downloads, CRC tests and hashing in a subagent, and bring back only the results table (pack, size, sha256, CRC pass or fail), not the logs.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done and what's left.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start V3-06.
