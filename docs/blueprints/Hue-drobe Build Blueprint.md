# Hue-drobe: Build Blueprint

Nov 14, 2026 · @Joe

## Vision

Hue-drobe lets you try outfits from your own wardrobe on an accurate 3D avatar of yourself, and teaches you which colours suit you. It starts as a private, phone-first web app for two users (you and your wife) and is built in thin, testable slices.

It does three jobs:

1. **Imagine.** Show a chosen outfit, built from photographed wardrobe items, on an avatar that matches the real person's measurements and colouring.
2. **Inspire.** Suggest new outfit combinations from the wardrobe, point out the one piece that would unlock the most new outfits, and match saved reference images against what you own.
3. **Learn.** Work out a 12-season colour profile from a guided questionnaire and colour pickers, then use it to score every outfit.

Principles that settle trade-offs:

- **Accuracy over breadth.** Ten garment templates that fit and drape correctly beat fifty that look wrong. Fit, colour, body proportions and personal colouring all matter, and none is traded away for speed.
- **Local first.** The app reads and writes its data on the device and works fully offline. Photos and measurements are never uploaded. Wardrobe, outfits, favourites and quiz answers sync between each person's own devices through a small backend on Cloud Run, behind Google sign-in (IAP). (Changed 16 Nov 2026, V2-06b: see `docs/decisions/2026-11-16-v2-06-data-model.md`.)
- **Risk first.** The 3D questions that could sink the idea are answered by a time-boxed spike before the app is built around them.
- **Stylised, not uncanny.** The aim is a believable Create-a-Sim-style figure, not a photoreal clone.

## Decisions already made

These came out of the planning interview. Claude Code should treat them as settled unless the spike proves one unworkable.

| Area | Decision |
| --- | --- |
| Platform | Personal PWA, phone-first, also usable on a laptop |
| Users | You and your wife; no public launch planned |
| Avatar | 3D, built from measurements, body-shape presets, photo assistance and manual skin/hair/eye colour pickers |
| Rendering | In the browser, probably three.js; Blender (scripted headlessly with Python) prepares body and garment assets |
| Garments | Generic templates; colour and pattern come from the item photo, shape from the nearest template |
| Accuracy | Fit and drape, garment colour, body proportions, and skin/hair/eye tone all matter; no accepted compromise on fit |
| Wardrobe input | One photo per item, with background removal and colour extraction |
| Colour theory | 12-season analysis from a guided questionnaire plus colour pickers |
| Inspiration | Combos from the wardrobe, gap analysis, and user-saved reference images matched against the wardrobe |
| AI use | Minimal and mostly local; no API key needed |
| Storage | IndexedDB on the device, synced to a private Firestore database through our own server (V2-06b) |
| Process | Staged and iterative; the spike is time-boxed and runs this weekend |

## Scope

The first usable version is small on purpose: one body model, a handful of garment types, and no network dependency.

**In scope for the first usable version**

- Two avatar profiles (you and your wife), each built from measurements, a body-shape preset and colour pickers
- Garment templates for roughly three to five types (for example tee, shirt, trousers, midi dress, jumper) with pre-fitted shapes across body sizes
- Photo upload per wardrobe item, with background removal and dominant colour and pattern extraction
- Dress the avatar from the wardrobe and rotate the figure on a phone
- 12-season questionnaire and colour pickers, producing a palette
- Basic outfit scoring on colour harmony and palette fit

**Later milestones**

- Outfit generation, occasion filters and gap analysis
- Saved reference images matched against the wardrobe
- Photo-assisted skin, hair and eye tone estimation
- More garment types, shoes and accessories
- Sync between each person's devices through our own server and Firestore (built in V2-06b)

**Out of scope for now**

- Accounts, public sign-up, payments, or any shared or social features
- Live cloth simulation on the phone
- Shopping links, curated external feeds, or any server-side AI
- Photoreal AI try-on of the user's own photo

## Architecture

