# V2-08 Bug: the tops show a point at each breast

**Status:** ready. Raised 16 November 2026 at the end of V2-03, which Joe accepted with this bug open. Run it last in version 2, after V2-07.
**Ceiling:** 3 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Fable, high. Opus tried seven fixes in V2-03 (three on the tee shell, three body shapes, four bra garments, counting the fourth) and none worked.
**Depends on:** V2-03, V2-07 (if V2-07 adopts a ready-made bra or tops that hang properly from the bust, this ticket may shrink or close)

## The bug
On every female body the tee, its V and scoop necklines and the sweatshirt come to a point at each breast, and in side view they follow the underside of the bust instead of hanging from it. Nothing shows through: every hard mesh check passes. It is a shape problem.

Seen on B in the spike viewer (`/?m=b&view=torso` and `torsoside`). The three synthetic female bodies show the same (not looked at by eye; same mesh and method).

## What is known
Full record, with numbers, in `docs/decisions/2026-11-16-v2-03-garments-on-b.md`. In short:
- **Cause.** The tops are offset shells resting about 3 mm off the body, and the base female MPFB mesh comes to a cone at each breast. A smooth body gives a smooth shell; a point gives a point.
- **Tried on the tee shell:** a smooth floor hung from the bust apexes. Broke the chest calibration, the neckline and the waistband.
- **Tried on the body:** MPFB nipple targets (they work, tips moved in 0.8 cm, but the cone remains), a rounder lifted bust (breaks the chest measurement near the armpit), Blender's Smooth modifier (10 passes, no visible change).
- **Tried as a bra garment:** an offset shell of the torso with its cups pushed onto a smooth floor. The bra passed its own checks every time, but the tops could not be fitted over it. Two causes found: a straight top edge rode up into B's armpits (her bust line is 2 to 3 cm below them), making the bra 10 cm too big round; and the floor is level between the two apexes, so the "cups" were one flat shelf with sharp sides.
- Patches and logs from every attempt are in `private/experiments/` on Joe's machine (git-ignored).

## Things to watch
- **B's tee has no margin at the trouser waistband.** A change to the bust alone made the tees cut through it (74 face pairs at 85 to 95 cm). Recheck after any change.
- **B's chest is measured close to her armpits** (`tee_chest_circ` in `spike/blender/body_from_measurements.py`). Anything that lifts the bust or adds room under the arms can make the reading flip between two values.
- **B's hips are still a placeholder.** Her trousers and shorts are refitted when the tape value arrives.

## Scope
- Make the tops on a female body read as worn over a bra: a rounded bust, no point, falling from the bust rather than tucking under it.
- Any method that keeps the hard mesh checks: real bra cups (two rounded cups joined by a narrow centre piece), a smoothed body copy used only to fit the tops, stronger smoothing, or a V2-07 asset.
- First, agree with Joe a measured number for "no point" (for example, surface curvature at the apex against the male tee), so the fix is judged by a number and a screenshot, not by eye alone. A simple bump-from-neighbours measure was tried in V2-03 and did not follow what the eye sees.

## Decisions needed from Joe
- If the fix is a bra garment: is it shown in the app when no top is worn? Recommendation: yes, as part of the body, with no menu entry.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- The agreed "no point" number met on B and the three synthetic female bodies, for the tee, both necklines and the sweatshirt, with front and side screenshots.
- Every hard mesh check passes on all eight bodies; Joe's and the male synthetic bodies' garments are byte-identical to before.
- B's visual sign-off, front, side and back.
