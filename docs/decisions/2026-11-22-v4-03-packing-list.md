# V4-03: packing lists

**Date:** 22 Nov 2026

## Decided

- **A trip is a name and dates.** No destination for now. V6-02 (suggested packing, with weather) will need a destination; that is a decision for V6-02.
- **Data:** a new synced key `trips`, a list of trips. Each trip has a name, start and end day (`YYYY-MM-DD`) and a list of entries. An entry points at a saved clothes item or a saved outfit by id, and has a packed flag. A deleted item or outfit stays on the list as "removed from your wardrobe" until taken off, as outfits do with their pieces.
- **Sync and backup:** `trips` is in the backup and in `SYNC_KEYS` on the server, so the server must be redeployed before sync accepts it.
- **Where it lives:** a Packing tab, the fourth screen in the bar. The ticket did not say where; this is the natural place beside Wardrobe.

## Why

The ticket said the list is stored with the other data, so it follows the same key-value pattern. Entries point at items and outfits rather than copying them, so renaming a saved item shows on the list.

## Not in this version

- Destination, weather, and suggested items (V6-02).
- An outfit and its pieces are separate entries: ticking the outfit does not tick its pieces, and the other way round.

## Amendment, 23 Nov 2026 (V4-04): outfits bring their garments

The earlier rule that an outfit and its pieces are separate entries is replaced. Adding an outfit puts it on the trip as a non-tickable "planned look" and adds each of its garments as an item entry. A garment already on the list is not duplicated. Entries gain two optional fields inside the existing `trips` key (no sync or server change): `via` (ids of the outfits that brought the item in) and `own` (added by hand). Removing an outfit removes only the garments no other outfit or hand-add still needs. The packed count counts garments only. Trips saved earlier are backfilled once on load (`backfillOutfitPieces`); a ticked old outfit brings its garments in as packed.
