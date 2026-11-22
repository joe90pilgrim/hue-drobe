# Proposal: template-based garment pipeline for version 3 onwards

Date: 17 November 2026. Status: **approved by Joe on 17 November 2026, across the board** (design with the MPFB/MakeClothes correction, the three-round limit, the Suits 01 blazer and Shirts 02/03 shirt test pair, and folding V3-06). Build tickets: V3-07 to V3-10.

Note added after reviewing the repo root: V3-06 is already built as `pack/pack_items.py`, so `fit_template.py` generalises that file rather than starting fresh, and `render_closeup.py` already exists in `spike/blender/`.

Reviewed: `spike/blender/` (`garment.py`, `body_from_measurements.py`, `mesh_checks.py`), `spike/assets/` (the V2-07 asset-pack spike), `spike/cloth/` (the V3-00 cloth experiment) and their write-ups. Not visible to the reviewer: `pack/` (including `pack/fit.py` and the current shirt code such as `add_shirt_details()` and `_fill_armpit_holes()`), `app/` and the root `CLAUDE.md`. Anything said about those is from the tickets and Joe's description, and should be checked before building.

## 1. Agreement, and one correction to the plan

Agreed: writing new geometry code per garment type doesn't scale. Each new type has meant new slicing and offset rules, then long loops against the strict mesh checks at armpits and crotch.

**The correction: don't build a fitting engine from scratch. MPFB already has one.** Its clothes format (MHCLO) stores, for every garment vertex, a link to nearby body vertices plus an offset. When the body's shape changes, the garment follows. V2-07 proved this works headlessly: every pack item loaded and attached to every body with MPFB's own loader and no manual work (32 of 32). MPFB also bundles MakeClothes, which turns any garment mesh modelled against the MPFB base body into an MHCLO asset.

So the "one reusable fitting script" is mostly a wrapper around tools that already work:

- **Once per template (authoring):** align the raw mesh to the MPFB reference body, then convert it to MHCLO with MakeClothes.
- **Per person (build):** load the body from measurements, attach the MHCLO garment with MPFB, then settle and correct it.

V2-07's failures were about textures, clipping at close contact, and how the body under a garment is hidden. They weren't about the fitting itself, and the design below targets exactly those.

## 2. Proposed design: `fit_template.py`

### Folder structure

```
pack/
  fit.py                    existing per-person build (bodies, legacy garments)
  fit_template.py           new: generic template fitting (this proposal)
  render_closeup.py         visual sign-off renders (front, three-quarter, back)
  templates/
    <category>/<template_id>/
      source.<obj|glb>      the raw downloaded mesh, untouched
      template.mhclo        MakeClothes output: vertex links to the base body
      template.obj          the aligned garment mesh MakeClothes produced
      meta.json             licence, source URL, sha256, author, layer, rules
      notes.md              what was done to it, and Joe's visual sign-off
assets/packs/MANIFEST.md    archived MakeHuman packs (V2-09)
```

`meta.json` holds everything a garment needs, so `fit_template.py` stays generic:

- `category`, `layer` (base, mid, outer, bottom, full), `allowed_bodies` (female, male, both)
- `licence`, `source_url`, `sha256`, `credit` (needed for CC-BY)
- `delete_group` (whether the body underneath is hidden)
- `settle` (none, or a cloth settle with pinned groups)
- `clearance_cm` and `contact_groups` (where it should sit close to the body)
- `replaces` (for example, a dress replaces the top and bottom)
- `colour`: always plain colour, except hair and shoes, as decided after V2-07

### Stage A: authoring, once per template (Joe signs off)

