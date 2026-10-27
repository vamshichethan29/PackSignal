"""
Unit tests for Phase 1 — Read files with positions (15 Oct)
Tests cover both Esko sample files:
1. DancingFish_Granola_Berry_US_Carton.pdf
2. DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx
"""

import unittest
from pathlib import Path
import sys

# Ensure lib is on sys.path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

from source_pieces import parse_source_file, parse_pdf_file, parse_excel_file

class TestSourcePiecesPhase1(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples_dir = root / "samples" / "organizer"
        cls.pdf_path = cls.samples_dir / "DancingFish_Granola_Berry_US_Carton.pdf"
        cls.xlsx_path = cls.samples_dir / "DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx"

    def test_both_sample_files_parse(self):
        pdf_res = parse_source_file(str(self.pdf_path))
        self.assertEqual(pdf_res["sourceType"], "pdf")
        self.assertGreater(len(pdf_res["pieces"]), 50)

        xlsx_res = parse_source_file(str(self.xlsx_path))
        self.assertEqual(xlsx_res["sourceType"], "excel")
        self.assertGreater(len(xlsx_res["pieces"]), 30)

    def test_each_piece_shows_file_panel_or_cell(self):
        pdf_res = parse_pdf_file(str(self.pdf_path))
        for piece in pdf_res["pieces"]:
            self.assertEqual(piece["file"], "DancingFish_Granola_Berry_US_Carton.pdf")
            self.assertIsNotNone(piece.get("panel"), f"Missing panel for {piece['text']}")
            self.assertIsInstance(piece.get("box"), list)
            self.assertEqual(len(piece["box"]), 4)

        xlsx_res = parse_excel_file(str(self.xlsx_path))
        for piece in xlsx_res["pieces"]:
            self.assertEqual(piece["file"], "DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx")
            self.assertIsNotNone(piece.get("cell"), f"Missing cell for {piece['text']}")
            self.assertIsNotNone(piece.get("sheet"))
            self.assertIn(piece.get("col"), ["A", "B", "C"])

    def test_excel_columns_a_to_c_only(self):
        xlsx_res = parse_excel_file(str(self.xlsx_path))
        cols = {p["col"] for p in xlsx_res["pieces"]}
        self.assertTrue(cols.issubset({"A", "B", "C"}))
        for p in xlsx_res["pieces"]:
            self.assertTrue(p["cell"].startswith(("A", "B", "C")))

    def test_art_orientation_and_copy_free_in_ignored_list(self):
        pdf_res = parse_pdf_file(str(self.pdf_path))
        ignored_texts = [p["text"].lower() for p in pdf_res["ignoredList"]]
        self.assertTrue(any("art orientation" in t for t in ignored_texts), "Art orientation missing from ignored list")
        self.assertTrue(any("copy free" in t for t in ignored_texts), "Copy free missing from ignored list")

    def test_eu_per_100g_table_marked_hidden(self):
        pdf_res = parse_pdf_file(str(self.pdf_path))
        hidden_texts = [p["text"].lower() for p in pdf_res["hiddenPieces"]]
        has_typical = any("typical values" in t for t in hidden_texts)
        has_per_100g = any("100g" in t for t in hidden_texts)
        self.assertTrue(has_typical or has_per_100g, "EU per-100g table not marked hidden")
        for p in pdf_res["hiddenPieces"]:
            self.assertTrue(p["hidden"])
            self.assertIsNotNone(p.get("hiddenReason"))

    def test_1_5_g_reads_as_15_g(self):
        pdf_res = parse_pdf_file(str(self.pdf_path))
        rebuilt_15g = [p for p in pdf_res["pieces"] if p["text"] == "15 g" and "1 5 g" in p.get("rawText", "")]
        self.assertGreater(len(rebuilt_15g), 0, "Expected '1 5 g' to read as '15 g'")
        target = rebuilt_15g[0]
        self.assertEqual(target["text"], "15 g")
        self.assertTrue(target["letterSpacedRebuilt"])
        self.assertTrue(target["hidden"])

if __name__ == '__main__':
    unittest.main()
