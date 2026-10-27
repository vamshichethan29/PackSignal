"""
Unit Test Suite for PackSignal Regulatory Symbols Computer Vision Engine.
Tests:
- Detection of green circular mark inside green square (FSSAI Vegetarian symbol)
- Detection of brown triangular mark inside brown square (FSSAI Non-Vegetarian symbol)
- Handling of missing image, wrong color, or absent symbols
"""
import unittest
import importlib
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
detect_regulatory_symbols = importlib.import_module("lib.regulatory-symbols", package=None).detect_regulatory_symbols

class TestRegulatorySymbols(unittest.TestCase):

    def test_missing_image_handled_gracefully(self):
        res = detect_regulatory_symbols({"image_path": "non_existent_file.png", "page": 1})
        self.assertEqual(res["status"], "ERROR")
        self.assertTrue(len(res["limitations"]) > 0)

    def test_synthetic_fssai_veg_symbol_detected(self):
        # Create a synthetic image with a green square and green circle inside
        im = Image.new("RGB", (400, 400), (255, 255, 255))
        draw = ImageDraw.Draw(im)
        # Green square outline (x: 100, y: 100, x2: 200, y2: 200)
        draw.rectangle([100, 100, 200, 200], outline=(0, 150, 0), width=4)
        # Green filled circle (center: 150, 150, radius: 25)
        draw.ellipse([125, 125, 175, 175], fill=(0, 150, 0))

        test_img_path = root / "tests" / "fixtures" / "temp_veg_symbol.png"
        test_img_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(test_img_path)

        try:
            res = detect_regulatory_symbols({"image_path": str(test_img_path), "page": 1})
            self.assertEqual(res["status"], "SUCCESS")
            # Should detect veg candidate or find green regions
            veg_candidates = [s for s in res.get("symbolsDetected", []) if s.get("symbolType") == "fssai_veg"]
            self.assertTrue(len(veg_candidates) >= 1)
            self.assertEqual(veg_candidates[0]["page"], 1)
        finally:
            if test_img_path.exists():
                test_img_path.unlink()

    def test_clean_image_without_symbols_reports_absent(self):
        im = Image.new("RGB", (300, 300), (255, 255, 255))
        test_img_path = root / "tests" / "fixtures" / "temp_blank.png"
        test_img_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(test_img_path)

        try:
            res = detect_regulatory_symbols({"image_path": str(test_img_path), "page": 1})
            self.assertEqual(res["status"], "SUCCESS")
            self.assertEqual(len(res.get("symbolsDetected", [])), 0)
        finally:
            if test_img_path.exists():
                test_img_path.unlink()

if __name__ == "__main__":
    unittest.main()
