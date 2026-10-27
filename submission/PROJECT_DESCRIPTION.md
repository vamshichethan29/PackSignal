# PackSignal — Evidence-Backed Packaging Artwork Readiness Review

## 1. Executive Summary & Core Mission
PackSignal is an evidence-backed packaging artwork readiness verification system developed for the Esko AIForge Hackathon challenge: *"Is this Packaging Artwork ready to launch?"* 

Consumer packaging is subject to stringent multi-jurisdictional compliance rules, precise prepress manufacturing tolerances, and rapid marketing copy revisions. Errors that escape into print runs trigger catastrophic product recalls, regulatory fines, and brand reputational damage. PackSignal eliminates guesswork by uniting document intake, multi-modal extraction, deterministic market rulepacks, audited vision AI, and cryptographic audit proofs into a unified reviewer cockpit. Every finding is mathematically pinned to source document coordinates, ensuring complete evidentiary integrity.

---

## 2. Multi-Modal Intake & Document Ingestion
PackSignal ingests the complete triad of packaging development files:
- **Artwork Vector PDFs**: Native print dielines, CMYK/spot-color separation layers, and vector text elements.
- **Copy & Content Spreadsheets**: Multi-sheet Microsoft Excel workbooks (`.xlsx`) containing approved marketing copy, ingredient lists, and nutritional declarations.
- **Product Specifications**: Microsoft Word (`.docx`) and technical PDF specifications detailing net weights, allergen alerts, and packaging dimensions.

Upon intake, PackSignal immediately calculates SHA-256 cryptographic digests for every uploaded file, storing them in isolated review sessions. Role tags (Artwork, Reference Spec, Marketing Copy, Regulatory Rulebook) are assigned automatically or adjusted by the reviewer.

---

## 3. Positioned Extraction & Fact Sheet Canonicalization
PackSignal utilizes an asynchronous Python extraction pipeline (`lib/extract.py`):
- **PDF Glyph Geometry**: `pypdfium2` extracts vector character sequences, exact bounding boxes, font names, point sizes, and page dimensions down to the millimeter.
- **Spreadsheet Grid Analysis**: `openpyxl` navigates workbook sheets, cell coordinates, calculated formula outputs, and table headers.
- **Specification Parsing**: `python-docx` extracts structured specification tables, body paragraphs, and declared tolerances.
- **Prepress Ink Analysis**: Identifies overprint flags, Total Area Coverage (TAC), and separation ink plates.

Extracted pieces are assembled into a **Packaging Fact Sheet**. Each fact is governed by an explicit **Authority Hierarchy**:
1. *Product Specification Sheets* (Highest Authority)
2. *Approved Marketing Content Spreadsheets*
3. *Artwork Proof Text* (Lowest Authority; Subject to Verification)

To eliminate hallucinations, every extracted claim is subjected to **Character-Level Quote Verification**: the candidate text must match the exact sequence of bytes in the source document at its specified coordinate location.

---

## 4. Dual-Track Compliance Engine: Deterministic vs. AI
PackSignal deliberately separates deterministic mathematical proofs from visual interpretation:

### Track A: Deterministic Market Rulepacks (Authoritative)
- **US FDA 21 CFR 101**: Computes Principal Display Panel (PDP) surface area from dieline dimensions, determines mandatory minimum type heights for net quantity declarations under § 101.105, verifies Daily Value rounding math, and checks allergen formatting.
- **India FSSAI & Legal Metrology**: Enforces green/brown veg/non-veg logo placement, retail MRP declaration formatting, and dual-language declarations.
- **Prepress Technical Preflight**: Evaluates Total Area Coverage (TAC) against a 300% press threshold, detects hairline trim safety violations, and verifies dieline fold lines.
- **Guarantees**: Zero hallucination, 100% offline operational readiness, and reproducible logic.

### Track B: Multimodal Vision AI (Audited Assist)
- **Engine**: Powered by **Google Gemini 3.8 Flash**, selected as the winning production model in our Phase 8 Trust Bake-Off.
- **Capabilities**: Reads curved typography on circular badges, transcribes non-linear layout text, and interprets complex artwork iconography.
- **Guardrails**: AI output schema is strictly bounded; any AI-suggested fact must pass local character-level quote validation against source coordinates before acceptance.
- **Resilience**: If API keys are unconfigured or provider rates are exceeded, PackSignal falls back instantly to the local deterministic engine without service interruption.

---

