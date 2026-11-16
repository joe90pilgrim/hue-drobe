# Ticket: [Short Title]
**Recommended Model:** [e.g., Sonnet 4.6 / Opus 4.6] | **Thinking:** [Low / Medium / High]

## Target Files (Read/Edit Only These First)
- `src/pages/Wardrobe.tsx` (main layout, switch, filter chips)
- `src/components/ItemCard.tsx` (card grid & selection border)
- `src/components/DetailPanel.tsx` (sheet/panel actions)
- *Do NOT modify:* `src/store/wardrobe.ts`, `src/store/outfits.ts`

## Scope
- [Bullet points of exact UI/logic changes—keep identical to your current clean style]

## Execution Rules
- **No broad repo search:** Start directly with the files listed under Target Files.
- **Subagents for heavy output:** If you need to search outside Target Files, inspect large files, or run full test suites/builds, delegate that to a subagent and return only a 5-line summary.
- **Done check:** Run a targeted typecheck/lint on modified files only, then stop.
