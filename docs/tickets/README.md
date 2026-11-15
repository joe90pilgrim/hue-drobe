# MVP tickets

Written 15 November 2026, after the spike closed with a go for close-fitting garments. Work them in number order unless a ticket says otherwise.

## The MVP

1. An app that runs on mobile (Pixel 8) and desktop.
2. Based on the concept designs.
3. Joe can see a representation of himself.
4. Joe can switch between pre-defined clothes (t-shirt, trousers, sweatshirt) and set each one's colour with a colour picker.
5. Joe can complete a seasonal colour quiz and receive general advice.

**Out of scope for the MVP:** adding your own clothes, other people or profiles, clothing recommendations, editing measurements, shoes.

## Tickets

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

## Workers

Each ticket names the cheapest model and effort level likely to finish it inside its ceiling without many reworks. Set the model and effort when you start the session for that ticket.
- **Haiku:** small, well-defined UI work.
- **Sonnet:** most tickets.
- **Opus:** only MVP-07, where reworks would cost more than the stronger model.
- **Fable:** not needed for the MVP.

If a ticket on Haiku or Sonnet hits the three-strikes rule, don't keep retrying on the same model. Stop, and Joe decides whether to move it up one level.

## Rules for every ticket

- **Joe signs off anything visual.** He QAs by eye in the app served locally (`npm run dev`, opened on the Pixel 8 and on desktop). A ticket with a visual criterion isn't done until he says so.
- **Done means stop.** When a ticket's acceptance criteria are met, stop work on it immediately, commit, report and move to the next ticket. Don't polish, refactor or add extras beyond the criteria. Write any ideas in `docs/tickets/backlog.md` instead of doing them.
- **The ceiling is a maximum, not a budget.** Each ticket has a ceiling in hours of work. Most tickets should finish well inside it. Note the start time (run `date`) when you begin a ticket. If the ceiling is reached before the criteria are met, stop whatever state the work is in, write down what was done, what's left and why, and ask Joe.
- **Three strikes.** If a fix hasn't worked after three attempts, stop and ask Joe, even if the ceiling hasn't been reached.
- **No custom physics or material models.** Garments use the offset-shell method from the spike. `--drape` stays off.
- **Test on one body first.** Don't run a full multi-body build to try a parameter.
- **Personal data never goes in git.** Joe's measurements and avatar files live in the git-ignored `private/` folder and its build outputs.
- **Done means:** the acceptance criteria are met, `npm run check` passes (from ticket 02 onwards), the work is committed, and a two-line note is added to the ticket saying what was done.
