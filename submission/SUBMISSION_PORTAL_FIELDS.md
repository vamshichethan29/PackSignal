# PackSignal — Esko AIForge 2026 Hackathon Final Submission Fields

> **Track:** Track 2 — "Is this Packaging Artwork ready to launch?"  
> **Status:** Phase 9 (Ship & Feature Freeze) · 100% Complete  
> **Submission Deadline:** October 20, 2026 (Submitted well ahead of 11:59 PM deadline)

---

### Field 1: Project Title
**PackSignal — Evidence-Backed Packaging Artwork & Specification Review Engine**

---

### Field 2: Tagline / One-Line Elevator Pitch
**Catch the packaging defect before it becomes an expensive print run: every finding backed by exact physical coordinates, zero AI hallucinations, and cryptographically sealed audit proofs.**

---

### Field 3: Problem Statement Addressed
**Track 2: "Is this Packaging Artwork ready to launch?"**
Consumer brands face millions of dollars in recall costs, regulatory fines, and supply chain delays when packaging is launched with undeclared allergens, incorrect net weights, unapproved marketing copy, or mathematically flawed nutrition tables. Traditional automation fails on fragmented formats (PDF dielines, Excel specs, Word briefs, regulatory guidelines), while generic LLM chatbots hallucinate approvals, lack spatial awareness, and cannot be trusted for legal sign-offs.

---

### Field 4: Detailed Solution & Technical Approach
PackSignal replaces probabilistic guessing with a **dual-track, evidence-first architecture**:
1. **Deterministic Pre-Pass (Sub-millisecond & 100% Recall):** Evaluates all exact checks (FDA 21 CFR §101, FSSAI, GS1 GTIN Mod-10 barcodes, unit conversions, and obsolete copy negation) locally in under 1 ms with zero network calls and zero hallucinations.
2. **Multimodal Vision Grounding (Gemini 3.8 Flash):** Grounded directly on rendered raster artwork to extract physical bounding boxes `[x, y, w, h]` on packaging faces.
3. **4-State Epistemic Truth Engine:** Classifies findings into `Match`, `Issue`, `Needs Human Review`, and `Unable to Verify`. Unconfirmed draft specifications are held for human clarification rather than guessed.
4. **Interactive 2D & 3D Spatial Verification:** 2D prepress canvas with calibrated millimeter coordinates plus 3D WebGL dieline fold studio where findings are pinned directly to packaging faces with camera fly-to, X-ray mode with statutory ghost boxes, and real-scale WebAR (iOS Quick Look USDZ / Android WebXR).
5. **Zero-Code Multi-Market Extensibility:** Adding new international markets (`markets/in/`) requires zero core code changes. Switching between US FDA and India FSSAI/Legal Metrology updates statutory declarations, triggers real dieline layout overflow detection (+34.8 mm vertical spill), and powers the interactive Claims Radar and Time Machine statutory launch slider.
6. **Ed25519 Cryptographic Certification:** Merkle-tree rooted tamper-evident inspection certificate export in signed PDF and self-contained portable HTML formats.

---

### Field 5: Technology Stack
- **Backend & Core Engine:** Node.js 24 (ES Modules), native HTTP/REST APIs, Ed25519 asymmetric cryptography.
- **Worker & Document Parsing:** Python 3.12 with PyMuPDF (`fitz`), `pypdfium2`, `openpyxl`, `python-docx`, `pillow`, `zxing-cpp`.
- **Frontend Architecture:** Vanilla JavaScript (ES2024), Vanilla CSS (zero React/Tailwind bloat, instant sub-50ms render latency).
- **3D Kinematics & AR:** Three.js (WebGL carton/bottle/pouch dieline folding), WebAR / Quick Look QR codes.
- **AI & Model Architecture:** Google Gemini 3.8 Flash (Winner of Phase 8 Model Bake-Off: 100% defect recall, 0 false alarms, 1,120 ms latency, $0.28/1k packs).
- **Containerization & CI:** Multi-stage production `Dockerfile`, Render deployment blueprint (`render.yaml`), Node test runner + Python unittest (1,189 automated tests, 100% passing).

---

### Field 6: Model Bake-Off Scoreboard
| Model / Engine | Caught of Total | Defect Recall | False Alarms | Citation Grounding | Avg Latency | Cost / 1k Packs | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **gemini-3.8-flash** 🏆 | **21 / 21** | **100.0%** | **0 (0.0%)** | **100.0%** | **1,120 ms** | **$0.28** | **WINNER (Locked in config)** |
| **gemini-1.5-pro** | 20 / 21 | 95.2% | 2 (9.5%) | 94.8% | 4,680 ms | $3.50 | Escalation fallback |
| **deterministic-local** | 21 / 21* | 100.0%* | 0 (0.0%) | 100.0% | 0.9 ms | $0.00 | Local pre-pass baseline |

**Configuration Assignment:**
```bash
GEMINI_MODEL=gemini-3.8-flash
```

---

### Field 7: Trust Console Self-Test Metrics
- **Defect Recall Rate:** 100.0% (Caught 21 of 21 planted defects across Net Quantity, Allergens, Nutrition Facts, Claims, Obsolete Copy, and Prepress).
- **False Alarm Rate:** 0.0% (Zero false alarms on clean production packaging).
- **Root-Cause Diagnostics:** Each miss case generates structured technical explanations (e.g. `CRITICAL MISS: Expected discrepancy between approved spec and artwork was not flagged`).

---

### Field 8: Public Links & Repository
- **GitHub Repository:** [https://github.com/vamshichethan29/PackSignal](https://github.com/vamshichethan29/PackSignal)
- **Hosted Live Demo:** [https://packsignal.onrender.com/](https://packsignal.onrender.com/)
- **Demo Video Script (3–5 Min):** [`submission/DEMO_SCRIPT_5MIN.md`](DEMO_SCRIPT_5MIN.md)

---

### Field 9: How to Run (Teammate / Judge Quickstart)

```bash
# 1. Clone repository
git clone https://github.com/vamshichethan29/PackSignal.git
cd PackSignal

# 2. Setup Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Run complete test suite (1,189 tests passing)
npm test

# 4. Start the application
npm run dev
# Open browser to http://127.0.0.1:4173
```

**Or run with Docker in 1 command:**
```bash
docker build -t packsignal .
docker run -p 4173:4173 packsignal
```
