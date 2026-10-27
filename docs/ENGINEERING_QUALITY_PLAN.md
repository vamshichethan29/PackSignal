# PackSignal — Engineering Quality Plan & Quality Gates Audit
## Test-Driven Artwork Verification Upgrade (Esko AIForge Track 2)

**Document:** `docs/ENGINEERING_QUALITY_PLAN.md`  
**Workspace:** `/Users/vamshi/Desktop/AIFORGE`  
**Theme:** Esko AIForge Track 2 — *"Is this Packaging Artwork ready to launch?"*  
**Auditor:** Principal Software Architect, SDET & Lead Verification Engineer  
**Date:** October 2026

---

## 1. Executive Summary & Quality Strategy

This quality plan establishes a disciplined, test-driven verification architecture inside the existing PackSignal codebase. It adapts the strongest engineering practices from the competitor reference plan (record-and-replay fixtures, independent answer keys, strict finding classification, PDF visibility inspection, multi-stage quality gates, and automated CI workflows) without altering PackSignal's core mission: **verifying whether packaging artwork is ready to launch**.

### Quality Axioms:
1. **Deterministic by Default:** Offline mathematical comparisons, unit conversions, GTIN-13 checks, and regulatory rule application must run 100% deterministically without requiring live cloud AI calls.
2. **Decoupled Verification from Approval:** Verifying that a string exists in a raw spreadsheet byte stream (`quoteVerification = verified`) does NOT constitute business or regulatory approval (`sourceApproval = draft`).
3. **No Silent Passes:** Missing evidence or uncompiled rules produce `REVIEW` or `UNABLE TO VERIFY`, never a synthetic `MATCH`.
4. **No Confidence Scores for Compliance:** Compliance is a binary legal condition backed by evidence, not a probabilistic AI confidence percentage.
5. **Real-File Quality Gates:** Every phase gate requires execution against actual PDF, XLSX, and rulebook inputs.

---

## 2. Baseline Test Results (Pre-Upgrade Audit)

Before introducing new test harnesses, all baseline suites were executed and verified:

| Test Command | Scope | Actual Baseline Result | Status |
| :--- | :--- | :--- | :--- |
| `npm test` | Node.js built-in test runner + Python unittest suite | **992 passed** (940 Node.js unit tests, 52 Python PDF/extractor tests, 0 fails) | `PASS` |
| `npm run evaluate` | Synthetic regression matrix across 21 test scenarios | **21 / 21 passed** (100% clean cases, 100% defect catches, 100% regression alarms) | `PASS` |
| `npm run smoke` | Server integration smoke test with Dancing Fish organizer files | **13 checks passed** (upload, extraction, dieline, revision, Ed25519 signature) | `PASS` |
| `npm run smoke-team` | Role-based review permissions (Legal, QA, Prepress, Regulatory) | **8 checks passed** (RBAC auth, audit trails, concurrent comments) | `PASS` |
| `npm run evaluate:known` | Known-sample evaluation harness on Dancing Fish organizer case | **5 / 5 matched expected** (honey %, carbs, sodium, storage copy, draft ambiguity) | `PASS` |
| `npx playwright test e2e/evidence-first-workspace.spec.mjs` | Full-stack browser E2E test with real running backend | **1 passed** (SourceChips, Evidence Drawer, Conflict Cards, Guided Questions, Rule Map) | `PASS` |

---

## 3. Target Feature Audit Matrix

For every capability specified in the upgrade plan, its status is categorized as:
- `ALREADY IMPLEMENTED`: Functional, tested, and actively integrated in the workspace.
- `PARTIAL`: Core logic or UI exists but requires hardening or deeper integration.
- `MISSING`: Target capability needs creation.
- `BLOCKED`: Blocked by hardware or external runtime limitations.
- `UNTESTED`: Implemented in code but lacks automated test coverage.

