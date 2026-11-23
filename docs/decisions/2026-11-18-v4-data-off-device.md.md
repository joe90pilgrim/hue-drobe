# Decision: Sending Wardrobe Data Off-Device (V4 & V6)

**Date:** 18 November 2026
**Status:** Accepted
**Related Ticket:** `V4-00`

## Context
Version 4 (`V4-01` Photo to nearest item, `V4-02` Screenshot to nearest item) and Version 6 (`V6-01`, `V6-02` Style assistant) require image classification and multimodal styling reasoning. Running local vision models in-browser would add heavy client-side bundle size and lower classification accuracy on a mobile PWA.

## Decision
We will use the **Gemini API** for image-to-garment matching and style assistant features rather than bundling local browser-based vision models.

## Guardrails & Privacy Limits
1. **Clothing items only:** Image uploads to the API are restricted strictly to standalone garments (flat-lays, hanger photos, or product shots).
2. **Zero personal imagery or body data:** Photos of Joe, Beth or anyone they know, personal avatar meshes, and physical body measurements remain strictly local/private and must never be sent to external AI APIs.
   - *Amended 22 Nov 2026 (V4-02, Joe's decision):* a cropped retailer product image that shows a model wearing the garment may be sent. The person chooses the crop on the device. Private photos of people are still never sent.
3. **Lightweight metadata only:** Text context sent for styling advice (V6) is limited to seasonal colour palettes and saved garment lists.

   - *Amended 23 Nov 2026 (V6-01, Joe's decision):* for packing templates the trip name, the trip's start and end dates, and the season name with its palette (only if the colour quiz is complete) may be sent. The app says on the screen that the trip name is sent to Gemini. No destination field is added; wardrobe contents are still not sent.

## Consequences
- `V4-01` can proceed using a server-side/API call to Gemini Flash for fast, accurate garment category, neckline, and colour extraction.
- The PWA remains lightweight on mobile devices without downloading multi-megabyte client-side ML weights.