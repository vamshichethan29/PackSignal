#!/usr/bin/env python3
"""
Unit tests for perspective rectification homography (lib/scan/perspective-rectification.py)
"""

import unittest
import sys
import os
import importlib.util

rectification_path = os.path.join(os.path.dirname(__file__), '..', 'lib', 'scan', 'perspective-rectification.py')
spec = importlib.util.spec_from_file_location("perspective_rectification", rectification_path)
rectification = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rectification)


class TestPerspectiveRectification(unittest.TestCase):

    def test_rectification_valid_convex_quad(self):
        corners = [[40.0, 50.0], [440.0, 45.0], [450.0, 610.0], [35.0, 600.0]]
        res = rectification.compute_rectification(corners, target_width=600, target_height=800)
        self.assertTrue(res["success"])
        self.assertIsNotNone(res["homographyForward"])
        self.assertIsNotNone(res["homographyInverse"])
        self.assertEqual(len(res["homographyForward"]), 9)
        self.assertEqual(res["destinationSize"]["width"], 600)
        self.assertEqual(res["destinationSize"]["height"], 800)

    def test_reject_self_intersecting_quad(self):
        # Bow-tie / crossed corners
        corners = [[40.0, 50.0], [450.0, 610.0], [440.0, 45.0], [35.0, 600.0]]
        res = rectification.compute_rectification(corners)
        self.assertFalse(res["success"])
        self.assertIn("non-convex", res["error"])

    def test_reject_insufficient_corners(self):
        corners = [[40.0, 50.0], [440.0, 45.0], [450.0, 610.0]]
        res = rectification.compute_rectification(corners)
        self.assertFalse(res["success"])
        self.assertIn("Exactly 4 corners", res["error"])


if __name__ == '__main__':
    unittest.main()
