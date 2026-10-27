#!/usr/bin/env python3
"""
Unit tests for PackSignal Native PDF Inspector (tests/test_pdf_inspector.py)
Exercises native PDF extraction, drawing-sequence occlusion, typography,
allergen formatting, raster PPI calculation, and layer metadata.
"""

import sys
import unittest
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
lib_dir = root_dir / "lib"
fixtures_dir = root_dir / "tests" / "fixtures" / "pdf-preflight"

if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

import importlib
pdf_inspector = importlib.import_module("pdf-inspector")
inspect_pdf_document = pdf_inspector.inspect_pdf_document


class TestPdfInspector(unittest.TestCase):
    def test_01_visible_native_text(self):
        pdf = fixtures_dir / "01_normal_visible.pdf"
        res = inspect_pdf_document(str(pdf))
        self.assertEqual(res["schemaVersion"], "packsignal-pdf-inspector/v1")
        self.assertEqual(res["pageCount"], 1)
        self.assertTrue(len(res["textSpans"]) >= 1)
        span = res["textSpans"][0]
        self.assertIn("Visible", span["text"])
        self.assertEqual(span["visibilityClassification"], "VISIBLE_CANDIDATE")

    def test_02_non_rendering_mode3(self):
        pdf = fixtures_dir / "02_non_rendering_mode3.pdf"
        res = inspect_pdf_document(str(pdf))
        obs = [o for o in res["observations"] if o["checkId"] == "PVP-001"]
        self.assertTrue(len(obs) >= 1)
        self.assertEqual(obs[0]["classification"], "NONRENDERING_TEXT")
        self.assertEqual(obs[0]["screeningOutcome"], "SCREENING_WARNING")

    def test_03_zero_opacity_text(self):
        pdf = fixtures_dir / "03_zero_opacity.pdf"
        res = inspect_pdf_document(str(pdf))
        obs = [o for o in res["observations"] if o["checkId"] == "PVP-001"]
        self.assertTrue(len(obs) >= 1)
        self.assertEqual(obs[0]["classification"], "ZERO_OPACITY_TEXT")

    def test_04_covered_opaque_rect(self):
        pdf = fixtures_dir / "04_covered_opaque_rect.pdf"
        res = inspect_pdf_document(str(pdf))
        obs = [o for o in res["observations"] if o["checkId"] == "PVP-002"]
        self.assertTrue(len(obs) >= 1)
        self.assertEqual(obs[0]["classification"], "POTENTIALLY_OCCLUDED")

    def test_05_partly_covered_rect(self):
        pdf = fixtures_dir / "05_partly_covered_rect.pdf"
        res = inspect_pdf_document(str(pdf))
        obs = [o for o in res["observations"] if o["checkId"] == "PVP-002"]
        self.assertTrue(len(obs) >= 1)

    def test_06_transparent_overlay(self):
        pdf = fixtures_dir / "06_transparent_overlay.pdf"
        res = inspect_pdf_document(str(pdf))
        # Transparent overlay must NOT be marked POTENTIALLY_OCCLUDED
        occluded = [o for o in res["observations"] if o.get("classification") == "POTENTIALLY_OCCLUDED"]
        self.assertEqual(len(occluded), 0)

    def test_07_typography_below_threshold(self):
        pdf = fixtures_dir / "18_below_threshold_fontsize.pdf"
        res = inspect_pdf_document(str(pdf), options={"minFontSizePt": 6.0})
        typo_obs = [o for o in res["observations"] if o["checkId"] == "PVP-003"]
        self.assertTrue(len(typo_obs) >= 1)
        self.assertEqual(typo_obs[0]["screeningOutcome"], "SCREENING_WARNING")
        self.assertLess(typo_obs[0]["measuredValue"], 6.0)

    def test_08_typography_valid_fontsize(self):
        pdf = fixtures_dir / "19_valid_fontsize.pdf"
        res = inspect_pdf_document(str(pdf), options={"minFontSizePt": 6.0})
        typo_warnings = [o for o in res["observations"] if o["checkId"] == "PVP-003" and o["screeningOutcome"] == "SCREENING_WARNING"]
        self.assertEqual(len(typo_warnings), 0)

    def test_09_allergen_statement(self):
        pdf = fixtures_dir / "15_correct_allergen_statement.pdf"
        res = inspect_pdf_document(str(pdf))
        allergen_obs = [o for o in res["observations"] if o["checkId"] == "PVP-005"]
        self.assertTrue(len(allergen_obs) >= 1)
        contains_obs = [o for o in allergen_obs if o.get("classification") == "CONTAINS_STATEMENT"]
        self.assertTrue(len(contains_obs) >= 1)

    def test_10_image_low_resolution(self):
        pdf = fixtures_dir / "27_low_res_image.pdf"
        res = inspect_pdf_document(str(pdf), options={"minPpi": 300.0})
        self.assertTrue(len(res["embeddedImages"]) >= 1)
        img = res["embeddedImages"][0]
        self.assertTrue(img["isLowResolution"])
        self.assertLess(img["effectivePpi"], 150.0)

    def test_11_image_high_resolution(self):
        pdf = fixtures_dir / "28_high_res_image.pdf"
        res = inspect_pdf_document(str(pdf), options={"minPpi": 300.0})
        self.assertTrue(len(res["embeddedImages"]) >= 1)
        img = res["embeddedImages"][0]
        self.assertFalse(img["isLowResolution"])
        self.assertGreaterEqual(img["effectivePpi"], 300.0)

    def test_12_page_boxes(self):
        pdf = fixtures_dir / "24_explicit_trimbox.pdf"
        res = inspect_pdf_document(str(pdf))
        self.assertEqual(len(res["pages"]), 1)
        p1 = res["pages"][0]
        self.assertTrue(p1["boxes"]["trimBox"]["isExplicit"])

    def test_13_structural_layer(self):
        pdf = fixtures_dir / "35_structural_guide_layer.pdf"
        res = inspect_pdf_document(str(pdf))
        layer_obs = [o for o in res["observations"] if o["checkId"] == "PVP-008"]
        self.assertTrue(len(layer_obs) >= 1)

    def test_14_multipage_packaging(self):
        pdf = fixtures_dir / "38_multipage_packaging.pdf"
        res = inspect_pdf_document(str(pdf))
        self.assertEqual(res["pageCount"], 2)


if __name__ == "__main__":
    unittest.main()
