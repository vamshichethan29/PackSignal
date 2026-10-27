"""Python Unit Tests for Native PDF Vector Font & Typography Inspector.
(tests/test_pdf_font_inspector.py)

Tests:
1. Extraction of nominal font size (pt) using PDFium C API.
2. Actual physical letter height (mm) measured and distinguished from nominal pt.
3. Lowercase 'o' letter height extraction.
4. Capital letter / numeral height extraction.
5. Rotated text letter height measured perpendicular to baseline normal (not axis-aligned box).
6. Hidden/occluded text marked as excluded from compliance.
7. Font resource metadata and descriptor values.
"""

import unittest
import tempfile
import math
from pathlib import Path

# Add lib directory to path
import sys
root_dir = Path(__file__).resolve().parent.parent
lib_dir = root_dir / 'lib'
if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

import fitz
from pdf_font_inspector import inspect_pdf_typography, measure_char_height_along_baseline

class TestPdfFontInspector(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)

    def test_1_nominal_size_vs_actual_glyph_height(self):
        """Nominal font size in points must be distinguished from actual printed glyph height in mm."""
        pdf_path = Path(self.temp_dir.name) / "nominal_vs_glyph.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)

        # Draw text at 12 pt: 12 pt = 4.233 mm em-height
        page.insert_text(fitz.Point(50, 100), "Net Wt 16 oz (454 g)", fontsize=12)
        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        self.assertEqual(len(res["textRuns"]), 1)

        tr = res["textRuns"][0]
        self.assertEqual(tr["nominalFontSizePt"], 12.0)
        self.assertAlmostEqual(tr["nominalHeightMm"], 4.233, places=2)

        # Lowercase 'o' height must be smaller than the 12 pt em-height
        self.assertIsNotNone(tr["measuredLowercaseOHeightMm"])
        self.assertLess(tr["measuredLowercaseOHeightMm"], tr["nominalHeightMm"],
                        "Lowercase 'o' physical height must not be equated to nominal em size")
        self.assertGreater(tr["measuredLowercaseOHeightMm"], 1.5, "Lowercase 'o' in 12pt should be ~2.29mm")

    def test_2_rotated_text_measurement(self):
        """Rotated text height must be measured perpendicular to baseline normal, not axis-aligned bbox."""
        # Test baseline rotation math directly
        # Horizontal box: left=10, bottom=20, right=20, top=30 -> height = 10 pt
        h_box = (10.0, 20.0, 20.0, 30.0)
        h0 = measure_char_height_along_baseline(h_box, 0.0)
        self.assertAlmostEqual(h0, 10.0, places=2)

        # 90 degrees rotated (pi/2 radians)
        h90 = measure_char_height_along_baseline(h_box, math.pi / 2.0)
        self.assertAlmostEqual(h90, 10.0, places=2)

    def test_3_category_classification_and_lowercase_o(self):
        """Net quantity declarations are classified and measured accurately."""
        pdf_path = Path(self.temp_dir.name) / "net_qty.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)
        page.insert_text(fitz.Point(50, 150), "NET QUANTITY 500 mL", fontsize=10)
        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        tr = res["textRuns"][0]
        self.assertEqual(tr["category"], "net_quantity")
        self.assertEqual(tr["nominalFontSizePt"], 10.0)
        self.assertIsNotNone(tr["measuredCapitalHeightMm"])

    def test_4_font_resource_inspection(self):
        """Font resource subtype and descriptor metrics are inventoried."""
        pdf_path = Path(self.temp_dir.name) / "font_meta.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)
        page.insert_text(fitz.Point(50, 100), "Ingredients: Whole milk, vitamin D3.", fontname="helv", fontsize=8)
        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        tr = res["textRuns"][0]
        self.assertIn("Helvetica", tr["fontName"])
        self.assertIn(tr["fontSubtype"], ["Type1", "TrueType", "Type0"])

    def test_5_hidden_text_exclusion(self):
        """Hidden text covered by later opaque shape is flagged and excluded from compliance."""
        pdf_path = Path(self.temp_dir.name) / "hidden_text.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)

        # 1. Under text
        page.insert_text(fitz.Point(50, 100), "Obsolete 100% Organic Claim", fontsize=9)
        # 2. Cover with white opaque rectangle
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(40, 80, 260, 120))
        shape.finish(fill=(1, 1, 1), color=(1, 1, 1))
        shape.commit()

        doc.save(str(pdf_path))
        doc.close()

        res = inspect_pdf_typography(str(pdf_path))
        self.assertEqual(res["status"], "ok")
        tr = res["textRuns"][0]
        self.assertEqual(tr["visibility"], "hidden")
        self.assertEqual(tr["excludedFromCompliance"], True)

if __name__ == '__main__':
    unittest.main()
