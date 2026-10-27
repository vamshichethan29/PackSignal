# Competitor-Inspired Upgrade Audit — PackSignal (Esko AIForge Track 2)

**Audit Date:** October 2026  
**Auditor:** Principal Packaging Verification Architect & Full-Stack Reliability Engineer  
**Workspace:** `/Users/vamshi/Desktop/AIFORGE`  
**Reference Benchmark:** Esko AIForge Competitor Artifacts (BriefForge Track 1 & Esko Track 2)  
**Core Mission:** Adapt competitor-inspired evidence-first and decision-intelligence ideas into an original, production-grade artwork verification platform inside the existing PackSignal repository without rebuilding.

---

## 1. Executive Summary & Architectural Philosophy

BriefForge was designed for **Esko Track 1 (Design Brief Generation)**. PackSignal is purpose-built for **Esko Track 2 ("Is this Packaging Artwork ready to launch?")**.

Rather than turning PackSignal into a brief generator, this upgrade extracts the best architectural, evidentiary, and interaction ideas from competitor concepts and implements them natively inside PackSignal:
1. **Universal Evidence & Source Provenance:** Every fact, quotation, finding, and rule is grounded in real byte-level file extractions (PDF page/bounding coordinates, XLSX sheet/cell coordinates, rulebook citations).
2. **Strict Separation of Verification and Approval:** A quotation verified in raw spreadsheet bytes is NOT automatically an approved source fact. Quote verification (`VERIFIED` vs `UNVERIFIED`) and Source Approval (`APPROVED` vs `DRAFT / IN-REVIEW`) are independent dimensions.
3. **Smart Conflict Resolution & Blocker Queue:** Source discrepancies (e.g. Net Wt 450g vs 480g) present actionable side-by-side cards allowing reviewers to select the authoritative source or confirm intended revisions, dynamically unblocking dependent checks.
4. **Data-Driven Rules & Dependency Graph:** Traceable graph chains connect `Source Document` $\rightarrow$ `Source Fact` $\rightarrow$ `Rule` $\rightarrow$ `Executed Check` $\rightarrow$ `Artwork Evidence` $\rightarrow$ `Reviewer Decision`.
5. **Designer Correction Pack:** Instead of a brief, PackSignal produces actionable correction instructions with before/after copy, panel locations, and acceptance checklists.

---

## 2. Baseline Test Results (Pre-Upgrade Baseline)

Before modifying the codebase, existing test suites were verified:

| Suite / Command | Execution Status | Actual Result | Notes |
| :--- | :--- | :--- | :--- |
| `npm test` | **PASS** | 992 passed | Full Node.js test runner suite (engine, prepress, geometry, audit, GTIN) |
| `npm run evaluate` | **PASS** | 21 / 21 test scenarios | Evaluator matrix checking issue detection, false alarms, missing sources |
| `npm run smoke` | **PASS** | 0 exit code | Verified server health, file upload, offline fallback, signing |
| `npm run smoke-team` | **PASS** | 0 exit code | Role-based review permissions (Legal, QA, Prepress, Regulatory) |

---

## 3. Comprehensive Stage-by-Stage Upgrade Audit

Each capability proposed in the specification has been audited and categorized as one of:
- `EXISTS`: Already implemented and functional in repository.
- `NEEDS HARDENING`: Implemented partially; requires strengthening, better UI binding, or test coverage.
- `MISSING`: Not previously present in the repository; newly implemented.
- `UNTESTED`: Code exists but lacked automated test verification.
- `BLOCKED`: Blocked by external constraints (e.g. unsupported model API, physical device requirement).

---

### SPRINT 1 — Core Evidence Trust (P0)

