# V6-01 Ask Gemini for advice

**Status:** outline. Refine with Joe before starting.

**Ceiling:** Set when refined.
**Worker:** Sonnet, medium (tentative). A small server step on Cloud Run calling Gemini; the work is mostly in the prompt and the guardrails.
**Depends on:** V4-00, V2-05

## Goal
Ask for style advice using your season, saved clothes and outfits.

## Scope
- A server step on Cloud Run holds the Gemini key; the phone never does.
- Sends only what V4-00 allows.

## Decisions needed from Joe
- What should Gemini be told about you, exactly?
- A monthly spending cap on the Gemini API?
- Free-form chat, or set questions such as 'What goes with this?'

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- To be agreed.
