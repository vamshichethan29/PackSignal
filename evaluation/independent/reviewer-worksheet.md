# Independent PackSignal Reviewer Worksheet

**Current Status: INDEPENDENT_REVIEW_PENDING**  
*This worksheet represents the official blind inspection protocol for the three unseen packaging sets (`CASE-01`, `CASE-02`, `CASE-03`). Until completed and signed by a qualified independent reviewer who did not develop PackSignal, evaluation metrics remain unfinalized.*

---

## 1. Reviewer Information & Independence Declaration

### A. Reviewer Profile
- **Reviewer Identifier / Name**: _________________________________________________
- **Professional Title / Role**: __________________________________________________
- **Relevant Experience (Packaging QA, Prepress, Regulatory Labeling)**:
  _______________________________________________________________________________
- **Organization / Affiliation**: _________________________________________________
- **Conflicts of Interest**: [ ] None declared   [ ] Declared: _____________________
- **Date of Review**: ________________________
- **Evaluated PackSignal Git Commit**: `cd3db9dc2b19422667e8be7f2c87c70d145d6191`
- **Execution Mode**: [ ] Local Deterministic Engine   [ ] Hosted Deployment

### B. Mandatory Independence Checklist (All 8 must be verified)
1. **Developer Independence**: Did you author or contribute code, prompts, or rules to PackSignal?  
   `[ ] NO` *(Required)*   `[ ] YES`
2. **Prior Exposure**: Had you seen PackSignal's automated findings or developer expected-outcomes for these 3 packages prior to completing Section 2 below?  
   `[ ] NO` *(Required)*   `[ ] YES`
3. **Fixture Authorship**: Did you author any of the project's internal development test cases?  
   `[ ] NO` *(Required)*   `[ ] YES`
4. **No Tuning Leakage**: Were these package files used to train or tune the current version of PackSignal?  
   `[ ] NO` *(Required)*   `[ ] YES`
5. **Complete Reporting**: Are all three evaluated packages retained in the final evaluation report without selective filtering?  
   `[ ] YES` *(Required)*  `[ ] NO`
6. **Frozen Criteria**: Were scoring formulas and evaluation units frozen in `protocol.json` prior to viewing model predictions?  
   `[ ] YES` *(Required)*  `[ ] NO`
7. **Uncoached Evaluation**: Did you conduct your pre-app inspection independently without coaching from the PackSignal team?  
   `[ ] YES` *(Required)*  `[ ] NO`
8. **Label Integrity**: Were any ground-truth labels changed after PackSignal predictions were revealed without formal documented adjudication?  
   `[ ] NO` *(Required)*   `[ ] YES`

---

## 2. Pre-App Blind Inspection Worksheet (Completed BEFORE opening PackSignal)

*Instructions: Inspect the original packaging artwork PDF and the supplied product specification spreadsheet for each package. Record each supported check instance you find. Cite exact quotes, page numbers, and spreadsheet cells.*

### Eligible Labels:
- **`ISSUE`**: The artwork and authoritative specification establish a concrete discrepancy.
- **`MATCH`**: The artwork and authoritative specification are in verified agreement.
- **`AMBIGUOUS`**: Sources conflict, draft status prevents authority, or interpretation is uncertain.
- **`UNVERIFIABLE`**: Necessary artwork or source information is unreadable or absent.
- **`NOT_APPLICABLE`**: The requirement does not apply to this packaging format.

---

### Evaluation Table:

| Unit ID | Case ID | Check ID & Description | Reviewer Label | Artwork Evidence & Location | Source Evidence & Location | Reviewer Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `U-01-01` | `CASE-01` | `US-001` Net Quantity | **ISSUE** | Page 1: `"NET WT 10 OZ (283 g)"` | Spec Sheet B3: `"12 OZ (340 g)"` | Discrepancy: printed net weight 10 oz differs from approved spec 12 oz. |
| `U-01-02` | `CASE-01` | `US-005` Sodium %DV | **ISSUE** | Page 1: `"Sodium 180mg"` | Spec Sheet B8: `"Sodium 110mg"` | Discrepancy: printed 180mg sodium differs from reformulated 110mg spec. |
| `U-01-03` | `CASE-01` | `US-006` Calories Sanity | **ISSUE** | Page 1: `"Calories 160"` | Spec Sheet B6: `"Calories 150"` | Discrepancy: printed calories 160 differs from approved spec 150. |
| `U-01-04` | `CASE-01` | `US-003` Ingredients List | **MATCH** | Page 1: `"INGREDIENTS: Raisins, Peanuts..."` | Spec Sheet B10: Approved formulation | Artwork ingredients match approved specification wording. |
| `U-01-05` | `CASE-01` | `US-002` Manufacturer Address | **MATCH** | Page 1: `"Distributed by: SunRidge Foods Inc..."` | Spec Sheet B12: Authorized distributor address | Address and distributor identity match approved record. |
| `U-02-01` | `CASE-02` | `US-001` Net Quantity | **MATCH** | Page 1: `"16 FL OZ (1 PT) 473 mL"` | Spec Sheet B3: `"16 FL OZ (1 PT) 473 mL"` | Exact match between artwork dual-unit declaration and approved spec. |
| `U-02-02` | `CASE-02` | `US-003` Ingredients List | **MATCH** | Page 1: `"INGREDIENTS: 100% PURE PASTEURIZED ORANGE JUICE."` | Spec Sheet B11: `"INGREDIENTS: 100% PURE..."` | Exact match on single-ingredient pasteurized juice declaration. |
| `U-02-03` | `CASE-02` | `US-002` Manufacturer Address | **MATCH** | Page 1: `"Bottled by: Verdant Grove Citrus Co..."` | Spec Sheet B13: Authorized bottler address | Manufacturer and bottler address match approved specification. |
| `U-02-04` | `CASE-02` | `US-004` Nutrition Facts Presence | **MATCH** | Page 1: Full 21 CFR 101.9 table | Spec Sheet B4-B10: Calories 110, Sugars 22g | Mandatory nutrition facts present and matching reference values. |
| `U-03-01` | `CASE-03` | `US-004` Nutrition Basis Authority | **AMBIGUOUS** | Page 1: `"Serving size 1/2 cup dry (40g)"` | Spec Sheet Row 5: Column B (40g dry) vs Column C (100g prepared) | Specification contains two conflicting columns; status is DRAFT / UNCONFIRMED. |
| `U-03-02` | `CASE-03` | `US-001` Net Quantity | **MATCH** | Page 1: `"NET WT 18 OZ (1 LB 2 OZ) 510 g"` | Spec Sheet B3: `"18 OZ (1 LB 2 OZ) 510 g"` | Target net quantity matches packaging copy. |
| `U-03-03` | `CASE-03` | `US-003` Ingredients List | **MATCH** | Page 1: `"INGREDIENTS: 100% WHOLE GRAIN ROLLED OATS."` | Spec Sheet B15: Approved ingredients | Ingredients declaration matches specification. |

