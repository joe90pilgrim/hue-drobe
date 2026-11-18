# Tickets

Written 15 November 2026, after the spike closed with a go for close-fitting garments. Work them in number order unless a ticket says otherwise.

## The MVP

1. An app that runs on mobile (Pixel 8) and desktop.
2. Based on the concept designs.
3. Joe can see a representation of himself.
4. Joe can switch between pre-defined clothes (t-shirt, trousers, sweatshirt) and set each one's colour with a colour picker.
5. Joe can complete a seasonal colour quiz and receive general advice.

**Out of scope for the MVP:** adding your own clothes, other people or profiles, clothing recommendations, editing measurements, shoes.

## MVP tickets (done)

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| 01 | [App shell](MVP-01-app-shell.md) | Concept designs from Joe | Sonnet, medium |
| 02 | [Checks command](MVP-02-checks.md) | 01 | Sonnet, medium |
| 03 | [Avatar pack build](MVP-03-avatar-pack.md) | none | Sonnet, high |
| 04 | [Avatar viewer](MVP-04-avatar-viewer.md) | 01, 03 | Sonnet, medium |
| 05 | [Choose clothes](MVP-05-choose-clothes.md) | 04 | Sonnet, low |
| 06 | [Colour picker](MVP-06-colour-picker.md) | 05 | Haiku, high |
| 07 | [Sweatshirt template](MVP-07-sweatshirt.md) | 03, 05 | Opus, high |
| 08 | [Quiz content](MVP-08-quiz-content.md) | none | Sonnet, high |
| 09 | [Quiz flow](MVP-09-quiz-flow.md) | 01, 08 | Haiku, high |
| 10 | [Deploy to Google Cloud](MVP-10-deploy.md) | 01, 04 | Sonnet, high |

## Roadmap tickets

One folder per version, following `docs/roadmap.md`. Every open decision is collected in [decisions-needed.md](decisions-needed.md); a ticket with an open decision stops and asks rather than guessing.

Versions 1.1 and 2 are full tickets. Later versions are outlines, marked as such, to refine with Joe before they start, because their details depend on the experiments (V3-00, L-01, L-02) and on decisions (V4-00, V5-00). Do V1.1-00 first, so the checks cover every new garment.

### Version 1.1: Make it mine

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V1.1-00 | [Checks test the garments the app ships](v1.1-make-it-mine/V1.1-00-checks-on-shipped-garments.md) | MVP | Sonnet, medium |
| V1.1-01 | [Favourite colours in the picker](v1.1-make-it-mine/V1.1-01-favourite-colours.md) | MVP quiz and colour picker | Haiku, high |
| V1.1-02 | [Saved clothes library](v1.1-make-it-mine/V1.1-02-saved-clothes.md) | MVP clothes and colour picker | Sonnet, low |
| V1.1-03 | [Preset outfits](v1.1-make-it-mine/V1.1-03-preset-outfits.md) | V1.1-02 | Haiku, high |
| V1.1-04 | [Other t-shirt necklines](v1.1-make-it-mine/V1.1-04-necklines.md) | MVP avatar pack build | Sonnet, high |
| V1.1-05 | [Shorts](v1.1-make-it-mine/V1.1-05-shorts.md) | MVP avatar pack build | Sonnet, medium |
| V1.1-06 | [Back up and restore your data (recommended addition)](v1.1-make-it-mine/V1.1-06-backup.md) | V1.1-02, V1.1-03 | Sonnet, low |
| V1.1-07 | [Show a close second season](v1.1-make-it-mine/V1.1-07-borderline-quiz-result.md) | MVP quiz | Haiku, high |

