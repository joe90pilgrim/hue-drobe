# Hue-drobe app

The MVP app shell: two screens (Dress, Colour), installable, works offline after the first visit.

```
cd app
npm install
npm run dev        # local dev server, open on desktop or the Pixel 8 (same Wi-Fi)
npm run build      # type-check, then build to app/dist, including sw.js
npm run preview    # serve the built app (needed to test install and offline)
npm run icons      # regenerate the placeholder icons in public/
```

Install and offline use only work from a build (`preview`), not `dev`. On a phone they also need HTTPS or localhost; MVP-10 covers that.
