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

## Decisions (made 16 Nov 2026, during V2-05)
- **Data syncs between devices** through a small Firestore database, written in the background. Sign-in stays IAP (V2-05). The Cloud Run server reads and writes Firestore for the person in IAP's signed header (`/api/me` already returns who that is), using its own service account. The app has no Firebase sign-in and no keys. IndexedDB stays as the offline copy. See `docs/decisions/2026-11-16-v2-05-logins.md`.
- This changes the blueprint's "data stays on the device, no backend" principle. Re-scope this ticket and its ceiling before starting: sync, conflict handling and Firestore security rules are more than 1.5 hours. A new decision record is also needed for the Firestore data model, which Joe approves before building.
- **No sharing between Joe and B for now.** Each person sees only their own data and avatar.

## Acceptance criteria
- Signing in as Joe or Beth shows only that person's data.
- Joe's 1.1 data is still there after the upgrade.
- End-to-end test covers both profiles.