### Version 1.2: Redesign

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V1.2-00 | [Redesign brief](v1.2-redesign/V1.2-00-redesign-brief.md) (done) | Version 1.1 done | No agent: Joe with a design specialist |
| V1.2-01 | [Look and feel foundations](v1.2-redesign/V1.2-01-look-and-feel.md) (done) | V1.1 done | Haiku, high |
| V1.2-02 | [App shell and navigation](v1.2-redesign/V1.2-02-app-shell.md) | V1.2-01 | Sonnet, medium |
| V1.2-03 | [Try on layout](v1.2-redesign/V1.2-03-try-on-layout.md) | V1.2-02 | Sonnet, medium |
| V1.2-04 | [Change a piece](v1.2-redesign/V1.2-04-change-a-piece.md) | V1.2-03 | Sonnet, medium |
| V1.2-05 | [Colour chooser](v1.2-redesign/V1.2-05-colour-chooser.md) | V1.2-04 | Sonnet, medium |
| V1.2-06 | [Wardrobe](v1.2-redesign/V1.2-06-wardrobe.md) | V1.2-02 | Sonnet, medium |
| V1.2-07 | [My colours](v1.2-redesign/V1.2-07-my-colours.md) | V1.2-02 | Sonnet, low |
| V1.2-08 | [Final check against the designs](v1.2-redesign/V1.2-08-final-check.md) | V1.2-01 to 07 | Haiku, high |

Build from the brief and designs in `docs/designs/2026-11-15-v1.2-redesign/` (V1.2-01 to 07 are pieces B1 to B7 in `brief.md`). Work them in number order; V1.2-06 and V1.2-07 may go before V1.2-03 if wanted, since they only need V1.2-02. Decisions: `docs/decisions/2026-11-15-v1.2-design-decisions.md`.

