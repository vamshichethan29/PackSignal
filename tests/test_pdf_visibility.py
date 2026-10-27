#!/usr/bin/env python3
"""
Unit test suite for PackSignal Native PDF Visibility & Occlusion Analyzer (lib/pdf_visibility.py).
Tests paint-order vector preflight, occluder opacity, rendering modes, and synthetic fixtures A through O.
"""

import unittest
import sys
import tempfile
import re
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))
sys.path.insert(0, str(root / "lib"))

from pdf_visibility import analyze_pdf_visibility
from extract import extract

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "pdf-visibility"
ORGANIZER_PDF = Path(__file__).resolve().parent.parent / "samples" / "organizer" / "DancingFish_Granola_Berry_US_Carton.pdf"


def run_extract(pdf_path):
    with tempfile.TemporaryDirectory() as tmpdir:
        return extract(str(pdf_path), 'artwork', tmpdir, 'doc_art', Path(pdf_path).name)


class TestPdfVisibilityAnalyzer(unittest.TestCase):

    def test_fixture_a_hidden_white_box(self):
        """Fixture A: Text drawn first, opaque white rectangle drawn over it -> CONFIRMED_HIDDEN"""
        pdf_path = FIXTURES_DIR / "fixture_a_hidden_white_box.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        self.assertGreater(len(p1), 0, "Should detect spans on page 1")
        hidden_spans = [s for s in p1 if s["visibility"]["state"] == "confirmed_hidden"]
        self.assertGreaterEqual(len(hidden_spans), 2, "Both obsolete EU nutrition lines should be confirmed hidden")
        for s in hidden_spans:
            self.assertEqual(s["occluder"]["fill"], "white")
            self.assertGreaterEqual(s["visibility"]["coveredRatio"], 0.85)
            self.assertEqual(s["visibility"]["reason"], "opaque_later_painted_shape")

    def test_fixture_b_visible_background(self):
        """Fixture B: White rectangle drawn first, text drawn afterward -> VISIBLE (Order matters!)"""
        pdf_path = FIXTURES_DIR / "fixture_b_visible_background.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        hidden_spans = [s for s in p1 if s["visibility"]["state"] == "confirmed_hidden"]
        self.assertEqual(len(hidden_spans), 0, "No text drawn on top of background should be classified as hidden")

    def test_fixture_c_transparent_outline(self):
        """Fixture C: Text followed by transparent rectangle outline -> VISIBLE (Strokes do not occlude)"""
        pdf_path = FIXTURES_DIR / "fixture_c_transparent_outline.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        hidden_spans = [s for s in p1 if s["visibility"]["state"] == "confirmed_hidden"]
        self.assertEqual(len(hidden_spans), 0, "Stroked border outline must not occlude underlying text")

    def test_fixture_d_semitransparent(self):
        """Fixture D: Text followed by 50% opacity fill -> VISIBILITY_UNCERTAIN / PARTIAL"""
        pdf_path = FIXTURES_DIR / "fixture_d_semitransparent.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        # With fill_opacity 0.5, it should NOT be confirmed hidden (which requires >= 0.95 opacity)
        confirmed_hidden = [s for s in p1 if s["visibility"]["state"] == "confirmed_hidden"]
        self.assertEqual(len(confirmed_hidden), 0, "Semitransparent shape must not create confirmed hidden classification")

    def test_fixture_e_colored_box(self):
        """Fixture E: Text covered by opaque colored rectangle -> CONFIRMED_HIDDEN"""
        pdf_path = FIXTURES_DIR / "fixture_e_colored_box.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        hidden_spans = [s for s in p1 if s["visibility"]["state"] == "confirmed_hidden"]
        self.assertGreater(len(hidden_spans), 0, "Opaque colored rectangle must occlude underlying text")
        self.assertIn("Covered By Color Patch", hidden_spans[0]["text"])

    def test_fixture_f_partial_overlap(self):
        """Fixture F: Text partially covered -> PARTIALLY_HIDDEN"""
        pdf_path = FIXTURES_DIR / "fixture_f_partial_overlap.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        partial_spans = [s for s in p1 if s["visibility"]["state"] == "partially_hidden"]
        self.assertGreater(len(partial_spans), 0, "Partial coverage must be classified as partially_hidden")
        self.assertLess(partial_spans[0]["visibility"]["coveredRatio"], 0.95)
        self.assertGreater(partial_spans[0]["visibility"]["coveredRatio"], 0.05)

    def test_fixture_g_render_mode_3(self):
        """Fixture G: Text rendering mode 3 -> INVISIBLE_RENDER_MODE"""
        pdf_path = FIXTURES_DIR / "fixture_g_render_mode_3.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        invisible_spans = [s for s in p1 if s["visibility"]["state"] == "invisible_render_mode"]
        self.assertGreater(len(invisible_spans), 0, "Text rendering mode 3 must be detected")
        self.assertIn("render_mode_3", invisible_spans[0]["visibility"]["reason"])

    def test_fixture_h_zero_opacity(self):
        """Fixture H: Zero opacity text -> INVISIBLE"""
        pdf_path = FIXTURES_DIR / "fixture_h_zero_opacity.pdf"
        analysis = analyze_pdf_visibility(str(pdf_path))
        p1 = analysis["pages"][0]["spans"]
        invisible_spans = [s for s in p1 if s["visibility"]["state"] == "invisible_opacity"]
        self.assertGreater(len(invisible_spans), 0, "Zero opacity text must be detected")

    def test_fixture_o_dual_nutrition_separation(self):
        """Fixture O: Two nutrition tables - US visible, EU covered by white box"""
        pdf_path = FIXTURES_DIR / "fixture_o_dual_nutrition.pdf"
        doc = run_extract(str(pdf_path))
        p1 = doc["pages"][0]
        # Visible lines should contain US Nutrition Facts
        visible_text = p1["text"]
        self.assertIn("Nutrition Facts", visible_text)
        self.assertIn("Calories 230", visible_text)
        # Hidden lines must contain obsolete EU table
        hidden_lines = p1.get("hiddenLines", [])
        self.assertGreaterEqual(len(hidden_lines), 4)
        hidden_texts = [l["text"] for l in hidden_lines]
        self.assertTrue(any("Typical Values per 100g" in t for t in hidden_texts))
        self.assertTrue(any("Energy 1868kJ" in t for t in hidden_texts))
        # Visible text MUST NOT contain obsolete EU values!
        self.assertNotIn("Typical Values per 100g", visible_text)
        self.assertNotIn("Energy 1868kJ", visible_text)

    def test_dancing_fish_organizer_artwork(self):
        """Step 1 & 16: Inspect actual Dancing Fish organizer artwork.
        Verify that obsolete EU nutrition rows are confirmed hidden beneath white rectangle Seq 241,
        and visible US Nutrition Facts are NOT flagged as hidden.
        """
        if not ORGANIZER_PDF.exists():
            self.skipTest(f"Organizer PDF not found at {ORGANIZER_PDF}")

        doc = run_extract(str(ORGANIZER_PDF))
        p1 = doc["pages"][0]
        hidden_lines = p1.get("hiddenLines", [])
        self.assertGreaterEqual(len(hidden_lines), 8, "Expected at least 8 covered EU nutrition lines")

        hidden_compact = re.sub(r'\s+', '', " ".join(l["text"] for l in hidden_lines))
        self.assertIn("TypicalValuesper100g", hidden_compact)
        self.assertIn("Energy1868kJ/445kcal", hidden_compact)
        self.assertIn("Fat15g", hidden_compact)
        self.assertIn("Carbohydrate65g", hidden_compact)

        # Check occlusion metadata
        for l in hidden_lines:
            self.assertEqual(l["kind"], "hidden")
            self.assertIn("occluder", l)
            self.assertEqual(l["occluder"]["fill"], "white")
            self.assertEqual(l["occluder"]["seqno"], 241)
            self.assertGreaterEqual(l["visibility"]["coveredRatio"], 0.85)

        # Confirm visible text STILL contains US Nutrition Facts
        visible_text = p1["text"]
        self.assertIn("Nutrition Facts", visible_text)
        self.assertIn("Calories", visible_text)
        # Obsolete EU typical values MUST NOT be in visible_text
        self.assertNotIn("TypicalValuesper100g", re.sub(r'\s+', '', visible_text))


if __name__ == "__main__":
    unittest.main()
