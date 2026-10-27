"""
Unit tests for Phase 3 — Rules, requirements and questions (16 Oct)
Tests cover:
1. Market pack loader (all US values live in markets/us/)
2. Added-sugar claim flag
3. Tree-nut "may contain" problem flag
4. Wrong daily values flag
5. Calorie math flag
6. Serving-size math flag
7. Barcode check digit pass
8. At most 10 questions with AI wording and reason
9. Design keep/change questions feeding brief
10. Engine code contains no US-specific values
"""

import unittest
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

from requirements_engine import evaluate_phase3, load_market_pack, verify_upc_check_digit

class TestRequirementsPhase3(unittest.TestCase):
    def test_loads_us_market_pack_with_20_rules(self):
        pack = load_market_pack("us")
        self.assertEqual(pack["market"], "US")
        self.assertGreaterEqual(len(pack["rules"]), 18)
        self.assertLessEqual(len(pack["rules"]), 25)
        self.assertIn("sodium", pack["dailyValues"])

    def test_flags_added_sugar_claim(self):
        res = evaluate_phase3()
        self.assertTrue(res["flags"]["addedSugarClaim"])

    def test_flags_tree_nut_may_contain(self):
        res = evaluate_phase3()
        self.assertTrue(res["flags"]["treeNutMayContainProblem"])

    def test_flags_wrong_daily_values(self):
        res = evaluate_phase3()
        self.assertTrue(res["flags"]["wrongDailyValues"])

    def test_flags_calorie_math(self):
        res = evaluate_phase3()
        self.assertTrue(res["flags"]["calorieMath"])

    def test_flags_serving_size_math(self):
        res = evaluate_phase3()
        self.assertTrue(res["flags"]["servingSizeMath"])

    def test_barcode_check_digit_passes(self):
        self.assertTrue(verify_upc_check_digit("120000000036"))
        res = evaluate_phase3()
        self.assertTrue(res["flags"]["barcodeValid"])
        self.assertTrue(res["summary"]["barcodePassed"])

    def test_at_most_10_questions_ranked_by_impact(self):
        res = evaluate_phase3()
        qs = res["questions"]
        self.assertLessEqual(len(qs), 10)
        self.assertGreaterEqual(len(qs), 8)

        # Check ranking
        ranks = [q["rank"] for q in qs]
        self.assertEqual(ranks, sorted(ranks))

        # Check AI wording and reason
        for q in qs:
            self.assertGreater(len(q["question"]), 15)
            self.assertGreater(len(q["reason"]), 10)

    def test_design_keep_change_questions_cover_brand_assets(self):
        res = evaluate_phase3()
        design_qs = [q for q in res["questions"] if "brandAsset" in q]
        assets = {q["brandAsset"] for q in design_qs}
        self.assertTrue({"logo", "product_photo", "colours", "tagline", "marks"}.issubset(assets))

    def test_no_us_specific_values_in_engine_code(self):
        engine_file = root / "lib" / "requirements-engine.mjs"
        content = engine_file.read_text(encoding="utf-8")
        # FDA reference constants like 2300mg sodium or 275g carbs must not be in engine
        self.assertNotIn("2300", content)
        self.assertNotIn("275", content)

        # They must live in markets/us/
        us_dv = root / "markets" / "us" / "daily-values.json"
        self.assertTrue(us_dv.exists())
        dv_content = us_dv.read_text(encoding="utf-8")
        self.assertIn("2300", dv_content)
        self.assertIn("275", dv_content)

if __name__ == '__main__':
    unittest.main()