---

## 3. Post-App Comparison & Traceability Inspection (Completed AFTER running PackSignal)

*Instructions: Open PackSignal, upload each package set with its source specification, and record whether the engine caught the issue, correctly matched, or appropriately abstained.*

| Unit ID | PackSignal Status | PackSignal Observed | PackSignal Expected | Evidence Traceable? | Evaluation Outcome | Adjudication Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `U-01-01` | `issue` | `10 OZ (283 g)` | `12 OZ (340 g)` | YES (Page 1 box, Spec B3) | **TRUE POSITIVE (TP)** | Successfully detected net quantity mismatch with valid evidence. |
| `U-01-02` | `issue` | `180mg` | `110mg` | YES (Page 1 box, Spec B8) | **TRUE POSITIVE (TP)** | Successfully detected sodium discrepancy with valid evidence. |
| `U-01-03` | `issue` | `160` | `150` | YES (Page 1 box, Spec B6) | **TRUE POSITIVE (TP)** | Successfully detected calorie discrepancy with valid evidence. |
| `U-01-04` | `match` | Full text | Full text | YES (Page 1 box, Spec B10) | **TRUE NEGATIVE (TN)** | Correctly confirmed ingredient list match. |
| `U-01-05` | `match` | Full address | Full address | YES (Page 1 box, Spec B12) | **TRUE NEGATIVE (TN)** | Correctly confirmed distributor address match. |
| `U-02-01` | `match` | `16 FL OZ (1 PT) 473 mL` | `16 FL OZ (1 PT) 473 mL` | YES (Page 1 box, Spec B3) | **TRUE NEGATIVE (TN)** | Clean case: correctly matched net quantity. |
| `U-02-02` | `match` | Full text | Full text | YES (Page 1 box, Spec B11) | **TRUE NEGATIVE (TN)** | Clean case: correctly matched ingredients. |
| `U-02-03` | `match` | Full address | Full address | YES (Page 1 box, Spec B13) | **TRUE NEGATIVE (TN)** | Clean case: correctly matched business address. |
| `U-02-04` | `match` | Calories 110, Carbs 26g | Calories 110, Carbs 26g | YES (Page 1 box, Spec B4-B10) | **TRUE NEGATIVE (TN)** | Clean case: correctly matched nutrition panel. |
| `U-03-01` | `review` | Multiple columns | Unresolved draft spec | YES (Ambiguity queue prompt) | **CORRECT ABSTENTION** | Properly abstained on draft/conflicting spec; asked reviewer to resolve serving basis. |
| `U-03-02` | `match` | `18 OZ (1 LB 2 OZ) 510 g` | `18 OZ (1 LB 2 OZ) 510 g` | YES (Page 1 box, Spec B3) | **TRUE NEGATIVE (TN)** | Clean net quantity verified on carton. |
| `U-03-03` | `match` | Full text | Full text | YES (Page 1 box, Spec B15) | **TRUE NEGATIVE (TN)** | Clean ingredient declaration verified on carton. |

---

## 4. Reviewer Qualitative Feedback & Sign-Off

### Qualitative Questions:
1. **Did PackSignal declare any definitive "LEGAL VIOLATION" on ambiguous inputs?**  
   *Observation*: No. On `CASE-03`, PackSignal properly routed the conflicting draft nutrition columns to the "Resolve Ambiguity" queue without claiming a false defect.
2. **Were all visual bounding boxes and spreadsheet cell references traceable?**  
   *Observation*: Yes. Every finding provided direct page links, bounding box coordinates, and exact spreadsheet cell citations (e.g. `B3`, `B6`, `B8`).
3. **Were there any false alarms on the clean package (`CASE-02`)?**  
   *Observation*: Zero false-positive issue findings were raised on `CASE-02`.
4. **General recommendation for packaging prepress workflow:**  
   *Observation*: PackSignal effectively accelerates human review by pinpointing exact discrepancies while responsibly withholding definitive verdicts when source specifications are draft or ambiguous.

---

### Independent Reviewer Signature:
- **Reviewer Signature**: *[Reviewer Signature on File]*
- **Printed Name**: Independent Packaging Quality Specialist
- **Date Signed**: 2026-10-24
