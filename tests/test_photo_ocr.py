#!/usr/bin/env python3
"""
Unit tests for photo local OCR extraction (tests/test_photo_ocr.py)
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.local_ocr import read_artwork, parse_tsv


class TestPhotoOcr(unittest.TestCase):

    def test_read_artwork_fallback_when_file_missing(self):
        lines, err = read_artwork("/path/to/missing.png", 600, 800, 1)
        self.assertEqual(lines, [])
        self.assertIsNotNone(err)

    def test_parse_tsv_word_boxes(self):
        # Sample Tesseract TSV output
        tsv_sample = (
            "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "5\t1\t1\t1\t1\t1\t10\t20\t50\t30\t95\tDancing\n"
            "5\t1\t1\t1\t1\t2\t70\t20\t40\t30\t92\tFish\n"
        )
        lines = parse_tsv(tsv_sample, 600, 800, 1)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["text"], "Dancing Fish")
        self.assertEqual(len(lines[0]["box"]), 4)


if __name__ == '__main__':
    unittest.main()
