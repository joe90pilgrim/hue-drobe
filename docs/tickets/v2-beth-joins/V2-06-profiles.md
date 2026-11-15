# V2-06 Profiles and per-person data

**Ceiling:** 1.5 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. Adds an owner to every stored record; the V1.1 records were designed for this.
**Depends on:** V2-05

## Goal
The app knows who is signed in and shows their avatar, clothes, outfits, favourites and quiz result.

## Scope
- Every stored record gains an owner.
- The app loads the signed-in person's avatar and data.
- Each person takes the quiz for themselves.
- Existing data from 1.1 is assigned to Joe.

## Decisions needed from Joe
- **Does your data stay on each device, or sync between devices?** Staying on the device keeps the blueprint's 'no backend' principle, but your phone and laptop show different wardrobes. Syncing needs a database (for example Firestore) and Firebase sign-in (V2-05 option B). Recommendation: stay on the device for v2, and use backup (V1.1-06) to move data; revisit syncing at v4.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Signing in as Joe or Beth shows only that person's data (plus the other's, read-only, if chosen).
- Joe's 1.1 data is still there after the upgrade.
- End-to-end test covers both profiles.
