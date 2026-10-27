# PackSignal — Judge Quickstart Guide (60-Second Walkthrough)

> **Core Mission**: PackSignal verifies packaging artwork against source-backed product specifications and company rulebooks. Every finding contains traceable coordinates in the original PDF, source conflicts remain under explicit human review, and reviews are cryptographically signed with Ed25519.

---

## 1. Where to Open the Application

- **Local Development / Offline Validation**: `http://127.0.0.1:4173/` (via `npm run dev` or `npm start`)
- **Docker Container**: `docker run -p 4173:4173 packsignal` -> `http://127.0.0.1:4173/`
- **Hosted Cloud Demonstration**: `https://packsignal.onrender.com/` *(Free-tier spun down if idle; please allow 45s for container wakeup. Healthcheck verified at `/healthz`)*

---

## 2. Secure Access Instructions

PackSignal implements **fail-closed team authentication**:
- **Public endpoints**: `/` (hero preview) and `/healthz` (container liveness without secrets).
- **Protected operations**: Creating reviews, viewing confidential artwork, mutating decisions, and downloading signed audit reports require authorization.
- **Judge Access**: Use the authorized review workspace credentials provided via the private judging portal / submission notes (or when running locally with default dev config). **No secret credentials or API tokens are stored in this repository or in client-side bundles.**

---

## 3. The 60-Second Judge Path

### Step 1: Open the Official Organizer Sample (Dancing Fish Granola)
1. On the homepage, click **"Explore organizer sample"** (loads official Esko files: `DancingFish_Granola_Berry_US_Carton.pdf` and `DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx`).
2. Click the **"Sources"** tab in the top navigation.
3. Observe **Draft / Conflicting Status**: The spreadsheet contains draft copy and conflicting serving sizes. PackSignal refuses to guess or invent failures, marking them as `AMBIGUOUS_SOURCE` requiring human clarification.

### Step 2: 🏆 Inspect the Trust Console (Phase 8 Feature Freeze)
1. Click the green **"🏆 Trust Console"** button in the review header.
2. View **Defect Recall: Caught 21 of 21 (100% Recall)**, **0 False Alarms**, and **0.9ms Latency**.
3. Click the **"Model Bake-Off"** subtab: see benchmark comparison designating `gemini-3.8-flash` as winner ($0.28/1k, 1,120ms).
4. Click **"▶ Run Self-Test Suite"** to watch the deterministic runner evaluate all categories live.

### Step 3: Open the Controlled Mismatch Case (Fieldday V1)
1. Click **"Load Fieldday V1"** (or use the sample selector).
2. Click the **"Findings"** tab.
3. Click on the finding: **"Net Quantity: 1000 mL (Source) vs 750 mL (Artwork)"**.
4. Observe the side-by-side evidence:
   - **Expected**: `1000 mL` (traceable to approved specification table).
   - **Observed**: `750 mL` (extracted directly from artwork layer).
   - **Status**: Deterministic mismatch flagged with 100% precision without needing AI.

### Step 4: Inspect Interactive Artwork Evidence & 3D Packaging Studio
1. In the finding panel, look at the **Artwork Canvas**.
2. Notice the PDF is rendered with precise bounding boxes highlighting the exact coordinate `[x, y, w, h]` on the physical carton face.
3. Switch to **"📦 Inspect in 3D Packaging Studio"** to rotate the closed 3D carton with findings pinned to the faces.

### Step 5: Native PDF Preflight & Technical Screening
1. Switch to the **"PDF Preflight"** tab.
2. Review technical layer inspection:
   - Font size measurements (points/mm) relative to regulatory minimums (FDA 21 CFR §101.105).
   - TrimBox / BleedBox / MediaBox boundaries.
   - Text occlusion or hidden non-printing text.
3. *Note*: This is technical prepress screening, not a substitute for print certification.

### Step 6: Record Reviewer Decision & Generate Correction Ticket
1. In the finding actions, click **"Request Change"** or **"Approve"**.
2. Enter reviewer remarks (e.g., *"Change net quantity to 1000 mL per approved spec"*).
3. Click **"Generate Ticket"**: An evidence-backed reviewer correction ticket is generated with deep links and exact bounding box coordinates.
4. Decisions are persisted atomically to `/var/data` disk storage.

### Step 7: Revision Comparison (V1 vs V2)
1. Click the **"Revisions"** tab.
2. Select **Fieldday V2** as the target revision.
3. The Visual Diff Studio displays:
   - **Corrected Issues**: Net quantity successfully updated to `1000 mL`.
   - **Detected Regressions**: Any newly introduced discrepancies highlighted in red.
   - Interactive slider and onion-skin overlay for visual pixel-level comparison.

### Step 8: Export & Verify Cryptographically Signed Audit Report
1. Click **"Export Inspection Certificate"** or download **Signed JSON ↓**.
2. The report embeds the Ed25519 signature and SHA-256 evidence merkle root.
3. Run the automated verifier:
   ```bash
   node scripts/verify-report.mjs path/to/downloaded-report.json
   ```
4. Output confirms: `[VERIFIED] Signature valid, tamper-evident audit seal intact.`

---

## 4. What PackSignal Explicitly Does NOT Claim

To maintain strict scientific and regulatory honesty:
1. **No Legal Certification**: PackSignal screens packaging artwork for discrepancy against provided inputs; it does not constitute legal or regulatory certification.
2. **No Guaranteed Print Readiness**: Technical preflight scans for vector/font anomalies, but prepress plate production requires final operator sign-off.
3. **No Unbounded AI Hallucination**: AI is strictly optional and sandboxed behind deterministic fallback logic. When offline or unconfigured, 100% of core rulebook, nutrition, barcode, and spec checks execute deterministically.
