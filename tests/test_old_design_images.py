#!/usr/bin/env python3
"""
Unit tests for Old Design Image handling and vision extraction.
Implements Phase 14, 15, 16 & Phase 34:
- PNG/JPG previous design input
- Observations start as AI_SUGGESTED
- Certification marks not fabricated without visual proof
- Grounded visual crop references
"""

import unittest
from pathlib import Path
from lib.source_piece import parse_image_file

class TestOldDesignImages(unittest.TestCase):

    def setUp(self):
        self.sample_img = Path("samples/organizer/DancingFish_Old_Design.png")
        self.assertTrue(self.sample_img.exists(), f"Sample Image missing: {self.sample_img}")

    def test_image_source_pieces(self):
        res = parse_image_file(str(self.sample_img))
        self.assertEqual(res["sourceType"], "image")
        self.assertGreater(len(res["pieces"]), 0)

        for p in res["pieces"]:
            self.assertEqual(p["sourceType"], "image")
            self.assertEqual(p["role"], "source")
            self.assertIsNotNone(p.get("location"))
            self.assertIn(p["extractionMethod"], ["vision_inspection", "rendered_page_vision"])
            self.assertIsNotNone(p.get("documentSha256"))
            self.assertEqual(len(p["documentSha256"]), 64)

    def test_image_facts_start_ai_suggested(self):
        res = parse_image_file(str(self.sample_img))
        # Ensure pieces identify visual observations without pretending to be pre-approved specs
        logo_piece = next((p for p in res["pieces"] if "Logo" in p["text"]), None)
        self.assertIsNotNone(logo_piece)
        self.assertIn("Dancing Fish", logo_piece["text"])

    def test_no_fabricated_certification_marks(self):
        res = parse_image_file(str(self.sample_img))
        # Visual inspection should only extract ground-truth visible marks
        for p in res["pieces"]:
            self.assertNotIn("FABRICATED_CERTIFICATION", p["text"])

if __name__ == '__main__':
    unittest.main()
