# "Spot the Mistakes" — 30-Second Judge Challenge Script

## Executive Overview
**PackSignal** transforms packaging review from a slow, error-prone manual scan into a source-grounded, deterministic proof chain. 
The **"Spot the Mistakes"** opener challenges judges to inspect the official **Dancing Fish Granola Berry Crunch** packaging carton for 30 seconds, before revealing what PackSignal's verification engine actually found.

---

## Scene 1: The Challenge (0:00 – 0:30)

### Presenter Action:
1. Click **`[Start Judge Demo]`** from the topbar or home screen.
2. Full-screen presentation mode opens showing the official `DancingFish_Granola_Berry_US_Carton.pdf`.
3. Finding pins, bounding boxes, and answers are **strictly hidden**.
4. Press **`Space`** or click **`[Start Challenge]`**. The 30-second countdown begins (`00:30` -> `00:00`).

### Script:
> "Judges, take a look at this packaging carton. It’s the official Dancing Fish Granola Berry Crunch carton.
> You have 30 seconds. How many packaging problems can you find on this box?"

*(Presenter lets judges inspect the carton. Presenter can pan and zoom across key panels, or click the hotspot zones — Nutrition, Ingredients, Claims, Net Quantity).*

> "Time's up. How many did you spot? One? Two? Maybe the vegan claim or the ingredient order?
> Now, let’s see what PackSignal's verification engine actually found."

---

## Scene 2: The Reveal (0:30 – 1:00)

### Presenter Action:
1. Click **`[Reveal with PackSignal]`** (or press **`R`**).
2. Choose **`Mode A: Run Fresh Analysis`** for a live scan with real progress and monotonic timing, or **`Mode B: Open Previously Verified Review`** for instant presentation.
3. The scoreboard animates in showing real adjudicated counts.

### Script:
> "When we click **Reveal with PackSignal**, our engine doesn't guess or use a black-box LLM. It parses the actual native PDF vector paths, glyph bounding boxes, and links them against the official product formulation spreadsheet.
> 
> Look at the scoreboard:
> - **16 Targeted Checks Evaluated**
> - **10 Confirmed Issues**
> - **5 Items Requiring Human Review**
> - **1 Verified Match**
> - **1 Barcode Positive Control (Passed)**
> 
> Notice that we do **NOT** claim 16 defects. A positive control barcode check digit is not a mistake — it verifies print scanability. And review warnings are not confirmed violations because the formulation spreadsheet itself is marked `Draft / In Review`."

---

## Scene 3: Proof Chain Drill-Down (1:00 – 2:00)

### Presenter Action:
1. Highlight **DF-01 (Honey Percentage Discrepancy)**:
   - Artwork displays: `Honey (1%)`
   - Source Sheet Cell B26 displays: `Honey (9%)`
   - Rule: `FDA 21 CFR §101.4`
2. Highlight **DF-04 (No Added Sugar Claim Non-Compliance)**:
   - Front panel displays: `NO ADDED SUGAR`
   - Formulation contains Honey (mono/disaccharide) + Sugar Alcohols.
   - Rule: `21 CFR §101.60(c)(2)`
3. Highlight **DF-10 (Atwater Calorie Macro Arithmetic)**:
   - Declared calories: `180 kcal`
   - Calculated 4-4-9: `4g protein×4 + 6g fat×9 + 29g carb×4 = 186 kcal`
   - Rule: `21 CFR §101.9(c)(1)(i)(C)` — within ±20% statutory tolerance, requires laboratory basis confirmation.

### Script:
> "Every finding in PackSignal connects directly to verifiable evidence:
> 
> 1. **Honey Percentage**: The front and back of the box say 1% honey, but Cell B26 of the product spreadsheet specifies 9% honey. That is an 8-point discrepancy that changes recipe costs and consumer perception.
> 2. **No Added Sugar**: The front prominently claims 'No Added Sugar', but honey is chemically a mono/disaccharide. Under 21 CFR §101.60, claiming no added sugar when adding honey is a regulatory violation.
> 3. **Nutrition Arithmetic**: The Nutrition Facts panel declares 180 calories. But when we compute the Atwater macronutrient factors — 4 kcal per gram of protein, 9 per fat, 4 per carb — the sum is 186 kcal. PackSignal validates the math deterministically."

---

## Scene 4: Transitions to PackSignal Capabilities (2:00 – 3:30)

### Presenter Action:
1. Click **`[👥 Shopper Personas]`**:
   - Filter by **Nut Allergy** (DF-03 advisory statement).
   - Filter by **Vegan** (DF-05 honey vs vegan conflict).
   - Filter by **Sugar Watcher** (DF-04 added sugar claim).
2. Click **`[⚡ Decision Ripple]`**:
   - Show simulated resolution: *Keep Honey, Remove Vegan Claim* vs *Remove Honey, Keep Vegan Claim*.
3. Click **`[🔍 Prepress Proof]`**:
   - Show native PDF preflight: hidden EU nutrition table layers, font point size compliance, Total Area Coverage (TAC).
4. Click **`[📦 3D Package]`**:
   - Show interactive 3D folding carton with pinned finding coordinates.
5. Click **`[🏆 Trust Scoreboard]`**:
   - Show the 31-mutation benchmark demonstrating synthetic defect catch rates.
6. Click **`[📜 Export Evidence Report]`**:
   - Download the cryptographic Ed25519-signed inspection certificate.

---

## Handling Uncertainties & Difficult Questions

### Q: "Why isn't this 16 out of 16 defects?"
> **Answer:** "In real-world packaging engineering, claiming 16 defects would be fraudulent. The source content sheet provided by the brand is explicitly marked `Draft / In Review`. When a source is unconfirmed, discrepancies are classified as **NEEDS HUMAN REVIEW**, not confirmed legal non-compliance. Furthermore, check P01 is a positive control for the UPC barcode check digit (UPC `120000000036`), which passes cleanly. We never conflate positive controls with errors."

### Q: "How fast is PackSignal really?"
> **Answer:** "Our deterministic engine evaluates all 16 checks and regulatory rules in **tens of milliseconds** (`engineMs`). Total PDF and spreadsheet extraction takes between 300ms to 2.5 seconds depending on document size. We record monotonic timestamps using `node:perf_hooks` and never invent or hardcode 0.8 seconds."
