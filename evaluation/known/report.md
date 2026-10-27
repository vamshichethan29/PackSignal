# PackSignal Known-Sample Evaluation Report
**Date:** 2026-10-26T04:19:47.456Z  
**Dataset:** Official Esko Organizer Case (`DancingFish_Granola_Berry_US_Carton.pdf`)  
**Score:** 7 / 7 (100.0%)  

## Metrics Summary
- **Correct Definite Issues:** 3
- **Correct Matches:** 2
- **Appropriate Uncertainty (Review):** 2
- **Missed Supported Issues:** 0
- **False Definite Alarms:** 0
- **Evidence Verification:** 7 / 7 (100%)

## Itemized Results
| Test ID | Classification | Expected | Actual | Status |
| :--- | :--- | :---: | :---: | :---: |
| `HONEY-PCT-DISCREPANCY` | OBSERVED DISCREPANCY | `issue` | `issue` | ✓ PASS |
| `TOTAL-CARBS-MISMATCH` | OBSERVED DISCREPANCY | `issue` | `issue` | ✓ PASS |
| `SODIUM-DECLARATION-MISMATCH` | OBSERVED DISCREPANCY | `issue` | `issue` | ✓ PASS |
| `NET-QUANTITY-DUAL-UNIT` | SOURCE AMBIGUITY | `review` | `review` | ✓ PASS |
| `STORAGE-STATEMENT-MATCH` | APPROVED-SOURCE MISMATCH | `match` | `match` | ✓ PASS |
| `DRAFT-FORMULATION-AMBIGUITY` | SOURCE AMBIGUITY | `review` | `review` | ✓ PASS |
| `DIELINE-GUIDE-TEXT-EXCLUSION` | TECHNICAL SCREENING WARNING | `match` | `match` | ✓ PASS |
