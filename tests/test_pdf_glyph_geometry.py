#!/usr/bin/env python3
"""
Unit tests for PDF glyph geometry extraction and bounding box normalization.
tests/test_pdf_glyph_geometry.py
"""

import unittest
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
lib_dir = root / "lib"
fixtures_dir = root / "tests" / "fixtures" / "reconstruction"

if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

import fitz
from pdf_text_reconstruction import extract_glyphs_from_page, fit_circular_arc, _solve_3x3_linear_system


class TestPdfGlyphGeometry(unittest.TestCase):

    def test_solve_3x3_linear_system(self):
        # A * X = B
        # 2x + y + z = 4
        # x + 3y + 2z = 5
        # x + y + z = 3
        A = [
            [2.0, 1.0, 1.0],
            [1.0, 3.0, 2.0],
            [1.0, 1.0, 1.0]
        ]
        B = [4.0, 5.0, 3.0]
        sol = _solve_3x3_linear_system(A, B)
        self.assertIsNotNone(sol)
        self.assertAlmostEqual(sol[0], 1.0, places=4)
        self.assertAlmostEqual(sol[1], 0.0, places=4)
        self.assertAlmostEqual(sol[2], 2.0, places=4)

    def test_fit_circular_arc_exact_circle(self):
        # Points on a circle with center (100, 150) and radius 50
        points = [
            (100.0 + 50.0 * 1.0, 150.0 + 50.0 * 0.0),
            (100.0 + 50.0 * 0.0, 150.0 + 50.0 * 1.0),
            (100.0 - 50.0 * 1.0, 150.0 + 50.0 * 0.0),
            (100.0 + 50.0 * 0.0, 150.0 - 50.0 * 1.0)
        ]
        fit = fit_circular_arc(points)
        self.assertIsNotNone(fit)
        self.assertAlmostEqual(fit["center"][0], 100.0, places=2)
        self.assertAlmostEqual(fit["center"][1], 150.0, places=2)
        self.assertAlmostEqual(fit["radius"], 50.0, places=2)
        self.assertLess(fit["rel_rmse"], 0.001)

    def test_extract_glyphs_fixture_a(self):
        pdf_path = fixtures_dir / "fixture_a_standard.pdf"
        doc = fitz.open(str(pdf_path))
        page = doc[0]
        glyphs, w, h = extract_glyphs_from_page(page, 1)
        doc.close()

        self.assertGreater(len(glyphs), 20)
        self.assertAlmostEqual(w, 600.0, places=1)
        self.assertAlmostEqual(h, 400.0, places=1)

        for g in glyphs:
            self.assertIn("glyphId", g)
            self.assertIn("char", g)
            self.assertIn("origin", g)
            self.assertIn("bbox", g)
            self.assertIn("normBox", g)
            self.assertIn("fontSize", g)
            self.assertEqual(g["visibility"], "visible")
            # Verify coordinates are normalized within [0, 1]
            nb = g["normBox"]
            self.assertTrue(0.0 <= nb[0] <= 1.0)
            self.assertTrue(0.0 <= nb[1] <= 1.0)
            self.assertTrue(0.0 <= nb[2] <= 1.0)
            self.assertTrue(0.0 <= nb[3] <= 1.0)


if __name__ == "__main__":
    unittest.main()
