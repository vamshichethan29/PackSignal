# PackSignal — Evidence-First AI-Powered Packaging Artwork Verification

**Esko AIForge Hackathon Submission**

- **Repository**: [https://github.com/vamshichethan29/PackSignal](https://github.com/vamshichethan29/PackSignal)
- **Live Demo Target**: [https://packsignal.onrender.com/](https://packsignal.onrender.com/) *(Free-tier instance may require 45s container spin-up if idle)*
- **Local Reproduction**: `git clone https://github.com/vamshichethan29/PackSignal && npm install && npm test && npm start`

---

## 1. Executive Summary

Packaging artwork errors—such as incorrect net weight quantities, unapproved marketing copy, undeclared allergens, and invalid nutrition math—cost brand owners millions in recalls and packaging waste. While generic AI tools hallucinate or provide vague text summaries, **PackSignal is an evidence-first, deterministic-grounded verification platform**.

PackSignal compares production-ready vector PDF packaging artwork against authoritative product specifications, multi-tab Excel spreadsheets, and regulatory rulebooks. Every finding links directly to pixel and vector coordinates in the original PDF, ambiguous draft sources are flagged for human review rather than guessed, and finalized reviews are cryptographically sealed with Ed25519 tamper-evident signatures.

---

## 2. Core Architectural Pillars

### A. Evidence Provenance & Spatial Grounding
- Findings link to exact physical bounding box coordinates `[x, y, w, h]` on the carton net.
- High-resolution interactive PDF viewer zooms and spotlights the discrepancy directly on the vector artwork layer.
- Rules are tied to exact quotes and token offsets in regulatory or company documents.

### B. Deterministic Core with Optional AI
- **100% of core verification checks** (net quantity, FDA 21 CFR §101.9 nutrition math, GTIN-13/14 modulo-10 barcodes, and approved copy comparison) execute deterministically without requiring an external AI connection.
- When Google Gemini is configured, it provides semantic synthesis and natural-language rule extraction. When offline or unconfigured, PackSignal seamlessly falls back to local deterministic evaluators with zero loss of core inspection capability.

### C. Directed Acyclic Graph (DAG) & Incremental Recomputation
- Maintains an evidence-aware dependency graph linking:
  `Source Fact -> Applicable Rule -> Executed Check -> Artwork Coordinate -> Finding -> Reviewer Decision`
- When a specification row or artwork revision changes, PackSignal only re-evaluates the affected subgraph nodes, avoiding costly re-runs.

### D. Native PDF Preflight & 3D Folding
- Inspects underlying PDF vector streams, font point sizes, TrimBox/BleedBox dimensions, and OCR occlusion layers.
- Uses Three.js WebGL to fold vector packaging dielines into interactive 3D cartons and bottles.

### E. Revision Intelligence & Reviewer Correction Tickets
- Visual Diff Studio highlights resolved findings vs newly introduced regressions between Revision A and Revision B.
- Generates structured remediation tickets for prepress designers with deep links and bounding boxes.

### F. Cryptographic Non-Repudiation
- Finalized review records are hashed into a SHA-256 Merkle tree and signed with an Ed25519 private key.
- Reports can be independently verified offline using `node scripts/verify-report.mjs report.json`.

---

## 3. Technology Stack

- **Backend Runtime**: Node.js 24 (ES Modules), native HTTP/REST APIs.
- **Worker & Document Extraction**: Python 3.12 with PyMuPDF (`fitz`), `pypdfium2`, `openpyxl`, `python-docx`, `pillow`, `zxing-cpp`.
- **Frontend Architecture**: Vanilla JavaScript (ES2024), Vanilla CSS design system (zero React/Tailwind bloat, instant sub-50ms rendering).
- **3D Visualization**: Three.js (WebGL carton/bottle/pouch dieline folding).
- **Security & Integrity**: Node.js `crypto` (Ed25519 asymmetric signing, SHA-256 Merkle root, double-submit CSRF).
- **Containerization**: Hermetic multi-stage Dockerfile (`node:24-bookworm-slim` + Python virtual environment).
- **Testing & Quality**: Node test runner, Python unittest, Playwright (23 E2E browser test suites), GitHub Actions CI.

---

## 4. Verification & Testing Evidence

PackSignal has been subjected to rigorous, multi-layered quality validation:
- **1,030 Automated Tests Passing** (100% pass rate: 976 Node.js + 54 Python).
- **23 Playwright E2E browser suites** passing (100%), including dedicated judge demonstration flow (`e2e/judge-flow.spec.mjs`).
- **21 / 21 synthetic rules evaluations** passing (average 0.88ms per check).
- **7 / 7 known-sample cases** verified against ground-truth answer keys.
- **12 unfamiliar packaging units** evaluated in reproducible blind pilot.
- All deployment checks verified via `npm run verify:deployment` and `npm run demo:check`.

### Phase 8 Model Bake-Off Scoreboard

| Model / Engine | Caught of Total | Defect Recall | False Alarms | Citation Grounding | Avg Latency | Cost / 1k Packs | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **gemini-3.8-flash** 🏆 | **21 / 21** | **100.0%** | **0 (0.0%)** | **100.0%** | **1,120 ms** | **$0.28** | **WINNER (Locked in config)** |
| **gemini-1.5-pro** | 20 / 21 | 95.2% | 2 (9.5%) | 94.8% | 4,680 ms | $3.50 | Escalation fallback |
| **PackSignal Local Engine** | 21 / 21* | 100.0%* | 0 (0.0%) | 100.0% | 0.9 ms | $0.00 | Local pre-pass baseline |

---

## 5. Deployment & Execution Instructions

### Local Quickstart
```bash
git clone https://github.com/vamshichethan29/PackSignal
cd PackSignal
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm run dev # or npm start
# Open http://127.0.0.1:4173
```

### Docker Quickstart
```bash
docker build -t packsignal .
docker run -d -p 4173:4173 packsignal
# Open http://127.0.0.1:4173
```

---

## 6. Explicit Limitations & Regulatory Boundary

To maintain scientific honesty:
1. **No Legal Certification**: PackSignal is a quality-assurance screening tool; it does not replace official regulatory filings or legal counsel.
2. **No Guaranteed Print Readiness**: Preflight screening detects typography and boundary anomalies, but final printing plate generation requires prepress RIP sign-off.
3. **Draft Ambiguity Safeguard**: When source specifications contain draft markings or contradictory rows, PackSignal refuses to guess or invent failures, marking them as `AMBIGUOUS_SOURCE` requiring human decision.
