"""
PackSignal PDF Preflight Python Unit Tests (tests/test_pdf_preflight.py)
Tests exact computational geometry, coordinate conversions, visibility modes,
drawing sequence occlusions, estimated text height, and dieline clearances.
"""

import unittest
import sys
from pathlib import Path
import math

root_dir = Path(__file__).resolve().parent.parent
lib_dir = root_dir / "lib" / "pdf-preflight"
fixtures_dir = root_dir / "tests" / "fixtures" / "pdf-preflight"

if str(lib_dir) not in sys.path:
    sys.path.insert(0, str(lib_dir))

from coordinates import pdf_pt_to_mm, mm_to_pdf_pt, pdf_to_normalized, normalized_to_rendered_pixels
from geometry import (
    minimum_distance_rect_to_segment,
    point_to_segment_distance,
    segments_intersect,
    classify_line_semantics,
    BOUNDARY_CUT,
    BOUNDARY_CREASE,
    BOUNDARY_UNCLASSIFIED,
)
from runner import run_screening_pipeline


class TestPdfPreflight(unittest.TestCase):

    def test_coordinates_conversion(self):
        # 72 pt = 25.4 mm (exact)
        mm = pdf_pt_to_mm(72.0)
        self.assertAlmostEqual(mm, 25.4, places=4)

        pt = mm_to_pdf_pt(25.4)
        self.assertAlmostEqual(pt, 72.0, places=4)

        # Normalized coordinates with bounds [0, 1]
        norm = pdf_to_normalized([50, 50, 150, 150], [0, 0, 200, 200])
        self.assertEqual(norm, [0.25, 0.25, 0.75, 0.75])

        # Rendered pixel calculation
        pixels = normalized_to_rendered_pixels(norm, 1000, 1000)
        self.assertEqual(pixels, [250, 250, 750, 750])

    def test_exact_rect_to_segment_distance(self):
        # Rectangle from (10, 10) to (30, 30)
        rect = [10, 10, 30, 30]

        # 1. Segment completely to the right at x=40, parallel from y=10 to y=30
        # Expected distance = 40 - 30 = 10.0
        dist = minimum_distance_rect_to_segment(rect, [40, 10], [40, 30])
        self.assertAlmostEqual(dist, 10.0, places=4)

        # 2. Segment intersecting rectangle
        dist_intersect = minimum_distance_rect_to_segment(rect, [0, 20], [50, 20])
        self.assertEqual(dist_intersect, 0.0)

        # 3. Segment with one endpoint inside rectangle
        dist_inside = minimum_distance_rect_to_segment(rect, [20, 20], [50, 50])
        self.assertEqual(dist_inside, 0.0)

        # 4. Segment diagonal to corner (30, 30) -> endpoint at (33, 34)
        # Distance to corner (30, 30) is sqrt(3^2 + 4^2) = 5.0
        dist_corner = minimum_distance_rect_to_segment(rect, [33, 34], [40, 40])
        self.assertAlmostEqual(dist_corner, 5.0, places=4)

    def test_line_classification(self):
        self.assertEqual(classify_line_semantics(layer_name="DIE_CUT_LINE"), BOUNDARY_CUT)
        self.assertEqual(classify_line_semantics(layer_name="CREASE_SCORE"), BOUNDARY_CREASE)
        self.assertEqual(classify_line_semantics(layer_name="Artwork_Layer_Black"), BOUNDARY_UNCLASSIFIED)

    def test_pvp_001_normal_visible(self):
        p = fixtures_dir / "01_normal_visible.pdf"
        res = run_screening_pipeline(str(p))
        self.assertEqual(res["schema"], "packsignal-pdf-preflight/v1")
        # Should have executed checks
        self.assertGreater(len(res["checks"]), 0)
        # Normal visible text should have NO_CONCERN_DETECTED for visibility
        vis_checks = [c for c in res["checks"] if c["checkId"] == "PVP-001"]
        self.assertTrue(any(c["screeningOutcome"] == "NO_CONCERN_DETECTED" for c in vis_checks))

    def test_pvp_001_non_rendering_mode_3(self):
        p = fixtures_dir / "02_non_rendering_mode3.pdf"
        res = run_screening_pipeline(str(p))
        vis_checks = [c for c in res["checks"] if c["checkId"] == "PVP-001"]
        # Must detect non-rendering mode 3
        tr3_check = next((c for c in vis_checks if c.get("technicalState") == "PDF_NONRENDERING_TEXT"), None)
        self.assertIsNotNone(tr3_check)
        self.assertEqual(tr3_check["screeningOutcome"], "SCREENING_WARNING")
        self.assertIn("Tr 3", tr3_check["title"])

    def test_pvp_001_zero_opacity(self):
        p = fixtures_dir / "03_zero_opacity.pdf"
        res = run_screening_pipeline(str(p))
        vis_checks = [c for c in res["checks"] if c["checkId"] == "PVP-001"]
        zero_op = next((c for c in vis_checks if "Zero Opacity" in c["title"]), None)
        self.assertIsNotNone(zero_op)
        self.assertEqual(zero_op["screeningOutcome"], "SCREENING_WARNING")

    def test_pvp_002_covered_opaque_rect(self):
        p = fixtures_dir / "04_covered_opaque_rect.pdf"
        res = run_screening_pipeline(str(p))
        overlap_checks = [c for c in res["checks"] if c["checkId"] == "PVP-002"]
        # Must flag drawing occlusion
        occ = next((c for c in overlap_checks if "Potential Occlusion" in c["title"]), None)
        self.assertIsNotNone(occ)
        self.assertEqual(occ["screeningOutcome"], "SCREENING_WARNING")

    def test_pvp_002_semi_transparent_overlay(self):
        p = fixtures_dir / "05_semi_transparent_overlay.pdf"
        res = run_screening_pipeline(str(p))
        overlap_checks = [c for c in res["checks"] if c["checkId"] == "PVP-002"]
        tint = next((c for c in overlap_checks if "Semi-Transparent" in c["title"]), None)
        self.assertIsNotNone(tint)
        # Semi-transparent overlay should conservatively produce REVIEW_REQUIRED
        self.assertEqual(tint["screeningOutcome"], "REVIEW_REQUIRED")

    def test_pvp_002_text_collision(self):
        p = fixtures_dir / "07_text_collision.pdf"
        res = run_screening_pipeline(str(p))
        overlap_checks = [c for c in res["checks"] if c["checkId"] == "PVP-002"]
        col = next((c for c in overlap_checks if "Text Collision" in c["title"]), None)
        self.assertIsNotNone(col)
        self.assertEqual(col["screeningOutcome"], "SCREENING_WARNING")

    def test_pvp_002_duplicate_stroke_suppression(self):
        p = fixtures_dir / "08_duplicate_stroke_fill.pdf"
        res = run_screening_pipeline(str(p))
        overlap_checks = [c for c in res["checks"] if c["checkId"] == "PVP-002"]
        # Intentional duplicate pass must NOT generate a text collision warning
        col = next((c for c in overlap_checks if "Text Collision" in c["title"]), None)
        self.assertIsNone(col)

    def test_pvp_003_estimated_text_height(self):
        # 12 pt should meet 1.6 mm threshold
        p_above = fixtures_dir / "15_height_above_threshold.pdf"
        res_above = run_screening_pipeline(str(p_above), {"textHeightThresholdMm": 1.6})
        typo_above = [c for c in res_above["checks"] if c["checkId"] == "PVP-003"]
        self.assertTrue(all(c["screeningOutcome"] == "NO_CONCERN_DETECTED" for c in typo_above))

        # 3.5 pt should be flagged below 1.6 mm threshold
        p_below = fixtures_dir / "16_height_below_threshold.pdf"
        res_below = run_screening_pipeline(str(p_below), {"textHeightThresholdMm": 1.6})
        typo_below = [c for c in res_below["checks"] if c["checkId"] == "PVP-003"]
        self.assertTrue(any(c["screeningOutcome"] == "SCREENING_WARNING" for c in typo_below))

    def test_pvp_004_trim_clearance(self):
        p_trim = fixtures_dir / "18_text_near_trim.pdf"
        res = run_screening_pipeline(str(p_trim), {"cutClearanceMm": 2.0})
        clear_checks = [c for c in res["checks"] if c["checkId"] == "PVP-004"]
        # Must detect text near cut line (distance ~0.7 mm < 2.0 mm)
        cut_warn = next((c for c in clear_checks if "Near Cut Line" in c["title"]), None)
        self.assertIsNotNone(cut_warn)
        self.assertEqual(cut_warn["screeningOutcome"], "SCREENING_WARNING")

    def test_pvp_004_no_trim_geometry_fail_safe(self):
        p_notrim = fixtures_dir / "25_no_trim_info.pdf"
        res = run_screening_pipeline(str(p_notrim))
        clear_checks = [c for c in res["checks"] if c["checkId"] == "PVP-004"]
        # Must NOT invent trim line from MediaBox; must return UNABLE_TO_EVALUATE
        unavail = next((c for c in clear_checks if c.get("measurement") == "TRIM_GEOMETRY_UNAVAILABLE"), None)
        self.assertIsNotNone(unavail)
        self.assertEqual(unavail["screeningOutcome"], "UNABLE_TO_EVALUATE")


if __name__ == "__main__":
    unittest.main()
