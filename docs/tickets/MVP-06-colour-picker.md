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

## Done (15 Nov 2026)
A native colour input in each garment's slot, applied through `Color.set` (sRGB hex, converted to linear), kept per garment in IndexedDB. The e2e test covers picking, the trousers keeping their own colour, and a reload. `npm run check` passes. About 5 minutes of work, started 18:43.
**Joe's visual sign-off:** pending. Open `npm run dev` on the Pixel 8 and desktop, pick a colour on the tee and check it looks right.
