# V2-05 Individual logins

**Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Routine on Google Cloud, but security mistakes are costly; high effort.
**Depends on:** MVP deploy

## Goal
Replace the shared password with one login each for Joe and Beth.

## Scope
- Google sign-in for the two of you only (an allowlist of two email addresses).
- Each person's avatar files are only served to them (or to both, per the decision below).
- Remove basic auth once logins work.
- Install and offline use still work.

## Decisions needed from Joe
- **How should sign-in work?** Option A: Identity-Aware Proxy on Cloud Run (Google does the sign-in in front of the app; simplest, very little code). Option B: Firebase Authentication in the app (more code, but needed later if data syncs between devices; see V2-06). Recommendation: A, unless you choose syncing in V2-06.
- **Can Joe and Beth see each other's avatar and wardrobe?** For example, to plan matching outfits. Recommendation: yes, read-only.
- Staying signed in: how long before you are asked to sign in again?

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Only Joe's and Beth's Google accounts can open the app; anyone else gets nothing, including avatar files.
- Installing on a phone and using it offline still work.
- No secrets in the repo.
