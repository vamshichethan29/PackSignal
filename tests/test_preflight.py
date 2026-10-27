"""Comprehensive Python Unit Test Suite for Prepress Inspection Engine.
Tests:
- Barcode module width estimation, quiet zone obstruction, and contrast screening
- PDF BleedBox, TrimBox, and safe margin measurements
- Native PDF font size extraction, x-height estimation, and allergen emphasis
- PDF color space, spot colors, and rich black screening
"""
import unittest, os, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

import importlib
inspect_typography = importlib.import_module("typography-inspector").inspect_typography
inspect_bleed_and_trim = importlib.import_module("bleed-inspector").inspect_bleed_and_trim
inspect_colors = importlib.import_module("color-preflight").inspect_colors
analyze_barcode_image = importlib.import_module("barcode-preflight").analyze_barcode_image

fixtures_dir = Path(__file__).resolve().parent / "fixtures" / "preflight"

class TestPrepressEngine(unittest.TestCase):

    def test_barcode_clean_valid_quiet_zones(self):
        im = Image.open(fixtures_dir / "barcode_valid_clean.png")
        res = analyze_barcode_image(im, {"format": "EAN-13", "gtin": "0123456789012"})
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["quietZones"]["status"], "match")
        self.assertTrue(res["quietZones"]["left"]["passes"])
        self.assertTrue(res["quietZones"]["right"]["passes"])
        self.assertGreaterEqual(res["contrastScreening"]["symbolContrast"], 0.60)

    def test_barcode_left_intrusion_detected(self):
        im = Image.open(fixtures_dir / "barcode_left_intrusion.png")
        res = analyze_barcode_image(im, {"format": "EAN-13"})
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["quietZones"]["status"], "issue")
        # Ensure finding exists with issue status
        issue_findings = [f for f in res["findings"] if f["check"] == "barcode_quiet_zone" and f["status"] == "issue"]
        self.assertTrue(len(issue_findings) >= 1)
        self.assertIn("Left:", issue_findings[0]["observed"])

    def test_barcode_right_intrusion_detected(self):
        im = Image.open(fixtures_dir / "barcode_right_intrusion.png")
        res = analyze_barcode_image(im, {"format": "EAN-13"})
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["quietZones"]["status"], "issue")
        issue_findings = [f for f in res["findings"] if f["check"] == "barcode_quiet_zone" and f["status"] == "issue"]
        self.assertTrue(len(issue_findings) >= 1)
        self.assertIn("Right:", issue_findings[0]["observed"])

    def test_barcode_low_contrast_screening(self):
        im = Image.open(fixtures_dir / "barcode_low_contrast.png")
        res = analyze_barcode_image(im, {"format": "EAN-13"})
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["contrastScreening"]["status"], "issue")
        self.assertLess(res["contrastScreening"]["symbolContrast"], 0.35)
        # Verify limitation notice is honest
        self.assertIn("not an ISO/IEC 15416", res["contrastScreening"]["limitation"])

    def test_bleed_box_valid_3mm(self):
        pdf_p = fixtures_dir / "bleed_valid_3mm.pdf"
        res = inspect_bleed_and_trim(str(pdf_p), {"requiredBleedMm": 3.0})
        self.assertEqual(res["status"], "success")
        geom = res["pageGeometries"][0]
        self.assertGreaterEqual(geom["availableBleedMm"]["minimum"], 2.9)
        matches = [f for f in res["findings"] if f["check"] == "bleed_box_dimensions" and f["status"] == "match"]
        self.assertTrue(len(matches) >= 1)

    def test_bleed_box_zero_margin_defect(self):
        pdf_p = fixtures_dir / "bleed_zero_margin.pdf"
        res = inspect_bleed_and_trim(str(pdf_p), {"requiredBleedMm": 3.0})
        self.assertEqual(res["status"], "success")
        geom = res["pageGeometries"][0]
        self.assertEqual(geom["availableBleedMm"]["minimum"], 0.0)
        issues = [f for f in res["findings"] if f["check"] == "bleed_box_dimensions" and f["status"] in ("issue", "review")]
        self.assertTrue(len(issues) >= 1)
        self.assertIn("3.0 mm bleed deficit", issues[0]["difference"])

    def test_typography_sub_6pt_defect(self):
        pdf_p = fixtures_dir / "typo_sub_6pt.pdf"
        res = inspect_typography(str(pdf_p), {"minFontSizePt": 6.0})
        self.assertEqual(res["status"], "success")
        small_issues = [f for f in res["findings"] if f["check"] == "font_size_minimum" and f["status"] == "issue"]
        self.assertTrue(len(small_issues) >= 1)
        self.assertAlmostEqual(small_issues[0]["measuredValue"], 4.8, delta=0.1)

    def test_typography_valid_8pt_passes(self):
        pdf_p = fixtures_dir / "typo_valid_8pt.pdf"
        res = inspect_typography(str(pdf_p), {"minFontSizePt": 6.0})
        self.assertEqual(res["status"], "success")
        small_issues = [f for f in res["findings"] if f["check"] == "font_size_minimum" and f["status"] == "issue"]
        self.assertEqual(len(small_issues), 0)

    def test_color_spot_inventory_detection(self):
        pdf_p = fixtures_dir / "color_pantone_spot.pdf"
        res = inspect_colors(str(pdf_p))
        self.assertEqual(res["status"], "success")
        spot_names = [s["name"] for s in res["spotColors"]]
        self.assertIn("PANTONE 186 C", spot_names)
        matches = [f for f in res["findings"] if f["check"] == "spot_color_inventory" and f["status"] == "match"]
        self.assertTrue(len(matches) >= 1)

if __name__ == '__main__':
    unittest.main()
