# PackSignal — 3–5 Minute Demonstration Script

**Track**: Esko AIForge Hackathon | Challenge: *Is this Packaging Artwork ready to launch?*  
**Format**: 3–5 Minute Video Walkthrough (Target: 4 minutes 15 seconds)  
**Presenter**: Principal Release & Systems Engineer  
**Live Application URL**: `http://127.0.0.1:4173` (Local) / `https://packsignal.onrender.com/` (Hosted)  
**Sample Dataset**: Official Esko Organizer Sample (`DancingFish_Granola_Berry_US_Carton.pdf`, `DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx`, `DancingFish_Granola_Product_Spec.docx`)

---

## Demonstration Timeline & Narration

### Scene 1: Problem Statement & Introduction (0:00 – 0:25)
- **Visual**: PackSignal Landing Cockpit (`http://127.0.0.1:4173`), showcasing the sleek dark glassmorphism interface, active jurisdictional rule packs, and the "Ready to Ingest" banner.
- **Spoken Narration**:
  > *"Every year, consumer brands face millions of dollars in recall costs, regulatory fines, and delayed product launches due to subtle discrepancies between approved specifications and final packaging artwork. Traditional proofreading relies on human spot-checking or unverified AI summaries that hallucinate approvals. PackSignal solves this by transforming artwork readiness into a deterministic, evidence-backed workflow where every finding is cryptographically traced to source files."*
- **Action**: Hover over the Jurisdiction Selector (US FDA 21 CFR 101 / India FSSAI / Prepress Preflight) to show multi-market capabilities.

---

### Scene 2: Multi-Modal Intake & Organizer Sample Ingestion (0:25 – 0:55)
- **Visual**: Drag-and-drop or select the 3 official Dancing Fish organizer files:
  1. `DancingFish_Granola_Berry_US_Carton.pdf` (Artwork PDF with dielines)
  2. `DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx` (Approved nutrition copy)
  3. `DancingFish_Granola_Product_Spec.docx` (Product specification)
- **Spoken Narration**:
  > *"We begin by loading the official Dancing Fish sample package. PackSignal ingests vector PDFs, multi-sheet Excel workbooks, and Word specifications. It immediately computes SHA-256 cryptographic digests for every document and dispatches extraction to our Python engine, parsing vector glyph coordinates, table cells, and spot-color ink separations without raster loss."*
- **Action**: Click **Start Review**. Observe the progress bar and status badge transition from "Extracting Source Pieces" to "Ready for Review".

---

### Scene 3: Fact Sheet & Character-Level Quote Verification (0:55 – 1:30)
- **Visual**: Navigate to the **Packaging Fact Sheet** tab. Click on a specific fact entry (e.g., *Net Quantity: 12 oz (340g)* or *Protein: 5g*).
- **Spoken Narration**:
  > *"Rather than relying on ungrounded LLM inferences, PackSignal constructs a canonical Fact Sheet. Each fact enforces an explicit Authority Hierarchy—specifications outrank marketing copy, which outranks unverified artwork text. Notice the Quote Verification badge: every single claim and numerical declaration is cryptographically checked against exact character sequences and bounding box coordinates in the source PDF."*
- **Action**: Click the source link on the Net Weight row. The UI highlights the exact bounding box on Page 1 of the artwork proof.

---

### Scene 4: Deterministic Compliance & Epistemic Findings (1:30 – 2:05)
- **Visual**: Switch to the **Canonical Findings** view. Filter by severity: *Issue Found (Violation)* and *Needs Human Review*.
- **Spoken Narration**:
  > *"PackSignal categorizes every requirement into four strict epistemic states: Matches Reference, Issue Found, Needs Human Review, or Unable to Verify. In this Dancing Fish carton, our deterministic engine catches two critical regulatory violations: first, the Principal Display Panel area requires a minimum type height of 4.8mm for the net quantity statement under FDA 21 CFR 101.105, but only 3.2mm is provided. Second, the total ink coverage in the dark berry illustration reaches 318%, exceeding the offset press TAC limit of 300%."*