## 5. Epistemic Finding Categorization
Every packaging requirement evaluated produces a canonical finding classified into one of four epistemic states:
1. **Matches Reference (Verified)**: The artwork value strictly matches the reference specification, confirmed by quote coordinates.
2. **Issue Found (Violation)**: A numerical discrepancy, missing statutory warning, or prepress violation exists (e.g. net quantity type height too small; TAC > 300%).
3. **Needs Human Review**: Ambiguous wording, conflicting multi-document claims, or uncorroborated marketing statements requiring domain judgment.
4. **Unable to Verify**: Source reference data was not provided; PackSignal strictly refuses to convert missing data into an ungrounded approval.

---

## 6. Reviewer Cockpit, 2D Prepress HUD & 3D Carton CAD
Reviewers collaborate within an interactive browser cockpit:
- **2D Proof View & Prepress HUD**: Deep-zoom viewer with millimeter crosshairs, separation layer toggles, and dynamic TAC overprint heatmaps.
- **3D Tuck-End Carton Viewer**: Built using Three.js, PackSignal parametrically folds the 2D PDF dieline into an interactive 3D tuck-end carton. UV textures project the high-resolution artwork onto all 6 physical faces. Finding pins in 3D allow reviewers to click an issue and fly the virtual camera directly to the relevant packaging face.
- **Ambiguity Hub & Decision Ripple**: When reviewers encounter conflicting facts, PackSignal models a dependency graph. Reviewers simulate "What-If" decisions, visualizing exactly which downstream checks will re-evaluate upon resolution.
- **Multi-Department Review**: Legal, Regulatory, Prepress, and Brand teams attach color-coded sticky notes, log dispositions, and execute sign-offs using fast keyboard triage (`A` for Approve, `R` for Reject, `H` for Human Review).

---

## 7. Audited Exports & Ed25519 Cryptographic Proof
Upon review completion, PackSignal generates audit-ready deliverables:
- **Evidence-Backed Creative Brief**: Formatted as interactive HTML, PDF, or markdown checklist. Every sentence features audit citations linked to source bounding boxes.
- **A3 Review Wall Poster**: High-resolution vector layout showing side-by-side revision proofs and finding callouts.
- **Cryptographic Ed25519 Review Seal (v2)**: The entire review bundle—source file digests, normalized facts, reviewer decisions, and audit history—is cryptographically hashed into a SHA-256 Merkle root and signed with an Ed25519 private key. External auditors verify integrity offline using `npm run verify-report`.

---

## 8. Trust Console & Reproducible Evaluation Metrics
To validate detection rigor, PackSignal includes an automated **Trust Console** (`/trust`):
- **Synthetic Mutation Engine**: Automatically plants 5 classes of realistic packaging defects into baseline packages (allergen omissions, out-of-date regulations, type-height shrinkages, net quantity alterations, and TAC over-inking).
- **Automated Release Gates**: Evaluates defect catch rate (recall), evidence rigor (bounding box precision), and false positive rates.
- **Evaluation Scope**: In our reproducible benchmark suite (`npm run trust:run`), PackSignal achieved a **100% defect catch rate** across synthetic mutations with 0% false positives, verifying our multi-jurisdiction rulepack.

---

## 9. Technology Stack Summary
- **Backend**: Node.js 24 (Native ES Modules, zero bulky frameworks)
- **Extraction**: Python 3.12 (`pypdfium2`, `openpyxl`, `python-docx`, `Pillow`, `reportlab`)
- **Frontend**: Vanilla JavaScript & CSS (High-performance Canvas & DOM proofing)
- **3D Engine**: Three.js WebGL (Parametric tuck-end folding & camera controls)
- **AI Integration**: Google Gemini 3.8 Flash (Multimodal vision with local fallback)
- **Containerization**: Docker (`node:24-bookworm-slim`, unprivileged `node` user, curl healthcheck)

---

## 10. How to Run Locally in 60 Seconds
```bash
# 1. Clone & Install Node Dependencies
git clone https://github.com/vamshichethan29/PackSignal.git
cd PackSignal
npm install

# 2. Python Virtual Environment Setup
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
export PACKPROOF_PYTHON="$(pwd)/.venv/bin/python"

# 3. Diagnostic Preflight Check
npm run doctor

# 4. Launch Local Development Server
npm run dev

# 5. Open Browser & Test Official Sample
# Open http://127.0.0.1:4173 in Chrome
# Click "Load Dancing Fish Sample" and explore the Cockpit
```
