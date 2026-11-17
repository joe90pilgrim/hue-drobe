# Hue-drobe app

The MVP app shell: three screens (Try on, Wardrobe, My colours), installable, works offline after the first visit.

```
cd app
npm install
npm run dev        # local dev server, open on desktop or the Pixel 8 (same Wi-Fi)
npm run dev:b      # the same, signed in as B (a woman's pack: skirt and tucked tops). npm run dev:joe is the same as npm run dev. Works in PowerShell and Git Bash.
npm run build      # type-check, then build to app/dist, including sw.js
npm run preview    # serve the built app (needed to test install and offline)
npm run icons      # regenerate the icons in public/
```

Install and offline use only work from a build (`preview`), not `dev`. On a phone they also need HTTPS or localhost; see `deploy/README.md` for the Cloud Run deploy.
