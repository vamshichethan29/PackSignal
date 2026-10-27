#!/usr/bin/env python3
"""
Unit tests for Geometry-Aware Text Reconstruction (lib/source_piece.py)
Tests:
- Letter-spaced text reconstruction ("1 5 g" -> "15 g", energy units, decimals)
- Preservation of rawText, sourceQuads, and transforms
- Preventing false concatenation on legitimate separated numbers
- Curved text reconstruction ("GRANOLA", "PACKED WITH GOODNESS")
- Glyphs and bounding geometry fidelity
"""

import unittest
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

from source_piece import (
    rebuild_letter_spaced_text,
    reconstruct_curved_text_runs,
    parse_pdf_file
)

class TestTextReconstruction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples_dir = root / "samples" / "organizer"
        cls.pdf_path = cls.samples_dir / "DancingFish_Granola_Berry_US_Carton.pdf"

    def test_1_5_g_reconstruction(self):
        """'1 5 g' must reconstruct to '15 g' with transformation record."""
        text, was_rebuilt, trans = rebuild_letter_spaced_text("1 5 g")
        self.assertTrue(was_rebuilt)
        self.assertEqual(text, "15 g")
        self.assertIsNotNone(trans)
        self.assertEqual(trans[0]["type"], "letter_spacing_reconstruction")

    def test_decimal_and_unit_reconstructions(self):
        """Decimals and unit spacing should be reconstructed."""
        # Decimal
        t1, r1, _ = rebuild_letter_spaced_text("2 . 2 g")
        self.assertTrue(r1)
        self.assertEqual(t1, "2.2 g")

        # Energy kJ
        t2, r2, _ = rebuild_letter_spaced_text("1 8 6 8 k J")
        self.assertTrue(r2)
        self.assertEqual(t2, "1868 kJ")

        # Energy kcal
        t3, r3, _ = rebuild_letter_spaced_text("4 4 5 kc a l")
        self.assertTrue(r3)
        self.assertEqual(t3, "445 kcal")

    def test_legitimate_separated_numbers_not_concatenated(self):
        """Legitimate separated text and addresses must NOT be falsely merged."""
        normal_texts = [
            "1 item 5 boxes",
            "1 2 3 Main Street",
            "Box 1 of 5",
            "Contains 2 parts: 1 and 2",
            "Serving size 1 bar 45 g"
        ]
        for s in normal_texts:
            t, r, _ = rebuild_letter_spaced_text(s)
            self.assertFalse(r, f"Legitimate text '{s}' should not be falsely rebuilt into '{t}'")
            self.assertEqual(t, s)

    def test_curved_text_reconstruction_on_official_sample(self):
        """Curved text on carton ('GRANOLA', 'PACKED WITH GOODNESS') is reconstructed."""
        res = parse_pdf_file(str(self.pdf_path))
        pieces = res["pieces"]

        # Check for reconstructed GRANOLA
        granola = [p for p in pieces if "GRANOLA" in p.get("text", "")]
        self.assertGreater(len(granola), 0, "Curved text GRANOLA must be reconstructed")
        g_piece = granola[0]
        self.assertTrue(g_piece.get("isCurved") or g_piece.get("reconstructed"))
        self.assertIsNotNone(g_piece.get("sourceQuads"))
        self.assertEqual(len(g_piece.get("box", [])), 4)

        # Check for PACKED WITH GOODNESS
        packed = [p for p in pieces if "PACKED WITH GOODNESS" in p.get("text", "")]
        self.assertGreater(len(packed), 0, "Curved text PACKED WITH GOODNESS must be reconstructed")
        p_piece = packed[0]
        self.assertTrue(p_piece.get("isCurved") or p_piece.get("reconstructed"))
        self.assertIsNotNone(p_piece.get("sourceQuads"))

    def test_reconstructed_pieces_preserve_raw_text(self):
        """All reconstructed pieces must preserve rawText alongside normalized text."""
        res = parse_pdf_file(str(self.pdf_path))
        reconstructed = [p for p in res["pieces"] if p.get("letterSpacedRebuilt") or p.get("isCurved")]
        self.assertGreater(len(reconstructed), 0)
        for p in reconstructed:
            self.assertIn("rawText", p)
            self.assertIn("text", p)
            self.assertIsNotNone(p["rawText"])
            self.assertIsNotNone(p["text"])
            self.assertIn("transforms", p)

if __name__ == '__main__':
    unittest.main()