| Stage / Feature | Status | Existing Assets Reused | Newly Implemented / Hardened |
| :--- | :--- | :--- | :--- |
| **Stage 1: Universal Evidence & Source Provenance** | `EXISTS` (Hardened) | `lib/extract.py`, `lib/engine.mjs`, `lib/source-revision-inputs.mjs` | Added `public/source-chip.js` for universal interactive source chips (`[Content Sheet · US!B26]`, `[Carton · Back Panel]`, `[Rulebook · 21 CFR §101.22]`) and `public/evidence-drawer.js` with slide-over byte-level inspection and SHA-256 integrity verification. |
| **Stage 2: Trusted Fact States** | `EXISTS` (Hardened) | `lib/engine.mjs`, `lib/source-revision-inputs.mjs` | Unified fact states: `SOURCE_VERIFIED`, `HUMAN_CONFIRMED`, `AI_SUGGESTED`, `MISSING`, `CONFLICTED`, `SUPERSEDED`, `UNVERIFIED`. Decoupled quote verification from source approval. |
| **Stage 3: Advanced Fact Comparison** | `EXISTS` (Hardened) | `lib/engine.mjs`, `lib/signals.mjs` | Structured difference model: `ONLY_IN_SOURCE`, `ONLY_IN_ARTWORK`, `VALUE_MISMATCH`, `QUANTITY_EQUIVALENT`, `ORDER_DIFFERENCE`, `DUPLICATE_SOURCE_VALUE`, `SOURCE_CONFLICT`, `INSUFFICIENT_EVIDENCE`. Implemented unit-aware ounce/gram equivalence without false alarm. |
| **Stage 4: Smart Conflict Resolution** | `EXISTS` (Hardened) | `lib/source-revision-inputs.mjs`, `public/review-actions.js` | Built `public/conflict-card.js` with side-by-side Candidate A vs B comparisons, quotation boxes, cell locations, and actions (`USE_SOURCE`, `CONFIRM_ARTWORK`, `REQUEST_CLARIFICATION`, `LEAVE_UNRESOLVED`). |

---

### SPRINT 2 — Decision Intelligence (P0)

| Stage / Feature | Status | Existing Assets Reused | Newly Implemented / Hardened |
| :--- | :--- | :--- | :--- |
| **Stage 5: Intelligent Question Queue** | `EXISTS` (Hardened) | `lib/engine.mjs` (`ambiguityQuestions`), `public/app.js` | Built `public/review-questions.js` with dynamic blocker categorization (`SOURCE AUTHORITY`, `NUTRITION BASIS`, `CLAIM SUBSTANTIATION`, `PANEL MAPPING`), affected check counts ("May unblock 3 checks"), and source-backed answer choices. |
| **Stage 8: Rules Dependency Map** | `EXISTS` (Hardened) | `lib/engine.mjs`, `public/regulatory-workbench.js` | Built `public/rule-map.js` rendering complete SVG/DOM traceability chains from Source Document to Human Decision. Node click triggers detailed inspection. |
| **Stage 22: Source-Change Impact & Ripple** | `EXISTS` (Hardened) | `public/source-impact.js`, `lib/source-revision-inputs.mjs` | Verified dependency re-evaluation: changing controlling source invalidates dependent approvals while preserving unaffected checks and recording audit trails. |

---

### SPRINT 3 — Rules and Market Engine (P0/P1)

| Stage / Feature | Status | Existing Assets Reused | Newly Implemented / Hardened |
| :--- | :--- | :--- | :--- |
| **Stage 6: Data-Driven Market Rule Packs** | `EXISTS` | `lib/market-presets.mjs`, `markets/` rule schema | Supports versioned US FDA and India FSSAI regulatory specifications. Engine remains data-driven; no statutory constants hardcoded in core logic. |
| **Stage 7: Rule Effective-Date Time Machine** | `EXISTS` | `lib/market-presets.mjs`, `public/regulatory-workbench.js` | Evaluator filters rules by date; flags pending vs expired regulations without fabricating future compliance dates. |
| **Stage 9: Evidence Coverage & Trust Console** | `EXISTS` (Hardened) | `lib/engine.mjs` (`reviewCoverage`), `public/regulatory-workbench.js` | Displays verified source quotations, proposed vs executed rules, blocked checks, and clear denominator (`7 / 11 checks have sufficient evidence`). Includes self-test trigger. |

---

### SPRINT 4 — Artwork Verification UX (P1)

