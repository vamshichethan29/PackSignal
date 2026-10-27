#!/usr/bin/env python3
"""
Unit tests for Word (.docx) source piece extraction.
Implements Phase 7 & Phase 34:
- DOCX paragraph provenance
- DOCX table provenance
- No invented page numbers from python-docx alone
- Extraction diagnostics and stable SHA-256 fingerprinting
"""

import unittest
import os
from pathlib import Path
from lib.source_piece import parse_docx_file

class TestDocxSourcePieces(unittest.TestCase):

    def setUp(self):
        self.sample_docx = Path("samples/organizer/DancingFish_Granola_Product_Spec.docx")
        self.assertTrue(self.sample_docx.exists(), f"Sample DOCX missing: {self.sample_docx}")

    def test_docx_paragraph_provenance(self):
        res = parse_docx_file(str(self.sample_docx))
        self.assertEqual(res["sourceType"], "docx")
        self.assertGreater(len(res["pieces"]), 0)

        # Check paragraph numbering and location string
        p2 = next((p for p in res["pieces"] if p.get("paragraph") == 2), None)
        self.assertIsNotNone(p2)
        self.assertEqual(p2["location"], "Paragraph 2")
        self.assertIn("Berry Crunch Granola", p2["text"])
        self.assertEqual(p2["extractionMethod"], "docx_paragraph")
        self.assertEqual(p2["role"], "source")
        self.assertIsNotNone(p2.get("documentSha256"))
        self.assertEqual(len(p2["documentSha256"]), 64)

    def test_docx_style_and_headings(self):
        res = parse_docx_file(str(self.sample_docx))
        p1 = res["pieces"][0]
        self.assertIn("style", p1)
        self.assertIn("sectionHeading", p1)
        self.assertEqual(p1["location"], "Paragraph 1")

    def test_no_invented_page_coordinates(self):
        res = parse_docx_file(str(self.sample_docx))
        for p in res["pieces"]:
            # Word pagination is layout dependent; python-docx must not invent pixel-exact bounding boxes
            self.assertIsNone(p.get("box"))
            self.assertIsNone(p.get("boxNorm"))

    def test_docx_table_handling(self):
        # Verify parser handles table rows if a table exists or doesn't fail on tables
        res = parse_docx_file(str(self.sample_docx))
        self.assertIn("extractionDiagnostics", res)
        self.assertIn("paragraphCount", res["extractionDiagnostics"])
        self.assertIn("tableCount", res["extractionDiagnostics"])

if __name__ == '__main__':
    unittest.main()
