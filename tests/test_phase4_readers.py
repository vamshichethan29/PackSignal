#!/usr/bin/env python3
"""
Tests for Phase 4 Multi-Source Readers (tests/test_phase4_readers.py)
Verifies:
1. Word reader (.docx) -> paragraph locations
2. Plain-PDF document reader -> page and line, no panels
3. Notes reader (.txt or raw text) -> line numbers as source
4. Images reader (.png/.jpg) -> vision model, facts start AI-suggested
"""

import unittest
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
lib_dir = root / "lib"
if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

from source_pieces import (
    parse_source_file,
    parse_docx_file,
    parse_plain_pdf_file,
    parse_note_file,
    parse_image_file
)

class TestPhase4Readers(unittest.TestCase):

    def setUp(self):
        self.samples_dir = root / "samples" / "organizer"
        self.docx_path = self.samples_dir / "DancingFish_Granola_Product_Spec.docx"
        self.plain_pdf_path = self.samples_dir / "DancingFish_Granola_Tech_Spec.pdf"
        self.txt_path = self.samples_dir / "DancingFish_QA_Notes.txt"
        self.img_path = self.samples_dir / "DancingFish_Old_Design.png"

    def test_docx_reader_paragraph_locations(self):
        result = parse_docx_file(self.docx_path)
        self.assertEqual(result["sourceType"], "docx")
        self.assertGreaterEqual(len(result["pieces"]), 5)

        first = result["pieces"][0]
        self.assertEqual(first["sourceType"], "docx")
        self.assertEqual(first["paragraph"], 1)
        self.assertEqual(first["location"], "Paragraph 1")
        self.assertIsNone(first["panel"], "Word reader must not assign panel")

        for piece in result["pieces"]:
            self.assertIsNotNone(piece["paragraph"])
            self.assertTrue(piece["location"].startswith("Paragraph"))

    def test_plain_pdf_page_and_line_no_panels(self):
        result = parse_plain_pdf_file(self.plain_pdf_path)
        self.assertEqual(result["sourceType"], "plain_pdf")
        self.assertGreaterEqual(len(result["pieces"]), 8)

        first = result["pieces"][0]
        self.assertEqual(first["sourceType"], "plain_pdf")
        self.assertEqual(first["page"], 1)
        self.assertEqual(first["line"], 1)
        self.assertEqual(first["location"], "Page 1, Line 1")
        self.assertIsNone(first["panel"], "Plain-PDF must not assign dieline panels")

        # Verify key technical specs extracted
        all_text = " ".join(p["text"] for p in result["pieces"])
        self.assertIn("1 20000 00003 6", all_text)
        self.assertIn("480 g", all_text)

    def test_notes_reader_line_numbers_source(self):
        result = parse_note_file(self.txt_path)
        self.assertEqual(result["sourceType"], "note")
        self.assertGreaterEqual(len(result["pieces"]), 5)

        for piece in result["pieces"]:
            self.assertEqual(piece["sourceType"], "note")
            self.assertGreaterEqual(piece["line"], 1)
            self.assertEqual(piece["location"], f"Line {piece['line']}")
            self.assertIsNone(piece["panel"])

        # Test raw string content input
        raw_notes = "Line A: Note 1\nLine B: Note 2"
        raw_res = parse_note_file(raw_notes, filename="custom_notes.txt")
        self.assertEqual(len(raw_res["pieces"]), 2)
        self.assertEqual(raw_res["pieces"][0]["location"], "Line 1")
        self.assertEqual(raw_res["pieces"][1]["location"], "Line 2")

    def test_image_reader_facts_start_ai_suggested(self):
        result = parse_image_file(self.img_path)
        self.assertEqual(result["sourceType"], "image")
        self.assertGreaterEqual(len(result["pieces"]), 5)

        for piece in result["pieces"]:
            self.assertEqual(piece["sourceType"], "image")
            self.assertEqual(piece["state"], "AI_SUGGESTED", "Facts from images must start AI_SUGGESTED")
            self.assertTrue(piece["isImageVision"])
            self.assertTrue(piece["location"].startswith("Visual inspection"))

        all_text = " ".join(p["text"] for p in result["pieces"])
        self.assertIn("Dancing Fish Logo", all_text)
        self.assertIn("Packed with Goodness", all_text)
        self.assertIn("Certified Vegan", all_text)

    def test_unified_dispatcher(self):
        d_res = parse_source_file(str(self.docx_path))
        self.assertEqual(d_res["sourceType"], "docx")

        p_res = parse_source_file(str(self.plain_pdf_path), {"is_plain_pdf": True})
        self.assertEqual(p_res["sourceType"], "plain_pdf")

        n_res = parse_source_file(str(self.txt_path))
        self.assertEqual(n_res["sourceType"], "note")

        i_res = parse_source_file(str(self.img_path))
        self.assertEqual(i_res["sourceType"], "image")

if __name__ == '__main__':
    unittest.main()
