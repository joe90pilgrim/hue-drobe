# V4-00 Decision: sending data off the device

**Status:** done. Decided by Joe.

**Ceiling:** No agent.
**Worker:** No agent. Joe and Beth. A decision, not code.
**Depends on:** None

## Goal
Agree whether photos and garment details may be sent to an outside service (such as Gemini) for this version and v6.

## Scope
- What would be sent: photos of clothes, retailer web pages, your season and saved items.
- Where it goes, how long the service keeps it, and the cost.

## Decisions made by Joe
- **Decision:** **Yes** — approved to send garment photos and wardrobe/season details to the Gemini API for Version 4 (photo/URL-to-item matching) and Version 6 (style assistant).
- **Boundaries & Limits:**
  - **Garments only:** Photos sent to the API must be standalone clothing items (e.g., flat-lays, hanger shots, or product images).
  - **No people or body data:** Never send photos of Joe, Beth or anyone they know, or body measurements/avatar meshes, off-device.
  - **Amended 22 Nov 2026 (V4-02):** a cropped retailer product image that shows a model wearing the garment is allowed. The model is not someone we know, and the crop is chosen on the device. Private photos of people are still never sent.

## Acceptance criteria
- [x] A decision record in `docs/decisions/` (`docs/decisions/2026-11-18-v4-data-off-device.md`).