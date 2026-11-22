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

## Add from screenshot (V4-02)

On the Wardrobe Clothes tab, **Add from screenshot** takes a screenshot of a product page (file picker on a phone; on a laptop also Ctrl+V or a dropped file). The screenshot is shown on the device with a crop box. Only the part inside the box is shrunk (longest side 1024 px) and sent to `/api/identify`, the same route and confirm sheet as "Take photo" and "Upload photo". Nothing is stored. The crop geometry is in `src/crop.ts`.

Live check against real retailer screenshots (needs `private/gemini-key.txt` and Playwright's Chromium; screenshots, manifest and results stay in git-ignored `private/`):

```bash
node scripts/screenshot-check.mjs
```

It reads `private/screenshot-check/manifest.json` (format in `scripts/screenshot-check.example.json`), drives the real app, and writes a table to `results.md` beside the manifest: the suggested template against Joe's choice (right or wrong) and the colour difference (CIEDE2000, `src/delta-e.ts`) against the colour Joe would pick. The numbers are reported, not forced to pass.
