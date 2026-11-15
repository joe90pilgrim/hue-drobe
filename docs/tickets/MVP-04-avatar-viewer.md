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
