# Ticket: App icon, hanger and tee (V7-01)

## Summary
- **Status:** designed 23 Nov 2026. Joe chose option A2 from the icon canvas.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. One script rewrite, a few small file edits and one number to measure.
- **Depends on:** none.

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 1 holds the source SVG).

Edit:
- `app/public/icon.svg` (new): the SVG from the spec, as written.
- `app/scripts/make-icons.mjs`: replace the hand-written PNG writer. Render `icon.svg` in headless Chromium through Playwright (`chromium` from `@playwright/test`, already a devDependency) and write `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` (180 px). In the same page, measure the safe zone (see acceptance).
- `app/public/icon-192.png`, `app/public/icon-512.png`: regenerated. `app/public/apple-touch-icon.png`: new.
- `app/index.html` lines 8-9: an SVG `rel="icon"` for browser tabs, the 192 PNG as a fallback, and `apple-touch-icon` pointing at the 180 file. Keep the manifest link and its `crossorigin="use-credentials"`.
- `app/vite.config.ts` line 49: add the new files to the precache list.
- `app/src/main.ts` lines 39-47 (and its two uses at lines 56 and 61): the header logo becomes the tee-and-hook mark, drawn without the dark tile and with the hook in ink (`#16161A`), 28 px.
- `app/src/style.css` lines 39-41 (`.brand`, `.logo`, `.wordmark`) only if the mark needs a size or colour rule.
- `app/tests/icons.test.ts` (new): reads the PNG headers.

Do NOT touch:
- `theme_color` and `background_color` in the manifest (`#F5F5F5`), and the `"any maskable"` entry unless decision 2 says so.
- `deploy/out/` (generated), `pack/`, `spike/`, `private/`.

## Scope
**Goal:** The home-screen icon shows a tee in the colour wheel with a hanger hook, so it says "clothes" as well as "colour". The same mark is in the header.

- Keep one source of truth: `icon.svg`. The header mark in `main.ts` is the same artwork minus the tile. Say in a comment where the two must stay in step.
- No new dependency. Playwright and its Chromium are already installed for the e2e specs.
- `npm run icons` must work in PowerShell and bash.
- Mock-up: the "A2" card of the icon canvas.

**Acceptance criteria:**
- `npm run icons` regenerates the three PNGs from `icon.svg`. Vitest checks their sizes are exactly 192, 512 and 180.
- Safe zone, measured: the script renders the artwork without the tile onto a transparent canvas, finds the opaque pixel farthest from the centre and prints it as a fraction of the size. It fails above 0.40. Report the number.
- The header and the laptop sidebar show the mark at 28 px, readable on white.
- The manifest is still valid and the service worker precaches the new files; the offline spec passes.
- `npm run check` passes.
- Joe's visual sign-off on the Pixel 8 home screen. Android caches icons, so he removes the app from the home screen and adds it again.

**Decisions needed from Joe:**
1. Header logo. The mock-up has only the home-screen icon. Recommendation: use the same mark in the header, without the dark tile.
2. Manifest purpose. The 512 icon is `"any maskable"` today. Recommendation: leave it, because the artwork is already inside the maskable safe zone.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Note (23 Nov 2026)
Built: `icon.svg`, Chromium-rendered icons (192, 512, 180) via `npm run icons`, tee-and-hook header mark, icon size test. Safe zone measured 0.389 (limit 0.40); `npm run check` passed (182 Vitest, 83 e2e). Waiting on Joe's Pixel 8 home-screen sign-off.
