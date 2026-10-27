# PackSignal — Test-Driven Judge Demonstration Script
## Esko AIForge Track 2: "Is this Packaging Artwork ready to launch?"
**Live Workspace Demonstration & Prepress Audit Flow**

---

### Demonstration Overview & Operating Modes
- **Server URL:** `http://localhost:4173/` (Node.js 24 ESM, native REST API)
- **AI Operating Mode:** `OFFLINE_DETERMINISTIC` by default (Gemini optional; zero network dependency during live presentation)
- **Official Dataset:** Dancing Fish Granola Berry Crunch (PDF Artwork + US Content Sheet XLSX)
- **Demo Target Duration:** 3–5 minutes

---

### Step-by-Step 15-Point Walkthrough Sequence

#### 1. Home Page & Verification Health (`00:00 - 00:20`)
- **Action:** Open `http://localhost:4173/`.
- **Narration:** *"Welcome to PackSignal. Traditional brief generators ask: 'What should we design?' In prepress and launch QA, PackSignal answers: **'Is this packaging artwork ready to launch?'** Notice the server status: 100% deterministic verification running locally on Node.js 24."*

#### 2. Official Esko Organizer Artwork & Source Loading (`00:20 - 00:45`)
- **Action:** Click `[Run Dancing Fish Granola Organizer Case]`.
- **Narration:** *"We load the official organizer case: Dancing Fish Granola Berry Crunch carton PDF and the US specification spreadsheet. In under 2 seconds, PackSignal runs 79 checks across identity, nutrition, allergens, and dieline geometries."*

#### 3. Source Spreadsheet & Universal Source Chips (`00:45 - 01:10`)
- **Action:** Click `[Evidence & Sources]` tab. Click any Source Chip, such as `[Content Sheet · US!B26]`.
- **Narration:** *"Every fact is anchored in raw file bytes. I click this Source Chip: the Universal Evidence Drawer slides open showing the exact cell coordinate `US!E8`, verbatim quotation, and SHA-256 cryptographic digest."*

#### 4. Real Source Ambiguity & Draft Authority Disclosure (`01:10 - 01:35`)
- **Action:** Point to the Evidence Drawer badges: `✓ QUOTE VERIFIED` and `DRAFT / IN-REVIEW AUTHORITY`.
- **Narration:** *"Notice this critical architectural distinction: the quotation is verified in the spreadsheet bytes, but its authority is **Draft / In-Review**. PackSignal never automatically promotes unapproved draft data to legal truth."*

#### 5. Verified Statutory Rule Quotation (`01:35 - 02:00`)
- **Action:** Click `[Rules & Trust]` tab. Inspect the Rule Traceability Map and citation table.
- **Narration:** *"Here in the Rule Trust Center, every rule traces back to primary statutory text (such as 21 CFR §101.4). Unverified or AI-invented rules remain proposed and are never executed without human sign-off."*

#### 6. Controlled Deterministic Discrepancy & Conflict Card (`02:00 - 02:25`)
- **Action:** Switch to `Review Overview` (Findings tab). Select the `Honey (1%) vs (9%)` or `Net Quantity (450g vs 480g)` finding.
- **Narration:** *"Here is an empirical mismatch: the draft sheet specifies 1% honey; the artwork declares 9%. Our Side-by-Side Conflict Card shows Candidate A vs Candidate B and provides 4 audited reviewer actions."*

#### 7. Artwork-Level Evidence & 2D Red-Pen Canvas (`02:25 - 02:50`)
- **Action:** Click `[Inspect 2D Artwork →]`.
- **Narration:** *"The 2D canvas spotlights the defect with vector-accurate bounding boxes. We inspect the actual PDF page without altering its source bytes."*

#### 8. Native PDF Preflight Observation (`02:50 - 03:10`)
- **Action:** Toggle to PDF Preflight mode or view Crease Margin Screening.
- **Narration:** *"PackSignal inspects font embedding, minimum type size, and dieline boundaries. Text encroaching on the glue flap or fold line is flagged before printing plates are etched."*

#### 9. Cleared Check with Proof of Equality ("Not Flagged, & Why") (`03:10 - 03:30`)
- **Action:** Select a `MATCH` finding (e.g. Storage instructions or Barcode check digit).
- **Narration:** *"A key differentiator: PackSignal explains what PASSED and why. Look at the Cleared Proof box: it proves exact string equality, barcode checksum validity, and explicitly discloses that technical dieline cut marks were ignored from consumer copy checks."*

#### 10. Reviewer Decision & Immutable Audit Ledger (`03:30 - 03:50`)
- **Action:** Record a decision (e.g. `[Confirm Intended Marketing Revision]`).
- **Narration:** *"When a reviewer confirms an intended revision, the decision is recorded with user identity and timestamp. Dependent approvals are rechecked while independent checks remain intact."*

#### 11. Corrected V2 Artwork Comparison (`03:50 - 04:10`)
- **Action:** Open `[Revisions & Corrections]` tab (`🔀 Compare Artwork Revisions`).
- **Narration:** *"When the agency delivers V2, PackSignal compares revisions automatically: green highlights verified corrections; red flags any regressions."*

#### 12. New Revision Regression Detection (`04:10 - 04:25`)
- **Narration:** *"If V2 introduced a typo in the brand identity while fixing the honey percentage, the engine immediately flags the regression."*

#### 13. Cryptographically Signed Report & Designer Correction Pack (`04:25 - 04:45`)
- **Action:** Click `[Reports & Audit]` tab. Highlight **Designer Handoff & Checklist** and click `[Export Inspection Certificate]`.
- **Narration:** *"Instead of an ungrounded design brief, PackSignal exports a **Designer Correction Pack** with exact defect tickets, observed vs. expected text, and an acceptance checklist — sealed with an Ed25519 digital signature."*

#### 14. Actual Passing Test Results (`04:45 - 05:00`)
- **Narration:** *"All verification logic is backed by 992 automated tests, 21-case synthetic regression matrices, real-file answer key evaluation (100% pass rate), and Playwright browser E2E tests."*

#### 15. Transparent Limitations Disclosure (`05:00 - 05:15`)
- **Narration:** *"Finally, PackSignal maintains total legal honesty: we provide prepress and regulatory screening assistance; we do not claim FDA certification or print guarantees. Every limitation is published in the signed certificate."*

---

### Emergency Live Demo Backup
If internet connectivity is restricted:
- All features run 100% locally on `localhost:4173`.
- No Gemini API key or external cloud connectivity is required.
- To run self-test evaluation live:
  ```bash
  npm run evaluate:known
  ```
