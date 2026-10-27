# PackSignal — Campus Presentation Packing List & Field Readiness Checklist

**Document**: `docs/campus/PACKING_LIST.md`  
**Purpose**: Pre-travel hardware, documentation, contingency media, and offline readiness checklist for the campus evaluation round.  
**Author**: Presentation Technical Director & Release Engineering  
**Revision**: 1.0 (October 2026)

---

## 1. Primary Presentation Hardware

| Item | Status | Verification Check | Notes |
| :--- | :---: | :--- | :--- |
| **Primary Laptop** | [ ] | MacBook Pro / Development Machine with tested local Node.js environment | Full battery charge; screen brightness calibrated |
| **Laptop Charger & AC Cable** | [ ] | Apple MagSafe / 140W USB-C brick + grounded 3-prong extension | Long cord (3m+) for distant venue outlets |
| **Multi-Port Presentation Hub** | [ ] | USB-C to 4K HDMI, USB-A, and Gigabit Ethernet | Test output on 1080p and 4K external monitors |
| **Presentation Remote / Clicker** | [ ] | Wireless presenter remote with laser pointer + spare AAA batteries | Verify forward/back maps to Arrow keys in browser |
| **Ergonomic Mouse & Mousepad** | [ ] | Wireless mouse with smooth tracking surface | For precision red pen and 3D camera control |
| **AR Demonstration Smartphone** | [ ] | iPhone / Android device with Safari/Chrome WebAR and camera permissions | Screen timeout set to 'Never'; DND enabled |
| **Phone Charging Cable & Brick** | [ ] | High-speed USB-C to Lightning / USB-C cable | Kept plugged in at presenter desk |
| **High-Capacity Power Bank** | [ ] | Anker 24,000 mAh (65W USB-C PD output) | Ensures full independence from venue wall outlets |
| **Independent Mobile Hotspot** | [ ] | 5G Phone Tether / Dedicated MiFi Hotspot | **Never rely exclusively on venue Wi-Fi** |

---

## 2. Physical Packaging Props & Printed Media

| Item | Status | Specification | Purpose |
| :--- | :---: | :--- | :--- |
| **Assembled Carton: Berry Crunch** | [ ] | 140 × 210 × 60 mm tuck-end carton on 300 gsm cardstock | Primary tactile prop for Spot the Mistakes opener |
| **Assembled Carton: Amrit Chai** | [ ] | 100 × 150 × 50 mm bilingual Indian tea carton | Second-product demonstration prop |
| **Flat Dieline Blanks (Spares)** | [ ] | 2 scored flat blanks in protective portfolio | Demonstrating flat-to-3D transformation |
| **Printed A3 Review Posters** | [ ] | 2 laminated 420 × 297 mm ISO A3 sheets with vector callouts | Handed to judges during scene 9 |
| **Numbered Pin Stickers** | [ ] | 1 sheet of vinyl red round pin stickers (1–10) | Interactive prop exploration |
| **Weighted Mobile Phone Stand** | [ ] | Adjustable tabletop phone tripod | Stable camera angle for "View on Your Table" AR |

---

## 3. Software & Offline Verification Assets

| Asset | Local File Path | Verification Status |
| :--- | :--- | :---: |
| **Local Standalone Server** | `PORT=3000 node server.mjs` | Tested completely offline (`127.0.0.1:3000`) |
| **Source Release Archive** | `submission/packsignal-source.zip` | 12.27 MB verified clean-room bundle |
| **Official Sample Fixtures** | `samples/organizer/`, `samples/campus-product-2/` | Verified SHA-256 integrity |
| **Generated A3 Poster PDF** | `scratch/a3-poster-test.pdf` | Verified 420 × 297 mm single page |
| **System Architecture Diagram** | `docs/architecture-overview.png` | High-res vector architecture visual |
| **Full Backup Demo Video** | `submission/packsignal-campus-walkthrough.mp4` | 1080p 60fps walkthrough with audio |
| **Static Screen Backups** | `docs/campus/backup-scenes/` | High-res fallback slides for every scene |
| **Printed 10-Minute Cue Sheet** | `docs/campus/DEMO_10_MINUTES.md` | Laminated one-page presenter cue card |

---

## 4. Pre-Departure "Go / No-Go" Checklist

- [ ] **Airplane Mode Dry Run**: Disconnect Wi-Fi and Bluetooth on presentation laptop. Launch `npm run dev` and navigate through all 10 scenes in Chrome. All local routes, fixtures, and fallbacks must render flawlessly.
- [ ] **Display Resolution Test**: Plug into an external monitor using HDMI dongle. Check typography and layout at 1920×1080 and 2560×1440 scaling.
- [ ] **Safe Reset Rehearsal**: Trigger `[Reset Campus Demo]` twice consecutively. Verify database and transient directories return to pristine state in under 50ms.
- [ ] **Physical Props Inspection**: Ensure cartons are crisp, uncreased, and adhesives are intact.
- [ ] **Git Working Copy Clean**: `git status` clean on release commit; no uncommitted debug modifications.