- **Action**: Click on the TAC violation finding. The Prepress HUD instantly opens an ink coverage heatmap revealing the over-inking region.

---

### Scene 5: Reviewer Cockpit, Ambiguity Hub & Decisions (2:05 – 2:35)
- **Visual**: Open the **Ambiguity Hub** and review questions. Show a guided question for a marketing claim (e.g., *"100% Whole Grain"* claim substantiation).
- **Spoken Narration**:
  > *"When documents present ambiguous or conflicting statements, PackSignal does not guess. It opens an Ambiguity Question in the Reviewer Cockpit, visualizing a dependency graph and a Decision Ripple preview showing exactly which downstream checks will be re-evaluated upon resolution. Department specialists—Regulatory, Legal, Prepress, and Brand—can attach sticky notes, assign owners, and record signed dispositions using quick keyboard shortcuts."*
- **Action**: Click **Resolve Ambiguity**; select the approved specification source. Observe the live recalculation updating the dependent requirement status.

---

### Scene 6: 2D Prepress HUD & 3D Tuck-End Carton Viewer (2:35 – 3:10)
- **Visual**: Switch to the **3D Pack View**. Observe the parametric tuck-end carton fold into 3D space with high-res artwork projected on all 6 faces.
- **Spoken Narration**:
  > *"To visualize how defects manifest in physical packaging, PackSignal provides both a millimeter-accurate 2D Prepress HUD and a fully parametric 3D Tuck-End Carton Viewer built on Three.js. The viewer maps the unfolded PDF dieline across front, rear, sides, and tuck flaps. Notice the 3D finding pins: clicking an issue flies the camera directly to that carton face, demonstrating shelf readability and barcode orientation."*
- **Action**: Click the Net Quantity finding pin in the 3D panel. The camera smoothly glides and orbits to focus directly on the front panel display.

---

### Scene 7: Creative Brief & Cryptographic Ed25519 Seal (3:10 – 3:45)
- **Visual**: Click **Generate Creative Brief** / **Export Audited Report**. Show the generated HTML report and click **Verify Cryptographic Seal**.
- **Spoken Narration**:
  > *"When the review concludes, PackSignal exports a complete, self-contained Evidence-Backed Creative Brief and an A3 Review Wall Poster. Every sentence in the brief carries audit citations linked to source coordinates. To guarantee non-repudiation, the entire review bundle is sealed using an Ed25519 cryptographic digital signature over a SHA-256 Merkle root. Anyone can verify this proof offline using our standalone verification CLI."*
- **Action**: Show the verification modal confirming: `Ed25519 Seal Verified — 0 byte modifications detected`.

---

### Scene 8: Trust Console, Model Bake-Off & Closing (3:45 – 4:25)
- **Visual**: Open the **Trust Console** (`/trust`). Display the 21 synthetic defect mutation cases and the Model Bake-Off leaderboard.
- **Spoken Narration**:
  > *"Finally, we hold ourselves accountable with the Trust Console. We built an automated defect mutation generator that plants 5 types of real-world packaging errors—from allergen omissions to type-height reductions. In our model bake-off, Gemini 3.8 Flash won production deployment, achieving 100% defect catch rate with 0% false positives, backed by deterministic release gates. PackSignal turns packaging artwork review into an evidence-backed workflow, connecting source documents, regulatory requirements, reviewer decisions, and exported proof."*
- **Action**: Run `npm run trust:verify` in terminal; show all release gates passing cleanly.

---

## Technical Rehearsal Notes
- **Resolution**: 1920x1080 (16:9), 60 FPS.
- **Browser**: Google Chrome or Chromium (full screen, devtools closed, clean window).
- **Audio**: Crisp directional microphone, no background hum, clear conversational cadence.
- **Backup Navigation**: If external network is slow, local deterministic mode runs 100% offline at `http://127.0.0.1:4173`.
