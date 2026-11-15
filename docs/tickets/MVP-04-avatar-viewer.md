# MVP-04 Avatar viewer

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. Close to the spike viewer that already exists.

## Goal
Joe sees himself in the app and can turn the avatar round.

## Scope
- Loads Joe's body from the pack (MVP-03).
- Rotate and zoom by touch and by mouse. Sensible default camera and lighting.
- On-screen frame rate readout behind a debug flag (`?debug`).

## Acceptance criteria
- 30 fps or better on the Pixel 8, and the pack loads in under 15 MB.
- **Joe's visual sign-off:** in the app served locally, he judges whether the avatar looks like his shape from the front and side, and records yes or no and any notes in this ticket. Anything he flags becomes a new ticket, not a change to this one.

## Done, awaiting sign-off (15 Nov 2026)
Dress screen now loads Joe's body, tee and trousers from the pack (**744 KB**, well under 15 MB) with touch and mouse rotate and zoom; `?debug` shows FPS and pack size (about 60 fps on a desktop browser). The dev and preview servers serve `private/pack/joe/` at `/pack/joe/`; it is never copied into a build (`dist` has no `.glb`). `npm run check` passes. About 20 minutes of work.
**Still needed from Joe:** frame rate on the Pixel 8 (`npm run dev`, open with `?debug`), and the visual sign-off (front and side, yes or no, notes here): _pending_.
