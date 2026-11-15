# MVP-08 Quiz content

**Ceiling:** 1 hour for Claude Code's draft, then Joe's review. Stop as soon as the draft meets the acceptance criteria.
**Worker:** Sonnet, high. Writing plus a scoring design that must reach all 12 seasons. Sonnet writes well; high effort for the scoring logic.
**Owner:** Joe signs off the content.

## Goal
The questions, the 12 seasons and the general advice for each, as data the app can read.

## Approach
Inspired by The Concept Wardrobe's guide to colour analysis (https://theconceptwardrobe.com/colour-analysis-comprehensive-guides/what-is-color-analysis), which uses the 12-season model and three traits of a person's natural colouring:
- **Warmth:** warm (yellow-based) or cool (blue-based) undertone.
- **Value:** how light or dark their colouring is.
- **Chroma:** how clear and bright, or soft and muted.

Each of the four seasons splits into three, and each sub-season is defined by its two strongest traits (for example, Light Summer, True Summer, Soft Summer).

**Write original content.** Don't copy the site's wording, quiz or palettes; its palettes are images and paid guides.

## Scope
- About 8 to 12 questions about skin, hair and eyes, each scoring one or more of the three traits.
- Scoring that maps the three traits to one of the 12 seasons.
- For each season: a short plain-English description, general advice (colours that flatter, neutrals, colours to approach with care), and a palette of about 8 to 12 swatches as hex values.
- Stored as one JSON file in the app, so the content can change without code changes.

## Acceptance criteria
- Every one of the 12 seasons can be reached by some set of answers (a unit test proves it).
- Joe has reviewed and signed off the questions and all 12 advice texts.