1. **Import and normalise.** Apply the transforms, check the scale matches the MPFB base body (MakeClothes fails if it doesn't), check normals, and drop textures.
2. **Align to the reference body by landmarks.** The landmarks are read from the MPFB reference body's joint groups, which the spike's `joint_positions()` already reads: neck base, both shoulders, chest or bust line, waist, hips, and crotch for bottoms. The matching points on the garment are found automatically where possible (for example the collar opening's centre, the sleeve seams, the waistband loop), or picked once and stored in `meta.json`. Fit in order:
   - uniform scale and translation from the neck-to-waist span
   - per-axis scale for chest, waist and hip widths
   - a Lattice modifier (about 3 by 4 by 3) to pull shoulders and hips onto their landmarks without bending the garment's own shape
   - match the pose: the garment must be in the base body's rest pose, so a T-pose garment's sleeves are rotated down to the A-pose
3. **Convert with MakeClothes.** Assign vertex groups (automatic first; hand-assigned only for collars or lapels that shouldn't follow the skin), set the delete group, and write `template.mhclo`.
4. **Render for sign-off** on the reference body, with `render_closeup.py`.

### Stage B: per-person build (automatic)

1. Build the body from measurements (unchanged `body_from_measurements.py`).
2. **Attach** with `HumanService.add_mhclo_asset`. MPFB moves the garment to the person's shape.
3. **Settle (only for loose garments).** A short Blender cloth pass with the regions that should follow the body pinned (waistband, shoulders, collar), using the V3-00 settings that gave identical results between builds (one thread, fixed frames). Fitted garments skip this step.
4. **Correct clearance without crushing the silhouette.** A Shrinkwrap modifier in *Outside Surface* mode with a small offset, limited to the template's `contact_groups`. It only moves vertices that are inside or too close to the body (or the inner garment), so lapels, skirts and collars keep their shape. Use Shrinkwrap only for this push-out, never as the main fit: as the main fit it would flatten every garment onto the body.
5. **Layering.** An outer garment is built after the inner one. Steps 3 and 4 use the inner garment as a collision object and Shrinkwrap target, so a jacket sits over a shirt, never through it.
6. **Bake and export** to GLB in plain colour. Apply the delete group to the exported body for pack-style items, with the "body as drawn" check from V3-06.

### Visual first, gates second

Agreed, with one guard so the visual loop doesn't become the new credit sink:

- **While tuning a template:** run `render_closeup.py` only, and report a few warning numbers (minimum clearance, intersecting pair count) without enforcing them. **At most three render rounds** per template, then stop and ask Joe.
- **After Joe approves the look:** the template's checks in `tolerances.json` are switched on, and from then on `npm run check` enforces them on every build, as now.
- **Legacy garments** (tee, sweatshirt, trousers, shorts, tights and the existing shirts) keep their current code and strict checks. Migrate one only if it breaks, or when a template version is clearly better.

### Recommended first test

One shirt and one jacket, on Joe, B and the synthetic bodies, with a ceiling of 2 hours each. The shirt comes first, because the existing procedural shirt gives a direct comparison of effort and look. **Worker: Opus · High** for building `fit_template.py` itself (one-off architecture), then **Sonnet · Medium** for each new template after that, because adding a template becomes data work.

## 3. Sources for openly licensed base meshes

1. **MakeHuman community asset packs (first choice).** They're already in MHCLO format, made for the MPFB base body, and mostly CC0, with some CC-BY. V2-07 confirmed every item attaches automatically. Relevant to the roadmap:
   - Suits 01 (formal suits, CC0): the best lead for a blazer
   - Shirts 02 (long-sleeved cardigans, sweaters and shirts, CC-BY)
   - Shirts 03 (short-sleeved shirts, tunics and tops, CC-BY)
   - Dress 01 (CC0), Dress 02 and 03 (CC-BY)

   Archive them now (V2-09): the community site is shutting down.
2. **Templates modelled once in Blender and converted with MakeClothes.** This isn't a download, but it's the most reliable source for simple shapes such as a wrap dress or a plain coat. A simple garment modelled directly against the MPFB base body gives clean, low-poly geometry with no licence questions. It suits the "stylised, not uncanny" look.
3. **General free-model sites (last resort, check each item).** For example, CGTrader's free clothing section has shirts, jackets and dresses, often exported from CLO3D or Marvelous Designer. Cautions:
   - Many are on CGTrader's "Royalty Free License (no AI)", not CC0. Read the licence for each item, and check whether the "no AI" clause conflicts with an AI-assisted pipeline before using one.
   - They're draped on other avatars and in other poses, so they need the full Stage A alignment.
   - They're often high-poly or made of several layered pieces.

   Avoid AI-generated "free CC0" models. They are usually single closed shapes, not wearable garment surfaces, and don't fit well.

## 4. Draft `CLAUDE.md` sections for approval

The current `CLAUDE.md` wasn't visible to the reviewer. These sections are written to replace whatever covers status, where to work and garment rules; keep any other sections (privacy, scripts, versions) as they are.

```markdown
## Project status

- Stage 0 (the spike) is complete. Its decision records are in `docs/decisions/`.
- The MVP, version 1.1, version 1.2 (redesign) and version 2 are complete or in progress; see `docs/tickets/README.md` for each ticket's state.
- We are building **version 3: loose clothes and layers**. Active code lives in `pack/` (the asset build, including `pack/fit.py` and `pack/fit_template.py`) and `app/` (the web app).
- `spike/` is history. Read it for reference, but don't add new work there.

## How to work on a ticket

- One ticket per session. Read the ticket first, then only the files it lists under Target Files.
- Each ticket names a ceiling (a maximum, not a target) and a worker (model and thinking level).
- Done means stop: when the acceptance criteria are met, commit, add a two-line note to the ticket, and stop.
- Three strikes: if a fix fails three times, stop and ask Joe.
- If a ticket has an open decision for Joe, stop and ask rather than guess.
- Run Blender builds, checks and tests in a subagent, and bring back only the results and render paths.

## Garments: how new types are added (version 3 onwards)

- **Don't write new procedural garment geometry** (mesh slicing, vertex offsets, carved collars or plackets) in `garment.py` or `pack/fit.py` for new garment types.
- **Existing offset garments are legacy and stay as they are:** tee (crew, V and scoop necks), sweatshirt, trousers, shorts, tights and the collared shirts. Change them only to fix a bug, under their existing checks.
- **New garment types are templates:** an openly licensed base mesh in `pack/templates/<category>/<template_id>/`, converted to MHCLO with MPFB's MakeClothes, and fitted per person by `pack/fit_template.py`. Each template has a `meta.json` with its licence, source, layer and fitting rules.
- **Sources, in order:** MakeHuman community asset packs (archived in `assets/packs/`), simple templates modelled in Blender against the MPFB base body, then other sites only if the licence allows it (CC0, CC-BY or similar; check every item).
- **Visual first, gates second.** While tuning a new template, render with `pack/render_closeup.py` (front, three-quarter, back) and report clearance and intersection numbers without enforcing them. At most three render rounds, then stop and ask Joe. Only after Joe approves the look are the template's checks in `tolerances.json` enforced.
- No custom physics or material code. Blender's own cloth and modifiers only.
- Plain colour for all garments except hair and shoes, which keep textures shrunk to 1024 px.

## Privacy (unchanged)

- Joe's and B's measurements, photos and avatar files stay in the git-ignored `private/` folder and the pack's output folder. Never commit them.
```

## Decisions needed from Joe

1. **Approve the design**, with the correction to use MPFB's own MHCLO fitting and MakeClothes rather than a fitting engine written from scratch.
2. **Approve the three-round limit** on visual tuning per template.
3. **Approve the `CLAUDE.md` sections**, and give access to the repo root (or paste the current file) so they can be merged into it, not written blind.
4. **First test pair:** a shirt (Shirts 02 or 03, CC-BY, needs a credit) and a blazer from Suits 01 (CC0)? Recommendation: yes; both come from the packs, so this tests the pipeline before the harder outside-source route.
5. **V3-06 merge:** V3-06 (pack asset pipeline and body-hiding check) is largely Stage B of this design. Recommendation: fold V3-06 into a new `fit_template.py` ticket, and rewrite V3-04 (jackets and coats) to use templates.