The heavy 3D work, fitting garments to bodies, runs once on your computer; the phone only loads the finished pack. The stack is TypeScript, three.js for rendering, IndexedDB for storage, and a service worker so the PWA works offline. Blender is driven headlessly from Python.

&#91;embedded content: architecture · build time and runtime\]

The highlighted asset pack is the hand-off between the two halves. Everything on the phone reads from it and from the user's own data, so no server is needed.

## Weekend spike

The spike answers two questions by Sunday evening, 15 November, and ends with a go/no-go decision on the 3D approach. It is time-boxed: when the box closes we decide with what we have, and we do not extend it.

1. **Body:** can we generate a believable 3D body in the browser from a handful of tape measurements, with proportions close enough to the real person?
2. **Garments:** can one garment template be fitted to several body shapes so that fit and drape look right when compared with a real garment?

### What you provide

- [ ] Tape measurements for you and your wife: height, chest or bust, underbust, waist, hips, shoulder width, neck, upper arm, wrist, thigh, inside leg, arm length and back length (neck to waist)
- [ ] Front and side photos of each of you in fitted clothing, taken from a fixed distance with the phone at chest height, for checking only
- [ ] Two or three real garments each (suggest a tee, trousers and a dress), photographed worn from the front and side, plus their flat measurements (length, width, sleeve, inseam)
- [ ] Which phone you will test on, and whether Blender is already installed on the computer Claude Code will run on

### Time-boxed plan

| Block | Work | Box |
| --- | --- | --- |
| 0. Setup | Repo, Blender runnable headlessly from Python, minimal three.js viewer that loads a model on your phone | 1 hour |
| 1. Candidates and licences | Shortlist open body generators (for example MakeHuman/MPFB), check their licences and export route to glTF | 1 hour |
| 2. Body from measurements | Map the measurements onto the body model's controls, solve for them, and measure the resulting mesh at the same landmarks | 4 to 5 hours |
| 3. Garment fitting | Build one tee and one trouser template, fit each offline to three body shapes (small, medium, large), export, and blend between them at runtime | 5 to 6 hours |
| 4. Phone check | Load avatar plus two garments on your phone; record frame rate and download size | 1 to 2 hours |
| 5. Side-by-side and decision | Compare avatar against your photos and real garments; fill in the results table and decide | 1 hour |

If block 2 has no working body by Sunday midday, stop and take the fallback in the risks section rather than carrying on into garments.

### Pass criteria

These targets are proposed and can be adjusted before the spike starts. Tape-measure error is itself about 1 cm, so anything tighter than 2 cm is not meaningful.

| Test | Pass |
| --- | --- |
| Body circumferences (chest or bust, waist, hips) | Within 2 cm of the tape measurement |
| Height and limb lengths | Within 1.5 cm of the tape measurement |
| Recognisability | Each of you says the avatar looks like your own shape from front and side |
| Garment landmarks (hem, sleeve end, inseam) | Land within 2 cm of the real garment worn on the real person |
| Garment clipping | No body showing through cloth when rotating through 360 degrees, on all three body shapes |
| In-between sizes | A blended size between two fitted shapes still looks plausible with no tearing or stretching |
| Phone performance | At least 30 frames per second on your phone, and under 15 MB to load an avatar with two garments |

### Spike outputs

- A results table with the measured error for every test above
- Screenshots of avatar against photo for each person, and avatar-in-garment against the real garment
- A short write-up: what worked, what did not, the effort per new garment type, and a recommendation
- The working scripts and viewer, kept in the repo as the start of the real pipeline

### Decision rule

| Result | Next step |
| --- | --- |
| Both questions pass | Go: begin milestone 1 with this pipeline |
| Body passes, garments fail on fit | Narrow to the garment types that did fit, or move to per-size hand-fitted garments, and re-spike for one more day |
| Body fails | Try a second body generator or a different measurement mapping; if that fails too, rethink 3D and revisit the stylised 2D option |
| Garments pass but cost too much effort per type | Go with a small curated garment library and accept slow growth |

## Milestones

