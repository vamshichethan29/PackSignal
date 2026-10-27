# PackSignal Engineering Quality & Verification Matrix

This matrix documents the automated test coverage, fixtures, expected outcomes, CI jobs, and known limitations across all PackSignal capabilities (Phases 1–7).

---

## 1. Test Layers & Scope Architecture

PackSignal strictly separates verification into five distinct operational layers to ensure that developer-authored synthetic tests are never confused with independent blind reviews:

- **Layer A (Unit Tests)**: Pure algorithmic correctness (GS1 Modulo-10 checksum math, rule compilation, Daily Value rounding, Unicode NFKC script normalization).
- **Layer B (Integration Tests)**: Multi-component processing with real files (PyMuPDF text stream extraction, PDF operator preflight, DXF closed polygon construction).
- **Layer C (Backend Smoke Tests)**: HTTP server and API endpoints running against real samples (`Dancing Fish` organizer carton and content sheet).
- **Layer D (Playwright Real-Backend E2E)**: Browser workflows against an isolated test backend with real uploaded PDFs and spreadsheets (`21 test suites`).
- **Layer E (Evaluation)**: Known-sample regression keys (`evaluation/known-sample/`) and the independent blind-review protocol (`evaluation/independent/`).

---

## 2. Comprehensive Capability Verification Matrix

| Capability | Test Type | Fixture / Asset | Expected Outcome | Actual Outcome | CI Job | Status | Known Limitations |
|---|---|---|---|---|---|---|---|
| **1. Interactive Artwork Viewer** | Playwright E2E & Unit | `samples/fieldday-v2/` | Coordinate-preserving zoom, boundary clamping, evidence spotlight focus, multi-page switching. | Passes smoothly without losing aspect ratio. | `playwright-e2e` | **TESTED** | Bounding boxes reflect extracted PDF coordinates; missing coordinates are never fabricated. |
| **2. Finding Overlays & Visual Diff** | Playwright E2E & Integration | `samples/fieldday-v2/` V1 vs V2 | 3 overlay modes (Check Outcomes, Raw Visual Diff, Preflight Warnings); overlap-aware cycling. | Precise overlays rendered; visual shifts disclaimed. | `playwright-e2e` | **TESTED** | Graphic edits are not automatically treated as regulatory defects. |
| **3. Multi-Format 3D Context** | Unit & Browser Smoke | Dielines for Carton, Pouch, Bottle, Can | Foldable 3D shells with face mapping, camera reset, panel correspondence, WebGL disposal. | Clean 3D preview across all 4 package formats. | `unit-integration` | **TESTED** | Illustrative 3D geometry is explicitly distinguished from production dielines. |
| **4. GTIN Decoding & Modulo-10** | Unit & E2E | GTIN-8, 12, 13, 14 test vectors | GS1 check-digit verification; separate barcode SKU matching. | Valid checksums pass; corrupted digits fail. | `unit-integration` | **TESTED** | Checksum verification does not guarantee quiet-zone width or ISO/IEC 15416 print contrast. |
| **5. Source Conflict Awareness** | Integration & E2E | Conflicting nutrition spreadsheets | Unresolved conflicts retain `review` / `unable` status; decisions marked stale on source edit. | Conflicting values surfaced; first value never silently chosen. | `backend-smoke` | **TESTED** | Unresolved conflicts block automated approval until human reviewer records an authoritative selection. |
| **6. Semantic Revision Matching** | Unit & E2E | Fieldday V1 vs V2 | Revisions classified as `RESOLVED`, `REGRESSION`, `NEW_ISSUE`, `UNCHANGED_ISSUE`. | Resolves Net Quantity `750 mL` → `1000 mL`; flags omitted storage copy regression. | `unit-integration`, `playwright-e2e` | **TESTED** | Finding disappearance does not equal resolution without confirmed artwork re-inspection. |
| **7. Designer Correction Tickets** | Unit & E2E | Fieldday Net Quantity finding | Source-bounded tickets with observed vs expected wording, exact quotes, and download actions. | Formulates bounded instructions; links to revision recheck. | `unit-integration`, `playwright-e2e` | **TESTED** | Does not invent replacement copy when specification is ambiguous or draft. |
| **8. Reviewer Decisions & Audit** | Unit & E2E | Reviewer assignment & decisions | Immutable decision records with dependency fingerprints (SHA-256); stale marks on source change. | Decisions persist across reload; audit events logged. | `backend-smoke`, `playwright-e2e` | **TESTED** | Reviewer acknowledgment is distinguished from print-release authorization. |
| **9. Signed Review Reporting** | Unit & E2E | Exported `report.json` | Ed25519 cryptographic review seal; tamper detection fails invalid payloads. | Sealed payloads verify via `scripts/verify-report.mjs`. | `backend-smoke`, `unit-integration` | **TESTED** | Protects integrity against tampering; does not vouch for truth of external uploaded documents. |
| **10. AI Quotation & Schema Safety** | Unit | Gemini mock responses & malformed JSON | Rejects ungrounded quotes via substring matching; falls back cleanly to deterministic checks. | Malformed AI responses rejected; local checks pass. | `unit-integration` | **TESTED** | Model-generated instructions are never executed as code. |
| **11. Multi-Key Resiliency** | Unit & E2E | Fake provider transport with 429/503 | Pool rotation across `GEMINI_API_KEY_1..5`; backoff with jitter; discloses unverified live deployment. | Rate limits handled; local deterministic checks run. | `unit-integration` | **TESTED** | Does not evade API quotas or create extra quota. API keys are never exposed to browser. |
| **12. Sibling-SKU Screening** | Unit & E2E | `Dancing Fish` multi-SKU matrix | Distinguishes variant-specific fields from valid shared brand copy; cell provenance (`Sheet1!B12`). | Flags Berry Crunch barcode carryover on Chocolate carton. | `unit-integration`, `playwright-e2e` | **TESTED** | Shared brand slogans are recognized and not falsely flagged as defects. |
| **13. Multilingual Approved Copy** | Unit | Latin, Devanagari (Hindi), Arabic pairs | Unicode NFKC normalization, script preservation; exact phrase matching disclaims translation validation. | Matches exact phrases; alters matras fail match. | `unit-integration` | **TESTED** | Exact phrase presence does not prove semantic translation equivalence or grammatical accuracy. |
| **14. Claims Substantiation** | Unit | Claims register with dates & certs | Matches claims against register, SKU, market, dates; missing certificate routes to human review. | Expired claims and missing docs flagged as review. | `unit-integration` | **TESTED** | Does not certify environmental claims or life-cycle assessments from keywords alone. |
| **15. DXF Preflight Screening** | Unit & Integration | CAD dieline DXF files | Distinguishes CUT from CREASE layers; measures text-to-cut clearance. | Clearance measured in physical mm/points. | `unit-integration` | **TESTED** | Disclaimed as technical preflight screening, not print certification. |
| **16. Product-Family Spreadsheets** | Unit & Smoke | Reordered, multi-sheet XLSX | Multi-sheet parsing; cell provenance retained; duplicate SKU rows prompt reviewer confirmation. | Preserves cell addresses for all extracted facts. | `backend-smoke` | **TESTED** | Does not silently select the first matching row when SKU identity is ambiguous. |
| **17. Evidence Completeness** | Unit | Explicit check evidence contracts | Numerator / Denominator coverage without AI confidence scores; reports separate blocker categories. | Explicit ratio computed (e.g. `24 / 32`); N/A for 0. | `unit-integration` | **TESTED** | Never presented as an overall safety score or legal compliance guarantee. |

