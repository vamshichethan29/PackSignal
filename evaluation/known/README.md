# PackSignal Known-Sample Evaluation Harness
## Track 2 Verification Answer Key & Rulebook Ground Truth

**Location:** `evaluation/known/`  
**Purpose:** Phase 3 Real-File Answer-Key Evaluation Harness  
**Target Case:** Dancing Fish Granola Berry Crunch (Official Esko Competition Case)

---

## 1. Discrepancy Classifications

Unlike simple binary pass/fail grading, PackSignal's answer key distinguishes the technical nature of each observation:

1. **`OBSERVED DISCREPANCY`:** An empirical difference between the supplied specification workbook and the printed artwork text (e.g. Honey 1% vs 9%, Sodium 15mg vs 0mg).
2. **`APPROVED-SOURCE MISMATCH`:** A mismatch against a confirmed, authoritative specification where the artwork deviates without brand sign-off.
3. **`RULE FAILURE`:** A definitive violation of an applicable statutory requirement (e.g. 21 CFR §101.4 descending order of predominance).
4. **`TECHNICAL SCREENING WARNING`:** A prepress or dieline observation (e.g. non-printing guide text, font size near threshold, cut-line proximity).
5. **`SOURCE AMBIGUITY`:** An unresolved conflict or draft designation in the source materials requiring reviewer confirmation.
6. **`UNSUPPORTED CHECK`:** A proposed requirement whose check algorithm is not yet compiled into the deterministic engine.

---

## 2. Integrity and Non-Contamination

- **No Production Engine Import:** The files `answer-key.json` and `rulebook-key.json` are test fixtures and are NEVER imported into `lib/engine.mjs` or `server.mjs`.
- **Cryptographic File Binding:** Every test case is keyed to exact SHA-256 digests of the organizer files. If a file is modified, the evaluator flags the hash change immediately.
- **Draft Authority Disclosure:** Because `DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx` includes "Draft / In-Review" copy, observed discrepancies are truthfully disclosed as draft comparisons rather than definitive legal violations until an authorized reviewer signs off.

---

## 3. Running Answer Key Scoring

```bash
npm run evaluate:known
```
