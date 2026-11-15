# Decisions for Joe to confirm

Status: confirmed by Joe on 2026-11-15, all three as recommended, with one addition to decision 2 (below).

## 1. Runtime size blending is dropped; garments are fitted per profile
- Change: `GarmentTemplate.fittedShapes (per body shape)` becomes a garment pack fitted per profile by the laptop build.
- Cost accepted: any change to a person's measurements needs a rebuild on the laptop and a new pack on the phone.
- The blueprint's "in-between sizes plausible" criterion is withdrawn, not passed.
- **Confirmed.** Blend test not run.

## 2. How a garment gets its size in the product
- (a) The user measures every item (what the spike tested), or
- (b) each template and cut has a default ease profile (for example slim jeans = body plus X cm at the hip, Y cm at the hem), with flat measurements as an optional refinement.
- Evidence from the spike: Joe's real tee chest and jeans waist were at the ease floor, so real items can be smaller than the body plus 3 mm (stretch fabric). An offset shell cannot represent that, which argues for (b) plus a stretch flag per item.
- **Confirmed: (b), with an addition from Joe:** the user can supply their own flat measurements for an item to get greater accuracy if they want. So the product has default ease profiles, a stretch flag, and optional measured refinement.
- Update: after Joe's tee re-measure (chest 108 cm, not 94), only the jeans waist remains at the ease floor, so the evidence for stretch is one item, not two.

## 3. Milestone 1 garment scope
- The shell method is shown for close-fitting garments only: tees, shirts, jeans, leggings, fitted knits.
- A skirt or midi dress has not been attempted, so the blueprint's midi dress and jumper are unproven.
- **Confirmed.** Milestone 1 is tee, shirt, trousers and one fitted knit. Dress and jumper move out until a loose-garment test (cloth simulation from a hung shell) succeeds.
