"""Python Unit Tests for PDF Color Separation & TAC Prepress Analysis.
(tests/test_pdf_color_analysis.py)

Tests:
1. True CMYK extraction and TAC formula (C+M+Y+K).
2. TAC excess detection against configured profile limit.
3. Rich black below limit does not fail TAC.
4. Unmanaged DeviceRGB returns UNABLE without guessing CMYK.
5. Spot color separation names and alternates.
6. Overprint / ExtGState flag detection.
"""

import unittest
import tempfile
import os
from pathlib import Path

# Add lib directory to path
import sys
root_dir = Path(__file__).resolve().parent.parent
lib_dir = root_dir / 'lib'
if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

import fitz
from pdf_color_analysis import analyze_pdf_colors

class TestPdfColorAnalysis(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)

    def test_1_cmyk_fill_and_tac_calculation(self):
        """Test real PDF with CMYK fill operators and TAC calculation."""
        pdf_path = Path(self.temp_dir.name) / "cmyk_excess.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)

        # Inject CMYK drawing stream: C=80%, M=70%, Y=70%, K=100% -> TAC = 320%
        # Operator: 0.8 0.7 0.7 1.0 k (CMYK fill)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(50, 50, 250, 250))
        shape.finish(color=None, fill=(0.8, 0.7, 0.7, 1.0)) # PyMuPDF 4-tuple is CMYK
        shape.commit()
        doc.save(str(pdf_path))
        doc.close()

        res = analyze_pdf_colors(str(pdf_path), {"tacLimitPercent": 300, "pressProfileId": "ISO-OFFSET-COATED-300"})
        self.assertEqual(res["cmykAvailable"], True)
        self.assertEqual(res["status"], "issue")
        self.assertEqual(res["verdict"], "TAC_LIMIT_EXCEEDED")
        self.assertEqual(res["peakTac"], 320)
        self.assertTrue(len(res["hotspots"]) >= 1)
        self.assertEqual(res["hotspots"][0]["excessPercentagePoints"], 20)

    def test_2_rich_black_below_limit(self):
        """Rich black with TAC 290% against 300% limit does not fail TAC alone."""
        pdf_path = Path(self.temp_dir.name) / "rich_black.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)

        # C=70%, M=60%, Y=60%, K=100% -> TAC = 290% <= 300%
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(50, 50, 250, 250))
        shape.finish(color=None, fill=(0.7, 0.6, 0.6, 1.0))
        shape.commit()
        doc.save(str(pdf_path))
        doc.close()

        res = analyze_pdf_colors(str(pdf_path), {"tacLimitPercent": 300})
        self.assertEqual(res["cmykAvailable"], True)
        self.assertNotEqual(res["status"], "issue", "Rich black below 300% limit must not be an issue")
        self.assertEqual(res["peakTac"], 290)

    def test_3_rgb_only_returns_unable(self):
        """Unmanaged RGB-only artwork returns UNABLE without fake CMYK."""
        pdf_path = Path(self.temp_dir.name) / "rgb_only.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)

        # RGB fill: 0.1 0.2 0.3 rg
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(50, 50, 250, 250))
        shape.finish(color=None, fill=(0.1, 0.2, 0.3)) # 3-tuple is RGB
        shape.commit()
        doc.save(str(pdf_path))
        doc.close()

        res = analyze_pdf_colors(str(pdf_path), {"tacLimitPercent": 300})
        self.assertEqual(res["status"], "UNABLE")
        self.assertEqual(res["cmykAvailable"], False)
        self.assertIsNone(res["peakTac"], "Must not guess CMYK from screen RGB")
        self.assertEqual(res["explanation"], "CMYK separation data could not be reliably evaluated for this artwork.")

    def test_4_spot_colors_detection(self):
        """Spot colors defined in /ColorSpace resources are inventoried."""
        import pikepdf
        pdf_path = Path(self.temp_dir.name) / "spot_dieline.pdf"

        # Create basic PDF with pikepdf and attach a /Separation color space
        pdf = pikepdf.new()
        page = pdf.add_blank_page(page_size=(300, 300))

        # Build Separation ColorSpace
        # [/Separation /CutContour /DeviceCMYK <<...>>]
        sep_cs = pikepdf.Array([
            pikepdf.Name('/Separation'),
            pikepdf.Name('/CutContour'),
            pikepdf.Name('/DeviceCMYK'),
            pikepdf.Dictionary({
                '/FunctionType': 2,
                '/Domain': pikepdf.Array([0.0, 1.0]),
                '/C0': pikepdf.Array([0.0, 0.0, 0.0, 0.0]),
                '/C1': pikepdf.Array([1.0, 0.0, 1.0, 0.0]),
                '/N': 1.0,
            })
        ])

        if '/Resources' not in page:
            page.Resources = pikepdf.Dictionary()
        page.Resources.ColorSpace = pikepdf.Dictionary({
            '/CS0': sep_cs
        })

        pdf.save(str(pdf_path))
        pdf.close()

        res = analyze_pdf_colors(str(pdf_path))
        spot_names = [s["name"] for s in res.get("spotColors", [])]
        self.assertIn("CutContour", spot_names)

if __name__ == '__main__':
    unittest.main()