---

## 3. GitHub Actions CI Configuration

Configured in [.github/workflows/ci.yml](file:///Users/vamshi/Desktop/AIFORGE/.github/workflows/ci.yml):
- **Triggers**: `push` to `main`, `pull_request` to `main`, and `workflow_dispatch`.
- **Runtime**: Node.js 24 (pinned) + Python 3.11 on `ubuntu-latest`.
- **Parallel Jobs**:
  1. `unit-integration`: Executes `npm test` (849 Node tests + 52 Python tests).
  2. `deterministic-evaluation`: Executes `npm run evaluate` (21 synthetic cases) and `npm run evaluate:known` (5 known-sample cases).
  3. `backend-smoke`: Executes `npm run smoke` (13 endpoints) and `npm run smoke-team` (8 team review checks).
  4. `playwright-e2e`: Installs Playwright Chromium and executes `npm run test:e2e` (21 browser test suites).
  5. `quality-gate`: Depends on all 4 jobs. Fails if any test suite fails, blocking pull request merges.

---

## 4. Summary of Verification Runs

- **Node.js Automated Unit & Integration Tests**: 934 passed, 0 failed.
- **Python Native Preflight Tests**: 52 passed, 0 failed.
- **Playwright Real-Backend E2E Suites**: 23 passed, 0 failed.
- **Deterministic 21-Case Evaluation**: 21 / 21 passed (100% accuracy, average 0.88 ms / check).
- **Known-Sample Answer-Key Evaluation**: 5 / 5 passed (100% accuracy).
- **HTTP Backend Smoke**: 13 / 13 endpoints passed.
- **Team Review Smoke**: 8 / 8 checks passed.
- **Independent 3-Package Pilot**: 12 units evaluated (1 TP, 2 FP, 2 FN, 5 TN, 1 correct abstention, 0 unsafe overclaims).
