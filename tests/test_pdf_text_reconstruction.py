#!/usr/bin/env python3
"""
Comprehensive Unit Tests for PDF Text Reconstruction Pipeline.
tests/test_pdf_text_reconstruction.py
"""

import unittest
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
lib_dir = root / "lib"
fixtures_dir = root / "tests" / "fixtures" / "reconstruction"

if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

from pdf_text_reconstruction import reconstruct_pdf_text


class TestPdfTextReconstruction(unittest.TestCase):

    def test_standard_horizontal_text_unchanged(self):
        """1. Normal text remains unchanged."""
        pdf_path = fixtures_dir / "fixture_a_standard.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        # Normal running text must NOT be mangled or reconstructed into single words
        ls_segs = [s for s in res["reconstructedSegments"] if s["kind"] == "letter_spaced_text"]
        self.assertEqual(len(ls_segs), 0)

    def test_letter_spaced_word(self):
        """2. 'P A C K E D' -> 'PACKED'."""
        pdf_path = fixtures_dir / "fixture_b_spaced_word.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        ls_segs = [s for s in res["reconstructedSegments"] if s["kind"] == "letter_spaced_text"]
        self.assertGreaterEqual(len(ls_segs), 1)
        self.assertEqual(ls_segs[0]["reconstructedText"], "PACKED")
        self.assertEqual(ls_segs[0]["rawText"], "P A C K E D")
        self.assertEqual(ls_segs[0]["authority"], "NATIVE_GEOMETRY_VERIFIED")

    def test_tracked_words_preserves_word_boundaries(self):
        """3. 'P A C K E D   W I T H   G O O D N E S S' -> 'PACKED WITH GOODNESS'."""
        pdf_path = fixtures_dir / "fixture_c_tracked_words.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        ls_segs = [s for s in res["reconstructedSegments"] if s["kind"] == "letter_spaced_text"]
        self.assertGreaterEqual(len(ls_segs), 1)
        self.assertEqual(ls_segs[0]["reconstructedText"], "PACKED WITH GOODNESS")
        # Ensure word boundaries list has 3 distinct words
        words = [wb["word"] for wb in ls_segs[0]["wordBoundaries"]]
        self.assertEqual(words, ["PACKED", "WITH", "GOODNESS"])

    def test_spaced_numeric_value(self):
        """4. '1 5 g' -> '15 g'."""
        pdf_path = fixtures_dir / "fixture_d_spaced_number.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        ls_segs = [s for s in res["reconstructedSegments"] if s["kind"] == "letter_spaced_text"]
        self.assertGreaterEqual(len(ls_segs), 1)
        self.assertIn("15 g", ls_segs[0]["reconstructedText"])

    def test_spaced_decimal(self):
        """5. '2 . 2 g' -> '2.2 g'."""
        pdf_path = fixtures_dir / "fixture_e_spaced_decimal.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        ls_segs = [s for s in res["reconstructedSegments"] if s["kind"] == "letter_spaced_text"]
        self.assertGreaterEqual(len(ls_segs), 1)
        self.assertIn("2.2 g", ls_segs[0]["reconstructedText"])

    def test_table_columns_not_merged(self):
        """6. Column 1: '1', Column 2: '5 g' must NOT be merged into '15 g'."""
        pdf_path = fixtures_dir / "fixture_f_table_columns.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        # Ensure no segment reconstructed '15 g' across columns
        for s in res["reconstructedSegments"]:
            self.assertNotEqual(s["reconstructedText"], "15 g")

    def test_outlined_vector_text_fallback(self):
        """15. Vector outlined text labeled as VECTOR_OUTLINE_OCR, never NATIVE_TEXT_VERIFIED."""
        pdf_path = fixtures_dir / "fixture_m_outlined_vector.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        outline_segs = [s for s in res["reconstructedSegments"] if s["kind"] == "outlined_vector_text"]
        self.assertGreaterEqual(len(outline_segs), 1)
        self.assertEqual(outline_segs[0]["authority"], "UNSUPPORTED_OUTLINED_TEXT")
        self.assertIn("OUTLINED TEXT", outline_segs[0]["reconstructedText"])

    def test_hidden_text_under_opaque_box_excluded(self):
        """18. Hidden native text under opaque box excluded from visible reconstruction."""
        pdf_path = fixtures_dir / "fixture_o_hidden_overlay.pdf"
        # Analyze visibility first
        from pdf_visibility import analyze_pdf_visibility
        vis = analyze_pdf_visibility(str(pdf_path))
        res = reconstruct_pdf_text(str(pdf_path), vis_report=vis)

        # The occluded '1 5 g' must NOT appear as visible reconstructed text
        for s in res["reconstructedSegments"]:
            if s.get("visibility") == "visible":
                self.assertNotIn("1 5 g", s["rawText"])

    def test_multiple_nutrition_columns_isolated(self):
        """23. Multiple nutrition columns (Per 100g vs Per Serving) stay isolated."""
        pdf_path = fixtures_dir / "fixture_r_nutrition_columns.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        # Verify columns detected in diagnostics
        self.assertGreaterEqual(res["diagnostics"][0]["tableColumnsDetected"], 1)
        for s in res["reconstructedSegments"]:
            # Neither '15 g' in col 1 and '5 g' in col 2 should be merged into '155 g'
            self.assertNotIn("155", s["reconstructedText"])


if __name__ == "__main__":
    unittest.main()
