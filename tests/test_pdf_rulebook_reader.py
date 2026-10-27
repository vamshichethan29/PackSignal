import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'lib')))
import importlib
pdf_reader = importlib.import_module("pdf-rulebook-reader")

class TestPdfRulebookReader(unittest.TestCase):
    def test_multiline_paragraph_reconstruction(self):
        sample_lines = [
            {"text": "The principal display panel of a food", "bbox": [50, 100, 300, 112], "page": 1, "font_size": 10},
            {"text": "in package form shall bear a declaration", "bbox": [50, 115, 290, 127], "page": 1, "font_size": 10},
            {"text": "of net quantity of contents.", "bbox": [50, 130, 280, 142], "page": 1, "font_size": 10},
            {"text": "21 CFR 101.9 Nutrition labeling.", "bbox": [50, 180, 250, 195], "page": 1, "font_size": 12},
        ]
        paras = pdf_reader.reconstruct_paragraphs_from_lines(sample_lines)
        self.assertEqual(len(paras), 2)
        self.assertIn("in package form shall bear a declaration of net quantity", paras[0]["text"])
        self.assertEqual(paras[0]["page"], 1)

    def test_distinct_columns_not_merged(self):
        col_lines = [
            {"text": "Left column text sentence.", "bbox": [50, 100, 200, 112], "page": 1, "font_size": 10},
            {"text": "Right column text sentence.", "bbox": [300, 100, 450, 112], "page": 1, "font_size": 10},
        ]
        paras = pdf_reader.reconstruct_paragraphs_from_lines(col_lines)
        self.assertEqual(len(paras), 2)

if __name__ == "__main__":
    unittest.main()
