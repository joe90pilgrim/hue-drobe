# MVP-09 Quiz flow

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Haiku, high. A question-by-question screen driven by the JSON from MVP-08; straightforward once the content exists.

## Goal
Joe takes the quiz in the app and gets his season and general advice.

## Scope
- One question at a time, with progress shown and a back button.
- Result screen: the season name, its description, its palette as swatches, and the general advice.
- The result is saved (IndexedDB) and shown on return; the quiz can be retaken.
- No outfit scoring and no clothing recommendations (out of scope).

## Acceptance criteria
- The end-to-end test completes the quiz and sees a result.
- **Joe's visual sign-off** on the quiz and result screens, on phone and desktop.
