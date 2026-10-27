# Phase 10A Integration Status — Scan to Brief

**Status**: `IMPLEMENTED_AND_TESTED`  
**Milestone**: Phase 10A — Physical Scan to Brief Intake  
**Target Window**: In-Person Campus Evaluation Round  
**Last Updated**: October 27, 2026

---

## 1. Executive Summary & Capabilities
Phase 10A enables review starting directly with a physical printed packaging carton—**no initial PDF or Excel document required**.
The mobile web camera captures physical packaging faces, rectifies perspective distortion via 4-corner homography, evaluates image sharpness, performs dual reading (Local OCR + Vision API), establishes consensus, flags unreadable areas for targeted close-ups, builds a progressive 3D twin, compares shelf observations against specification sheets, and generates an evidence-backed packaging brief.

---

## 2. Architectural Pillars

### A. Two Entry Routes, One Underlying Engine
- **Route A (Digital PDF/CAD)**: Direct vector PDF dieline extraction.
- **Route B (Physical Carton Scan)**: Mobile camera capture -> unwarp -> dual reading.
- **Shared Core**: Canonical fact schema (`lib/fact-sheet.mjs`), rule evaluators (`lib/engine.mjs`), reviewer lenses, finding IDs, evidence audit ledger, and Ed25519 sealed brief export.

### B. Dual-Reader Consensus Policy
- **Independent Reading**: Local Tesseract OCR + Vision model read each panel independently.
- **Strict Agreement Matrix**:
  - `AGREE_EXACT`: Exact character match.
  - `AGREE_NORMALIZED`: Character/unit normalization matches (e.g., "10 oz" vs "10oz").
  - `DISAGREE`: Reconciliation card displayed; never auto-confirmed.
  - `ONE_READER_ONLY`: Flagged as `AI_SUGGESTED / REVIEW_REQUIRED`.
  - `CRITICAL_FIELD_LIMITATION`: Critical fields (allergens, nutrients, claims) with borderline quality are gated as `CANDIDATE_CONFIRMED_WITH_LIMITATIONS`.

### C. Zero Hidden EU Table Leakage
- Native non-printing EU nutrition tables present in PDF vector CAD dieline layers are strictly barred from contaminating physical photo reviews. If not visible on the printed package, EU table facts are completely excluded.

### D. Bank-Card Scale Reference & Privacy Protection
- Standard ID-1 reference target (85.60 mm × 53.98 mm) provides optical scale calibration (pixels/mm).
- Automated payment privacy regex filters detect and reject sensitive bank card data (PAN numbers, expiry dates, CVV codes). Financial information is never uploaded or persisted.

### E. Progressive 3D Twin & Geometry Authority
- Scanned faces are progressively mapped onto a 3D box twin.
- Unscanned faces remain neutral placeholders.
- Twin geometry authority clearly reports `REFERENCE_SCALED_APPROXIMATE_TWIN` or `ILLUSTRATIVE_SHELL` rather than claiming CAD dieline precision without a dieline.

---

## 3. Verification Suite & Test Results

| Test Suite | Files | Passed / Total | Status |
| :--- | :--- | :--- | :--- |
| **Node.js Unit Tests** | `tests/scan-*.test.mjs`, `tests/photo-*.test.mjs`, `tests/reader-*.test.mjs` | 33 / 33 | `PASSED` |
| **Python Computer Vision** | `tests/test_face_detection.py`, `tests/test_image_quality.py`, `tests/test_perspective_rectification.py`, `tests/test_photo_ocr.py` | 15 / 15 | `PASSED` |
| **Two Routes Equivalence** | `scripts/verify-scan-vs-pdf.mjs` | 100.0% Parity | `PASSED` |
| **Playwright Mobile E2E** | `e2e/phase10a-scan-to-brief.spec.mjs` | 1 / 1 (4.4s) | `PASSED` |

---

## 4. Current Status Summary
- **Specification Status**: `COMPLETED`
- **Implementation Status**: `IMPLEMENTED_AND_TESTED`
- **Release Gate**: `READY_FOR_CAMPUS_DEMO`