Each stage ends in a gate that you and your wife can judge by using the app, and the next stage starts only once the gate is passed. Only the spike has a date; the spike's findings set the pace for everything after it.

&#91;embedded content: roadmap · six stages, each ending in a gate\]

The highlighted stage is the one running this weekend. Inspiration features, including saved reference images and gap analysis, deliberately come last, because they depend on a trustworthy wardrobe, avatar and colour profile.

## Testing strategy

Because accuracy is the top requirement, testing follows the spike's principle: every accuracy claim is a number produced by a script, and anything that can be automated is. Judgement calls, such as "does this look like me", are still tested, but by a written checklist rather than a gut feel.

| Layer | What it checks | How | When |
| --- | --- | --- | --- |
| Unit tests | Measurement-to-body solving, colour maths, season scoring, outfit scoring, data migrations | Vitest, with small fixed fixtures | Every commit |
| Geometry accuracy | Generated body circumferences and lengths against input measurements; garment landmarks (hem, sleeve end, inseam); body clipping through cloth; stretching when blending between fitted sizes | Scripts run headlessly in Blender or Node, failing the asset build if a tolerance is missed | Every asset-pack build |
| Visual regression | Avatar plus each garment on each body shape from front, side and back | Playwright renders fixed camera angles, compared with approved baseline images; you review any diff by eye | Every change to assets or the viewer |
| Colour accuracy | Extracted garment colour against the real item, and on-screen colour against extracted colour | A set of items with known colours, photographed in daylight and warm indoor light, measured as colour difference (delta E) | Stage 2 onwards, and when the extraction changes |
| Season logic | Same answers give the same season; a small change in answers moves at most to a neighbouring season | Fixture sets of questionnaire answers with expected results | Every commit once stage 3 starts |
| End-to-end | Create a profile, enter measurements, add an item from a photo, dress the avatar, save an outfit, export and re-import a backup, use the app offline | Playwright on a phone-sized viewport | Every commit once stage 1 starts |
| Device and performance | Frame rate, load size, memory and heat on your real phones; PWA installability | Manual run on both phones, plus a Lighthouse audit | End of every stage |
| Human acceptance | The roadmap gates, such as "you both can dress your avatar" | A written checklist you and your wife complete, with pass or fail and notes kept in the repo | At every gate |

### Tolerances

The spike sets the first numbers (2 cm on circumferences, 1.5 cm on lengths, 30 frames per second, 15 MB). Colour tolerances are not set yet: the spike should record what the extraction actually achieves, and we then fix a delta E limit based on what a person can see on a phone screen. Whatever limits we agree are stored in one config file that the tests read, so changing a tolerance is a visible, reviewed edit.

### What each gate must show

| Gate | Evidence required |
| --- | --- |
| 0. Spike | Results table, side-by-side screenshots, phone frame rate and size |
| 1. Thin slice | End-to-end test passing and both of you dressing your avatars on your phones |
| 2. Wardrobe | Colour test set within the agreed delta E limit, and visual regression baselines approved |
| 3. Colour profile | Season fixtures passing, and both of you confirming your result reads as right |
| 4. Outfits | You each rate a batch of generated outfits (suggest 20) and most are ones you would wear |
| 5. Inspiration and polish | Backup round trip and offline use tested, and performance targets met on both phones |

### Test data and privacy

Your real photos and measurements stay out of the repository. Committed tests use synthetic bodies and sample garments; your own data lives in a git-ignored local folder that the same scripts can read when you run the checks on your machine. One command, for example `npm run check`, runs everything that can run locally, so the checks are cheap enough to run before every commit.

## Data model

