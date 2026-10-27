#!/usr/bin/env python3
"""
Unit tests for PDF Panel Geometry & Layer Mapping (lib/source_piece.py)
Tests packaging panel polygon/bbox mapping, canonical roles (FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM, FLAP, UNKNOWN),
and PDF Optional Content Group layer classification.
"""

import unittest
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "lib"))

from source_piece import (
    map_bbox_to_panel,
    classify_pdf_layer,
    parse_pdf_file,
    PANEL_ZONES
)

class TestPdfPanels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples_dir = root / "samples" / "organizer"
        cls.pdf_path = cls.samples_dir / "DancingFish_Granola_Berry_US_Carton.pdf"

    def test_canonical_panel_roles_defined(self):
        """All defined panel zones must have valid canonical roles."""
        valid_roles = {'FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'FLAP', 'UNKNOWN'}
        for z in PANEL_ZONES:
            self.assertIn(z['role'], valid_roles, f"Invalid role {z['role']} in panel {z['name']}")
            self.assertEqual(len(z['bbox']), 4, "Bbox must be [x0, y0, x1, y1]")
            self.assertLess(z['bbox'][0], z['bbox'][2])
            self.assertLess(z['bbox'][1], z['bbox'][3])

    def test_panel_mapping_known_coordinates(self):
        """Points clearly inside known panels must map to the expected panel and role."""
        # Front panel center: (800, 600)
        name, role, pid = map_bbox_to_panel([790, 590, 810, 610])
        self.assertEqual(role, 'FRONT')
        self.assertEqual(pid, 'front_panel')

        # Back panel center: (250, 600)
        name, role, pid = map_bbox_to_panel([240, 590, 260, 610])
        self.assertEqual(role, 'BACK')
        self.assertEqual(pid, 'back_panel')

        # Right panel center: (550, 600)
        name, role, pid = map_bbox_to_panel([540, 590, 560, 610])
        self.assertEqual(role, 'RIGHT')
        self.assertEqual(pid, 'right_panel')

        # Left panel center: (1180, 600)
        name, role, pid = map_bbox_to_panel([1170, 590, 1190, 610])
        self.assertEqual(role, 'LEFT')
        self.assertEqual(pid, 'left_panel')

        # Glue flap: (25, 500)
        name, role, pid = map_bbox_to_panel([20, 490, 30, 510])
        self.assertEqual(role, 'FLAP')
        self.assertEqual(pid, 'glue_flap')

    def test_ambiguous_and_outside_coordinates(self):
        """Coordinates outside any package panel must return UNKNOWN / dieline_margin."""
        name, role, pid = map_bbox_to_panel([2000, 2000, 2050, 2050])
        self.assertEqual(role, 'UNKNOWN')
        self.assertEqual(pid, 'dieline_margin')

        name, role, pid = map_bbox_to_panel(None)
        self.assertEqual(role, 'UNKNOWN')
        self.assertEqual(pid, 'unknown')

    def test_layer_classification(self):
        """PDF layer strings must classify accurately without fabricating absent layers."""
        self.assertEqual(classify_pdf_layer('Artwork panel'), 'ARTWORK_PANEL')
        self.assertEqual(classify_pdf_layer('Artwork - CMYK'), 'ARTWORK_PANEL')
        self.assertEqual(classify_pdf_layer('Dieline Cut'), 'DIELINE_CONSTRUCTION')
        self.assertEqual(classify_pdf_layer('Crease lines'), 'DIELINE_CONSTRUCTION')
        self.assertEqual(classify_pdf_layer('Dimensions & Guides'), 'GUIDE_ANNOTATION')
        self.assertEqual(classify_pdf_layer('Notes'), 'GUIDE_ANNOTATION')
        self.assertEqual(classify_pdf_layer(None), 'UNKNOWN')
        self.assertEqual(classify_pdf_layer(''), 'UNKNOWN')

    def test_official_pdf_panel_extraction(self):
        """Official DancingFish PDF extracts pieces with verified panel assignments."""
        res = parse_pdf_file(str(self.pdf_path))
        pieces = res['pieces']
        self.assertGreater(len(pieces), 50)

        # Check front panel pieces exist
        front_pieces = [p for p in pieces if p.get('panelRole') == 'FRONT' or p.get('panel') == 'Front panel (Principal Display Panel)']
        self.assertGreater(len(front_pieces), 5, "Should have multiple Front panel pieces")

        # Check back panel pieces exist
        back_pieces = [p for p in pieces if p.get('panelRole') == 'BACK' or 'Back panel' in str(p.get('panel'))]
        self.assertGreater(len(back_pieces), 5, "Should have multiple Back panel pieces")

        # Check layer is preserved when recoverable
        layers = {p.get('layer') for p in pieces if p.get('layer')}
        self.assertTrue(any(l in ['DESIGN', 'Artwork panel', 'Dimensions and text'] for l in layers), f"Should preserve actual layer name, got: {layers}")

if __name__ == '__main__':
    unittest.main()
