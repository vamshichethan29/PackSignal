# PackSignal — Executive Summary & Short Write-Up

### Project Name
**PackSignal** — Evidence-Backed Packaging Artwork Readiness Review

### Challenge Theme
*Is this Packaging Artwork ready to launch?* (Esko AIForge Hackathon)

---

### The Problem
Consumer packaged goods (CPG) companies release packaging artwork under intense deadline pressure across multiple global jurisdictions. Today's review processes are dangerously fragmented: regulatory teams review Word specs, brand teams edit copy in Excel spreadsheets, and prepress teams check vector dielines in Adobe Illustrator. 

Critical errors slip through—from subtle allergen omissions and non-compliant Nutrition Facts type heights to total ink coverage overprint defects that jam printing presses. Relying on generic generative AI exacerbates the problem: standard LLMs frequently hallucinate compliance, misread curved packaging typography, and provide ungrounded approvals that cannot withstand a regulatory audit.

---

### The Solution
PackSignal is an evidence-backed packaging review platform that turns artwork readiness into a reproducible, traceable engineering discipline. It ingests the triad of packaging assets—artwork vector PDFs, nutrition/copy spreadsheets, and technical product specifications—extracts positioned source tokens with millimeter accuracy, and executes a dual-track compliance verification pipeline.

Deterministic rule packs execute mathematical compliance checks for US FDA 21 CFR 101, Indian FSSAI / Legal Metrology, and prepress tolerances without hallucination. Simultaneously, an audited multimodal AI engine (Gemini 3.8 Flash) reads complex packaging layouts and transcribes curved typography, with every candidate finding strictly validated by character-level quote verification against source files.

---

### Who Uses It
1. **Regulatory & Compliance Officers**: Verify mandatory declarations, Daily Value mathematics, allergen highlights, and jurisdictional label requirements.
2. **Prepress & Packaging CAD Engineers**: Detect Total Area Coverage (TAC) ink limits, dieline fold alignments, font type height minimums, and separation layers.
3. **Brand Managers & Creative Directors**: Ensure claims match approved marketing copy and export sentence-cited creative briefs with cryptographic integrity seals.

---

### Core Workflow
1. **Intake & Hashing**: Upload PDF dielines, Excel copy sheets, and Word specs; PackSignal computes SHA-256 digests and establishes source provenance.
2. **Fact Sheet Canonicalization**: Positioned source pieces populate a unified truth sheet governed by an explicit authority hierarchy (Spec Sheet > Artwork > Copy).
3. **Dual-Track Evaluation**: Deterministic rulebooks check numerical requirements; multimodal AI reads curved art with character-level quote validation.
4. **Epistemic Finding Categorization**: Findings are strictly classified into *Matches Reference*, *Issue Found*, *Needs Human Review*, or *Unable to Verify*.
5. **Interactive 2D/3D Cockpit**: Reviewers inspect issues on a 2D Prepress HUD or interactively rotate a parametric 3D tuck-end carton with finding pins.
6. **Ambiguity Resolution & Audit Export**: Collaborative triage resolves conflicts with live dependency ripples, culminating in an Ed25519-sealed audit export.

---

### Key Differentiation: Why Cryptographic Evidence Matters
In enterprise packaging, an ungrounded approval is worse than useless—it is a legal liability. PackSignal never produces a finding without an exact coordinate locator, source page reference, and cryptographic character match. If data is missing or out-of-scope, PackSignal yields *Unable to Verify*, never a false positive approval. Every exported deliverable contains an Ed25519 digital signature over a SHA-256 Merkle root that can be verified offline via CLI.

---

### Implemented Technology Stack
- **Server Runtime**: Node.js 24 (ES Modules, HTTP service, zero heavy framework overhead).
- **Document Extraction Engine**: Python 3.12 (`pypdfium2` vector extraction, `openpyxl` spreadsheet grids, `python-docx` specification tables, `Pillow` image rasterization).
- **Frontend Cockpit**: Vanilla JavaScript & CSS (high-performance deep-zoom proof viewer, prepress separation toggles, TAC heatmaps).
- **3D Packaging CAD**: Three.js WebGL fold-graph viewer (real tuck-end carton geometry with UV artwork face projection).
- **AI Assist**: Google Gemini 3.8 Flash (evaluated and frozen via multi-model bake-off with deterministic fallback).
- **Security & Integrity**: Ed25519 asymmetric cryptography, SHA-256 content addressing, local/Render persistent data storage.

---

### Evaluation Approach & Scope
PackSignal includes a built-in **Trust Console** with an automated synthetic mutation engine that systematically plants 5 classes of realistic packaging defects:
- Missing mandatory allergen warnings
- Out-of-date regulatory effective dates
- Non-compliant PDP font type heights
- Serving size / Net quantity discrepancies
- Prepress Total Area Coverage (TAC) ink overflow (>300%)

In our reproducible test suite, PackSignal achieved a **100% defect catch rate** across synthetic test cases with zero false alarms.

---

### Disclosed Limitations
- **Evaluation Scope**: Metrics are established against synthetic defect mutations and official organizer test packages; real-world packaging variations may require additional domain-specific rules.
- **Physical Geometry**: 3D carton folding currently models standard tuck-end cartons; complex closures, flexible pouches, and bottles are supported in 2D vector HUD.
- **AI Availability**: Multimodal AI requires server-side Gemini API credentials; in offline or air-gapped environments, PackSignal automatically falls back to its 100% local deterministic engine.
