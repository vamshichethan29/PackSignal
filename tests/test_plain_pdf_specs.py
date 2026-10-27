#!/usr/bin/env python3
"""
Unit tests for Plain PDF Specification source piece extraction.
Implements Phase 9, 10 & Phase 34:
- Plain PDF page and line provenance
- Plain PDF is NOT forced into packaging dieline panels
- Minimum source location is PAGE + LINE
- Preserves document identity and SHA-256
"""

import unittest
from pathlib import Path
from lib.source_piece import parse_plain_pdf_file

class TestPlainPdfSpecs(unittest.TestCase):

    def setUp(self):
        self.sample_pdf = Path("samples/organizer/DancingFish_Granola_Tech_Spec.pdf")
        self.assertTrue(self.sample_pdf.exists(), f"Sample PDF missing: {self.sample_pdf}")

    def test_plain_pdf_page_line_provenance(self):
        res = parse_plain_pdf_file(str(self.sample_pdf))
        self.assertEqual(res["sourceType"], "plain_pdf")
        self.assertGreater(len(res["pieces"]), 0)

        # First line
        p1 = res["pieces"][0]
        self.assertEqual(p1["page"], 1)
        self.assertEqual(p1["line"], 1)
        self.assertEqual(p1["location"], "Page 1, Line 1")
        self.assertIn("DANCING FISH", p1["text"])
        self.assertEqual(p1["extractionMethod"], "plain_pdf_line")
        self.assertEqual(p1["classification"], "SPECIFICATION_TEXT")

    def test_not_forced_into_dieline_panels(self):
        res = parse_plain_pdf_file(str(self.sample_pdf))
        for p in res["pieces"]:
            # Plain specifications should not require dieline panel mapping
            self.assertIsNone(p.get("panel"), f"Expected panel to be None for plain PDF spec, got {p.get('panel')}")

    def test_minimum_source_location_is_page_plus_line(self):
        res = parse_plain_pdf_file(str(self.sample_pdf))
        for idx, p in enumerate(res["pieces"]):
            self.assertIsNotNone(p.get("page"))
            self.assertIsNotNone(p.get("line"))
            self.assertEqual(p["location"], f"Page {p['page']}, Line {p['line']}")

    def test_stable_sha256_fingerprint(self):
        res = parse_plain_pdf_file(str(self.sample_pdf))
        first_piece = res["pieces"][0]
        self.assertIsNotNone(first_piece.get("documentSha256"))
        self.assertEqual(len(first_piece["documentSha256"]), 64)

if __name__ == '__main__':
    unittest.main()
