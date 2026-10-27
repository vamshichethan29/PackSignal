"""
PackSignal PDF Page Geometry & Clearance Engine (lib/pdf_preflight/geometry.py)
Extracts page boxes (MediaBox, CropBox, TrimBox, BleedBox, ArtBox), verifies box consistency,
and calculates 2D Euclidean clearance to trim and structural dieline lines.
"""

import math
from .coordinates import pdf_pt_to_mm, pdf_to_normalized
from .models import (
    CHECK_PVP_004,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    DEFAULT_CUT_CLEARANCE_MM,
    DEFAULT_CREASE_CLEARANCE_MM,
    BOUNDARY_CUT,
    BOUNDARY_CREASE,
    BOUNDARY_UNCLASSIFIED,
    THRESHOLD_ORIGINS,
    create_observation,
    DISCLAIMER_TEXT,
)


def _rect_to_list(r):
    if not r:
        return None
    return [round(float(r.x0), 2), round(float(r.y0), 2), round(float(r.x1), 2), round(float(r.y1), 2)]


def extract_page_boxes_and_geometry(page, page_num=1):
    """
    Extracts all standard PDF page boxes: MediaBox, CropBox, TrimBox, BleedBox, ArtBox.
    Reports whether each box is explicitly declared or inherited/defaulted.
    """
    rect = page.rect
    media_box = getattr(page, "mediabox", rect)
    crop_box = getattr(page, "cropbox", rect)
    trim_box = getattr(page, "trimbox", None)
    bleed_box = getattr(page, "bleedbox", None)
    art_box = getattr(page, "artbox", None)

    rotation = getattr(page, "rotation", 0) or 0
    w_pt = rect.width
    h_pt = rect.height
    w_mm = pdf_pt_to_mm(w_pt) or 0.0
    h_mm = pdf_pt_to_mm(h_pt) or 0.0

    boxes = {
        "mediaBox": {
            "bbox": _rect_to_list(media_box),
            "isExplicit": True,
            "widthMm": round(pdf_pt_to_mm(media_box.width) or 0.0, 2),
            "heightMm": round(pdf_pt_to_mm(media_box.height) or 0.0, 2),
        },
        "cropBox": {
            "bbox": _rect_to_list(crop_box),
            "isExplicit": crop_box != media_box,
            "widthMm": round(pdf_pt_to_mm(crop_box.width) or 0.0, 2),
            "heightMm": round(pdf_pt_to_mm(crop_box.height) or 0.0, 2),
        },
        "trimBox": {
            "bbox": _rect_to_list(trim_box) if trim_box else _rect_to_list(rect),
            "isExplicit": trim_box is not None and trim_box != media_box,
            "widthMm": round(pdf_pt_to_mm(trim_box.width if trim_box else rect.width) or 0.0, 2),
            "heightMm": round(pdf_pt_to_mm(trim_box.height if trim_box else rect.height) or 0.0, 2),
        },
        "bleedBox": {
            "bbox": _rect_to_list(bleed_box) if bleed_box else _rect_to_list(rect),
            "isExplicit": bleed_box is not None and bleed_box != media_box,
            "widthMm": round(pdf_pt_to_mm(bleed_box.width if bleed_box else rect.width) or 0.0, 2),
            "heightMm": round(pdf_pt_to_mm(bleed_box.height if bleed_box else rect.height) or 0.0, 2),
        },
        "artBox": {
            "bbox": _rect_to_list(art_box) if art_box else None,
            "isExplicit": art_box is not None,
        }
    }

    return {
        "page": page_num,
        "rotation": rotation,
        "dimensions": {
            "widthPt": round(w_pt, 2),
            "heightPt": round(h_pt, 2),
            "widthMm": round(w_mm, 2),
            "heightMm": round(h_mm, 2),
        },
        "boxes": boxes,
        "disclaimer": (
            "PDF document page boxes are metadata containers. They do not constitute proof of physical "
            "die cut accuracy or bleed ink coverage without inspection of actual vector drawing paths."
        )
    }


def _point_to_segment_distance(px, py, x1, y1, x2, y2):
    """Calculates minimum 2D Euclidean distance from point (px, py) to line segment (x1, y1)-(x2, y2)."""
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)

    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    return math.hypot(px - closest_x, py - closest_y)


def _rect_to_segment_distance(rect_bbox, x1, y1, x2, y2):
    """Calculates minimum distance between an axis-aligned rectangle and a segment."""
    rx0, ry0, rx1, ry1 = rect_bbox
    # Sample corners and edge midpoints
    test_points = [
        (rx0, ry0), (rx1, ry0), (rx1, ry1), (rx0, ry1),
        ((rx0 + rx1) / 2, ry0), ((rx0 + rx1) / 2, ry1),
        (rx0, (ry0 + ry1) / 2), (rx1, (ry0 + ry1) / 2),
    ]
    return min(_point_to_segment_distance(px, py, x1, y1, x2, y2) for px, py in test_points)


