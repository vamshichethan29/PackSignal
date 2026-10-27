# PackSignal — Video Demonstration QA & Preflight Checklist

This checklist must be audited prior to recording, uploading, and finalizing any demonstration video for hackathon judges and evaluation panels.

---

## 1. Video Technical Specifications
- [x] **Aspect Ratio**: 16:9 widescreen format.
- [x] **Resolution**: Minimum 1080p (1920x1080) or 4K. Text in source documents, bounding boxes, and code must be crisp and easily legible.
- [x] **Frame Rate**: Minimum 30 fps (60 fps recommended for smooth 3D carton rotation).
- [x] **Duration**: Strictly between **3:00 and 5:00 minutes** (Target pacing: 4 minutes 15 seconds).
- [x] **Audio Quality**: Clear voiceover narration; microphone leveled without distortion, background hiss, or echo.

---

## 2. Environment & Recording Hygiene
- [x] **Clean Browser Session**: Dedicated Incognito/Guest Chrome window without extraneous extensions, bookmarks, or download shelves.
- [x] **No Visible Secrets**: Zero API keys, environment files (`.env`), passwords, or private signing keys displayed on screen.
- [x] **Zero Distractions**: Do Not Disturb enabled; system notifications, Slack/messaging alerts, and background popups muted.
- [x] **No Console Clutter**: Browser developer tools closed unless explicitly demonstrating client-side network offline resilience.
- [x] **Local & Live URL Consistency**: Screen visibly displays local `http://127.0.0.1:4173` or hosted `https://packsignal.onrender.com/` without DNS or connectivity errors.

---

## 3. Workflow & Functional Demonstration Gates
- [x] **Document Ingestion**: Demonstrates real uploading of official Dancing Fish sample files (`PDF`, `XLSX`, `DOCX`).
- [x] **Fact Sheet & Quote Check**: Explicitly zooms in on character-level quote verification and source document bounding boxes.
- [x] **Regulatory & Prepress Finding**: Shows real violations caught by deterministic rule packs (FDA 21 CFR PDP type height, Prepress TAC overprint).
- [x] **Reviewer Interaction**: Resolves an ambiguity question with live dependency ripple and re-evaluation.
- [x] **2D & 3D Visual Proofing**: Rotates 3D tuck-end carton; demonstrates camera fly-to on 3D finding pins.
- [x] **Audited Export**: Generates Creative Brief / HTML Report; verifies Ed25519 cryptographic seal v2 live.
- [x] **Trust Console**: Opens `/trust`, displaying 21 synthetic test mutations, reproducible metrics, and model bake-off results.

---

## 4. Deliverable Verification & Public Accessibility
- [x] **Hosting Verification**: Existing demonstration recording reference: `https://www.loom.com/share/bfbb94f094344b0fa22baa7ead1a8970`.
- [x] **Access Permissions**: Video URL confirmed viewable in an unauthenticated private browser session without requiring a Loom account login.
- [x] **Accurate Representation**: Video accurately portrays real, implemented capabilities without fabricated metrics or misleading mockups.
- [x] **Closing Statement**: Features the official release summary:
  > *"PackSignal turns packaging artwork review into an evidence-backed workflow, connecting source documents, regulatory requirements, reviewer decisions and exported proof."*
