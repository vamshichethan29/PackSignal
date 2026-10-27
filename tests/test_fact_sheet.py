"""
Unit tests for Phase 2 — Facts and the quote check (15–16 Oct)
Tests cover:
1. Fact schema with sources (file, panel or cell)
2. Three states (PROVEN, AI_SUGGESTED, CONFLICT)
3. Value conflict: honey 9% vs 1%
4. Value conflict: carbohydrate 15 g vs 66 g
5. AI meaning conflict: ingredient list differences
6. Vision detection: Certified Vegan mark
7. Unit conversion: 480 g vs 16.9 oz does not become a conflict
8. Sheet notes make a fact AI-suggested
9. Quote check verification
10. Caching by file fingerprint
"""

import unittest
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

from fact_sheet import (
    generate_fact_sheet,
    are_quantities_equivalent,
    verify_quote,
    compute_file_sha256
)

class TestFactSheetPhase2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples_dir = root / "samples" / "organizer"
        cls.pdf_path = cls.samples_dir / "DancingFish_Granola_Berry_US_Carton.pdf"
        cls.xlsx_path = cls.samples_dir / "DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx"

    def test_facts_have_sources_with_file_and_panel_or_cell(self):
        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        self.assertEqual(fact_sheet["status"], "SUCCESS")
        self.assertGreater(len(fact_sheet["allFacts"]), 30)

        for fact in fact_sheet["allFacts"]:
            self.assertIn("file", fact["source"])
            has_location = bool(fact["source"].get("panel") or fact["source"].get("cell"))
            self.assertTrue(has_location, f"Fact {fact['id']} must show its panel or cell")
            self.assertIn(fact["state"], ["PROVEN", "AI_SUGGESTED", "CONFLICT"])

    def test_honey_value_conflict_9_percent_vs_1_percent(self):
        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        honey_conflict = next((c for c in fact_sheet["conflicts"] if c["field"] == "honey_percentage"), None)
        self.assertIsNotNone(honey_conflict, "Expected honey percentage conflict")
        self.assertEqual(honey_conflict["conflictType"], "VALUE_CONFLICT")
        self.assertEqual(honey_conflict["specValue"], "9%")
        self.assertEqual(honey_conflict["artworkValue"], "1%")

    def test_carbohydrate_value_conflict_15g_vs_66g(self):
        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        carb_conflict = next((c for c in fact_sheet["conflicts"] if c["field"] == "total_carbohydrate"), None)
        self.assertIsNotNone(carb_conflict, "Expected carbohydrate conflict")
        self.assertEqual(carb_conflict["conflictType"], "VALUE_CONFLICT")
        self.assertEqual(carb_conflict["specValue"], "15g")
        self.assertEqual(carb_conflict["artworkValue"], "66g")

    def test_ingredient_list_ai_meaning_conflict(self):
        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        ing_conflict = next((c for c in fact_sheet["conflicts"] if c["field"] == "ingredients"), None)
        self.assertIsNotNone(ing_conflict, "Expected ingredient list meaning conflict")
        self.assertEqual(ing_conflict["conflictType"], "AI_MEANING_CONFLICT")
        self.assertGreater(len(ing_conflict["unauthorizedAdditions"]), 0)
        self.assertTrue(any("walnuts" in a.lower() for a in ing_conflict["unauthorizedAdditions"]))

    def test_certified_vegan_mark_found(self):
        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        self.assertTrue(fact_sheet["summary"]["certifiedVeganFound"])
        vegan_mark = next((vm for vm in fact_sheet["visionMarks"] if vm["mark"] == "Certified Vegan"), None)
        self.assertIsNotNone(vegan_mark)
        self.assertEqual(vegan_mark["status"], "DETECTED")
        self.assertIn("Front panel", vegan_mark["panel"])

    def test_net_quantity_unit_conversion_480g_vs_16_9oz(self):
        self.assertTrue(are_quantities_equivalent("480g", "16.9 oz"))
        self.assertTrue(are_quantities_equivalent("480 g", "16.9oz"))

        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        net_qty = next((cmp for cmp in fact_sheet["comparisons"] if cmp.get("field") == "net_quantity"), None)
        self.assertIsNotNone(net_qty)
        self.assertFalse(net_qty["isConflict"], "480 g vs 16.9 oz must not be a conflict")

    def test_sheet_notes_make_fact_ai_suggested(self):
        fact_sheet = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        ai_suggested = [f for f in fact_sheet["specFacts"] if f["state"] == "AI_SUGGESTED"]
        self.assertGreaterEqual(len(ai_suggested), 3)
        for f in ai_suggested:
            self.assertTrue(any(k in (f.get("notes") or "").lower() for k in ["confirm", "assumed", "verify", "provisional"]))

    def test_quote_check_exact_and_rejection(self):
        sample_text = "Store in a cool, dry place. Once opened, keep packaging closed."
        ok, _ = verify_quote("Store in a cool, dry place", sample_text)
        self.assertTrue(ok)

        bad, _ = verify_quote("Store in a warm, moist place", sample_text)
        self.assertFalse(bad)

    def test_caching_by_file_fingerprint(self):
        f1 = compute_file_sha256(self.pdf_path)
        f2 = compute_file_sha256(self.xlsx_path)
        self.assertTrue(len(f1) > 20)
        self.assertTrue(len(f2) > 20)

        sheet1 = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        sheet2 = generate_fact_sheet(str(self.pdf_path), str(self.xlsx_path))
        self.assertEqual(sheet1["fingerprint"], sheet2["fingerprint"])

if __name__ == '__main__':
    unittest.main()
