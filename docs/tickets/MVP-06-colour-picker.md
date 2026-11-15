# MVP-06 Colour picker

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Haiku, high. Small and well understood. One trap: three.js colour management, so the picked hex colour must be set as sRGB or it will look washed out on screen.

## Goal
Joe sets the colour of each garment.

## Scope
- A colour picker for the selected garment; the colour applies straight away.
- Each garment keeps its own colour.
- Colours are remembered between visits (IndexedDB).
- Plain colour only: no patterns or textures in the MVP.

## Acceptance criteria
- A colour set on the tee survives closing and reopening the app.
- **Joe's visual sign-off:** the colour on screen looks like the colour he picked, in the default lighting.
