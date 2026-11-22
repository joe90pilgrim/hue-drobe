# V4-03 Create a packing list

**Status:** built (22 Nov 2026). Decision made by Joe: a trip is a name and dates, with no destination. See `docs/decisions/2026-11-22-v4-03-packing-list.md`.

**Ceiling:** 1 hour. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Haiku, high. A list built from saved items; simple.
**Depends on:** V1.1-02, V1.1-03

## Goal
Make a packing list for a trip from your saved clothes and outfits.

## Scope
- A trip: a name and dates.
- Add saved items and outfits; tick items off as packed.
- Stored with your other data.

## Decisions needed from Joe
- ~~What is a trip: just a name and dates, or a destination too?~~ **Decided 22 Nov 2026:** a name and dates only. V6-02 will need a destination; that is for its own decision.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Create a list, add items and outfits, tick them off; it survives a restart.

## Note (22 Nov 2026)
- Built on the `trips` key (stored with the other data, synced via `deploy/datastore.mjs`; the server needs redeploying before sync accepts it). Screen: a Packing tab. Tests: `tests/trips.test.ts` and `e2e/packing.spec.ts`, both passing; `npm run check` run before commit.
