# design-audit.mjs

Measures the running app and `app/src/style.css` for the UI design review (V10-01). It reads only: it builds nothing, starts no server and changes no app file.

## Run

Start a built preview first (from the repo root, PowerShell):

```powershell
cd app; npx vite build; $env:E2E_PACK='fixture'; npx vite preview --port 4199 --strictPort
```

Then, in another terminal at the repo root:

```powershell
node app/scripts/design-audit.mjs [baseUrl] [outDir]
```

- `baseUrl` defaults to `http://localhost:4199`. If nothing answers, the script says so and exits with code 2.
- `outDir` defaults to `docs/screenshots/review-2026-11/`. It writes `design-audit.json` and `design-audit.txt` there and prints the same table.
- `E2E_PACK=fixture` makes the preview serve the placeholder pack, never Joe's private pack. The script also blocks every `/pack/` request, so the stage is empty and no body is loaded. The app's two server calls (`/api/packing-template`, `/api/identify`) are answered inside the script.
- Takes about two to three minutes. Playwright comes from `app/node_modules` (no new dependency).

## What it reports

At the phone size (412 x 915), on the same screens and states as `screenshots.mjs` (36 of them), with the same sample wardrobe:

1. Distinct computed font sizes with element counts, and any text under 12px.
2. Visible buttons, links, fields and tabs under 44 x 44px (a tick box inside a label is measured as the label).
3. From `style.css`: distinct padding, margin, gap, border-radius and font-size values, with counts.
4. From `style.css`: colours that are not `var(--token)` uses, and WCAG contrast for each text token on each background token, plus white on ink.
5. Whether controls show a focus style when reached with the Tab key (author outline or shadow, browser default ring only, or none).
6. Horizontal overflow, text clipped by `overflow: hidden`, and elements past the screen edge at 360, 412 and 560px wide.

Any screen it cannot reach is listed as "Screens not reached" rather than stopping the run. When a sheet is open, only that sheet is measured, because the page behind it cannot be used.