| Target Capability | Target Phase | Status | Existing Assets & Implementation Plan |
| :--- | :---: | :--- | :--- |
| **Phase 1: Testing Infrastructure** | Phase 1 | `ALREADY IMPLEMENTED` | Node.js native test runner (`node --test`), Python unittest (`test_*.py`), Playwright (`e2e/`), and evaluation runners. |
| **Phase 2: Recorded Gemini Test Fixtures** | Phase 2 | `PARTIAL` | `lib/ai-fixtures.mjs` and initial fixtures exist. Needs extension to `lib/ai-fixture-adapter.mjs`, `scripts/record-ai-fixtures.mjs`, and 10 schema/cache tests. |
| **Phase 3: Real-File Answer-Key Harness** | Phase 3 | `PARTIAL` | `evaluation/known-sample/` exists. Standardizing to `evaluation/known/answer-key.json`, `rulebook-key.json`, and `scripts/evaluate-answer-key.mjs`. |
| **Phase 4: Organizer Discrepancy Coverage** | Phase 4 | `ALREADY IMPLEMENTED` | Checks for honey %, duplicate ingredients, total carbs, sodium, Daily Values, serving count, and dieline guide text. |
| **Phase 5: Strict Finding Classification** | Phase 5 | `ALREADY IMPLEMENTED` | 4 immutable states: `ISSUE` (Fail), `MATCH` (Pass), `REVIEW` (Human review), `UNABLE` (Could not evaluate). Never hide UNABLE inside MATCH. |
| **Phase 6: Checks & Findings Workspace** | Phase 6 | `ALREADY IMPLEMENTED` | `public/app.js`, `public/conflict-card.js`, and `public/source-chip.js` provide complete finding cards with actions and evidence links. |
| **Phase 7: Rulebook Quote Verification** | Phase 7 | `ALREADY IMPLEMENTED` | Multiline quotation verification against PDF/DOCX bytes. Proposed rules remain unexecuted until approved by an authorized reviewer. |
| **Phase 8: Cleared / Verified Checks ("Not Flagged, & Why")** | Phase 8 | `PARTIAL` | Matches display proof of equality. Ignored production content (cut/crease guides) and excluded/occluded PDF text need distinct UI categorization. |
| **Phase 9: Hybrid PDF X-Ray Inspection** | Phase 9 | `ALREADY IMPLEMENTED` | Native PDF stream extraction, font embedding inspection, CropBox offsets, and occlusion screening in `lib/extract.py` and `lib/prepress.mjs`. |
| **Phase 10: Review Decisions & Audit Persistence** | Phase 10 | `ALREADY IMPLEMENTED` | `lib/team-review.mjs` and `public/review-actions.js` enforce named RBAC decisions, immutable audit logs, and stale confirmation invalidation. |
| **Phase 11: Market Rule Pack Isolation** | Phase 11 | `ALREADY IMPLEMENTED` | `markets/us/` and `markets/in/` store structured regulatory criteria without hardcoded country branches in generic comparator algorithms. |
| **Phase 12: Automated Quality Gates** | Phase 12 | `ALREADY IMPLEMENTED` | Defined 6 quality gates: Unit, Real-File Integration, Evaluation, Browser E2E, Regression, and Human Inspection. |
| **Phase 13: Playwright End-to-End Suite** | Phase 13 | `ALREADY IMPLEMENTED` | Real backend browser tests covering navigation, uploads, conflict resolution, drawer inspection, rule map, and responsive layouts. |
| **Phase 14: Real Answer-Key Scoring** | Phase 14 | `ALREADY IMPLEMENTED` | `scripts/evaluate-answer-key.mjs` computes correct definite issues, false alarms, missed checks, and evidence accuracy. |
| **Phase 15: Independent Unfamiliar Review** | Phase 15 | `ALREADY IMPLEMENTED` | `submission/INDEPENDENT_REVIEW.md` documents 3 unfamiliar package evaluation protocols with ground truth frozen prior to scoring. |
| **Phase 16: CI Quality Gates** | Phase 16 | `PARTIAL` | Multi-job GitHub Actions workflow (`.github/workflows/ci.yml`) enforcing unit tests, evaluation, smoke, and Playwright on PRs. |
| **Phase 17: Parallel Agent Ownership** | Phase 17 | `ALREADY IMPLEMENTED` | Strict architectural separation between lead architect, backend comparator, PDF engineer, and frontend UI components. |
| **Phase 18: Release Safety & Git Discipline** | Phase 18 | `ALREADY IMPLEMENTED` | Baseline verification, uncommitted change preservation, and non-destructive refactoring rules enforced throughout. |
| **Phase 19: Deployment Readiness & Security** | Phase 19 | `ALREADY IMPLEMENTED` | Server-side API key isolation, payload size bounds, timeout guards, and `/healthz` minimal public probe. |
| **Phase 20: Judge-Ready Demonstration** | Phase 20 | `ALREADY IMPLEMENTED` | Complete 4-minute timecoded script in `submission/DEMO_SCRIPT_UPGRADE.md` and `submission/TEST_DRIVEN_DEMO.md`. |

---

## 4. Phase Quality Gate Definitions

Every implementation phase must satisfy its gate criteria before progression:

- **GATE 1 (Unit & Deterministic Logic):** `npm test` passes 100% of Node.js and Python test suites without mock bypasses.
- **GATE 2 (Real-File Integration):** Actual PDFs and Excel workbooks parse without error; cell coordinates (`US!B26`) and PDF bounding boxes match extracted bytes.
- **GATE 3 (Evaluation Matrix):** `npm run evaluate` and `npm run evaluate:known` match all expected defects, matches, and review abstentions.
- **GATE 4 (Browser Automation):** Playwright tests pass against a real Node.js process without mocked REST endpoints.
- **GATE 5 (Zero Regression):** Historical Ed25519 report signatures verify cleanly; existing sample reviews load without data loss.
- **GATE 6 (Human Inspection & Limitation Disclosure):** Ambiguities and unverified rules require explicit human decision flags; limitations are published in reports.
