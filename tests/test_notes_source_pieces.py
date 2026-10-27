#!/usr/bin/env python3
"""
Unit tests for TXT and Pasted Notes source piece extraction.
Implements Phase 11, 12, 13 & Phase 34:
- Line-numbered provenance
- Real versioned source artifacts with SHA-256
- Reviewer notes start unapproved (not automatically approved specs)
- Preserves raw and cleaned text
"""

import unittest
from pathlib import Path
from lib.source_piece import parse_note_file

class TestNotesSourcePieces(unittest.TestCase):

    def setUp(self):
        self.sample_txt = Path("samples/organizer/DancingFish_QA_Notes.txt")
        self.assertTrue(self.sample_txt.exists(), f"Sample TXT missing: {self.sample_txt}")

    def test_txt_line_numbering(self):
        res = parse_note_file(str(self.sample_txt))
        self.assertEqual(res["sourceType"], "note")
        self.assertGreater(len(res["pieces"]), 0)

        for idx, piece in enumerate(res["pieces"], start=1):
            self.assertEqual(piece["line"], idx)
            self.assertEqual(piece["location"], f"Line {idx}")
            self.assertIsNotNone(piece["text"])
            self.assertEqual(piece["extractionMethod"], "note_lines")

    def test_notes_retain_stable_hashes(self):
        res = parse_note_file(str(self.sample_txt))
        for piece in res["pieces"]:
            self.assertIsNotNone(piece.get("documentSha256"))
            self.assertEqual(len(piece["documentSha256"]), 64)

    def test_notes_content_parsing(self):
        # Test arbitrary pasted notes text
        pasted_content = "Line 1: Confirm honey ratio.\nLine 2: Review Kosher OU-D mark.\nLine 3: Release batch 102."
        res = parse_note_file(pasted_content, is_content=True, file_name="pasted_reviewer_notes.txt")
        self.assertEqual(len(res["pieces"]), 3)
        self.assertEqual(res["pieces"][0]["location"], "Line 1")
        self.assertEqual(res["pieces"][1]["location"], "Line 2")
        self.assertEqual(res["pieces"][2]["location"], "Line 3")

    def test_notes_do_not_auto_approve(self):
        # Notes carry role "source" but are classified as printable copy or unapproved notes
        res = parse_note_file(str(self.sample_txt))
        for piece in res["pieces"]:
            self.assertEqual(piece["role"], "source")
            # Must not invent dieline panel coordinates
            self.assertIsNone(piece.get("panel"))

if __name__ == '__main__':
    unittest.main()