### Version 2: Beth joins

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V2-01 | [Beth's measurements and photos](v2-beth-joins/V2-01-beth-measurements.md) | None | No agent. Joe and Beth. |
| V2-02 | [A woman's body: Beth's avatar](v2-beth-joins/V2-02-womans-body.md) | V2-01 | Sonnet, high |
| V2-03 | [MVP garments on Beth](v2-beth-joins/V2-03-garments-on-beth.md) | V2-02 | Sonnet, high |
| V2-04 | [Tights](v2-beth-joins/V2-04-tights.md) | V2-02 | Sonnet, medium |
| V2-05 | [Individual logins](v2-beth-joins/V2-05-logins.md) | MVP deploy | Sonnet, high |
| V2-06 | [Profiles and per-person data](v2-beth-joins/V2-06-profiles.md) | V2-05 | Sonnet, medium |
| V2-06b | [Sync between devices](v2-beth-joins/V2-06b-sync.md) | V2-06 | Sonnet, high |
| V2-07 | [Spike: free MakeHuman asset packs](v2-beth-joins/V2-07-asset-pack-spike.md) | V2-03; run before V3-00 | Sonnet, high |
| V2-08 | [Bug: the tops show a point at each breast](v2-beth-joins/V2-08-bust-shape-bug.md) | V2-03, V2-07; run last in version 2 | Fable, high |
| V2-09 | [Archive the free asset packs](v2-beth-joins/V2-09-archive-packs.md) | V2-07; do soon | Haiku, high |

### Version 3: Loose clothes and layers (closed 18 Nov 2026)

Closed by Joe. Done tickets stay as history; open ones are closed, retired or parked (kept, not deleted). Template work carries on in version 3.1.

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V3-00 | [Experiment: skirts with cloth simulation](v3-loose-clothes/V3-00-cloth-experiment.md) (done: go, with conditions) | V2-03, V2-07 | Opus, high |
| V3-01a | [Skirt: fix the waistband and the small body](v3-loose-clothes/V3-01a-skirt-fixes.md) | V3-00 | Opus, high |
| V3-01b | [Skirt in the app](v3-loose-clothes/V3-01b-skirt-in-app.md) | V3-01a | Sonnet, high |
| V3-02 | [Dresses from the free packs](v3-loose-clothes/V3-02-dresses.md) | V3-06 | Sonnet, medium |
| V3-03 | [Shirts (long, mid and short sleeves)](v3-loose-clothes/V3-03-shirts.md) | V1.1-04; V3-05 for wearing under other tops | Sonnet, high |
| V3-04 | [Jackets and coats](v3-loose-clothes/V3-04-jackets-coats.md) (superseded by V3-09) | - | - |
| V3-05 | [Multiple top layers](v3-loose-clothes/V3-05-layers.md) (decided: ship passing combinations only; app side remaining) | V3-01b | Sonnet, medium |
| V3-06 | [Pack asset pipeline and body-hiding check](v3-loose-clothes/V3-06-pack-asset-pipeline.md) (done; folded into V3-07) | V2-07, V2-09 | Sonnet, high |
| V3-07 | [Generic template fitting: `pack/fit_template.py`](v3-loose-clothes/V3-07-fit-template.md) | V3-06, V3-07a | Opus, high |
| V3-07a | [Archive Suits 01 and Shirts 02/03, allow CC-BY with credits](v3-loose-clothes/V3-07a-archive-template-packs.md) | V2-09 | Sonnet, low |
| V3-07b | [Loose-fit volume for templates](v3-loose-clothes/V3-07b-loose-fit-volume.md) (removed by V3.1-01) | V3-07, V3-08 | Opus, high |
| V3-08 | [First template: a shirt from Shirts 02/03](v3-loose-clothes/V3-08-shirt-template.md) (closed) | V3-07, V3-07a | Sonnet, medium |
| V3-07c | [`keep_islands`: use one garment from a whole-suit pack item](v3-loose-clothes/V3-07c-keep-islands.md) | V3-07 | Opus, medium |
| V3-09 | [Second template: a blazer from Suits 01](v3-loose-clothes/V3-09-blazer-template.md) (retired) | V3-08, V3-07c | Sonnet, high |
| V3-10 | [Credits screen for CC-BY assets](v3-loose-clothes/V3-10-credits-screen.md) (parked) | V3-07a | Sonnet, low |
| V3-11 | [Garment chips and variant row in the slot sheet](v3-loose-clothes/V3-11-top-sheet-garment-chips.md) (parked) | - | Sonnet, medium |
| V3-12 | [Colour row and colour page, collapsed Fine-tune](v3-loose-clothes/V3-12-top-sheet-colour-page.md) (parked) | V3-11 | Sonnet, medium |
| V3-13 | [All garments list with search](v3-loose-clothes/V3-13-all-garments-list.md) (parked) | V3-11 | Sonnet, medium |
| V3-14 | [Experiment: cloth, garment-side pins and inner-layer hiding](v3-loose-clothes/V3-14-cloth-layering-experiment.md) (closed: folded into V3.1-01) | V3-07, V3-07c | Opus, high |

### Version 3.1: Template garments

Built on the V3-14 result: plain MHCLO for fitted items, Blender cloth with garment-side pins and the template's own rest shape for loose ones, and inner layers hidden where they're covered. No scripted reshaping.

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V3.1-01 | [Close out V3-14; fold rest-shape cloth and inner-layer hiding into `fit_template.py`](v3.1-templates/V3.1-01-fold-experiment-into-fit-template.md) | V3-14 | Opus, high |
| V3.1-02 | [App: draw the inner garment with covered parts hidden](v3.1-templates/V3.1-02-app-draws-hidden-inner-layer.md) | V3.1-01 | Sonnet, medium |
| V3.1-03 | [T-shirt template](v3.1-templates/V3.1-03-tee-template.md) | V3.1-01 | Sonnet, medium |
| V3.1-04 | [Straight-leg trousers template](v3.1-templates/V3.1-04-straight-leg-trousers-template.md) | V3.1-01 | Sonnet, high |
| V3.1-05 | [Open-front coat template](v3.1-templates/V3.1-05-open-front-coat-template.md) | V3.1-01, V3.1-02, coat source decision | Sonnet, high |

### Version 4: Your real wardrobe

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V4-00 | [Decision: sending data off the device](v4-real-wardrobe/V4-00-data-off-device.md) (outline) | None | No agent. Joe and Beth. |
| V4-01 | [Photo to nearest item](v4-real-wardrobe/V4-01-photo-to-item.md) (outline) | V4-00, V3 garments | Sonnet, high (tentative) |
| V4-02 | [URL to nearest item (recommend dropping)](v4-real-wardrobe/V4-02-url-to-item.md) (outline) | V4-00, V4-01 | Sonnet, high (tentative) |
| V4-03 | [Create a packing list](v4-real-wardrobe/V4-03-packing-list.md) (outline) | V1.1-02, V1.1-03 | Haiku, high |

### Version 5: Finishing the look

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V5-00 | [Decision: where shoes, hats, jewellery and hair come from](v5-finishing-the-look/V5-00-asset-sources.md) (shoes and hair decided) | None | No agent. Joe. |
| V5-01 | [Shoes: boots, sandals, trainers](v5-finishing-the-look/V5-01-shoes.md) | V3-06, V5-05 | Sonnet, high |
| V5-02 | [Hats](v5-finishing-the-look/V5-02-hats.md) (outline) | V5-00 | Sonnet, high (tentative) |
| V5-03 | [Jewellery: necklaces, rings, watches](v5-finishing-the-look/V5-03-jewellery.md) (outline) | V5-00 | Sonnet, high (tentative) |
| V5-04 | [Hair styles](v5-finishing-the-look/V5-04-hair.md) | V5-05 | Sonnet, medium |
| V5-05 | [Shrink textures at build time](v5-finishing-the-look/V5-05-texture-shrink.md) | V3-06 | Sonnet, low |

### Version 6: Style assistant

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| V6-01 | [Ask Gemini for advice](v6-style-assistant/V6-01-gemini-advice.md) (outline) | V4-00, V2-05 | Sonnet, medium (tentative) |
| V6-02 | [Suggested packing list](v6-style-assistant/V6-02-suggested-packing.md) (outline) | V4-03, V6-01 | Sonnet, medium (tentative) |

### Later: needs an architecture change first

| # | Ticket | Depends on | Worker |
| --- | --- | --- | --- |
| L-01 | [Experiment: changing body dimensions in the app](later-architecture/L-01-body-change-experiment.md) (outline) | V2 | Opus, high |
| L-02 | [Experiment: other avatar poses](later-architecture/L-02-poses-experiment.md) (outline) | V3 (so loose clothes are known first) | Opus, high |

## Workers

Each ticket names the cheapest model and effort level likely to finish it inside its ceiling without many reworks. Set the model and effort when you start the session for that ticket.
- **Haiku:** small, well-defined UI work.
- **Sonnet:** most tickets.
- **Opus:** only where reworks would cost more than the stronger model: new garment geometry that is hard to get right, and the capped experiments.
- **Fable:** bugs the cheaper models could not fix (V2-08, after seven failed attempts on Opus in V2-03).

If a ticket on Haiku or Sonnet hits the three-strikes rule, don't keep retrying on the same model. Stop, and Joe decides whether to move it up one level.

## Rules for every ticket

- **Joe (or Beth, for her avatar) signs off anything visual.** QA is by eye in the app served locally (`npm run dev`, opened on the Pixel 8 and on desktop). A ticket with a visual criterion isn't done until he says so.
- **Done means stop.** When a ticket's acceptance criteria are met, stop work on it immediately, commit, report and move to the next ticket. Don't polish, refactor or add extras beyond the criteria. Write any ideas in `docs/tickets/backlog.md` instead of doing them.
- **The ceiling is a maximum, not a budget.** Each ticket has a ceiling in hours of work. Most tickets should finish well inside it. Note the start time (run `date`) when you begin a ticket. If the ceiling is reached before the criteria are met, stop whatever state the work is in, write down what was done, what's left and why, and ask Joe.
- **Three strikes.** If a fix hasn't worked after three attempts, stop and ask Joe, even if the ceiling hasn't been reached.
- **No custom physics or material models.** Garments use the offset-shell method from the spike. `--drape` stays off.
- **Test on one body first.** Don't run a full multi-body build to try a parameter.
- **Personal data never goes in git.** Joe's measurements and avatar files live in the git-ignored `private/` folder and its build outputs.
- **Done means:** the acceptance criteria are met, `npm run check` passes (from ticket 02 onwards), the work is committed, and a two-line note is added to the ticket saying what was done.
