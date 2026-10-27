# PackSignal — 10-Minute Campus Rehearsal Presentation Script

**Document**: `docs/campus/DEMO_10_MINUTES.md`  
**Purpose**: Timed script, scene progression, fallback contingency paths, and presenter cues for the campus evaluation presentation.  
**Total Target Time**: 09:45 (with 15s buffer for 10:00 maximum limit)  
**Presenter Hotkeys**:
- `Space` / `→`: Next Scene
- `←`: Previous Scene
- `R`: Safe Rehearsal Reset
- `M`: Toggle US / India Market
- `F`: Reveal Findings
- `L`: Toggle English / Hindi UI
- `Esc`: Close Overlays / Return to Navigator

---

## Presentation Timeline

### 0:00–1:00 | Scene 1: Spot the Mistakes Opener
- **Presenter Spoken Cue**:
  > "Welcome judges. Every packaging recall starts with small discrepancies between brand briefs, spreadsheets, and the printed carton. On your table is our physical carton prop for Dancing Fish Berry Crunch. Take ten seconds: can anyone spot what is legally dangerous about this box?"
- **Action**:
  - Hold up physical Berry Crunch carton prop.
  - Display initial clean carton view on projector screen.
  - Press `F` or click `[Reveal PackSignal Findings]`.
  - Ten verified compliance findings highlight on the carton.
- **Key Message**: "Human proofreaders take 45 minutes and miss subtle cross-panel conflicts; PackSignal's deterministic verification engine flags them in under a second."
- **Contingency Matrix**:
  - *Primary Path*: Interactive 30s timer with live animated finding pin reveal.
  - *Fallback Path*: Static 2D finding overview cards.
  - *Skip Condition*: Audience asks to jump directly into technical extraction.
  - *Reentry Point*: Transition directly to Evidence Desk (`Space`).

---

### 1:00–2:00 | Scene 2: Evidence Desk
- **Presenter Spoken Cue**:
  > "PackSignal never operates as a black box. Behind every check is a real document. Here in the Evidence Desk, we ingest the original vector PDF carton, the lab formulation Excel, and the regulatory specification."
- **Action**:
  - Click on the Net Quantity finding.
  - Show the split screen: PDF Principal Display Panel on the left, Excel formula sheet cell `C14` on the right.
  - Highlight the exact bounding box and cell coordinate.
- **Key Message**: "Zero hallucination: every claim is anchored to a SHA-256 verified document coordinate."
- **Contingency Matrix**:
  - *Primary Path*: Interactive side-by-side PDF and Excel viewport with highlight synchronizer.
  - *Fallback Path*: Cached coordinate inspection drawer.
  - *Skip Condition*: None (core workflow requirement).
  - *Reentry Point*: Proceed to Fact Sheet.

---

### 2:00–3:00 | Scene 3: Fact Sheet & Reviewer Questions
- **Presenter Spoken Cue**:
  > "Discrepancies don't fix themselves; they require cross-functional decisions. Here is our Verified Fact Sheet, grouping canonical facts from marketing, legal, and QA."
- **Action**:
  - Show the serving size discrepancy: 30g serving vs 45g formulation.
  - Open the Reviewer Question: "Which serving basis is approved for final production?"
  - Select "Approve 45g formulation basis" and click `Save Decision`.
  - Show the cryptographic audit event recorded in the immutable ledger.
- **Key Message**: "We turn regulatory uncertainty into clear, accountable reviewer decisions."
- **Contingency Matrix**:
  - *Primary Path*: Live interactive question resolution with audit badge update.
  - *Fallback Path*: Pre-saved reviewer scenario playback.
  - *Skip Condition*: Time running ahead of schedule (> 3:15).
  - *Reentry Point*: Proceed to Red Pen Markup.

---

### 3:00–4:00 | Scene 4: Red Pen Review & Department Sticky Notes
- **Presenter Spoken Cue**:
  > "Designers don't read raw JSON; they work with red pen markups. With one click, PackSignal transforms findings into prepress annotations."
- **Action**:
  - Toggle from `Clean Artwork` to `Marked Proof`.
  - Point to regulatory callouts, allergen flags, and department sticky notes (Legal in Amber, Regulatory in Blue, QA in Green).
  - Show how comments stay anchored during pan and zoom.
- **Key Message**: "Standardized, role-filtered prepress feedback that speaks the packaging team's language."
- **Contingency Matrix**:
  - *Primary Path*: Dynamic SVG red pen markup overlay with interactive sticky notes.
  - *Fallback Path*: High-resolution pre-rendered marked proof PNG.
  - *Skip Condition*: If audience focuses on CAD geometry.
  - *Reentry Point*: Proceed to Pack Canvas.

---

### 4:00–5:00 | Scene 5: Pack Canvas & Live Content Fitting
- **Presenter Spoken Cue**:
  > "When regulatory text expands, will it still physically fit on the carton? Let's test Pack Canvas."
- **Action**:
  - Click on the back panel nutrition callout.
  - Increase the statutory disclaimer text length to simulate mandatory bilingual warnings.
  - Visual Overlap Shield highlights text boundary collision in red.
  - Click `Apply Layout Fix`: text auto-reflows into approved multi-column zone without violating dieline margins.
