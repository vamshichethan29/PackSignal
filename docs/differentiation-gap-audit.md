# PackSignal Differentiation Gap Audit: Five Core Differentiators vs. Competitor Baseline

This audit establishes the implementation status, engineering depth, test verification, and known boundaries across the 5 core differentiators designed to exceed BriefForge and conventional packaging QA baselines.

---

## 1. Differentiator Inventory & Gap Classification

| # | Differentiator | Target Scope | Current Status | Supporting Modules | Automated Tests & Verification |
|---|---|---|---|---|---|
| **D1** | **Evidence-Aware Change Impact** | Canonical dependency graph (Source → Fact → Rule → Check → Evidence → Finding → Decision). Evaluator-declared inputs. True selective recomputation with invocation counters. Fine-grained reviewer decision revalidation (REVALIDATION_REQUIRED) on affected dependencies without invalidating unrelated decisions. | **EXISTING / TESTED** | `lib/review-intelligence/dependency-graph.mjs`<br>`lib/review-intelligence/impact-analyzer.mjs`<br>`lib/review-intelligence/incremental-runner.mjs` | `tests/finding-basis.test.mjs`<br>`tests/remediation/revision.test.mjs`<br>`e2e/reviewer-decision.spec.mjs`<br>`scripts/smoke.mjs` |
| **D2** | **Transparent Rule-Execution Coverage** | Rule execution ledger tracking source verification, authorization, applicability, implementation support, execution state, and result. Accounting for every known rule (executable, uncompiled prose, proposed AI, rejected, not-applicable, blocked, executed). Eligible denominator coverage fraction (no fabricated "100% compliant" claims). Evidence completeness separation. | **EXISTING / TESTED** | `lib/rulebook/execution-ledger.mjs`<br>`lib/rulebook/coverage.mjs`<br>`lib/rulebook-ledger.mjs`<br>`public/regulatory-workbench.js` | `tests/rulebook-engine.test.mjs`<br>`tests/rulesets-loader.test.mjs`<br>`e2e/rulebook-workflow.spec.mjs`<br>`scripts/rulebook-trust-browser-e2e.mjs` |
| **D3** | **Multi-SKU Cross-Contamination** | Source-backed SKU registry (`lib/product-family/sku-registry.mjs`). Active SKU confirmation before definitive comparisons. Field-aware comparison (product name, variant, net quantity, ingredients, allergens, barcode) tied to spreadsheet cell provenance (`Sheet1!B12`). False-positive suppression for legitimate shared family content (brand name, manufacturer address, shared slogans). | **EXISTING / TESTED** | `lib/product-family/sku-registry.mjs`<br>`lib/product-family/spreadsheet-parser.mjs`<br>`lib/organizer-verification.mjs` | `tests/sibling-sku.test.mjs`<br>`tests/product-family-spreadsheets.test.mjs`<br>`tests/organizer-verification.test.mjs`<br>`e2e/product-family.spec.mjs` |
| **D4** | **Hybrid Native-PDF & Rendered-Image Inspection** | Preservation of PDFium extraction/rendering (`lib/extract.py`). Native PDF structural inspector (`lib/pdf-structure.py`, `lib/pdf-visible-text.py`, `lib/pdf-preflight.mjs`). Text rendering mode analysis (Tr 3 non-rendering), opacity, drawing sequence order, later opaque occlusions. Visibility classification: `NATIVE_VISIBLE_CANDIDATE`, `RENDER_CONFIRMED`, `PDF_NONRENDERING_TEXT`, `POTENTIALLY_OCCLUDED`, `RENDER_NOT_CONFIRMED`, `UNKNOWN_VISIBILITY`. Conservative human-review routing. | **EXISTING / TESTED** | `lib/pdf-preflight.mjs`<br>`lib/pdf-visible-text.py`<br>`lib/pdf-structure.py`<br>`public/preflight-dashboard.js` | `tests/pdf-visibility.test.mjs`<br>`tests/pdf-preflight/`<br>`tests/test_pdf_preflight.py`<br>`e2e/pdf-evidence.spec.mjs` |
| **D5** | **Independently Demonstrated Reliability** | Preserved 21-case synthetic regression benchmark (`scripts/evaluate-engine.mjs`). Formal blind evaluation harness (`evaluation/independent/` with protocol, case manifest, frozen ground-truth schemas, and scoring rules). 3 unfamiliar packaging sets (genuine mismatch, clean approved match, conflicting/ambiguous sources). Honest evaluation scoring (`scripts/score-blind-evaluation.mjs`): records TP, FP, FN, TN, correct abstentions, and 0 unsafe overclaims. Transparent disclosure when independent blind human review is pending. | **EXISTING / TESTED** | `evaluation/independent/`<br>`scripts/score-blind-evaluation.mjs`<br>`scripts/run-independent-evaluation.mjs`<br>`submission/INDEPENDENT_REVIEW.md` | `npm run evaluate`<br>`npm run evaluate:blind`<br>`tests/independent-eval/`<br>`e2e/independent-eval.spec.mjs` |

---

## 2. Baseline Test Execution Results

- **Node.js Automated Unit & Integration Tests**: 934 passed, 0 failed.
- **Python Native PDF & Structural Tests**: 52 passed, 0 failed (`tests/test_extract.py`).
- **Playwright Real-Backend E2E Suite**: 23 / 23 suites passed (`npx playwright test`).
- **Deterministic 21-Case Evaluation Engine**: 21 / 21 passed (100% accuracy, average 0.88 ms / check).
- **HTTP Smoke Verification**: 13 / 13 endpoints passed (`scripts/smoke.mjs`).
- **Team Review & Sign-Off Smoke**: 8 / 8 checks passed (`scripts/team-smoke.mjs`).
- **Independent Blind Scorer**: 12 units evaluated (1 TP, 2 FP, 2 FN, 5 TN, 1 correct abstention, 0 unsafe overclaims).

---

## 3. Comparative Architectural Differentiation: PackSignal vs. Competitor (BriefForge)

| Architecture Dimension | Competitor (BriefForge) | PackSignal (Differentiated) |
|---|---|---|
| **Change Impact** | Full re-run of all checks upon any edit; decision state blindly wiped. | Selective dependency-graph recomputation (`lib/review-intelligence/dependency-graph.mjs`); only affected downstream evaluators rerun; unaffected approvals stay valid. |
| **Rulebook Trust** | Displays only rules that produced findings; drops uncompiled or inapplicable rules. | Full rule execution ledger (`lib/rulebook/execution-ledger.mjs`); accounts for every rule (executed, blocked, unsupported, uncompiled prose); eligible denominator coverage metrics. |
| **Product Family Screening** | Flavour/variant copy evaluated in isolation or fuzzy string matching. | Multi-SKU spreadsheet registry (`lib/product-family/sku-registry.mjs`); field-aware carryover detection (barcodes, allergens, variants) with exact cell provenance (`Sheet1!B12`); protects valid shared brand copy. |
| **PDF Inspection** | Assumes text extracted via OCR or PDFium is physically visible ink. | Hybrid native + rendered inspection (`lib/pdf-preflight.mjs`); detects Tr 3 non-rendering text, opaque occlusions, drawing order conflicts; disclaims unlocated text honestly. |
| **Evaluation Integrity** | Self-reported pass rate on author-tuned test samples presented as "model accuracy". | Strict blind evaluation harness (`evaluation/independent/`); frozen ground-truth SHA-256 hashes; distinct evaluation units (Package + Check + Instance); counts correct abstentions. |