The data model describes garments as shape plus colour, never as a renderer-specific asset, so the 3D renderer can be swapped later without touching a user's wardrobe. Everything lives in IndexedDB on the device, is synced in the background to a private Firestore database through our own server, and can be exported as one backup file.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Profile | id, name, createdAt | One per person; owns everything below |
| Body | profileId, measurements (cm), presetId, derived morph values, sourceNotes | Measurements are the source of truth; morph values are recomputed whenever the body model changes |
| Colouring | profileId, skin, hair, eyes (sampled colour values), undertone, season, confidence | Season is a label plus the questionnaire answers that produced it, so it can be re-run |
| GarmentTemplate | id, type, sizeRange, fittedShapes (per body shape), anchors, version | Ships with the app; one per garment type and cut |
| WardrobeItem | id, profileId, templateId, photo (blob), cutout (blob), colour (dominant and palette), pattern, formality, seasonTags, notes | The photo is kept so colour can be re-extracted if the algorithm improves |
| Outfit | id, profileId, itemIds, score parts (harmony, palette fit), occasion, savedAt | Score parts are stored so the reasoning can be shown to the user |
| ReferenceImage | id, profileId, image (blob), extractedPalette, notes | Used later to suggest matches from the wardrobe |

## Risks and fallbacks

The biggest risk is that accurate fit and drape across body shapes costs too much effort per garment. The spike is designed to expose that cost early.

| Risk | Why it matters | Fallback |
| --- | --- | --- |
| Garment fitting effort per type is high | Every new garment must be fitted to several body shapes offline; the library could grow very slowly | Keep a small curated library; automate fitting with Blender scripts; add types only when worth it |
| Measurements do not give a convincing body | Tape measurements underdetermine shape; two bodies with equal measurements can look different | Add preset body shapes and photo-assisted correction; allow manual slider tweaks |
| Body model licences restrict use | Some well-known body models are non-commercial only, which is fine for personal use but blocks publishing | Check licences in block 1 and prefer openly licensed models; note the limit if a restricted model is used |
| Phone performance or download size | 3D with several garments can be heavy for a mobile browser | Compress meshes and textures, limit visible layers, and test on the real phone early |
| Colour from phone photos is unreliable | Lighting and white balance shift colours, hurting garment colour accuracy | Show extracted colour for the user to correct; encourage daylight and a reference background; add white balance correction later |
| Seasonal analysis is self-reported | A questionnaire is only as accurate as the answers and the lighting used to judge them | Present the season as a starting point; add a draping check later to confirm |
| Local-only data is lost if the browser is cleared | Photos and measurements could disappear | One-tap export and import of a backup file; wardrobe and quiz data also sync through Firestore (V2-06b) |
| 3D proves unworkable | The whole premise rests on it | Revisit a stylised 2D layered avatar, keeping the same data model |

## Working agreement for Claude Code

Paste this section into the repo as `CLAUDE.md`, or point Claude Code at this doc, before the spike starts.

- **Start with the spike, not the app.** Build only what the spike needs, in a `spike/` folder, and keep it throwaway-friendly. Do not scaffold the full PWA until the go decision.
- **Respect the time boxes.** Report at the end of each block with what works, what does not and the measured numbers. If a block overruns by half, stop and say so rather than carrying on.
- **Measure, never assert.** Every accuracy claim comes with a number, a script that produced it and a screenshot. Do not describe a result as good without the comparison.
- **Scripts over manual steps.** Blender work runs headlessly from Python so anyone can re-run it from the repo. Record Blender and library versions.
- **Plain, reviewable output.** Small commits, short READMEs for each script, and no dependency added without saying why and checking its licence.
- **Privacy by default.** No analytics, and no uploads of photos or measurements. The only network calls are to our own server, behind Google sign-in, which keeps each person's synced data private to them. (Changed 16 Nov 2026, V2-06b: see `docs/decisions/2026-11-16-v2-06-data-model.md`.)
- **Ask before choosing for me** on anything that changes the data model, the licence position or the garment library scope.

### Open questions

- Which phone and browser will be the test device, and does it support WebGL 2 smoothly?
- Is Blender already installed on the machine Claude Code runs on, and which version?
- Which garment types matter most to you both for the first library after the three spike garments?
- Should the avatar include hair and face in the spike, or stay a neutral head until the body and garments pass?
- How will you each take consistent front and side photos for the check (tripod, a fixed spot, a friend)?
