# Ticket: Patterns: data model, pattern picker and second colour picker (V9-01)

## Summary
- **Status:** Ready, subject to the decisions below.
- **Ceiling:** 3 hours maximum. Stop the moment the acceptance criteria are met.
- **Worker:** Sonnet · High. Several files and a data change, but all follow existing patterns.
- **Depends on:** Nothing open. V9-02 (2D drawing) follows this ticket. **Do not deploy this ticket on its own:** the new controls change nothing visible until V9-02 lands.

## Target Files
Read these first, and only these:

**Edit**
- NEW `app/src/patterns.ts` (pattern ids and labels, `isPatternable(garmentId)`, a clean-up function; shared by V9-01, V9-02 and V9-03)
- `app/src/wardrobe.ts` (`SavedItem` ~227, `cleanItems` ~291, `ensureItem`/dedupe key ~337, `autoName`, `wearItem` ~370)
- `app/src/outfits.ts` (`wearOutfit` ~130 only)
- `app/src/screens/try-on.ts` (editor ~186-218, chooser use ~252, `itemKey` ~311, `ensureItem` calls ~645 and ~700, kv load and save of `colours` ~254/520/535/625/652; add the `patterns` state)
- `app/src/colour-chooser.ts` (one instance gets a target: base colour or pattern colour)
- `app/src/backup.ts` (`KEYS`, only if the new `patterns` key is chosen)
- `deploy/datastore.mjs` (`SYNC_KEYS`, line ~13, same condition)
- `app/src/style.css` (only what the new rows need)
- Tests: `app/tests/wardrobe.test.ts`, `outfits.test.ts`, `backup.test.ts`, `sync-keys.test.ts`; `app/e2e/colour-chooser.spec.ts`, `try-on.spec.ts`, `wardrobe.spec.ts`
- NEW `docs/decisions/2026-11-27-v9-patterns.md` (the decision record)
- `docs/tickets/README.md` (add a "Version 9: Patterns" section with this ticket's row)

**Read-only reference:** `app/src/colour-maths.ts`, `app/src/favourites.ts`, `app/e2e/helpers.ts`, `docs/decisions/2026-11-16-v2-06-data-model.md`, `docs/decisions/2026-11-18-v4-data-off-device.md.md`

**Do NOT touch:** `app/src/silhouettes.ts`, `app/src/paper-doll.ts`, `app/src/viewer.ts` (drawing is V9-02; 3D is V9-03), `deploy/packing.mjs`, `app/src/packing-template.ts`, `app/src/match.ts`, `pack/`, `spike/`, `private/`, `CLAUDE.MD`.

## Scope

### Goal
Every piece except shoes can have a pattern and a second colour. The Try On editor gets a Pattern row and a Pattern colour button. The choice is remembered, saved with a piece when it is added to the wardrobe, and carried through backup and sync. Nothing is drawn yet; V9-02 does that.

Joe's decisions (27 Nov 2026): 2D goes first and 3D keeps showing the base colour for now; two colours only (base plus pattern colour); every garment takes a pattern except shoes; five options: plain, horizontal stripes, vertical stripes, spots, flowers.

### What the scout found
- Try On's `colours` is keyed by garment id (`tee`, `blazer_male`, `hair`), not mesh name. The Under slot's tee shares `colours.tee` with the Top slot, so a pattern on the tee applies to both, exactly as colour does today.
- `SavedItem` is `{v:2, id, garment, neckline?, sheer?, colour, name, savedAt}`. `cleanItems` rebuilds each record from known fields only, so unknown fields are **dropped** on load, backup and sync. New optional fields must be added there. Earlier optional fields (`sheer`, etc.) were added without a version bump; do the same.
- The `ensureItem` dedupe key (~337) must include pattern and pattern colour, or two patterns of the same base colour merge into one item.
- `wearItem` and `wearOutfit` write `colours[garment]` only. They must also set or clear the pattern state, or a plain item would inherit a stale pattern.
- `Outfit` holds item ids only, so it needs no change. `OutfitLook` holds whole items and picks up the fields automatically.
- `deploy/server.mjs` only checks the key list, JSON and the 256 KB limit; it does not whitelist item fields, so new fields on existing keys pass. Only a **new synced key** needs `deploy/datastore.mjs` changed, and `tests/sync-keys.test.ts` fails if the app and server key lists differ.
- Backup version stays 1: `parseBackup` only rejects a newer version.
- Rollout risk: an older app build open on another device would drop the new fields when it re-saves. Joe and Beth should refresh the app after deploy.
- The colour chooser (`createColourChooser({input, commit, toggleFavourite})`) is appended inside `#editor` and opened by `chooseBtn`. Keep **one** instance and give it a target (base or pattern); a second instance would make `page.locator('.chooser')` match two nodes and break the e2e spec.
- Editor order today: Garment chips, Sleeves, layer note, Sheerness, Neckline, Colour button plus heart, Add to wardrobe. `try-on.spec.ts` (~52) asserts garment < neckline < colour < add. Put **Pattern and Pattern colour after Colour and before Add to wardrobe.**
- Pattern picker: five options fit `.chips` in `.chip-fade` (as Garment does). `.seg` is for two or three.
- E2E constraints: every control at least 44 px; the word "Save" appears exactly once on Try On; `chooseButton` is `/^Colour(, |$)/`, so name the new button "Pattern colour, <name>"; the slot-row count stays 9.
- Matching (`match.ts`) uses the base colour only. A patterned piece still ranks by its base colour. Leave it.
- The Gemini packing payload sends only `{id, garment, name, colour}`; `deploy/packing.mjs` rebuilds those four fields. Leave it unchanged.
- This ticket overturns the 16 Nov 2026 decision "shape plus colour for garments; textures for hair and shoes only" (`docs/tickets/decisions-needed.md` ~124) and the `CLAUDE.MD` line "Plain colour for every garment except hair and shoes".

### Acceptance criteria
- [ ] `patterns.ts` defines the five pattern ids (plain, horizontal stripes, vertical stripes, spots, flowers) with labels, and `isPatternable(garmentId)`: true for every garment id whose slot is not Shoes; false for shoes, `hair` and unknown ids.
- [ ] `SavedItem` gains optional `pattern` and `patternColour`, omitted when plain. `cleanItems` drops an unknown pattern id, an invalid hex, or any pattern on a shoe. A plain item round-trips through load, backup and sync with no new fields (`backup.test.ts` `toEqual` still passes).
- [ ] `ensureItem` treats pattern and pattern colour as part of identity. `autoName` includes the pattern word within the 40-character cap (see decision 2).
- [ ] Try On keeps pattern state per garment id and remembers it across reloads (see decision 1). Wearing a saved item or an outfit sets or clears it. A test shows a plain item worn after a patterned one leaves no pattern behind.
- [ ] The editor shows a Pattern row after Colour and before Add to wardrobe. Picking any pattern other than plain shows a "Pattern colour, <name>" button. Neither appears for shoes or hair. The first time a pattern is chosen, its colour defaults to one that contrasts with the base (a light colour on a dark base, a dark one on a light base).
- [ ] The pattern colour uses the same chooser (swatches, Basics, favourites, Fine-tune) through a single instance. The back button and the favourite heart act on the colour being edited.
- [ ] Add to wardrobe saves the pattern and pattern colour, and the same piece in a different pattern is a separate item.
- [ ] Sync and backup carry the new data. `sync-keys.test.ts` passes with the lists changed in both places.
- [ ] Plain outfits behave exactly as before: all existing tests pass unchanged, the 3D avatar still shows base colour only, packing and Gemini payload tests are untouched and pass.
- [ ] `docs/decisions/2026-11-27-v9-patterns.md` records Joe's four decisions, the overturned 16 Nov rule, the data shape chosen, and proposed wording for the `CLAUDE.MD` line, for Joe to apply himself.
- [ ] Targeted checks pass while working (`npm --prefix app run typecheck`, `npx vitest related <files>`, the affected Playwright specs); the full `npm run check` passes once before the final commit.

### Decisions needed from Joe
Work stops if any is open. Recommendations are marked.
1. **Where Try On remembers patterns.** A new synced key `patterns` (mirrors `colours`; needs `backup.ts` and `deploy/datastore.mjs` edited and the server redeployed), or squeeze them into `colours` (no server change, but untidy). *Recommend: new `patterns` key.*
2. **Names.** Include the pattern word in auto-names (for example "Navy striped tee"). Names already go to Gemini, so the word would too; the pattern fields themselves would not. *Recommend: yes.*
3. **Gemini and matching.** Leave the Gemini payload and colour matching on base colour and name only, so the privacy record stays as it is. *Recommend: yes.*
4. **`CLAUDE.MD`.** Joe applies the one-line change himself from the wording in the decision record. *Recommend: yes, before V9-02 starts.*

## Execution Rules
- Read only the Target Files first. No broad repo search.
- Start from an up-to-date `master` and branch as `CLAUDE.MD` describes; never commit on `master`. Do not push, open a pull request or deploy unless Joe asks.
- Run Playwright and full checks in a subagent and bring back results only.
- No new dependency. Do not edit `CLAUDE.MD`.
- Done means stop: when the acceptance criteria are met, commit, add a two-line note below and the README row, and stop. Ideas go in `docs/tickets/backlog.md`.
- Three strikes: if a fix fails three times, stop and ask Joe.

## Note
Built 27 Nov 2026 on branch `feat/V9-01-pattern-data-and-pickers`: `patterns.ts`, `patterns` key (synced, backed up), pattern fields on saved items, Try On Pattern row and Pattern colour through the one chooser. All four decisions answered by Joe (decision 4 changed: `CLAUDE.md` edited in this ticket).
Nothing is drawn yet and the server must be redeployed before the app; do not deploy until V9-02 lands. See `docs/decisions/2026-11-27-v9-patterns.md`.
