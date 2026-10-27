# Independent PackSignal review worksheet

**Status: protocol prepared; independent review not yet completed.** This worksheet only becomes independent evidence after a reviewer who did not build PackSignal completes it using unfamiliar artwork and reference files. Do not submit the blank worksheet as a test result.

## Handoff message

> Could you spend about 30 minutes doing a blind exploratory review of PackSignal using three packaging samples that are not included in the project and that you have not reviewed in the app? Please choose one with a concrete source/artwork mismatch, one that appears consistent on selected checks, and one with conflicting or incomplete source material. Before opening PackSignal, write down the supported checks and exact artwork/source locations you find. Then create a separate review for each package and compare PackSignal's results with your notes. Record what it caught, missed, or correctly left uncertain, and whether each finding's evidence was traceable. This is a small qualitative review, not a legal-compliance assessment or an accuracy study. Public sample files are preferred; do not share confidential customer artwork.

The reviewer can use the [PackSignal deployment](https://packsignal.onrender.com/) or a local copy. Ask them to record which they used and whether an AI-assisted result was live or saved.

## Reviewer setup

- Reviewer name or role:
- Relevant packaging, prepress, labeling, or quality-review experience:
- Date and PackSignal version/commit:
- Review mode: local / live AI-assisted / saved AI result
- AI model shown by the app, if applicable:

Choose at least three packaging sets the reviewer has not seen in PackSignal: one expected to contain a concrete mismatch, one expected to be consistent on the selected checks, and one with a source conflict or incomplete evidence. Use the artwork and its actual specification or supplied rule. Do not show the reviewer PackSignal's findings or any expected-result notes before their independent inspection. Do not use Dancing Fish or Fieldday as the only evidence; both are project demonstration samples.

## Blind sequence

1. The coordinator selects the three package sets and labels them A, B, and C. Keep any known answer notes separate from the reviewer. Do not use the project's 21 hand-authored evaluation cases or the included Dancing Fish / Fieldday demonstration materials as the unfamiliar set.
2. The reviewer inspects each artwork and its supplied product/source files first, without PackSignal. They record only checks that those files support, with page, line, sheet, or cell locations. Mark unsupported, incomplete, or conflicting facts as uncertain instead of guessing.
3. The reviewer creates three new PackSignal reviews, using the same files and correct source roles. Record whether the run was local or hosted, the app commit if known, and the AI model/configuration shown. Do not let the builder explain a finding until the comparison notes are complete.
4. The reviewer compares the results with their pre-app notes, then records every miss, false alarm, traceable finding, and appropriate human-review / unable-to-verify result. Preserve the original files and exported reports with the completed worksheet.
5. Only after the reviewer signs the worksheet may the coordinator reconcile any disputed outcome against the original files. Record disagreements; do not silently rewrite the reviewer's notes.

### Classification guide

- **Caught:** PackSignal raised the independently documented discrepancy and linked the relevant artwork and source evidence.
- **Missed:** the reviewer documented a supported discrepancy before opening PackSignal, but the corresponding check did not surface it.
- **False alarm:** PackSignal presented a definite issue, but the supplied files did not support that conclusion or the linked evidence contradicted it.
- **Correctly uncertain:** PackSignal used human review or unable-to-verify where the source, artwork coverage, authority, or interpretation was insufficient for a definite result.
- **Evidence problem:** a result's status may be reasonable, but the cited artwork or source evidence was missing, inaccurate, or difficult to follow.

Do not count a result as caught merely because the app mentions the same topic. It must agree with the supplied evidence and point to a reviewer-checkable location. Do not count an unresolved legal, visual-quality, or source-authority question as a false alarm when the app correctly kept it for a person.

## Blind inspection, before opening PackSignal

For each package, have the reviewer write down the checks they can support from the supplied files. Record the exact artwork text/page and the exact source value/page, sheet, or cell. Let them mark an item as **issue**, **matches supplied source**, **human review**, or **unable to verify**. Their judgment is the comparison record, not a legal-compliance determination.

| Package ID | Check / requirement | Reviewer result | Artwork evidence and location | Source evidence and location | Uncertainty or missing material |
|---|---|---|---|---|---|
| A |  |  |  |  |  |
| A |  |  |  |  |  |
| B |  |  |  |  |  |
| B |  |  |  |  |  |
| C |  |  |  |  |  |
| C |  |  |  |  |  |

## PackSignal run and comparison

After the blind notes are complete, create a new review for each package and keep the source roles accurate. Inspect PackSignal's result and evidence before comparing it with the reviewer notes. Record a mismatch as a false alarm, missed issue, appropriate human-review question, or appropriate unable-to-verify outcome. Add rows as needed.

| Package ID | Check | Reviewer result | PackSignal result | Was evidence traceable and accurate? | Difference / follow-up |
|---|---|---|---|---|---|
| A |  |  |  |  |  |
| B |  |  |  |  |  |
| C |  |  |  |  |  |

## Reviewer feedback

- Did any result look definite when the sources were actually ambiguous?
- Did any “matches reference” result rely on incomplete artwork or source coverage?
- Could you verify each selected finding without help from the builder?
- Which result would change your next action as a reviewer or designer?
- What was confusing, slow, or missing?
- Would you use this to focus a human review while retaining human release approval? Why or why not?

## Report the result honestly

Attach the reviewer's completed notes and identify the packages, app version, mode, and any known limitations. Report counts and examples descriptively; a few packages are too small and selected to support a general accuracy percentage. Do not call the review independent if the reviewer saw expected outcomes first, helped author the cases, or only inspected PackSignal-created examples whose answers were already known to the team.

### Descriptive result summary

- Packages reviewed: ___ (target: 3)
- Checks documented before PackSignal: ___
- Supported discrepancies caught with traceable evidence: ___
- Supported discrepancies missed: ___
- Definite issues that were unsupported / false alarms: ___
- Correctly left uncertain for human review or unable to verify: ___
- Evidence-link problems: ___
- Reviewer recommendation and one example that most affected it:

Present these as observations from this small sample, not as an accuracy rate, compliance result, or proof that PackSignal is superior to another product.

---

## Technical Protocol & Automated Scoring Infrastructure

### 1. Evaluator and Scorer Commands
- **Run engine on unseen package sets:**
  ```bash
  node scripts/run-independent-evaluation.mjs
  ```
- **Deterministic scorer (independent evaluation):**
  ```bash
  npm run evaluate:blind
  # or directly:
  node scripts/score-blind-evaluation.mjs
  ```
- **Deterministic synthetic regression benchmark (preserved):**
  ```bash
  npm run evaluate
  ```

### 2. Version Freezing Procedure & Integrity Hashes
Before predictions are revealed to any reviewer:
1. Record software Git commit: `cd3db9dc2b19422667e8be7f2c87c70d145d6191`.
2. Compute SHA-256 digests of all 3 unseen package artworks and source documents, stored in `evaluation/independent/cases/manifest.json`.
3. Freeze protocol parameters, eligible checks, evaluation units, and scoring formulas in `evaluation/independent/protocol.json`.
4. Freeze reviewer pre-inspection annotations in `evaluation/independent/ground-truth.json`.
5. Run the engine and freeze outputs in `evaluation/independent/predictions.json`.
6. Verify file integrity using SHA-256 before scoring. Any post-hoc changes require a versioned amendment.

### 3. Reviewer Independence Form (8 Core Questions)
The independent human reviewer must certify:
1. Did you author, contribute to, or review PackSignal's code or prompts? (Must be NO)
2. Did you create or tune the developer test fixtures, benchmark cases, or demo files? (Must be NO)
3. Did you see PackSignal's findings or predictions before inspecting the packaging files? (Must be NO)
4. Did anyone from PackSignal coach, prompt, or advise your evaluation unit labels? (Must be NO)
5. Were the 3 test package sets independently selected and previously unseen in PackSignal? (Must be YES)
6. Were your inspection labels frozen before PackSignal was run on these files? (Must be YES)
7. Do you have any financial, commercial, or employment interest in PackSignal? (Must be NO)
8. Do you consent to having your anonymized or named evaluation worksheet published? (Must be YES)

### 4. Ground-Truth & Prediction Schemas
- **Ground Truth (`evaluation/independent/ground-truth.json`):**
  - `evaluationUnitId`: e.g. `U-01-01`
  - `caseId`: e.g. `CASE-01`
  - `checkId`: e.g. `US-001` (Net Quantity)
  - `reviewerLabel`: `ISSUE` | `MATCH` | `AMBIGUOUS` | `UNVERIFIABLE` | `NOT_APPLICABLE`
  - `artworkEvidence`: text, bounding box coordinates, page number
  - `sourceEvidence`: document filename, sheet/section, cell/line, approved quotation
  - `notes`: reviewer comments and rationale
- **Predictions (`evaluation/independent/predictions.json`):**
  - `unitId`: matching `evaluationUnitId`
  - `predictedStatus`: `issue` | `match` | `review` | `unable`
  - `linkedFindingIds`: array of engine finding IDs
  - `observedValue`: text extracted from artwork
  - `expectedValue`: text extracted from source
  - `evidenceQuality`: source quality, artwork quality, rule reference validity

### 5. Scoring Rubric & Anti-Inflation Rules
- **Unit of Evaluation:** `(Package ID, Check ID, Specific Declaration Instance)`.
- **True Positive (TP):** Ground truth is `ISSUE`, PackSignal declares a definite `issue`, identifies the correct underlying discrepancy, and provides verifiable source/artwork evidence.
- **False Positive (FP):** Ground truth is `MATCH`, but PackSignal declares a definite `issue`.
- **False Negative (FN):** Ground truth is `ISSUE`, but PackSignal reports `match`, `review`, or `unable`.
- **True Negative (TN):** Ground truth is `MATCH` and PackSignal declares `match`.
- **Duplicate Findings:** Multiple finding cards citing the same physical defect cannot satisfy an evaluation unit more than once; duplicates are tracked separately and suppressed from TP counts.

### 6. Ambiguity Handling & Safety Metrics
Ambiguous or conflicting sources (`CASE-03`) are evaluated separately from binary precision/recall:
- **Correct Abstention:** Ground truth is `AMBIGUOUS` or `UNVERIFIABLE`, and PackSignal returns `review` or `unable`.
- **Unsafe Definitive Issue:** PackSignal reports a definite `issue` despite insufficient source authority.
- **Unsupported Match:** PackSignal reports a definite `match` on ambiguous or unverified inputs.

### 7. Results Publication Rules & Honest Denominators
- Precision = `TP / (TP + FP)`.
- Recall = `TP / (TP + FN)`.
- F1 = `2 * P * R / (P + R)`.
- When denominators are 0, metrics MUST display `N/A`, never 100%.
- Both numerator and denominator must be displayed next to every metric (e.g. `1 / 3 = 33.3%`).
- Describe results strictly as pilot-sample observations. Never advertise "98% accuracy", "FDA approved", or "outperforms competitor" from a 3-case pilot.

