#!/usr/bin/env python3
"""
Unit tests for Excel Source Cell Extraction (lib/source_piece.py)
Tests:
- Strict columns A–C extraction policy for trusted product facts
- Exclusion of formula-derived scaled calculation columns D+
- Metadata-only extraction of cell E3 ("Draft / In Review") without polluting product facts
- Strict zero-formula execution policy (data_only/cached values with provenance)
- Cell coordinate and sheet provenance
"""

import unittest
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

from source_piece import parse_excel_file

class TestExcelSourceCells(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples_dir = root / "samples" / "organizer"
        cls.xlsx_path = cls.samples_dir / "DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx"

    def test_excel_file_parses_cleanly(self):
        """Excel workbook parses into source pieces and diagnostics."""
        res = parse_excel_file(str(self.xlsx_path))
        self.assertEqual(res["sourceType"], "excel")
        self.assertGreater(len(res["pieces"]), 30)
        self.assertIn("extractionDiagnostics", res)
        diag = res["extractionDiagnostics"]
        self.assertGreater(diag["sheetCount"], 0)
        self.assertGreater(diag["columnsAtoC_populatedCells"], 30)
        self.assertGreater(diag["excludedFormulaColumns"], 0)

    def test_strictly_columns_a_to_c(self):
        """All trusted product pieces must originate exclusively from columns A, B, or C."""
        res = parse_excel_file(str(self.xlsx_path))
        pieces = res["pieces"]
        for p in pieces:
            col = p.get("col") or p.get("location", {}).get("column")
            self.assertIn(col, ["A", "B", "C"], f"Piece '{p['text']}' came from untrusted column {col}")
            cell = p.get("cell") or p.get("location", {}).get("cell")
            self.assertTrue(cell.startswith(("A", "B", "C")), f"Cell coordinate {cell} not in A-C")

    def test_e3_metadata_exception(self):
        """Cell E3 ('Draft / In Review') must be extracted as document-level metadata only."""
        res = parse_excel_file(str(self.xlsx_path))
        # Ensure E3 is NOT in trusted product pieces
        e3_in_pieces = [p for p in res["pieces"] if p.get("cell") == "E3" or p.get("location", {}).get("cell") == "E3"]
        self.assertEqual(len(e3_in_pieces), 0, "Cell E3 must NOT be present in trusted product facts")

        # Ensure E3 IS present in metadataPieces
        metadata_pieces = res.get("metadataPieces", [])
        e3_meta = [p for p in metadata_pieces if p.get("cell") == "E3" or p.get("location", {}).get("cell") == "E3"]
        self.assertGreater(len(e3_meta), 0, "Cell E3 should be captured in metadataPieces")
        self.assertIn("Draft", e3_meta[0]["text"])
        self.assertEqual(e3_meta[0]["classification"], "DOCUMENT_METADATA")

    def test_cell_provenance_and_hash(self):
        """Every cell must contain exact sheet, coordinate, document name, and sha256 hash."""
        res = parse_excel_file(str(self.xlsx_path))
        for p in res["pieces"]:
            self.assertEqual(p["file"], "DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx")
            self.assertIsNotNone(p.get("sheet"))
            self.assertIsNotNone(p.get("cell"))
            self.assertIsNotNone(p.get("documentSha256"))
            self.assertEqual(len(p["documentSha256"]), 64)
            self.assertEqual(p["location"]["sheet"], p["sheet"])
            self.assertEqual(p["location"]["cell"], p["cell"])

    def test_no_formula_execution_flag(self):
        """Spreadsheet parser marks extraction method without formula execution."""
        res = parse_excel_file(str(self.xlsx_path))
        for p in res["pieces"]:
            self.assertEqual(p["extractionMethod"], "excel_cached_cell")
            self.assertFalse(p.get("formulaExecuted", False))

if __name__ == '__main__':
    unittest.main()
