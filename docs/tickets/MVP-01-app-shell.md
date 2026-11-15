# MVP-01 App shell

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. Standard set-up work, but installing and offline use have common traps, and matching the concept designs needs judgement.

## Goal
The empty app Joe can open on his Pixel 8 and on desktop, laid out from the concept designs, ready for the avatar and the quiz.

## Scope
- TypeScript, Vite and three.js, as in the blueprint. A new `app/` folder; leave `spike/` as it is.
- Two areas from the concept designs: the avatar and outfit screen, and the colour quiz. Navigation between them.
- Responsive: phone portrait and desktop.
- Installable web app with a service worker, so it opens offline after the first visit.

## Blocked on
- **Concept designs.** Joe to say where they are. Until then, build a plain two-screen layout and match the designs once supplied.

## Acceptance criteria
- Installs to the Pixel 8 home screen and opens offline.
- Works in desktop Chrome.
- Joe signs off that the layout matches the concept designs on phone and desktop.

## Done (15 Nov 2026)
Built `app/` (Vite 6.0.7, TypeScript, three.js 0.170.0): Dress screen laid out from concept B (outfit rail), placeholder Colour screen, bottom nav on phone and side nav on desktop, manifest and a precaching service worker. Verified in the browser at phone and desktop widths and that the service worker caches all built files; still needs Joe to install it on the Pixel 8, test offline there and sign off the layout.
Concept B was chosen because it has a slot per garment; fonts are system fonts (the concepts load Google Fonts, which would be a network call). Placeholder icons are plain green and cream.
