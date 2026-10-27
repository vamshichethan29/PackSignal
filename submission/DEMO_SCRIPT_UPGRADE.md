# PackSignal — 4-Minute Judge Demonstration Script
## Track 2: "Is this Packaging Artwork ready to launch?"
**Live Workspace Demonstration & Prepress Audit Flow**

---

### [00:00 – 00:25] Opening Pitch & Core Problem
**Visual:** Browser starts at PackSignal Home (`http://localhost:4173/`).
**Presenter:**
> *"Packaging recalls cost millions and delay launches. Why? Because packaging errors happen when product sources, regulatory rules, and artwork files drift apart.*
> *BriefForge and traditional tools try to generate design briefs. But in prepress and brand QA, the million-dollar question is: **Is this packaging artwork ready to launch?***
> *PackSignal is an evidence-first verification workspace. Every claim, nutrition number, and allergen is verified directly against raw source bytes, applicable regulatory rulebooks, and rendered PDF vector geometries."*

---

### [00:25 – 01:00] Official Organizer Dataset & Universal Evidence
**Action:** Click `[Run Dancing Fish Granola Organizer Case]` on Home. Review opens in under 2 seconds.
**Visual:** Review Overview renders 15 issues, 46 human reviews, 17 matches. Navigate to **Evidence & Sources** tab.
**Presenter:**
> *"Here is the official Esko competition dataset: Dancing Fish Granola Berry Crunch carton PDF and the US specification workbook.*
> *Notice our universal **Source Chips**: every fact displays its origin — like `[Content Sheet · US!B26]` or `[Carton · Back Panel]`.*
> *I click this Source Chip — and the **Evidence Drawer** slides out. Here is the verbatim character sequence extracted directly from the XLSX bytes, the exact cell coordinate `US!E8`, and the SHA-256 cryptographic hash.*
> *Crucially: notice the status badge: **'QUOTE VERIFIED'** but **'DRAFT / IN-REVIEW AUTHORITY'**. Unlike naive AI tools, PackSignal never equates reading a spreadsheet with corporate legal approval."*

---

### [01:00 – 01:40] Real Source Conflict & Side-by-Side Resolution Card
**Action:** Navigate to **Review Overview** / Findings tab. Select finding: `Ingredients discrepancy` or `Net Quantity conflict`.
**Visual:** Finding card renders with inline **Conflict Card** showing side-by-side Candidate A (Specification) vs Candidate B (Artwork).
**Presenter:**
> *"Look at this conflict card: Candidate A is the specification sheet declaring `450 g (15.8 oz)`. Candidate B is the artwork declaring `480 g (16.9 oz)`.*
> *PackSignal does not guess or hallucinate the answer. It shows both exact quotations, their sheet coordinates, and the 3 dependent downstream checks.*
> *The reviewer has 4 clear, audited actions: `[Use Source Value]`, `[Confirm Artwork as Intended Revision]`, `[Request Clarification]`, or `[Leave Unresolved]`.*
> *Let's confirm the artwork value as an intentional marketing revision."*

---

### [01:40 – 02:20] Guided Resolution & Dependency-Aware Impact Ripple
**Action:** Click `[Confirm Artwork as Intended Revision]`. Then navigate to **Resolve Questions** tab.
**Visual:** Active Blocker Question queue dynamically recalculates. Rule Traceability Map updates live.
**Presenter:**
> *"When that decision is confirmed, PackSignal doesn't just recolor a card. It triggers our **Source-Change Ripple Engine**:*
> *1. It invalidates stale approvals on dependent checks.*
> *2. It preserves completely independent allergen and barcode checks.*
> *3. It writes an immutable entry into the cryptographic audit trail.*
> *Here in the **Guided Questions Queue**, questions are categorized by blocker type: Source Authority, Nutrition Basis, and Claim Substantiation. Each question shows exactly how many checks it will unblock — for instance, 'May unblock 3 checks'. Answering this single question immediately clears the pipeline."*

---

### [02:20 – 02:55] 2D Artwork Red-Pen Overlay & Native PDF Preflight
**Action:** Navigate to **Artwork & Preflight** tab (or click `[Inspect 2D Artwork →]`).
**Visual:** PDF Canvas renders Page 1 with finding bounding overlays, strike-through markup, and preflight observations.
**Presenter:**
> *"Now let's examine the artwork itself. This is our 2D interactive canvas.*
> *Every defect detected in the ingredient statement is highlighted with coordinate-accurate bounding boxes. Clicking any defect immediately spotlights the exact text snippet in the PDF.*
> *Switch to **PDF Preflight**: PackSignal inspects native PDF streams: font embedding, minimum point sizes, cut lines, bleed boundaries, and CMYK color separation.*
> *Notice our dieline boundary screening: text too close to the crease line is flagged before plates are made."*

---

### [02:55 – 03:20] 3D Packaging Evidence Mapping
**Action:** Toggle `[3D Package Preview]` mode.
**Visual:** Interactive 3D folding carton renders with wrapped artwork textures and evidence pins.
**Presenter:**
> *"For packaging engineers and brand managers, 2D dielines can be hard to visualize. PackSignal maps confirmed 2D bounding boxes directly onto our 3D carton model.*
> *Rotate the pack: the Nutrition Facts table wraps cleanly on the Side Panel. The Back Panel displays our ingredient finding pin.*
> *This isn't an artistic rendering — it uses the actual diecut cut/crease layout from the artwork vector paths."*

---

### [03:20 – 03:45] Version Comparison: V1 vs V2 Verification
**Action:** Click `[Revisions & Corrections]` tab (or `🔀 Compare Artwork Revisions`).
**Visual:** Side-by-side or difference diff between V1 (Draft) and V2 (Revision).
**Presenter:**
> *"When the design agency submits revision V2, how do you know they actually fixed the defects without introducing new ones?*
> *PackSignal runs automated revision diffing: green indicates verified corrections; red flags regressions.*
> *The missing allergen warning was added correctly, while the approved brand identity was preserved untouched."*

---

### [03:45 – 04:00] Designer Handoff & Cryptographic Ed25519 Seal
**Action:** Navigate to **Reports & Audit** tab. Highlight **Designer Handoff & Correction Checklist** and click `[Export Inspection Certificate]`.
**Visual:** Signed JSON / PDF Certificate displays with Ed25519 signature hash and evidence coverage metrics.
**Presenter:**
> *"Finally, we generate the **Designer Correction Pack** — a structured, actionable handoff sheet with before/after copy, panel coordinates, and an acceptance checklist.*
> *Every review is sealed with an **Ed25519 digital signature** verifying the exact SHA-256 hash of all source files, rules, and reviewer decisions.*
> *Evidence-first, mathematically transparent, and production-tested. That is PackSignal."*

---

### Demo Backup Checklist & Safe States
- **Port:** Server runs on `http://localhost:4173`
- **Offline Reliability:** Deterministic verification runs 100% offline without requiring Gemini API tokens.
- **Official Sample:** Click `[Run Dancing Fish Granola Organizer Case]` on homepage for instant execution.
- **Key Tabs in Demo:**
  1. `Evidence & Sources` (SourceChips, Evidence Drawer, Ingredient Diff)
  2. `Resolve Questions` (Blocker question queue)
  3. `Rules & Trust` (Rule Traceability Map)
  4. `Artwork & Preflight` (2D Red-Pen Canvas & 3D Carton)
  5. `Reports & Audit` (Designer Handoff & Cryptographic Seal)