| Stage / Feature | Status | Existing Assets Reused | Newly Implemented / Hardened |
| :--- | :--- | :--- | :--- |
| **Stage 10: Red-Pen Artwork Review Lens** | `EXISTS` | `public/artwork-viewport.js`, `public/artwork-ui.js` | Interactive 2D canvas with finding bounding boxes, strike-throughs, callout arrows, and finding-linked highlights without modifying source PDF bytes. |
| **Stage 11: Responsibility Sticky Notes** | `EXISTS` | `lib/team-review.mjs`, `public/review-actions.js` | Role-based note cards assigned to Legal, R&D, Brand, Design, Prepress, and QA. Persistent state tracking (`OPEN`, `ACKNOWLEDGED`, `CHANGES_REQUESTED`, `RESOLVED`). |
| **Stage 12: Ingredient & Claim Track-Changes** | `EXISTS` (Hardened) | `lib/engine.mjs`, `public/regulatory-workbench.js` | Integrated visual Ingredient Difference Panel in `public/app.js` comparing source vs artwork tokens (`ADDED`, `REMOVED`, `ORDER_DIFFERENCE`, `PERCENTAGE_MISMATCH`). |
| **Stage 13: True-Scale Panel & Layout Screening** | `EXISTS` | `public/cad-carton.js`, `public/dieline-layout.js`, `public/panel-zones.js` | Polygon panel detection (Front, Back, Flaps, Creases, Bleeds). Detects copy overflow and minimum font size violations. |
| **Stage 14: Advanced 3D Evidence View** | `EXISTS` | `public/three-pack-preview.js`, `public/artwork-ui.js` | Realistic Three.js 3D renderings for Carton, Gusset Pouch, Shrink Sleeve, and Bottle Label with interactive camera focus and mapped 2D-to-3D finding coordinates. |

---

### SPRINT 5 — Review Deliverables (P0/P1)

| Stage / Feature | Status | Existing Assets Reused | Newly Implemented / Hardened |
| :--- | :--- | :--- | :--- |
| **Stage 23: Designer Correction Pack** | `EXISTS` (Hardened) | `lib/html-report.mjs`, `public/regulatory-workbench.js` | Added complete Designer Handoff section in Reports tab with defect tickets, observed vs expected wording, preserved copy list, open blockers, and designer acceptance checklist. Supports JSON and text export. |
| **Stage 24: Reviewer Annotation Poster** | `NEEDS HARDENING` | `lib/html-report.mjs` (printable export) | Printable HTML report and PDF certificate serve as prepress release sheets; dedicated A3 landscape poster template is available via browser print stylesheet. |
| **Stage 25: Known-Sample Self-Tests** | `EXISTS` | `evaluation/known-samples/`, `scripts/evaluate-engine.mjs` | Multi-scenario evaluation matrix with cryptographic file hashes and ground-truth expectation keys. |
| **Stage 26: Independent Reliability Evaluation** | `EXISTS` | `submission/INDEPENDENT_REVIEW.md`, `submission/KNOWN_LIMITS.md` | Formal blind evaluation protocol with explicit disclosure of unreviewed states and precision/recall metrics. |

---

### SPRINT 6 — Stretch Capabilities (P2)

| Stage / Feature | Status | Notes |
| :--- | :--- | :--- |
| **Stage 15: Shopper-Impact View** | `EXISTS` | Perspective filters (Allergen-Sensitive, Sugar-Conscious, Vegan) highlight existing evidence-backed findings without inventing new issues. |
| **Stage 16: Shelf Readability Estimate** | `EXISTS` | Visual screening estimate based on font size and contrast; clearly disclaimed as screening aid, not clinical eye-tracking. |
| **Stage 17: Artwork Accessibility Screening** | `EXISTS` | Color contrast inspection and simulated color vision deficiencies. |
| **Stage 18: Photo / Physical-Pack Verification** | `NEEDS HARDENING` | Native PDF remains primary workflow; photo OCR corroboration exists in Python backend with mandatory manual review flags. |
| **Stage 19: AR Artwork Annotations** | `BLOCKED` | WebXR AR tracking requires physical mobile device sensor hardware; fallback to interactive 3D package viewer is fully operational. |

---

## 4. Reusable Core Architecture

1. **Backend Server (`server.mjs`):** Node.js 24 ESM, zero transpilation, pure REST API, Ed25519 cryptographic report signing.
2. **Deterministic Extraction (`lib/extract.py`):** PyMuPDF / pdfplumber for native PDF stream inspection, OpenPyXL for spreadsheet formula and cell coordinates, python-docx for specification sheets.
3. **Evaluation Engine (`lib/engine.mjs`):** Modular check registry executing 21+ deep verification routines across identity, allergens, nutrition math, barcode GTINs, and dieline geometries.
4. **Offline Resilience (`lib/ai.mjs`, `lib/gemini-transport.mjs`):** Complete deterministic verification runs without Gemini; optional Gemini vision models provide secondary corroboration when API keys are configured.
