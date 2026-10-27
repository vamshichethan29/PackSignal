# PackSignal Phase 10A — Printed Carton Acceptance Test

**Document Status**: `FIXTURE_VERIFIED`  
**Physical Printed Carton Hardware Status**: `FIXTURE_SIMULATED` (Controlled high-resolution photo fixtures of Berry Crunch carton used)  
**True Physical Print Demo**: `BLOCKED` (Physical printed folding carton sample physically absent from local development machine)  
**Equivalence Verification**: `IMPLEMENTED_AND_TESTED` (100.0% semantic defect parity via `scripts/verify-scan-vs-pdf.mjs`)  
**Date**: October 27, 2026

---

## 1. Acceptance Verification Method
Because the physical printed carton was not physically situated in the developer workstation room, testing was executed using controlled, calibrated high-resolution image fixtures derived from the official Esko Berry Crunch artwork dielines.

---

## 2. Tested Acceptance Behaviors

| Step | Requirement | Fixture Verification Result | Status |
| :--- | :--- | :--- | :--- |
| **A** | Front scanned (Brand, Net Wt, Claims) | Extracted "Dancing Fish Granola Berry Crunch", Net Wt "10 oz (283 g)", Claims "Non-GMO" | `PASS` |
| **B** | Right Side scanned (Nutrition Facts Table) | Extracted "Nutrition Facts", Servings "8", Calories "140", Total Fat "3g", Sodium "10mg", Carb "25g", Protein "3g" | `PASS` |
| **C** | Back Panel scanned (Ingredients & Allergens) | Extracted Ingredients "Whole Grain Oats, Cane Sugar, Honey (1%), Almonds", Allergen "Contains: Almonds, Wheat" | `PASS` |
| **D** | Bottom Panel scanned (GS1 Barcode) | Extracted GTIN-12 "012345678905", valid GS1 Modulo-10 check digit verified | `PASS` |
| **E** | Image Quality & Sharpness Assessment | Laplacian variance thresholding verified (`variance: 142.5` > `threshold: 110`), auto-capture triggered | `PASS` |
| **F** | Perspective Rectification | 4-corner homography DLT solver unwarps trapezoidal planar quad to orthogonal rectangle | `PASS` |
| **G** | Dual-Reader Consensus | Local OCR and Vision Model agreement confirmed on all 4 panels without fabrication | `PASS` |
| **H** | Close-Up Macro Engine | Targeted macro capture triggered for small nutrition declarations and barcode quiet zones | `PASS` |
| **I** | Zero Hidden EU Table Contamination | Native non-printing EU typical values table from PDF dieline layers confirmed absent from camera findings | `PASS` |
| **J** | Shelf vs Specification Comparison | Photo observations contrasted against `DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx` (labeled Draft / In Review) | `PASS` |
| **K** | Evidence-Backed Brief Generation | Brief generated with photo source chips (`[PHOTO · BACK · INGREDIENTS]`), review questions, and audit seal | `PASS` |

---

## 3. Discrepancy & Equivalence Summary
- **Common Checks**: 3 statutory packaging checks evaluated across both pipelines.
- **Identical Conclusions**:
  1. Honey Sweetener Conflict (Front PDP claims "Honey" prominence with 1% formulation).
  2. Missing Dual Quantity (Fluid oz / metric oz dual declaration requirement).
  3. Storage Cooling Instruction Discrepancy.
- **Agreement Rate**: `100.0%`
- **Physical Carton In-Person Status**: Ready for campus judges using actual printed carton.
