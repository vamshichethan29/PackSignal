#!/usr/bin/env python3
"""
Unit tests for packaging face detection and identity classification (lib/scan/face-detection.py)
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import importlib.util
face_detection_path = os.path.join(os.path.dirname(__file__), '..', 'lib', 'scan', 'face-detection.py')
spec = importlib.util.spec_from_file_location("face_detection", face_detection_path)
face_detection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(face_detection)


class TestFaceDetection(unittest.TestCase):

    def test_candidate_quadrilateral_valid(self):
        corners = [[40, 50], [440, 45], [450, 610], [35, 600]]
        res = face_detection.detect_candidate_quadrilateral(800, 1000, corners)
        self.assertTrue(res["valid"])
        self.assertGreater(res["area"], 10000)
        self.assertEqual(res["quality"], "high")

    def test_degenerate_quadrilateral_rejected(self):
        # Collinear / zero-area corners
        corners = [[10, 10], [20, 20], [30, 30], [40, 40]]
        res = face_detection.detect_candidate_quadrilateral(800, 1000, corners)
        self.assertFalse(res["valid"])
        self.assertEqual(res["quality"], "degenerate")

    def test_classify_front_pdp(self):
        text = "Dancing Fish Granola Berry Crunch Net Wt 10 oz (283 g) Non-GMO Project Verified"
        res = face_detection.classify_face_identity(text)
        self.assertEqual(res["faceIdentity"], "FRONT")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertIn("Net quantity declaration", res["landmarks"])

    def test_classify_nutrition_facts_right(self):
        text = "Nutrition Facts 8 Servings per container Calories 140 Total Fat 3g % Daily Value"
        res = face_detection.classify_face_identity(text)
        self.assertEqual(res["faceIdentity"], "RIGHT")
        self.assertGreaterEqual(res["confidence"], 0.80)
        self.assertIn("Nutrition Facts header", res["landmarks"])

    def test_classify_ingredients_back(self):
        text = "Ingredients: Whole grain rolled oats, honey, almonds. Contains: Almonds. Store in cool place."
        res = face_detection.classify_face_identity(text)
        self.assertEqual(res["faceIdentity"], "BACK")
        self.assertGreaterEqual(res["confidence"], 0.80)

    def test_classify_barcode_bottom(self):
        text = "012345678905 Lot: 2026-X1 Exp: Nov 2027"
        res = face_detection.classify_face_identity(text, hints={"hasBarcode": True})
        self.assertEqual(res["faceIdentity"], "BOTTOM")

    def test_classify_unknown_when_ambiguous(self):
        text = "lorem ipsum dolor sit amet"
        res = face_detection.classify_face_identity(text)
        self.assertEqual(res["faceIdentity"], "UNKNOWN")
        self.assertTrue(res["needsUserConfirmation"])


if __name__ == '__main__':
    unittest.main()
