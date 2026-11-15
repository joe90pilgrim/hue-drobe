# MVP-10 Deploy to Google Cloud

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Cloud Run, Secret Manager and basic auth are routine, but basic auth with offline install is a known awkward combination.

## Goal
Joe opens the app on his phone from anywhere, behind a password.

## Scope
- Host on **Cloud Run** with a small static server that serves the built app behind **HTTP basic auth** (one shared username and password). Plain static hosting (Firebase Hosting, a Cloud Storage bucket) can't do basic auth, which is why Cloud Run.
- The password is kept in Secret Manager, never in the repo. HTTPS only.
- Deploy is one command, run from Joe's machine, because the avatar pack comes from the git-ignored build output and is never committed.
- Check the service worker and install still work behind basic auth; this combination can be fiddly. If it isn't solved within the ceiling, stop, report and Joe decides.
- Basic auth is a stop-gap. Individual logins and user profiles come later.

## Acceptance criteria
- Opening the URL asks for the password; the wrong password gets nothing, including the avatar files.
- Joe installs the app on the Pixel 8 from the live URL and it works offline afterwards.
- No password or personal file appears in the repo.

## Done (15 Nov 2026)
Added `deploy/`: a dependency-free Node server with basic auth, `set-password.mjs` (password to Secret Manager from a hidden prompt), `deploy.mjs` (build, add the pack from `private/`, `gcloud run deploy`) and a README. Tested locally in Chromium: no or wrong password gets 401 on every path including the avatar files; installability errors none; the service worker installs behind auth; with the server stopped, the app and all four avatar files load from cache. `npm run check` passes. About 25 minutes of work.
Two traps fixed: the manifest link needs `crossorigin="use-credentials"`, and the service worker now caches the avatar pack (it was never cached before, so the avatar would not load offline).
**Joe's live check (15 Nov 2026):** deployed to Cloud Run, password prompt works, installed on the Pixel 8 and opens offline. All acceptance criteria met. Ticket closed.