- **Key Message**: "PackSignal prevents costly pre-press rejections before plates are engraved."
- **Contingency Matrix**:
  - *Primary Path*: Live canvas reflow simulation with zone boundary detection.
  - *Fallback Path*: Before/after comparison wipe slider.
  - *Skip Condition*: If behind schedule.
  - *Reentry Point*: Proceed to India Market Switch.

---

### 5:00–6:00 | Scene 6: India Market Switch & English/Hindi UI
- **Presenter Spoken Cue**:
  > "Global brands deploy across multiple jurisdictions. Watch what happens when we switch our market from US FDA to India FSSAI & Legal Metrology."
- **Action**:
  - Press `M` or select `India (FSSAI)`.
  - Watch rule engine re-evaluate: FDA Net Weight in oz is flagged; mandatory FSSAI Green Vegetarian Logo and MRP declaration rules activate.
  - Press `L` or toggle language to `हिन्दी (Hindi)`.
  - UI navigation, requirement explanations, and questions seamlessly translate into authentic Devanagari Unicode text without losing rule IDs.
- **Key Message**: "Data-driven regulatory engine supporting multilingual packaging workflows."
- **Contingency Matrix**:
  - *Primary Path*: Instant client-side locale switch with dynamic Devanagari font rendering.
  - *Fallback Path*: English India market rules view with static bilingual comparison card.
  - *Skip Condition*: None.
  - *Reentry Point*: Proceed to Second Product.

---

### 6:00–7:00 | Scene 7: Second Product Demonstration (Amrit Organic Chai)
- **Presenter Spoken Cue**:
  > "PackSignal is not a hardcoded demo for one cereal box. Here is our second product: Amrit Organic Masala Chai—an Indian tea carton with bilingual English and Hindi packaging."
- **Action**:
  - Switch product selector to `Amrit Chai · Masala Blend`.
  - Show distinct files: `AmritChai_Masala_IN_Carton.pdf`, `AmritChai_Content_Sheet.xlsx`, `AmritChai_Product_Spec.docx`.
  - Show real extraction: Devanagari numerals (`२०० ग्राम`) arithmetic comparison against English `250 g`, and FSSAI 14-digit licence verification.
- **Key Message**: "Proven multi-category adaptability with distinct brand geometry and statutory rules."
- **Contingency Matrix**:
  - *Primary Path*: Live review session switch to preloaded `campus-product-2` fixture.
  - *Fallback Path*: Amrit Chai inspection panel in Campus Extras.
  - *Skip Condition*: None (critical proof point).
  - *Reentry Point*: Proceed to 3D/AR.

---

### 7:00–8:15 | Scene 8: 3D Pack View / AR On Your Table
- **Presenter Spoken Cue**:
  > "Packaging lives in three dimensions. PackSignal folds the flat dieline into a true tuck-end carton in Three.js and projects finding pins onto the 3D surface."
- **Action**:
  - Switch to `3D Pack View`.
  - Animate fold slider from 0% (flat blank) to 100% (assembled 3D carton).
  - Orbit camera around the 3D package; click a finding pin to fly the camera directly to the offending panel.
  - Click `View on Your Table` to display the validated AR QR code and mobile viewer.
- **Key Message**: "Connecting 2D vector CAD dielines to spatial retail reality."
- **Contingency Matrix**:
  - *Primary Path*: Three.js WebGL folding animation and camera fly-to; WebAR mobile preview.
  - *Fallback Path*: Pre-rendered 360-degree turntable view or high-res 2D annotated proof.
  - *Skip Condition*: WebGL unsupported on projector machine -> automatic 2D proof fallback.
  - *Reentry Point*: Proceed to Brief & Trust Console.

---

### 8:15–9:15 | Scene 9: Approved Brief, A3 Poster & Trust Console
- **Presenter Spoken Cue**:
  > "Once all findings are resolved, PackSignal generates an Evidence-Audited Creative Brief and our print-ready A3 Review Poster."
- **Action**:
  - Show the Approved Brief with tamper-evident cryptographic hash signature.
  - Display the generated single-page 420 × 297 mm A3 Review Poster with vector pins and numbered legend.
  - Open `Trust Console`: show 100% precision and recall metrics across our test suites with zero hallucinated defect claims.
- **Key Message**: "Full provenance: from raw vendor input to legally defensible release artifact."
- **Contingency Matrix**:
  - *Primary Path*: Live modal viewing of generated PDF brief and Trust Console scoreboard.
  - *Fallback Path*: Pre-generated PDF downloads.
  - *Skip Condition*: None.
  - *Reentry Point*: Proceed to Close.

---

### 9:15–10:00 | Scene 10: Physical Props Showcase, Safe Reset & Close
- **Presenter Spoken Cue**:
  > "From the physical carton on your table to the spatial 3D model, the bilingual rule engine, and the cryptographically signed release brief—PackSignal gives packaging teams absolute certainty before printing millions of units."
- **Action**:
  - Hold up both physical cartons (Berry Crunch and Amrit Chai) and the laminated A3 review poster.
  - Press `R` or click `[Reset Campus Demo]`.
  - Point out that demo returns instantly to clean state in < 50ms without deleting production records.
  - Conclude and invite judge questions.
- **Key Message**: "Reproducible, trustworthy, and ready for deployment."
- **Contingency Matrix**:
  - *Primary Path*: Live instant reset verified on screen.
  - *Fallback Path*: Manual scene 1 return.
  - *End of Session*: Stand by for Q&A.
