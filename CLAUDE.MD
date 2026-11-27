# Hue-drobe

Hue-drobe is a private, phone-first web app (PWA) for two users, Joe and his wife. It shows outfits from their own wardrobe on an accurate 3D avatar of each of them, suggests new outfit combinations, and teaches them which colours suit them using 12-season colour analysis.

The full plan is in `docs/blueprints/Hue-drobe Build Blueprint.md`. Read it before starting any piece of work. If this file and the blueprint disagree, stop and ask.

## Where we are

Stage 0, the spike, is complete; its decision records are in `docs/decisions/`. The MVP and versions 1.1, 1.2 and 2 are built. **Version 3 (loose clothes and layers)** is in progress, with some version 4 and 6 tickets already built. **Version 7 (packing and the app icon)** is designed. Each ticket's state is in `docs/tickets/README.md`; the plan is in `docs/roadmap.md`.

Active work lives in:

- `pack/`: the asset build (`build_pack.py`, `fit.py`, `pack_items.py`, and from V3-07 `fit_template.py` and `pack/templates/`)
- `app/`: the web app
- `deploy/`: the Cloud Run server
- `assets/packs/`: the archived MakeHuman packs (zips git-ignored; `MANIFEST.md` committed)

`spike/` is history, but its Blender scripts (`spike/blender/`, `spike/cloth/`) and `spike/tolerances.json` are still used by the pack build. Change them only when a ticket says so, and don't start new work there.

## Decisions already made

Treat these as settled unless the spike proves one unworkable. If that happens, say so plainly and propose an alternative rather than quietly changing course.

- Personal PWA, phone-first, also usable on a laptop. Two users only.
- 3D avatar rendered in the browser, probably with three.js. Blender, driven headlessly from Python, prepares body and garment assets.
- Avatar built from measurements, body-shape presets, photo assistance and manual skin, hair and eye colour pickers.
- Garments are generic templates. Shape comes from the nearest template, colour and pattern from the item photo.
- Each garment is fitted to each person's own body at build time. There is no runtime blending between fitted sizes.
- Accuracy comes first: fit and drape, garment colour, body proportions, and personal colouring. Do not trade fit accuracy away for speed or breadth.
- Data lives on the device (IndexedDB) and syncs in the background to a private Firestore database through our own server (changed in V2-06b; see `docs/decisions/2026-11-16-v2-06-data-model.md`). Photos and measurements are never uploaded.
- AI use is minimal and mostly local. No API keys in the app. The only backend is the small Cloud Run server behind IAP (`deploy/`).
- Garments are described as shape plus colour, never as a renderer-specific asset, so the renderer can be swapped later.

## How to work

