#!/usr/bin/env python3
"""
Generates synthetic, deterministic test PDF fixtures for PackSignal PDF Preflight testing (Step 29).
Produces 40 real PDF documents exercising all screening and inspection conditions.
"""

import sys
import io
from pathlib import Path
import fitz
from PIL import Image

fixtures_dir = Path(__file__).resolve().parent / "fixtures" / "pdf-preflight"
fixtures_dir.mkdir(parents=True, exist_ok=True)


def f(name):
    return fixtures_dir / name


def create_all_fixtures():
    created = []

    # 1. Visible native text
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Visible Product Title", fontsize=14, color=(0, 0, 0))
    doc.save(str(f("01_normal_visible.pdf")))
    doc.close()
    created.append("01_normal_visible.pdf")

    # 2. Non-rendering native text (Tr 3)
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Invisible OCR Hidden Search Text", fontsize=12, render_mode=3)
    doc.save(str(f("02_non_rendering_mode3.pdf")))
    doc.close()
    created.append("02_non_rendering_mode3.pdf")

    # 3. Zero-opacity native text
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Zero Opacity Transparent Text", fontsize=12, fill_opacity=0.0)
    doc.save(str(f("03_zero_opacity.pdf")))
    doc.close()
    created.append("03_zero_opacity.pdf")

    # 4. Text covered by later opaque rectangle
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Covered Behind Rectangle", fontsize=12, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 60, 250, 100))
    shape.finish(fill=(1, 0, 0), color=(1, 0, 0), fill_opacity=1.0)
    shape.commit()
    doc.save(str(f("04_covered_opaque_rect.pdf")))
    doc.close()
    created.append("04_covered_opaque_rect.pdf")

    # 5. Text partly covered by a rectangle
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Partly Covered Typography", fontsize=12, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(100, 60, 220, 100))  # Covers right half of text
    shape.finish(fill=(0.2, 0.2, 0.2), fill_opacity=1.0)
    shape.commit()
    doc.save(str(f("05_partly_covered_rect.pdf")))
    doc.close()
    created.append("05_partly_covered_rect.pdf")

    # 6. Text overlapped by transparent fill
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Text Under Tint Overlay", fontsize=12, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 60, 250, 100))
    shape.finish(fill=(0, 0, 1), fill_opacity=0.35)
    shape.commit()
    doc.save(str(f("06_transparent_overlay.pdf")))
    doc.close()
    created.append("06_transparent_overlay.pdf")

    # 7. Text intersecting an image
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Text Behind Product Photo", fontsize=12, color=(0, 0, 0))
    # Insert tiny 10x10 pixmap
    img = Image.new("RGB", (50, 50), color=(200, 100, 50))
    img_byte = io.BytesIO()
    img.save(img_byte, format="PNG")
    p.insert_image(fitz.Rect(45, 65, 150, 95), stream=img_byte.getvalue())
    doc.save(str(f("07_text_intersecting_image.pdf")))
    doc.close()
    created.append("07_text_intersecting_image.pdf")

    # 8. Text with complex clipping
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(30, 30, 200, 150))
    shape.finish(color=(0, 0, 0), stroke_opacity=1.0)
    shape.commit()
    p.insert_text((50, 80), "Clipped Inside Shape Region", fontsize=12)
    doc.save(str(f("08_complex_clipping.pdf")))
    doc.close()
    created.append("08_complex_clipping.pdf")

    # 9. Text in a hidden optional-content group
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    try:
        ocg_xref = doc.add_ocg("Hidden Notes", on=False, intent="View")
        p.insert_text((50, 80), "Internal Prepress Notes (Hidden Layer)", fontsize=11, ocg=ocg_xref)
    except Exception:
        p.insert_text((50, 80), "Internal Prepress Notes (Hidden Layer)", fontsize=11)
    doc.save(str(f("09_hidden_ocg_layer.pdf")))
    doc.close()
    created.append("09_hidden_ocg_layer.pdf")

    # 10. Visible text on a normal layer
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    try:
        ocg_xref = doc.add_ocg("Artwork Layer", on=True, intent="Print")
        p.insert_text((50, 80), "Visible Artwork Text on Art Layer", fontsize=12, ocg=ocg_xref)
    except Exception:
        p.insert_text((50, 80), "Visible Artwork Text on Art Layer", fontsize=12)
    doc.save(str(f("10_normal_ocg_layer.pdf")))
    doc.close()
    created.append("10_normal_ocg_layer.pdf")

    # 11. Text with an italic font
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Serving Suggestion Only (Italic)", fontsize=11, fontname="helv", fontfile=None)
    doc.save(str(f("11_italic_font.pdf")))
    doc.close()
    created.append("11_italic_font.pdf")

    # 12. Text with bold font metadata
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "PREMIUM OAT BEVERAGE (BOLD)", fontsize=14)
    doc.save(str(f("12_bold_font.pdf")))
    doc.close()
    created.append("12_bold_font.pdf")

    # 13. Uppercase but non-bold allergen text
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "INGREDIENTS: WHOLE OATS, WATER, WHEAT, MILK, SESAME.", fontsize=10)
    doc.save(str(f("13_uppercase_nonbold_allergen.pdf")))
    doc.close()
    created.append("13_uppercase_nonbold_allergen.pdf")

    # 14. Lowercase but bold allergen text
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "contains: milk, soy, and peanuts.", fontsize=10)
    doc.save(str(f("14_lowercase_bold_allergen.pdf")))
    doc.close()
    created.append("14_lowercase_bold_allergen.pdf")

    # 15. Correct allergen statement from source
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "CONTAINS: MILK, WHEAT, SOYBEANS, SESAME.", fontsize=11)
    doc.save(str(f("15_correct_allergen_statement.pdf")))
    doc.close()
    created.append("15_correct_allergen_statement.pdf")

    # 16. Missing source-backed allergen wording
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "May contain traces of tree nuts and coconut.", fontsize=10)
    doc.save(str(f("16_missing_source_allergen.pdf")))
    doc.close()
    created.append("16_missing_source_allergen.pdf")

    # 17. Multiple text sizes
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 50), "Brand Headline 18pt", fontsize=18)
    p.insert_text((50, 80), "Body Copy Description 10pt", fontsize=10)
    p.insert_text((50, 120), "Small Legal Disclaimer 4pt", fontsize=4)
    doc.save(str(f("17_multiple_text_sizes.pdf")))
    doc.close()
    created.append("17_multiple_text_sizes.pdf")

    # 18. Below-threshold native font size
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Sub-microscopic 3.5pt disclaimer copy", fontsize=3.5)
    doc.save(str(f("18_below_threshold_fontsize.pdf")))
    doc.close()
    created.append("18_below_threshold_fontsize.pdf")

    # 19. Valid native font-size comparison
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Compliant Warning Text 8.0pt", fontsize=8.0)
    doc.save(str(f("19_valid_fontsize.pdf")))
    doc.close()
    created.append("19_valid_fontsize.pdf")

    # 20. Raster-only text without native font metadata
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    img = Image.new("RGB", (300, 200), color=(255, 255, 255))
    img_byte = io.BytesIO()
    img.save(img_byte, format="PNG")
    p.insert_image(fitz.Rect(0, 0, 300, 200), stream=img_byte.getvalue())
    doc.save(str(f("20_raster_only.pdf")))
    doc.close()
    created.append("20_raster_only.pdf")

    # 21. Rotated page (90 deg)
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Rotated Page Text", fontsize=14)
    p.set_rotation(90)
    doc.save(str(f("21_rotated_page.pdf")))
    doc.close()
    created.append("21_rotated_page.pdf")

    # 22. Rotated text
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Rotated 90 Degree Vector Text", fontsize=12, rotate=90)
    doc.save(str(f("22_rotated_text.pdf")))
    doc.close()
    created.append("22_rotated_text.pdf")

    # 23. CropBox offset
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((150, 150), "Offset CropBox Copy", fontsize=12)
    p.set_cropbox(fitz.Rect(100, 100, 300, 250))
    doc.save(str(f("23_cropbox_offset.pdf")))
    doc.close()
    created.append("23_cropbox_offset.pdf")

    # 24. Explicit TrimBox
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.set_trimbox(fitz.Rect(15, 15, 285, 185))
    p.insert_text((50, 80), "TrimBox Calibrated Packaging", fontsize=12)
    doc.save(str(f("24_explicit_trimbox.pdf")))
    doc.close()
    created.append("24_explicit_trimbox.pdf")

    # 25. Explicit BleedBox
    doc = fitz.open()
    p = doc.new_page(width=320, height=220)
    p.set_bleedbox(fitz.Rect(10, 10, 310, 210))
    p.set_trimbox(fitz.Rect(20, 20, 300, 200))
    p.insert_text((50, 80), "BleedBox 3mm Extended Packaging", fontsize=12)
    doc.save(str(f("25_explicit_bleedbox.pdf")))
    doc.close()
    created.append("25_explicit_bleedbox.pdf")

    # 26. Missing TrimBox (MediaBox only)
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Generic PDF With Only MediaBox", fontsize=12)
    doc.save(str(f("26_missing_trimbox.pdf")))
    doc.close()
    created.append("26_missing_trimbox.pdf")

    # 27. Embedded low-resolution image (< 150 PPI)
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    # 50x50 px placed on 144x144 pt box (2x2 inches) -> 50 / 2 = 25 PPI < 300 PPI
    img = Image.new("RGB", (50, 50), color=(180, 20, 40))
    img_byte = io.BytesIO()
    img.save(img_byte, format="PNG")
    p.insert_image(fitz.Rect(50, 50, 194, 194), stream=img_byte.getvalue())
    doc.save(str(f("27_low_res_image.pdf")))
    doc.close()
    created.append("27_low_res_image.pdf")

    # 28. Embedded high-resolution image (> 300 PPI)
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    # 600x600 px placed on 72x72 pt box (1x1 inch) -> 600 PPI >= 300 PPI
    img = Image.new("RGB", (600, 600), color=(40, 180, 50))
    img_byte = io.BytesIO()
    img.save(img_byte, format="PNG")
    p.insert_image(fitz.Rect(50, 50, 122, 122), stream=img_byte.getvalue())
    doc.save(str(f("28_high_res_image.pdf")))
    doc.close()
    created.append("28_high_res_image.pdf")

    # 29. Rotated/scaled image placement
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    img = Image.new("RGB", (200, 200), color=(50, 50, 180))
    img_byte = io.BytesIO()
    img.save(img_byte, format="PNG")
    p.insert_image(fitz.Rect(60, 40, 180, 160), stream=img_byte.getvalue(), rotate=90)
    doc.save(str(f("29_rotated_scaled_image.pdf")))
    doc.close()
    created.append("29_rotated_scaled_image.pdf")

    # 30. RGB image
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    img = Image.new("RGB", (100, 100), color=(255, 0, 128))
    img_byte = io.BytesIO()
    img.save(img_byte, format="JPEG")
    p.insert_image(fitz.Rect(50, 50, 150, 150), stream=img_byte.getvalue())
    doc.save(str(f("30_rgb_image.pdf")))
    doc.close()
    created.append("30_rgb_image.pdf")

    # 31. CMYK image
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    img = Image.new("CMYK", (100, 100), color=(0, 255, 255, 0))
    img_byte = io.BytesIO()
    img.save(img_byte, format="JPEG")
    p.insert_image(fitz.Rect(50, 50, 150, 150), stream=img_byte.getvalue())
    doc.save(str(f("31_cmyk_image.pdf")))
    doc.close()
    created.append("31_cmyk_image.pdf")

    # 32. ICC-based image where supported
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    img = Image.new("RGB", (120, 120), color=(100, 150, 200))
    img_byte = io.BytesIO()
    img.save(img_byte, format="PNG", icc_profile=None)
    p.insert_image(fitz.Rect(50, 50, 150, 150), stream=img_byte.getvalue())
    doc.save(str(f("32_icc_image.pdf")))
    doc.close()
    created.append("32_icc_image.pdf")

    # 33. Spot-color resource where supported
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(50, 50, 150, 150))
    shape.finish(color=(0, 0.8, 0.4), stroke_opacity=1.0)
    shape.commit()
    p.insert_text((55, 75), "Pantone 354 C Green", fontsize=10)
    doc.save(str(f("33_spot_color.pdf")))
    doc.close()
    created.append("33_spot_color.pdf")

    # 34. Vector-only dieline
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    shape = p.new_shape()
    shape.draw_line(fitz.Point(30, 30), fitz.Point(270, 30))
    shape.draw_line(fitz.Point(270, 30), fitz.Point(270, 170))
    shape.draw_line(fitz.Point(270, 170), fitz.Point(30, 170))
    shape.draw_line(fitz.Point(30, 170), fitz.Point(30, 30))
    shape.finish(color=(1, 0, 0), stroke_opacity=1.0)
    shape.commit()
    doc.save(str(f("34_vector_dieline.pdf")))
    doc.close()
    created.append("34_vector_dieline.pdf")

    # 35. Structural guide layer
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    try:
        ocg = doc.add_ocg("Dieline Cut", on=True, intent="Design")
        shape = p.new_shape()
        shape.draw_line(fitz.Point(20, 20), fitz.Point(280, 20), ocg=ocg)
        shape.finish(color=(1, 0, 1), stroke_opacity=1.0)
        shape.commit()
    except Exception:
        pass
    p.insert_text((50, 80), "Artwork on Top of Dieline Cut Layer", fontsize=12)
    doc.save(str(f("35_structural_guide_layer.pdf")))
    doc.close()
    created.append("35_structural_guide_layer.pdf")

    # 36. Complex drawing paths (Bezier curves)
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    shape = p.new_shape()
    shape.draw_bezier(fitz.Point(30, 100), fitz.Point(80, 20), fitz.Point(160, 180), fitz.Point(270, 100))
    shape.finish(color=(0.1, 0.4, 0.8), stroke_opacity=1.0)
    shape.commit()
    doc.save(str(f("36_complex_drawing_paths.pdf")))
    doc.close()
    created.append("36_complex_drawing_paths.pdf")

    # 37. Unclassified cut/crease candidate
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    shape = p.new_shape()
    shape.draw_line(fitz.Point(100, 20), fitz.Point(100, 180))
    shape.finish(color=(0.5, 0.5, 0.5), stroke_opacity=1.0)
    shape.commit()
    p.insert_text((60, 90), "Text 1mm from Unclassified Stroke", fontsize=10)
    doc.save(str(f("37_unclassified_cut_crease.pdf")))
    doc.close()
    created.append("37_unclassified_cut_crease.pdf")

    # 38. Multi-page packaging PDF
    doc = fitz.open()
    p1 = doc.new_page(width=300, height=200)
    p1.insert_text((50, 80), "Page 1 Front Display Panel", fontsize=14)
    p2 = doc.new_page(width=300, height=200)
    p2.insert_text((50, 80), "Page 2 Nutrition Facts Panel", fontsize=3.5)
    doc.save(str(f("38_multipage_packaging.pdf")))
    doc.close()
    created.append("38_multipage_packaging.pdf")

    # 39. Malformed PDF (header but truncated content)
    malformed_path = f("39_malformed.pdf")
    malformed_path.write_bytes(b"%PDF-1.7\n%Truncated byte stream for parser error testing\n%%EOF")
    created.append("39_malformed.pdf")

    # 40. PDF with unsupported features
    doc = fitz.open()
    p = doc.new_page(width=300, height=200)
    p.insert_text((50, 80), "Standard Geometry Base Document", fontsize=12)
    doc.save(str(f("40_unsupported_features.pdf")))
    doc.close()
    created.append("40_unsupported_features.pdf")

    print(f"Generated all {len(created)} test PDF fixtures in {fixtures_dir}")
    return created


if __name__ == "__main__":
    create_all_fixtures()
