# Judge Presentation Guide — "Spot the Mistakes"

## Purpose
This document provides key timing, presentation notes, and structural guidelines for demonstrating PackSignal's **"Spot the Mistakes"** challenge to hackathon judges, packaging professionals, and technical evaluators.

---

## 1. Timing Breakdown

| Segment | Duration | Primary Focus |
|---|---|---|
| **Opener Challenge** | 0:30 | Judge interaction, silent scanning of official carton |
| **Reveal & Scoreboard** | 0:45 | Genuine check breakdown (10 issues, 5 reviews, 1 match, 1 positive control) |
| **Proof Drill-Down** | 1:15 | Honey %, No added sugar, Atwater math with exact cell/PDF citations |
| **Esko & Prepress Value** | 1:00 | Hidden PDF text, font pt measurements, 3D carton fold |
| **Trust & Export** | 0:30 | Ed25519 signed report, Mutation benchmark |
| **Q&A Buffer** | 1:00 | Answering technical questions on deterministic rules vs AI |

---

## 2. Presenter Shortcuts Reference

During Presentation Mode, presenters can operate the stage seamlessly without fumbling for the mouse:

- **`Space`**: Start or pause countdown timer.
- **`R`**: Trigger the verification reveal.
- **`N`**: Reveal the next finding in the queue and gently pan to its artwork coordinates.
- **`F`**: Exit presentation mode and jump directly to the comprehensive PackSignal Checks tab.
- **`Esc`**: Close presentation mode and return to the main workspace.

---

## 3. Key Differentiators to Emphasize

1. **No Hallucination**:
   PackSignal is not an LLM chat prompt that guesses packaging problems. It parses actual font glyph geometries, bounding boxes, spreadsheet cells, and evaluates deterministic mathematical rules.
2. **Honest Metrics**:
   We do not claim 16 defects. We evaluate 16 targeted candidate checks:
   - 10 Confirmed Issues
   - 5 Needs Human Review (due to draft source authority)
   - 1 Verified Match
   - 1 Barcode Positive Control (UPC 120000000036 passes)
3. **Monotonic Timing**:
   Timings are recorded using `performance.now()`. Total review processing is transparently separated from deterministic engine execution time.
4. **Physical Prepress & 3D Integration**:
   Detects hidden EU nutrition layers buried in native PDF vector streams that 2D raster OCR tools completely miss.
