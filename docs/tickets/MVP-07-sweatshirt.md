# MVP-07 Sweatshirt template

**Ceiling:** 2 hours, the most this ticket may take, not a target. It is the riskiest MVP ticket. Stop as soon as the acceptance criteria are met.
**Worker:** Opus, high. The only ticket where Opus pays for itself. It is new garment geometry in Blender, the area that ate most of the spike's reworks, and its fallback is a cheaper long-sleeve tee.

## Goal
A regular-fit sweatshirt using the same offset-shell method as the tee.

## Scope
- Long sleeves, more room than the tee, cuffs and hem drawn in slightly (as ribbing would).
- Regular fit only. No oversized fit, no hood.
- Built over the trousers, like the tee.
- Added to the pack build (MVP-03) and to the clothes menu (MVP-05).

## Acceptance criteria
- Passes the same hard mesh checks as the tee on Joe and the six synthetic bodies.
- **Joe's visual sign-off:** it reads as a sweatshirt, not a tee with long sleeves.

## If the ceiling is reached
Stop and report. The fallback is a long-sleeve tee in the sweatshirt slot. Joe decides.

## Done, awaiting Joe's sign-off (15 Nov 2026)
Regular-fit sweatshirt (chest + 10 cm, long tapered sleeves, hem and cuffs drawn in by shape) in the pack build and the Top slot. It passes the tee's mesh checks on Joe and all six synthetic bodies (0 intersecting pairs, 0.3 cm minimum clearance), and Joe's pack is 832 KB. `npm run check` passes. Started 18:46, done by 19:01 on the clock; details in `docs/decisions/2026-11-15-sweatshirt.md`.
**Joe's visual sign-off:** pending.
