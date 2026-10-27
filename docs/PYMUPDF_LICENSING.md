# PyMuPDF Licensing & Architecture Decision

## Overview
PackSignal Phase 3 incorporates deep native PDF structural inspection via `lib/pdf-inspector.py` utilizing the PyMuPDF library (`fitz`). This document details the licensing assessment, obligations, deployment boundaries, and the decoupling architecture ensuring license compliance and zero-crash fallbacks.

---

## 1. PyMuPDF Licensing Model
PyMuPDF is dual-licensed:
1. **GNU Affero General Public License v3.0 (AGPL-3.0)**:
   - For open-source, non-commercial, or internal evaluation where all network-user source-code disclosure obligations of the AGPL-3.0 are fulfilled.
   - Any distribution or remote network interaction with modified AGPL software requires making the full corresponding source code available to all users under the AGPLv3.
2. **Commercial License**:
   - Artifex Software Inc. provides commercial licensing for proprietary enterprise distributions where AGPLv3 terms are incompatible.

---

## 2. PackSignal Architecture & Decoupling Strategy
PackSignal never couples application core logic directly to PyMuPDF. Instead:
1. **Process Boundary Isolation**:
   - All PyMuPDF interactions are contained strictly within an external command-line worker subprocess (`lib/pdf-inspector.py`).
   - Communication occurs solely through standard streams and versioned JSON schemas (`packsignal-pdf-inspector/v1`).
   - The Node.js server (`server.mjs`, `lib/pdf-preflight.mjs`) calls this worker using safe argument arrays, with no in-process linking.
2. **Deterministic Fallback Pipeline**:
   - PackSignal retains its standard `pypdfium2` (Apache-2.0 / BSD) extraction, rendering, and text-matching engine as the foundational pipeline.
   - The capability detector checks for `fitz` availability. If absent, disabled via environment variable (`DISABLE_PYMUPDF=1`), or unlicensed in a target deployment:
     - The application continues operating seamlessly with `pypdfium2`.
     - Advanced features (drawing-order occlusion, character quads, OCG layers, ICC profiles) are transparently reported as `UNAVAILABLE_IN_DEPLOYMENT`.
     - No fake findings, synthetic metrics, or placeholder passes are ever fabricated.

---

## 3. Deployment Guidance for Operators
- **Local Workstation & Open Source Use**: Standard PyMuPDF AGPL-3.0 applies.
- **Enterprise SaaS & Proprietary Packaging Systems**:
  - Obtain a commercial PyMuPDF OEM license from Artifex Software Inc., OR
  - Set `DISABLE_PYMUPDF=1` to enforce the pure `pypdfium2` / `pypdf` mode.
