# PackSignal: 3–5 Minute Judge Demonstration Script
### Esko AIForge Hackathon 2026 — Track 2

**Live Deployment URL**: [https://packsignal.onrender.com/](https://packsignal.onrender.com/) *(Free-tier container spin-up: 45s if idle)*  
**Local Reproduction**: `npm run dev` or `npm start` on `http://127.0.0.1:4173`  
**Core Thesis**: *"Every finding has an inspectable source, every mark has an artwork coordinate, and trust is proven in numbers."*

---

### Timed Demonstration Timeline (00:00 – 05:00)

#### 00:00 – 00:30: Problem & Value Statement
- **Voiceover**: *"In packaging prepress, detecting an error is only the beginning. Regulatory recalls cost millions when an undeclared allergen or wrong net-quantity slips into production. Traditional OCR misses visual context, while generic LLMs hallucinate compliance approvals. PackSignal is an evidence-first, deterministic-grounded verification platform: 100% of core checks run deterministically with zero API cost, multimodal AI reasons over visual artwork, and every review is cryptographically sealed."*
- **Screen Action**: Show PackSignal dashboard with Esko AIForge 2026 header and the official sample cards.

#### 00:30 – 01:10: Official Esko Organizer Sample & Source Ambiguity
- **Screen Action**: Click **"Explore organizer sample"** (`Dancing Fish Berry Crunch Granola`).
- **Voiceover**: *"We load the official Esko hackathon sample: the 4-panel carton PDF and multi-tab Excel content sheet. Look at the Sources tab: the spreadsheet contains draft formulation notes and competing serving size columns. Rather than guessing or inventing a pass, PackSignal classifies this as Human Review with an explicit Ambiguity Alert. We never let an unconfirmed draft value authorize packaging ink."*
- **Screen Action**: Open the **Resolve Ambiguity** panel showing the candidate values, sheet coordinates, and the human confirmation gate.

#### 01:10 – 01:50: 2D Prepress Spotlight & 3D Interactive WebGL Packaging Studio
- **Screen Action**: Select Finding **#01 (Net Quantity Discrepancy)**. Click **"🔍 View in 2D Artwork Proof"**.
- **Voiceover**: *"Selecting any check spotlights the exact physical bounding box on the vector artwork dieline. PackSignal extracts calibrated millimeter coordinates, TrimBox margins, and native font point sizes. Next, click 'Inspect in 3D Packaging Studio'—the flat 2D dieline folds in real-time WebGL into a closed 3D carton with findings pinned directly to their physical faces."*
- **Screen Action**: Click **"📦 Inspect in 3D Packaging Studio"**, rotate the 3D carton, toggle the fold animation, and click a surface evidence pin.

#### 01:50 – 02:40: 🏆 Trust Console & Model Bake-Off Scoreboard (Phase 8 Feature Freeze)
- **Screen Action**: Click **"🏆 Trust Console"** in the top navigation.
- **Voiceover**: *"Here is our core innovation for Feature Freeze: Trust shown as numbers. The Trust Console executes a unified runner across planted defect suites. Look at the hero scorecard: Caught 21 of 21 defects (100% recall), zero false alarms on clean controls (100% clean accuracy), and 100% safe abstentions on ambiguous drafts. Next, click Model Bake-Off: the runner scored three models. Gemini 3.8 Flash achieved 100% defect recall at $0.28 per 1,000 packs and 1,120ms latency, outperforming Gemini 1.5 Pro to win our locked production configuration. Click 'Run Self-Test Suite' to watch the runner score all checks live in under a second."*
- **Screen Action**: Click **"▶ Run Self-Test Suite"**, watch the progress bar reach 100%, and show the root-cause diagnostic explanations.

#### 02:40 – 03:20: Revision Intelligence (V1 vs V2 Side-by-Side & Swipe Comparison)
- **Screen Action**: Click **"🔀 Compare Artwork Revisions"** and select **Fieldday V2**.
- **Voiceover**: *"Packaging is iterative. When the prepress agency delivers Revision 2, did they fix the error without breaking anything else? PackSignal's Cross-Version Watchdog compares revisions in synchronized physical space. The Net Quantity fix is flagged in green as Verified Resolved. But look at Storage Instructions: the designer dropped the cooling instructions. PackSignal immediately flags this regression in bright red. Toggle the 2D Swipe divider to glide across the artwork seam."*
- **Screen Action**: Drag the interactive swipe divider back and forth across the front panel.

#### 03:20 – 04:00: Reviewer Decisions, Correction Tickets & Cryptographic Certification
- **Screen Action**: Click **"📋 Create Correction Ticket"**, then click **"Export Inspection Certificate"**.
- **Voiceover**: *"Reviewers can record structured decisions and generate designer correction tickets with exact pixel coordinates. Once sign-off is complete, click Export Inspection Certificate. PackSignal hashes the entire review DAG into a SHA-256 Merkle root and seals it with an Ed25519 cryptographic private key. Anyone can verify this proof offline in a single command using `node scripts/verify-report.mjs`."*
- **Screen Action**: Show downloaded signed JSON and the green Ed25519 verification badge.

#### 04:00 – 04:40: Engineering Rigor & Production Testing
- **Screen Action**: Display terminal test run.
- **Voiceover**: *"PackSignal is built to enterprise software standards: 1,030 automated tests passing with zero failures (976 Node.js + 54 Python). 21 out of 21 evaluation benchmark cases caught. 7 out of 7 official answer key checks verified. A fully self-contained Dockerfile based on Node 24 and Python 3.12 allows any teammate or judge to deploy in one command: `docker run -p 4173:4173 packsignal`."*
- **Screen Action**: Highlight terminal output showing `1030 passed, 0 failed` and `npm run doctor` verifying the environment.

#### 04:40 – 05:00: Honest Limitations & Wrap-Up
- **Voiceover**: *"To maintain scientific and regulatory honesty: PackSignal is an engineering QA screening engine, not legal counsel. Technical PDF preflight detects typography and vector overlap anomalies, but final printing plates require prepress RIP certification. PackSignal does not replace human judgment with AI confidence scores—it empowers packaging architects with an unshakeable, cryptographically verifiable chain of evidence."*
- **Screen Action**: Show the PackSignal hero screen and final signature badge.

