#!/usr/bin/env python3
"""
Generates synthetic PDF fixtures A through O for PackSignal Hidden Text & Opaque Overlay Detector.
Tests native PDF vector preflight across drawing sequence, opacity, rendering modes, and geometry.
"""

import sys
from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image
import io

fixtures_dir = Path(__file__).resolve().parent / "fixtures" / "pdf-visibility"
fixtures_dir.mkdir(parents=True, exist_ok=True)


def f(name):
    return fixtures_dir / name


def create_all_visibility_fixtures():
    created = []

    # FIXTURE A: Black text drawn first, opaque white rectangle drawn over it
    # Expected: CONFIRMED_HIDDEN
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Obsolete European Nutrition Facts", fontsize=14, color=(0, 0, 0))
    p.insert_text((50, 125), "Typical Values per 100g", fontsize=12, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 75, 320, 145))
    shape.finish(fill=(1.0, 1.0, 1.0), color=(1.0, 1.0, 1.0), fill_opacity=1.0)
    shape.commit()
    doc.save(str(f("fixture_a_hidden_white_box.pdf")))
    doc.close()
    created.append("fixture_a_hidden_white_box.pdf")

    # FIXTURE B: White rectangle drawn first, black text drawn afterward
    # Expected: VISIBLE (drawing order matters!)
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 75, 320, 145))
    shape.finish(fill=(1.0, 1.0, 1.0), color=(1.0, 1.0, 1.0), fill_opacity=1.0)
    shape.commit()
    p.insert_text((50, 100), "Genuinely Visible Header Copy", fontsize=14, color=(0, 0, 0))
    p.insert_text((50, 125), "100% Organic Whole Grain Oats", fontsize=12, color=(0, 0, 0))
    doc.save(str(f("fixture_b_visible_background.pdf")))
    doc.close()
    created.append("fixture_b_visible_background.pdf")

    # FIXTURE C: Black text followed by transparent rectangle outline (stroke without fill)
    # Expected: VISIBLE (strokes do not occlude underlying text)
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Visible Text Inside Border Box", fontsize=14, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 75, 320, 145))
    shape.finish(color=(0, 0, 0), width=1.5)  # stroked border only, no fill!
    shape.commit()
    doc.save(str(f("fixture_c_transparent_outline.pdf")))
    doc.close()
    created.append("fixture_c_transparent_outline.pdf")

    # FIXTURE D: Black text followed by semitransparent fill (opacity 0.5)
    # Expected: PARTIAL / UNCERTAIN
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Text Under Tinted Watermark", fontsize=14, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 75, 320, 145))
    shape.finish(fill=(0.8, 0.8, 0.8), fill_opacity=0.5)
    shape.commit()
    doc.save(str(f("fixture_d_semitransparent.pdf")))
    doc.close()
    created.append("fixture_d_semitransparent.pdf")

    # FIXTURE E: Black text completely covered by opaque colored rectangle (fill blue/yellow)
    # Expected: CONFIRMED_HIDDEN
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Hidden Text Covered By Color Patch", fontsize=14, color=(0, 0, 0))
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 75, 350, 130))
    shape.finish(fill=(0.2, 0.4, 0.9), fill_opacity=1.0)
    shape.commit()
    doc.save(str(f("fixture_e_colored_box.pdf")))
    doc.close()
    created.append("fixture_e_colored_box.pdf")

    # FIXTURE F: Text partially covered by an opaque shape (~50% width covered)
    # Expected: PARTIALLY_HIDDEN
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Long Ingredient Declaration Line Covered Halfway", fontsize=13, color=(0, 0, 0))
    shape = p.new_shape()
    # Cover the first half horizontally
    shape.draw_rect(fitz.Rect(45, 80, 200, 120))
    shape.finish(fill=(1.0, 1.0, 1.0), fill_opacity=1.0)
    shape.commit()
    doc.save(str(f("fixture_f_partial_overlap.pdf")))
    doc.close()
    created.append("fixture_f_partial_overlap.pdf")

    # FIXTURE G: Text rendering mode 3 (invisible text)
    # Expected: INVISIBLE_RENDER_MODE
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Invisible Searchable OCR Layer", fontsize=14, render_mode=3)
    doc.save(str(f("fixture_g_render_mode_3.pdf")))
    doc.close()
    created.append("fixture_g_render_mode_3.pdf")

    # FIXTURE H: Text with zero opacity
    # Expected: INVISIBLE
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Completely Transparent Native Text", fontsize=14, fill_opacity=0.0)
    doc.save(str(f("fixture_h_zero_opacity.pdf")))
    doc.close()
    created.append("fixture_h_zero_opacity.pdf")

    # FIXTURE I: Inactive PDF Optional Content Group (OCG layer)
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    ocg_id = doc.add_ocg("Obsolete Language Layer", on=False)
    p.insert_text((50, 100), "Inactive German Copy Layer", fontsize=14, oc=ocg_id)
    doc.save(str(f("fixture_i_inactive_ocg.pdf")))
    doc.close()
    created.append("fixture_i_inactive_ocg.pdf")

    # FIXTURE J: Visible PDF text + separate invisible OCR layer
    # Expected: No false packaging content duplication
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 80), "NET WT 14 OZ (396g)", fontsize=14, color=(0, 0, 0))
    p.insert_text((50, 80), "NET WT 14 OZ (396g)", fontsize=14, render_mode=3)
    doc.save(str(f("fixture_j_ocr_invisible_layer.pdf")))
    doc.close()
    created.append("fixture_j_ocr_invisible_layer.pdf")

    # FIXTURE K: Form XObject with covering shape
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "XObject Preflight Content", fontsize=14, color=(0, 0, 0))
    doc.save(str(f("fixture_k_xobject.pdf")))
    doc.close()
    created.append("fixture_k_xobject.pdf")

    # FIXTURE L: Rotated / CropBox PDF
    # Expected: Correct normalized coordinates
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.set_rotation(90)
    p.set_cropbox(fitz.Rect(20, 20, 380, 280))
    p.insert_text((50, 100), "Rotated 90 Deg Panel Text", fontsize=14, color=(0, 0, 0))
    doc.save(str(f("fixture_l_rotated_cropbox.pdf")))
    doc.close()
    created.append("fixture_l_rotated_cropbox.pdf")

    # FIXTURE M: Large vector path bbox overlaps text, but actual geometry does not
    # e.g., an L-shape or hollow frame whose bounding box encloses text, but fill is outside
    doc = fitz.open()
    p = doc.new_page(width=500, height=500)
    p.insert_text((150, 150), "Centered Safe Text Not Covered", fontsize=14, color=(0, 0, 0))
    # Draw an outer frame around it (hollow border)
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(50, 50, 450, 80)) # top bar
    shape.draw_rect(fitz.Rect(50, 420, 450, 450)) # bottom bar
    shape.finish(fill=(0, 0, 0), fill_opacity=1.0)
    shape.commit()
    doc.save(str(f("fixture_m_non_overlapping_path.pdf")))
    doc.close()
    created.append("fixture_m_non_overlapping_path.pdf")

    # FIXTURE N: Later image partly covers native text
    doc = fitz.open()
    p = doc.new_page(width=400, height=300)
    p.insert_text((50, 100), "Covered By Later PNG Image Badge", fontsize=14, color=(0, 0, 0))
    # Create a small opaque PIL image
    img = Image.new("RGBA", (200, 100), (255, 255, 255, 255))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    p.insert_image(fitz.Rect(40, 70, 300, 130), stream=img_bytes.getvalue())
    doc.save(str(f("fixture_n_image_occluder.pdf")))
    doc.close()
    created.append("fixture_n_image_occluder.pdf")

    # FIXTURE O: Dual nutrition tables: one visible US FDA Nutrition Facts,
    # one fully covered EU Typical Values table beneath an opaque white rectangle
    doc = fitz.open()
    p = doc.new_page(width=600, height=800)
    # 1. Draw obsolete EU table
    p.insert_text((50, 100), "NUTRITION DECLARATION", fontsize=14, color=(0, 0, 0))
    p.insert_text((50, 125), "Typical Values per 100g", fontsize=12, color=(0, 0, 0))
    p.insert_text((50, 145), "Energy 1868kJ / 445kcal", fontsize=12, color=(0, 0, 0))
    p.insert_text((50, 165), "Fat 15g", fontsize=12, color=(0, 0, 0))
    p.insert_text((50, 185), "Carbohydrate 65g", fontsize=12, color=(0, 0, 0))
    p.insert_text((50, 205), "Protein 9.2g", fontsize=12, color=(0, 0, 0))

    # 2. Draw opaque white rectangle covering the EU table
    shape = p.new_shape()
    shape.draw_rect(fitz.Rect(40, 80, 280, 230))
    shape.finish(fill=(1.0, 1.0, 1.0), color=(1.0, 1.0, 1.0), fill_opacity=1.0)
    shape.commit()

    # 3. Draw US FDA Nutrition Facts panel on another panel or later
    p.insert_text((320, 100), "Nutrition Facts", fontsize=16, color=(0, 0, 0))
    p.insert_text((320, 125), "8 servings per container", fontsize=12, color=(0, 0, 0))
    p.insert_text((320, 145), "Serving size 2/3 cup (55g)", fontsize=12, color=(0, 0, 0))
    p.insert_text((320, 175), "Calories 230", fontsize=16, color=(0, 0, 0))
    p.insert_text((320, 195), "Total Fat 8g", fontsize=12, color=(0, 0, 0))
    p.insert_text((320, 215), "Total Carbohydrate 37g", fontsize=12, color=(0, 0, 0))
    p.insert_text((320, 235), "Protein 5g", fontsize=12, color=(0, 0, 0))

    doc.save(str(f("fixture_o_dual_nutrition.pdf")))
    doc.close()
    created.append("fixture_o_dual_nutrition.pdf")

    print(f"Successfully generated {len(created)} visibility PDF fixtures in {fixtures_dir}")
    return created


if __name__ == "__main__":
    create_all_visibility_fixtures()