- **One ticket per session.** Read the ticket first, then only the files under its Target Files.
- **Ceilings are a maximum, not a budget.** Each ticket has a ceiling and a worker (model and thinking level). Note the start time when you begin. At the ceiling, stop whatever state the work is in, write down what was done and what's left, and ask Joe.
- **Done means stop.** When the acceptance criteria are met, commit, add a two-line note to the ticket, and stop. Don't polish, refactor or add extras; put ideas in `docs/tickets/backlog.md`.
- **Three strikes.** If a fix fails three times, stop and ask Joe, even with time left.
- **Open decisions stop the work.** If a ticket has an open decision for Joe, stop and ask rather than guess.
- **Only Joe creates or starts tickets.** Don't write new tickets, split a ticket, or start another one. If more work is needed, propose it in the ticket's note or the decision record, and stop.
- **Joe and B only (Joe's decision, 18 Nov 2026; definitive, overrides any ticket, spec or doc that says otherwise).** Builds, template tuning, renders, comparisons and acceptance numbers use only Joe's and B's real bodies (`python pack/build_pack.py --private --only joe`, then `--only b`). Skip all synthetic bodies in builds: do not build them, render them or report on them, and do not list them in acceptance criteria. Synthetic bodies remain only where committed tests need them (they cannot use private data), and the full `npm run check` keeps using them, as described under Testing.
- **Test on one body first.** Don't run a full multi-body build to try a parameter. Run Blender builds, checks and tests in a subagent, and bring back only the results and render paths.
- **Measure, never assert.** Every accuracy claim needs a number, the script that produced it and a render. Never call a result good without the comparison.
- **Scripts over manual steps.** Blender work runs headlessly from Python so it can be re-run from the repo. Record the Blender and library versions used.
- **Check licences first.** Before adopting any body model, asset or library, check its licence and say what it allows. Prefer openly licensed options. Flag anything non-commercial. CC-BY items need a credit recorded in `assets/packs/CREDITS.md`.
- **No new dependency without saying why.** Name it, give its licence, and explain what it replaces or enables.
- **Ask before choosing for us** on anything that changes the data model, the licence position or the garment library scope.
- **Small commits and short READMEs.** Each script gets a README that says what it does and how to run it.

## Git

Added 22 Nov 2026, after the V5-00 pull request carried 33 commits instead of 2: local `master` was 18 commits ahead of `origin/master`, and the branch was cut from another ticket's branch. `origin/master` is the truth; keep local `master` equal to it.

- **Start from an up-to-date `master`, never from another feature branch.** Before a ticket: `git fetch origin`, then `git rev-list --left-right --count master...origin/master`. If either number is not 0, stop and tell Joe. Never commit on `master`. Branch with `git switch -c <type>/<TICKET-KEY>-<summary> origin/master`.
- **If the current branch is a feature branch, say so before starting.** If Joe wants the new ticket stacked on an unmerged branch, he says so; otherwise ask whether the earlier branch should be merged first. Uncommitted ticket edits can come across with `git switch -c ... origin/master` only if they do not conflict; if they do, stop and ask.
- **Check the size before any pull request.** Run `git rev-list --count origin/master..HEAD` and `git diff --stat origin/master...HEAD | tail -1`. Compare them with what the ticket should have produced. If the count is higher than the branch's own commits, say so to Joe before opening the pull request, and say so again before merging.
- **Never push, open a pull request or merge unless Joe asks.** When he does, do only what he asked. Use the base `master` and a merge commit.
- **After a merge, bring local `master` up to date at once:** `git switch master`, `git fetch origin`, `git merge --ff-only origin/master`. If it will not fast-forward, stop and ask; never reset or force-push.
- **One ticket, one branch, one pull request**, merged before the next ticket that depends on it starts. Unrelated untracked files (specs, tickets Joe is writing, `Claude outputs/`) are not part of any commit.
- **Windows:** the Git Bash tool has no `gh`; a pull request is opened from the browser pane once Joe is signed in. Run Blender and the full `npm run check` while nothing else is loading the machine, because the Playwright sync test times out under load.

## Garments: how new types are added (version 3 onwards)

- **Don't write new procedural garment geometry** (mesh slicing, vertex offsets, carved collars or plackets) in `spike/blender/garment.py`, `body_from_measurements.py` or `pack/` for new garment types.
- **Existing offset garments are legacy and stay as they are:** the tee (crew, V and scoop necks), sweatshirt, trousers, shorts, tights, the collared shirts (short, mid and long) and the cloth skirt. Change them only to fix a bug, under their existing checks.
- **New garment types are templates:** an openly licensed MHCLO garment in `pack/templates/<category>/<template_id>/` with a `meta.json` (licence, source, layer, fitting rules), fitted per person by `pack/fit_template.py` (V3-07). The design is in `docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`.
- **Sources, in order:** the archived MakeHuman packs (`assets/packs/`), simple templates modelled in Blender against the MPFB base body and converted with MakeClothes, then other sites only if the licence allows it (CC0, CC-BY or similar; check every item).
- **Visual first, gates second.** While tuning a new template, render with `spike/blender/render_closeup.py` (front, three-quarter, back) and report the check numbers without forcing them to pass. At most three render rounds, then stop and ask Joe. Only after Joe approves the look (`approved: true` in `meta.json`) are the template's checks enforced.
- **Fitted items use the MHCLO fit as it is.** Loose items (shirts worn loose, jumpers, jackets, coats) get their volume from Blender's own cloth with collision against the body and inner garments, pinned by a vertex group on the garment itself (collar, shoulder seams, waistband), never on the body.
- **No scripted reshaping of garments:** no inflating vertices, hull or band maths, or per-body warping to force looseness or clearance. If a template doesn't look right with MHCLO plus cloth, report it and stop.
- **Layers:** where an outer garment covers an inner one, hide the covered inner faces, as the body is hidden under a dress, rather than pushing the outer garment off the inner one.
- No custom physics or material code in the asset build: Blender's own cloth and modifiers only. The one exception is the runtime pattern tweak below.
- Garments are plain colour in the pack, with one optional pattern and second colour (V9, Joe's decision of 27 Nov 2026: plain, horizontal stripes, vertical stripes, spots or flowers; not on shoes). The pattern is drawn in 2D on the doll and, from V9-04, on the 3D avatar by exactly one named runtime material tweak: `onBeforeCompile` in `app/src/viewer-pattern.ts`, working from model-space position and normal. No custom shader files, no pattern data or textures in the pack, and no other runtime material code. Only hair and shoes keep textures, shrunk to 1024 px.

## Testing

Anything that can be automated should be. Tolerances live in one config file (`spike/tolerances.json`) that the tests read, so changing one is a visible, reviewed edit. `npm run check` runs everything that can run locally. Run the right amount at the right time:

- **While a ticket is in progress,** run only the checks for what changed: `npm --prefix app run typecheck`, `npx vitest related <files>`, and the affected Playwright specs (`npx playwright test e2e/<spec>.ts` or `--only-changed`).
- **Run the full `npm run check` once before the ticket's final commit and before any pull request,** with nothing else loading the machine. It must pass at both points.
- **Commits that change only docs need no checks.**

The layers:

- Geometry checks: generated bodies against the input measurements, garment landmarks, body clipping, layer clipping, and "body as drawn" for pack and template items. These fail the asset build when a tolerance is missed, except for templates not yet approved, whose numbers are reported only.
- Visual checks: close-up renders (front, three-quarter, back) for Joe's sign-off.
- Unit tests (Python and Vitest) and the Playwright end-to-end test on a phone-sized screen.
- Phone check: frame rate and download size on the Pixel 8 when a ticket adds weight.

Colour tolerances are not set yet.

## Privacy

Real photos and measurements for Joe and his wife must never be committed. They live in the git-ignored `private/` folder, and scripts should read from there when run locally. Committed tests use synthetic bodies and sample garments. Add no analytics and upload no photos or measurements. The app talks only to our own server.

## Repo layout

- `app/` the web app (TypeScript, Vite, three.js)
- `pack/` the asset build; `pack/templates/` garment templates (from V3-07); `pack/out/` build output (git-ignored)
- `assets/packs/` archived MakeHuman packs: `MANIFEST.md` and `fetch_packs.py` committed, zips and extracted files git-ignored
- `deploy/` the Cloud Run server behind IAP
- `spike/` the spike's scripts, still used by the pack build (`spike/blender/`, `spike/cloth/`, `spike/tolerances.json`)
- `docs/blueprints/` the build blueprint; `docs/roadmap.md` the versions
- `docs/decisions/` short records of decisions made along the way; add one whenever we change or settle something that matters
- `docs/tickets/` tickets for planned work, one folder per version
- `private/` personal photos, measurements and avatar files, git-ignored, never committed

## Environment

Joe works on Windows, so scripts must work in PowerShell, not only in bash. Prefer cross-platform Python or Node scripts over shell scripts, and use forward-slash-safe paths. Do not leave `node_modules`, `dist` or `.blend1` files in commits.

## Communication

Write in plain, professional English with UK spelling and avoid corporate jargon. When reporting, lead with the result and the numbers, then what was tried, then what is next. Keep it short. If something failed, say so directly.
