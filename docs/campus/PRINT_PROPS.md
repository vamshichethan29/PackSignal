# PackSignal — Physical Carton Props & Print Production Checklist

**Document**: `docs/campus/PRINT_PROPS.md`  
**Purpose**: Production and assembly specification for physical packaging demonstration props in the campus evaluation round.  
**Author**: Packaging Experience Designer & Release Engineering  
**Revision**: 1.0 (October 2026)

---

## 1. Carton Prop Specifications

### Prop A: Dancing Fish Organic Berry Crunch (Primary Prop)
- **Product**: Dancing Fish Berry Crunch Granola (US Market)
- **Artwork Source**: `samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf`
- **Source SHA-256**: `d7f3e8b0a991c4d21e84a27f...` (Verified canonical fixture)
- **Carton Style**: Straight Tuck-End (STE) Folding Carton with Dust Flaps
- **Physical Dimensions (Folded)**:
  - Width ($W$): 140.0 mm
  - Height ($H$): 210.0 mm
  - Depth ($D$): 60.0 mm
- **Flat Blank Size**: 412.0 mm × 286.0 mm (fits within standard A3 sheet)
- **Paper Stock**: 280–320 gsm Heavyweight Coated Matte Board / SBS Paperboard

### Prop B: Amrit Chai Masala Blend (Second Product Prop)
- **Product**: Amrit Organic Masala Chai (India Market — Bilingual EN/HI)
- **Artwork Source**: `samples/campus-product-2/AmritChai_Masala_IN_Carton.pdf`
- **Carton Style**: Reverse Tuck-End (RTE) Carton
- **Physical Dimensions (Folded)**:
  - Width ($W$): 100.0 mm
  - Height ($H$): 150.0 mm
  - Depth ($D$): 50.0 mm
- **Flat Blank Size**: 314.0 mm × 224.0 mm (fits within standard A3 or oversized A4)
- **Paper Stock**: 250–300 gsm Uncoated Kraft or White Board

---

## 2. Print & CAD Layer Conventions

| Layer Name | Stroke / Swatch | Stroke Weight | Purpose |
| :--- | :--- | :--- | :--- |
| **Artwork** | Process CMYK | Varied | Visual branding, copy, nutritional panels |
| **Cut Line** | Spot `DieCut` (100% Magenta) | 1.0 pt solid | Outer silhouette cutting contour |
| **Crease Line** | Spot `Crease` (100% Cyan) | 1.0 pt dashed (3mm dash / 2mm gap) | Score lines for folding creases |
| **Bleed** | Spot `Bleed` (100% Key/Black) | 0.5 pt solid | 3.0 mm bleed margin outside cut lines |
| **Annotations**| Spot `Annotation` (Orange) | 0.75 pt | Red pen reviewer callouts & pin anchors |

---

## 3. Print Production Checklist

- [ ] **Paper Format**: ISO A3 (420 mm × 297 mm) or ANSI Tabloid (11" × 17").
- [ ] **Print Scale**: Exactly **100% / Actual Size** (Disable "Fit to Printable Area" or "Shrink to Fit").
- [ ] **Page Orientation**: Landscape.
- [ ] **Color Management**: Direct PDF Passthrough / Fogra39 or sRGB; verify high contrast on fine statutory disclaimers.
- [ ] **Double-Sided**: Single-sided print for exterior graphics; optional interior reverse print for unprinted kraft effect.
- [ ] **Finishing**: Score all cyan dashed crease lines with a bone folder or blunt scoring wheel prior to folding.
- [ ] **Adhesive**: Apply 12 mm double-sided high-tack tape to the side glue tab (15 mm width).

---

## 4. Assembly & Folding Instructions

1. **Scoring**: Place the printed A3 sheet face-up on a cutting mat. Align a steel ruler along each dashed cyan crease line and firmly trace with a scoring stylus.
2. **Cutting**: Using a sharp X-Acto / utility knife, cut along all solid magenta outer boundary lines.
3. **Pre-Folding**: Gently break all scores outward to 90 degrees, then return to flat.
4. **Side Seam Bonding**: Apply adhesive along the glue tab (left edge). Align the side panel to form a rectangular sleeve and press firmly for 15 seconds.
5. **Base Closure**: Fold in bottom dust flaps first, followed by the bottom tuck flap and friction lock tab.
6. **Top Closure**: Keep the top tuck flap accessible during presentation to show interior structure if requested.

---

## 5. Physical Props Packing Manifest

| Item | Qty | Location / Container | Notes |
| :--- | :---: | :--- | :--- |
| Pre-assembled Berry Crunch 3D Carton | 2 | Rigid prop box | Primary demo prop with interactive pins |
| Pre-assembled Amrit Chai 3D Carton | 1 | Rigid prop box | Second-product bilingual comparison |
| Flat Scored Dieline Sheets (Spares) | 2 | A3 portfolio folder | Flat sheet inspection & tactile demo |
| Laminated A3 Review Posters | 2 | A3 portfolio folder | Vector marked proof with numbered legend |
| Numbered Finding Marker Stickers | 1 sheet | Presenter pouch | Physical pin stickers matching digital UI |
| Presentation Mobile Phone Stand | 1 | Tech bag | For AR table camera demonstration |
| USB-C to HDMI 4K Display Adapter | 1 | Tech bag | Direct projector connection |
| Backup High-Capacity Power Bank | 1 | Tech bag | Anker 24,000 mAh |

---

## 6. Truth in Presentation Note
The dimensions and panel layouts in this document correspond directly to the vector dielines in `samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf` and `samples/campus-product-2/AmritChai_Masala_IN_Carton.pdf`. If exact commercial finishing dies are unavailable at the venue, props must be identified as **"Physical Review Prototypes derived from verified CAD geometry"**.
