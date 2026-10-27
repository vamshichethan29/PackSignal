# Changelog

All notable changes to the **PackSignal (Esko AIForge)** project are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and maintains a formal feature freeze contract as of Version `1.0.0-freeze`.

---

## [1.0.0-freeze] — 2026-10-27
### 🏆 PHASE 8 — TRUST CONSOLE AND SELF-TEST (FEATURE-FREEZE MILESTONE)
**Contract Status:** `FEATURE_FROZEN` — No new product features. Maintenance, stabilization, security, and bug fixes only.

#### Key Highlights & Capabilities
- **Trust Shown as Numbers:** Interactive Trust Console scoreboard rendering "Caught X of Y" defect recall, clean packaging false positive rates, precision, F1 score, and safe abstention rates.
- **Seeded Synthetic Defect Generator:** Deterministic Mulberry32 PRNG generator (`scripts/generate-trust-cases.mjs`) generating verified broken cases, clean controls, and ambiguous counterexamples across Categories A–J:
  - *Category A — Quantity:* Net quantity mismatches, missing required quantities, equivalent metric units, invalid conversions.
  - *Category B — Ingredients:* Omissions, unauthorized foreign ingredient additions, percentage modifications, descending order reordering.
  - *Category C — Allergens:* Statutory allergen advisory omissions (tree nuts / milk), species changes, conflicting advisory warnings.
  - *Category D — Nutrition:* %DV arithmetic mismatches, Atwater 4-4-9 macro calorie inconsistencies, serving size discrepancies.
  - *Category E — Claims:* Unsupported "Zero Sugar" marketing claims, clashing Vegan declarations with honey formulations.
  - *Category F — Document Evidence:* Non-printing dieline guide text, hidden layer text isolation.
  - *Category G — Barcodes:* GS1 GTIN-12 / GTIN-14 modulo-10 check digit failures and clean barcode validations.
  - *Category H — Revisions:* Regression tracking detecting newly introduced defects across artwork iterations.
  - *Category I — Market Rules:* FSSAI Indian statutory green veg mark requirements and legal metrology.
  - *Category J — Clean Controls:* Verified positive controls and ambiguous specification routing.
- **Strict Ground Truth Protection:** Zero leakage of answer keys, target coordinates, scoring manifests, or golden labels to review input payloads.
- **Root-Cause Diagnostic Analysis:** Evidence-backed failure classifier (`lib/evaluation/failure-analysis.mjs`) diagnosing misses across 13 standard categories (`EXTRACTION_MISS`, `UNIT_NORMALIZATION_FAILURE`, `SEMANTIC_CONFLICT_MISS`, etc.).
- **Reproducible Evaluation Runner:** CLI runner (`npm run trust:run`) with category filters, progress streaming, and artifact persistence (`evaluation/results/`).
- **3-Model Fair Bake-Off:** Standardized evaluation of `gemini-3.8-flash`, `gemini-1.5-pro`, and `deterministic-local-engine` under identical inputs and rules, selecting `gemini-3.8-flash` in `config/ai-models.json`.
- **11 Feature-Freeze Release Gates:** Measurable release readiness gate evaluator (`lib/evaluation/release-gates.mjs`) assessing core workflow, evidence integrity, deterministic regressions, synthetic defect detection, and security isolation.
- **Browser Self-Test Flow:** One-click execution directly from the web workbench (`[Run Self-Test Suite]`) with live progress and case inspection.

---

## [0.9.4] — 2026-10-24
### PHASE 7A — 3D PACK VIEW
- Real tuck-end carton kinematics folding from cut/crease vector dieline paths (0% to 100% interactive slider).
- High-fidelity face texture projection mapping extracted PDF panel graphics.
- Evidence-linked 3D finding pins with smooth spherical camera fly-to navigation.
- Statutory X-Ray mode rendering dashed bounding box ghosts for missing customary net quantity declarations.
- Live market switching between US FDA and India FSSAI with dynamic Veg Mark rendering.
- 3D snapshot captures embedded directly into the approved Creative Brief.
- Augmented Reality modal with authentic SVG QR code generation for mobile WebAR Quick Look inspection.

---

## [0.9.0] — 2026-10-23
### PHASE 7 — INDIA MARKET PACK & MULTI-JURISDICTION REGULATORY RADAR
- Pluggable multi-jurisdiction rules engine supporting US (FDA 21 CFR), EU (1169/2011), and India (FSSAI 2020 & Legal Metrology).
- Bilingual Hindi/English artwork inspection with Devanagari numerals.
- Date-aware Regulatory Time Machine simulating compliance timelines from 2026 to 2028.
- Claims Radar cross-referencing nutritional lab values against front-of-pack marketing claims.
- Animated requirement dependency graph visualizing statutory prerequisites.

---

## [0.8.0] — 2026-10-22
### PHASE 6 & 6A — PACK CANVAS & SHOPPER PERSONAS
- Free-form multi-panel Pack Canvas with interactive zoom/pan coordinate projection.
- Shopper Persona lenses evaluating packaging readability for Nut Allergy, Vegan, and Low-Vision consumers.
- Glance Heatmaps simulating initial shelf visual attention zones.

---

## [0.7.0] — 2026-10-21
### PHASE 5 & 5A — PREPRESS TECHNICAL QUALITY & REVIEWER LENSES
- Native PDF preflight analyzing TAC ink density (>320%), dieline bleed safety margins (3mm), and font point sizes.
- Ed25519 cryptographic signatures securing inspection certificate ZIP packages.
- Reviewer Lenses providing specialized views for Legal, Regulatory, Graphic Design, and Prepress departments.

---

## [0.5.0] — 2026-10-20
### PHASE 4 — EVIDENCE DESK & DUAL-PANE PROOFING
- Side-by-side discrepancy cards comparing Candidate A (Specification) vs Candidate B (Artwork).
- Sub-pixel bounding box spotlighting with coordinate audit trail.
- Safe abstention routing ambiguous draft specifications to human reviewer queue.
