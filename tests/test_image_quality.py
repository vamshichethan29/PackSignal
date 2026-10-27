#!/usr/bin/env python3
"""
Unit tests for image quality assessment and auto-capture gating (lib/scan/face-detection.py)
"""

import unittest
import sys
import os
import importlib.util

face_detection_path = os.path.join(os.path.dirname(__file__), '..', 'lib', 'scan', 'face-detection.py')
spec = importlib.util.spec_from_file_location("face_detection", face_detection_path)
face_detection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(face_detection)


class TestImageQuality(unittest.TestCase):

    def test_sharp_image_meets_auto_capture_threshold(self):
        # Laplacian variance 145 meets threshold (110)
        res = face_detection.analyze_image_quality(variance=145.0)
        self.assertTrue(res["isSharp"])
        self.assertTrue(res["readyForCapture"])
        self.assertEqual(res["qualityGrade"], "B")

    def test_blurry_image_blocks_auto_capture(self):
        # Laplacian variance 65 is below threshold
        res = face_detection.analyze_image_quality(variance=65.0)
        self.assertFalse(res["isSharp"])
        self.assertFalse(res["readyForCapture"])
        self.assertEqual(res["qualityGrade"], "C")

    def test_excellent_quality_graded_A(self):
        res = face_detection.analyze_image_quality(variance=185.0)
        self.assertTrue(res["isSharp"])
        self.assertEqual(res["qualityGrade"], "A")
        self.assertTrue(res["readyForCapture"])


if __name__ == '__main__':
    unittest.main()
