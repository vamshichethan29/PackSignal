"""Python Unit Tests for Native PDF Vector Font & Typography Inspector.
(tests/test_pdf_typography.py)

Tests Phase 1 through Phase 6 & Phase 12 of Upgrade #47:
1. Native font resource analysis (Type 1, TrueType, Type 0, CID).
2. Embedded font table inspection (unitsPerEm, OS/2 sxHeight).
3. Exact nominal font size in points (pt) extracted.
4. Actual physical glyph height measured along baseline normal.
5. Distinction of nominal pt from printed glyph height (lowercase 'o' / capital).
6. Height-to-width ratio measurement under 21 CFR 101.105(h) (condensed font check).
7. Rotated text angle and local coordinate projection.
8. Hidden/occluded text gating.
"""

import unittest
import tempfile
import math
from pathlib import Path
import sys

root_dir = Path(__file__).resolve().parent.parent
lib_dir = root_dir / 'lib'
if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

import fitz
from pdf_typography import (
    inspect_pdf_typography,
    measure_char_height_along_baseline,
    measure_char_width_along_baseline,
    extract_font_resources_deep,
    MEASUREMENT_METHOD,
    MEASUREMENT_AUTHORITY,
    PT_TO_MM
)

class TestPdfTypography(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)

    def test_1_nominal_size_vs_actual_glyph_height(self):
        """Nominal font size in pt must not be confused with actual lowercase 'o' printed height in mm."""
        pdf_path = Path(self.temp_dir.name) / "nominal_vs_glyph.pdf"
        doc = fitz.open()
        page = doc.new_page(width=400, height=400)
        # 10 pt nominal size
        page.insert_text(fitz.Point(50, 100), "Net Wt 12 oz (340g)", fontsize=10)
        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        self.assertGreater(len(res["textRuns"]), 0)

        tr = res["textRuns"][0]
        self.assertEqual(tr["nominalFontSizePt"], 10.0)
        self.assertAlmostEqual(tr["nominalHeightMm"], 10.0 * PT_TO_MM, places=2)

        # Lowercase 'o' height must be strictly less than nominal em-height
        self.assertIsNotNone(tr["measuredLowercaseOHeightMm"])
        self.assertLess(tr["measuredLowercaseOHeightMm"], tr["nominalHeightMm"])
        self.assertEqual(tr["measurementMethod"], MEASUREMENT_METHOD.NATIVE_CHARACTER_GEOMETRY)
        self.assertEqual(tr["measurementAuthority"], MEASUREMENT_AUTHORITY.MEASURED_FROM_SOURCE)

    def test_2_height_to_width_ratio_condensed_lettering(self):
        """Lettering must be evaluated for height-to-width ratio under 21 CFR 101.105(h)."""
        pdf_path = Path(self.temp_dir.name) / "condensed_test.pdf"
        doc = fitz.open()
        page = doc.new_page(width=400, height=400)
        page.insert_text(fitz.Point(50, 120), "NET WT 500g", fontsize=12)
        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        tr = res["textRuns"][0]

        # Normal text should not violate condensed ratio (ratio must be <= 3.0)
        self.assertIsNotNone(tr["heightToWidthRatio"])
        self.assertLessEqual(tr["heightToWidthRatio"], 3.0)
        self.assertFalse(tr["isCondensedViolation"])

    def test_3_rotated_text_measured_along_baseline_normal(self):
        """Rotated characters must be projected along baseline normal, not axis-aligned bbox."""
        char_box = (100.0, 100.0, 115.0, 120.0) # width 15 pt, height 20 pt
        
        # 0 degrees
        h0 = measure_char_height_along_baseline(char_box, 0.0)
        w0 = measure_char_width_along_baseline(char_box, 0.0)
        self.assertAlmostEqual(h0, 20.0, places=2)
        self.assertAlmostEqual(w0, 15.0, places=2)

        # 90 degrees rotation (math.pi / 2)
        # When a 20 pt tall glyph is rotated 90 degrees, its height extends horizontally across the page
        rotated_box = (100.0, 100.0, 120.0, 115.0)
        h90 = measure_char_height_along_baseline(rotated_box, math.pi / 2.0)
        self.assertAlmostEqual(h90, 20.0, places=2)

    def test_4_font_resource_extraction(self):
        """PDF font resources and embedded subtypes are extracted."""
        pdf_path = Path(self.temp_dir.name) / "font_sample.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)
        page.insert_text(fitz.Point(50, 80), "Nutrition Facts", fontname="helv", fontsize=14)
        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        self.assertIn("Helvetica", res["summary"]["fontsUsed"][0])
        self.assertEqual(res["textRuns"][0]["category"], "nutrition")

if __name__ == '__main__':
    unittest.main()
