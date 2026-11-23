# Ticket: Outfit pieces in the packing list

## Summary
- **Status:** built 23 Nov 2026; decisions answered (see the note at the end).
- **Ceiling:** 1.5 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet, medium. Small state-logic change across the trips model and the Packing screen, plus a one-off backfill.
- **Depends on:** V4-03 (built).
- **Must be merged before:** V6-01, which edits the same files.

## Target Files
Read and edit only these first.
- `app/src/trips.ts` (`PackEntry`, `toggleEntry`, `packedCount`, `cleanTrips`/`cleanEntries`; add an outfit-adding helper)
- `app/src/screens/packing.ts` (outfit picker, the click handler on the sheet, `rowHtml`, `piecesOf`, packed counts)
- `app/src/outfits.ts` (read only: `resolveOutfit`, outfit slots)
- `app/tests/trips.test.ts` (add and update unit tests)
- `app/e2e/packing.spec.ts` (the first test expects an outfit to be its own row with its own tick; it will change)
- `docs/decisions/2026-11-22-v4-03-packing-list.md` (add a short amendment; it currently says an outfit and its pieces are separate entries)

Do NOT touch:
- `deploy/datastore.mjs` and `app/src/backup.ts`. No new sync key, no server change, no redeploy. Extend `PackEntry` with optional fields inside the existing `trips` key instead.
- `app/src/wardrobe.ts` and anything under `pack/`.

## Scope
**Goal.** When you add an outfit to a trip, its individual garments go on the packing list, because garments are what you pack. The trip still shows the outfits you plan to wear.

**Proposed behaviour (Joe to confirm; see decisions):**
- Tapping an outfit in the picker adds the outfit as a "planned look" row and adds each of its garments as a normal item entry.
- A garment already on the list is not added twice. If two outfits share a garment, it appears once.
- Outfit rows are not ticked off. Garment rows are ticked off, and the packed count counts garments only.
- Each garment entry records which outfit(s) added it (`via?: string[]`, outfit ids) and whether you also added it by hand (`own?: true`). Removing an outfit takes out only the garments that no other outfit and no hand-add still needs.
- A garment deleted from the wardrobe still shows as "removed", as it does today.

**Acceptance criteria**
- Adding an outfit to a trip adds one item entry per garment in that outfit, plus the outfit as a planned look. Garments already on the list are not duplicated.
- Outfit rows have no tick box and are not counted in the packed count; the count reflects garments only.
- Removing an outfit removes only the garments it alone brought in. A garment added by hand, or brought in by another outfit, stays.
- Existing trips are handled as agreed under the migration decision, with a unit test for it.
- A trip saved with the new fields still loads on the old shape: the new fields are optional and `cleanTrips` accepts trips with and without them.
- `app/tests/trips.test.ts` covers: adding an outfit, a shared garment, removing an outfit, a hand-added garment that is also in an outfit, a deleted wardrobe item, and the migration.
- `app/e2e/packing.spec.ts` is updated and passes on a phone-sized screen.
- Amendment added to the V4-03 decision record.

## Decisions needed from Joe
If a decision isn't made when this ticket starts, stop and ask rather than guess. Recommended answers are given so you can reply "yes to all".
1. **Outfit rows.** Keep them on the trip as non-tickable "planned looks"? *Recommended: yes.*
2. **Removing an outfit.** Remove the garments it added, unless something else still needs them? *Recommended: yes, using `via` and `own` as above.*
3. **Existing trips.** They hold outfit entries with no garment entries. Backfill the garments once when the trip is loaded, or leave old trips as they are? *Recommended: backfill, as a pure function with a test.*
4. **Ticks on old outfit entries.** If an old outfit was ticked as packed, should its garments come in as packed too? *Recommended: yes.*

## Execution Rules
- **No broad repo search:** start directly with the files listed under Target Files.
- **Subagents for heavy output:** if you need to search outside Target Files, inspect large files, or run full test suites or builds, delegate that to a subagent and return only a 5-line summary.
- **Git:** follow the Git section of `CLAUDE.md`. Fetch, check `master` equals `origin/master`, and branch from `origin/master`. Never push or open a pull request unless Joe asks.
- **Done check:** run `npm --prefix app run typecheck`, `npx vitest related app/src/trips.ts` and `npx playwright test e2e/packing.spec.ts`, then run the full `npm run check` once before the final commit, with nothing else loading the machine. Then add a two-line note to this ticket and stop. Ideas go in `docs/tickets/backlog.md`.

## Note (23 Nov 2026)
Built with all four recommended answers: outfits are non-tickable planned looks, garments carry `via`/`own`, old trips backfill once on load (ticked outfits give packed garments). Full `npm run check` passed (80 e2e, vitest, typecheck); V4-03 decision record amended.