def inspect_trim_and_dieline_clearance(
    page,
    text_spans,
    document_hash="",
    page_num=1,
    cut_threshold_mm=DEFAULT_CUT_CLEARANCE_MM,
    crease_threshold_mm=DEFAULT_CREASE_CLEARANCE_MM,
    dieline_segments=None,
):
    """
    Evaluates clearance (PVP-004) between text spans and TrimBox edges or dieline cut/crease segments.
    """
    observations = []
    trim_box = getattr(page, "trimbox", None)
    has_explicit_trim = trim_box is not None and trim_box != page.rect
    page_rect = page.rect
    rotation = getattr(page, "rotation", 0) or 0

    page_spans = [s for s in text_spans if s.get("page") == page_num]

    # Evaluate TrimBox edge clearance if explicit TrimBox exists
    if has_explicit_trim:
        tx0, ty0, tx1, ty1 = trim_box.x0, trim_box.y0, trim_box.x1, trim_box.y1
        trim_edges = [
            (tx0, ty0, tx1, ty0),  # top
            (tx1, ty0, tx1, ty1),  # right
            (tx0, ty1, tx1, ty1),  # bottom
            (tx0, ty0, tx0, ty1),  # left
        ]

        for span in page_spans:
            s_bbox = span.get("bbox", [0, 0, 0, 0])
            min_dist_pt = min(_rect_to_segment_distance(s_bbox, x1, y1, x2, y2) for x1, y1, x2, y2 in trim_edges)
            min_dist_mm = pdf_pt_to_mm(min_dist_pt) or 0.0

            if min_dist_mm < cut_threshold_mm:
                observations.append(create_observation(
                    observation_id=f"obs_p{page_num}_{span['spanId']}_trim_proximity",
                    check_id=CHECK_PVP_004,
                    document_id="artwork",
                    document_hash=document_hash,
                    page=page_num,
                    region=span["normalizedBox"],
                    method="2D point-to-segment Euclidean distance to explicit PDF TrimBox",
                    parser="PyMuPDF",
                    parser_version="1.26+",
                    native_object_ids=[span["spanId"]],
                    measured_value=round(min_dist_mm, 2),
                    measurement_unit="mm",
                    threshold=cut_threshold_mm,
                    threshold_origin=THRESHOLD_ORIGINS["REVIEWER_DEFINED"],
                    classification=BOUNDARY_CUT,
                    screening_outcome=SCREENING_WARNING,
                    title="TrimBox Edge Proximity Warning",
                    explanation=(
                        f"Text '{span['text'][:35]}' is located {min_dist_mm:.2f} mm from the PDF TrimBox boundary, "
                        f"which is within the safety clearance margin ({cut_threshold_mm} mm). "
                        "Risk of character clipping during die cutting or guillotine trimming."
                    ),
                    reviewer_action="Shift text inward toward safe area or verify packaging dieline alignment.",
                    evidence={"minDistanceMm": round(min_dist_mm, 2), "trimBoxBbox": [tx0, ty0, tx1, ty1]}
                ))

    # Evaluate Vector Dieline Crease/Cut Clearance if dieline segments are provided or found on page
    if dieline_segments:
        for seg in dieline_segments:
            kind = seg.get("kind", BOUNDARY_UNCLASSIFIED)
            pts = seg.get("points", [])
            if len(pts) < 2:
                continue
            x1, y1 = pts[0][:2]
            x2, y2 = pts[1][:2]
            thresh_mm = crease_threshold_mm if "crease" in kind.lower() or "fold" in kind.lower() else cut_threshold_mm

            for span in page_spans:
                s_bbox = span.get("bbox", [0, 0, 0, 0])
                dist_pt = _rect_to_segment_distance(s_bbox, x1, y1, x2, y2)
                dist_mm = pdf_pt_to_mm(dist_pt) or 0.0

                if dist_mm < thresh_mm:
                    observations.append(create_observation(
                        observation_id=f"obs_p{page_num}_{span['spanId']}_dieline_proximity",
                        check_id=CHECK_PVP_004,
                        document_id="artwork",
                        document_hash=document_hash,
                        page=page_num,
                        region=span["normalizedBox"],
                        method="2D rectangle-to-segment Euclidean minimum distance calculation",
                        parser="PyMuPDF",
                        parser_version="1.26+",
                        native_object_ids=[span["spanId"]],
                        measured_value=round(dist_mm, 2),
                        measurement_unit="mm",
                        threshold=thresh_mm,
                        threshold_origin=THRESHOLD_ORIGINS["REVIEWER_DEFINED"],
                        classification=BOUNDARY_CREASE if "crease" in kind.lower() else BOUNDARY_CUT,
                        screening_outcome=SCREENING_WARNING,
                        title=f"Dieline {kind.upper()} Proximity Warning",
                        explanation=f"Text '{span['text'][:35]}' is {dist_mm:.2f} mm from {kind} line (threshold {thresh_mm} mm).",
                        reviewer_action="Verify fold line clearance to avoid ink cracking on packaging creases.",
                        evidence={"minDistanceMm": round(dist_mm, 2), "boundaryKind": kind}
                    ))

    return observations
