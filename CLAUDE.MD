# Hue-drobe

Hue-drobe is a private, phone-first web app (PWA) for two users, Joe and his wife. It shows outfits from their own wardrobe on an accurate 3D avatar of each of them, suggests new outfit combinations, and teaches them which colours suit them using 12-season colour analysis.

The full plan is in `docs/blueprints/Hue-drobe Build Blueprint.md`. Read it before starting any piece of work. If this file and the blueprint disagree, stop and ask.

## Where we are

Stage 0, the spike, is running. It is time-boxed and ends on the evening of Sunday 15 November 2026 with a go/no-go decision on the 3D approach. Work only inside `spike/` until that decision is made. Do not scaffold the full app, add accounts, or build features from later stages.

The spike must answer two questions:

1. Can we build a believable 3D body in the browser from a handful of tape measurements?
2. Can one garment template be fitted to several body shapes so fit and drape look right against a real garment?

Proposed pass criteria (the spike's results table must report the measured value for each):

- Chest or bust, waist and hips within 2 cm of the tape measurement
- Height and limb lengths within 1.5 cm
- Garment landmarks (hem, sleeve end, inseam) within 2 cm of the real garment worn
- No body showing through cloth through a full 360-degree rotation, on all three fitted body shapes
- Blended in-between sizes look plausible, with no tearing or stretching
- At least 30 frames per second and under 15 MB to load on Joe's phone

## Decisions already made

Treat these as settled unless the spike proves one unworkable. If that happens, say so plainly and propose an alternative rather than quietly changing course.

- Personal PWA, phone-first, also usable on a laptop. Two users only.
- 3D avatar rendered in the browser, probably with three.js. Blender, driven headlessly from Python, prepares body and garment assets.
- Avatar built from measurements, body-shape presets, photo assistance and manual skin, hair and eye colour pickers.
- Garments are generic templates. Shape comes from the nearest template, colour and pattern from the item photo.
- Accuracy comes first: fit and drape, garment colour, body proportions, and personal colouring. Do not trade fit accuracy away for speed or breadth.
- Data stays on the device (IndexedDB). Firebase is a possible later addition, not now.
- AI use is minimal and mostly local. No API keys and no backend.
- Garments are described as shape plus colour, never as a renderer-specific asset, so the renderer can be swapped later.

## How to work

- **Respect the time boxes.** Report at the end of each block with what works, what does not, and the measured numbers. If a block overruns by half, stop and say so instead of carrying on.
- **Measure, never assert.** Every accuracy claim needs a number, the script that produced it and a screenshot. Never call a result good without the comparison.
- **If the body is not working by Sunday midday, stop.** Do not carry on into garments. Report the failure and propose the fallback from the blueprint's risks section.
- **Scripts over manual steps.** Blender work runs headlessly from Python so it can be re-run from the repo. Record the Blender and library versions used.
- **Check licences first.** Before adopting any body model, asset or library, check its licence and say what it allows. Prefer openly licensed options. Flag anything non-commercial.
- **No new dependency without saying why.** Name it, give its licence, and explain what it replaces or enables.
- **Ask before choosing for us** on anything that changes the data model, the licence position or the garment library scope.
- **Small commits and short READMEs.** Each script gets a README that says what it does and how to run it.

## Testing

Anything that can be automated should be. Tolerances live in one config file that the tests read, so changing one is a visible, reviewed edit. The layers, in order of importance for the spike:

- Geometry accuracy scripts: measure the generated mesh against the input measurements, check garment landmarks, test for body clipping, and check blends between fitted sizes. These must fail the asset build when a tolerance is missed.
- Visual checks: render fixed front, side and back views for each body and garment and compare against approved baselines.
- Unit tests for the measurement-to-body solver and colour maths, using small fixed fixtures.
- Phone check: record frame rate and download size on the real phone at the end of each block.

Colour tolerances are not set yet. The spike should record what colour extraction actually achieves so we can agree a limit.

## Privacy

Real photos and measurements for Joe and his wife must never be committed. They live in the git-ignored `private/` folder, and scripts should read from there when run locally. Committed tests use synthetic bodies and sample garments. Make no network calls, add no analytics, and upload nothing.

## Repo layout

- `docs/blueprints/` the build blueprint
- `docs/decisions/` short records of decisions made along the way; add one whenever we change or settle something that matters
- `docs/tickets/` tickets for planned work
- `spike/blender/` headless Blender scripts for bodies and garments
- `spike/viewer/` the three.js viewer, built with Vite
- `private/` personal photos and measurements, git-ignored, never committed

## Environment

Joe works on Windows, so scripts must work in PowerShell, not only in bash. Prefer cross-platform Python or Node scripts over shell scripts, and use forward-slash-safe paths. Do not leave `node_modules`, `dist` or `.blend1` files in commits.

## Communication

Write in plain, professional English with UK spelling and avoid corporate jargon. When reporting, lead with the result and the numbers, then what was tried, then what is next. Keep it short. If something failed, say so directly.
