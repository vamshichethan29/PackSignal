#!/usr/bin/env python3
"""
Unit tests for Curved Arc Text Reconstruction & Reading Order.
tests/test_pdf_arc_text.py
"""

import unittest
import sys
import math
from pathlib import Path

root = Path(__file__).resolve().parent.parent
lib_dir = root / "lib"
fixtures_dir = root / "tests" / "fixtures" / "reconstruction"

if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

from pdf_text_reconstruction import reconstruct_pdf_text, fit_circular_arc, unwrap_arc_to_strip
from PIL import Image


class TestPdfArcText(unittest.TestCase):

    def test_top_circular_arc_reconstruction(self):
        pdf_path = fixtures_dir / "fixture_g_top_arc.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        arcs = [s for s in res["reconstructedSegments"] if s["kind"] == "curved_text"]

        self.assertGreaterEqual(len(arcs), 1)
        top_arc = arcs[0]
        self.assertIn("PACKED", top_arc["reconstructedText"].upper())
        self.assertIn("GOODNESS", top_arc["reconstructedText"].upper())
        self.assertEqual(top_arc["method"], "native_glyph_arc_reconstruction")
        self.assertEqual(top_arc["authority"], "NATIVE_GEOMETRY_VERIFIED")

        geom = top_arc["pathGeometry"]
        self.assertIsNotNone(geom)
        self.assertEqual(geom["type"], "circular_arc")
        # Center should be around x=300, y=220 in 600x500 canvas
        self.assertAlmostEqual(geom["center"][0], 0.50, delta=0.08)
        self.assertAlmostEqual(geom["center"][1], 0.56, delta=0.08)  # y is inverted in PDF rendering
        self.assertAlmostEqual(geom["ptRadius"], 100.0, delta=15.0)

    def test_bottom_circular_arc_reconstruction(self):
        pdf_path = fixtures_dir / "fixture_h_bottom_arc.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        arcs = [s for s in res["reconstructedSegments"] if s["kind"] == "curved_text"]

        self.assertGreaterEqual(len(arcs), 1)
        bottom_arc = arcs[0]
        self.assertIn("NATURAL", bottom_arc["reconstructedText"].upper())
        self.assertIn("INGREDIENTS", bottom_arc["reconstructedText"].upper())
        self.assertEqual(bottom_arc["authority"], "NATIVE_GEOMETRY_VERIFIED")

    def test_counterclockwise_arc_reconstruction(self):
        pdf_path = fixtures_dir / "fixture_i_counterclockwise.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        arcs = [s for s in res["reconstructedSegments"] if s["kind"] == "curved_text"]

        self.assertGreaterEqual(len(arcs), 1)
        arc = arcs[0]
        self.assertIn("HARVEST", arc["reconstructedText"].upper())

    def test_scattered_letters_no_false_arc(self):
        pdf_path = fixtures_dir / "fixture_l_scattered.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        arcs = [s for s in res["reconstructedSegments"] if s["kind"] == "curved_text"]
        # Scattered random letters must NOT form a false verified slogan
        for a in arcs:
            self.assertNotEqual(a["authority"], "NATIVE_GEOMETRY_VERIFIED")

    def test_straight_text_not_classified_as_arc(self):
        pdf_path = fixtures_dir / "fixture_a_standard.pdf"
        res = reconstruct_pdf_text(str(pdf_path))
        arcs = [s for s in res["reconstructedSegments"] if s["kind"] == "curved_text"]
        self.assertEqual(len(arcs), 0)

    def test_unwrap_arc_to_strip(self):
        # Create a test image with an arc
        im = Image.new("RGB", (400, 400), (240, 240, 240))
        strip = unwrap_arc_to_strip(im, (200, 200), 80.0, 0.0, math.pi, height=30, width=200)
        self.assertIsNotNone(strip)
        self.assertEqual(strip.size, (200, 30))


if __name__ == "__main__":
    unittest.main()
