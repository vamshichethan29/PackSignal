"""
PackSignal Hidden and Obscured Text Detector (lib/pdf_preflight/occlusion.py)
Analyzes painting sequences, vector path occlusions, clipping boundaries,
and text collisions with false-positive suppression for drop shadows and multi-pass glyphs.
"""

import math
from .models import (
    CHECK_PVP_001,
    CHECK_PVP_002,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    REVIEW_REQUIRED,
    VISIBLE_CANDIDATE,
    NONRENDERING_TEXT,
    ZERO_OPACITY_TEXT,
    POTENTIALLY_OCCLUDED,
    PARTIALLY_OCCLUDED_CANDIDATE,
    OVERLAP_NEEDS_REVIEW,
    UNKNOWN_VISIBILITY,
    create_observation,
    DISCLAIMER_TEXT,
)


def _rect_intersects(b1, b2):
    """Returns True if bounding boxes b1 and b2 intersect."""
    return not (b1[2] < b2[0] or b1[0] > b2[2] or b1[3] < b2[1] or b1[1] > b2[3])


def _rect_contains(outer, inner, tolerance=1.5):
    """Returns True if outer rectangle completely encloses inner rectangle (within tolerance pt)."""
    return (
        outer[0] <= inner[0] + tolerance
        and outer[1] <= inner[1] + tolerance
        and outer[2] >= inner[2] - tolerance
        and outer[3] >= inner[3] - tolerance
    )


def _intersection_area(b1, b2):
    """Calculates 2D intersection area of two rectangles."""
    ix0 = max(b1[0], b2[0])
    iy0 = max(b1[1], b2[1])
    ix1 = min(b1[2], b2[2])
    iy1 = min(b1[3], b2[3])
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) * (iy1 - iy0)


def detect_text_occlusions_and_visibility(text_spans, drawing_ops, document_hash="", page_num=1):
    """
    Analyzes all text spans on a page against painting sequence and subsequent drawing operations.
    Returns:
    - updated text spans with verified visibilityClassification
    - list of technical preflight observations (PVP-001, PVP-002)
    """
    observations = []

    # Sort drawing operations by sequence number
    sorted_drawings = sorted(drawing_ops, key=lambda d: d.get("seqno", 0))

    # 1. Evaluate Drawing Occlusions (PVP-002)
    for span in text_spans:
        if span.get("page") != page_num:
            continue

        span_bbox = span["bbox"]
        span_seqno = span.get("seqno", 0)
        span_area = max(1e-5, (span_bbox[2] - span_bbox[0]) * (span_bbox[3] - span_bbox[1]))

        # Check for Tr 3 non-rendering mode (PVP-001)
        if span["textRenderingMode"] == 3:
            span["visibilityClassification"] = NONRENDERING_TEXT
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_nonrendering",
                check_id=CHECK_PVP_001,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="PDF operator rendering mode (Tr 3)",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"]],
                drawing_sequence=span_seqno,
                measured_value="Tr 3 (Invisible/Neither fill nor stroke)",
                measurement_unit="rendering_mode",
                threshold="Tr 0 or Tr 1",
                classification=NONRENDERING_TEXT,
                screening_outcome=SCREENING_WARNING,
                title="Non-Rendering Native Text (Tr 3)",
                explanation=f"Text '{span['text'][:40]}' is declared with PDF rendering mode Tr 3 (invisible). It is present in the textstream but not painted on visual artwork.",
                reviewer_action="Verify whether this text is intended strictly for invisible OCR searching or if visible labeling was omitted.",
            ))
            continue

        # Check for zero opacity (PVP-001)
        if span["textOpacity"] <= 0.001:
            span["visibilityClassification"] = ZERO_OPACITY_TEXT
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_zeroopacity",
                check_id=CHECK_PVP_001,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="PDF graphics state text opacity (alpha == 0)",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"]],
                drawing_sequence=span_seqno,
                measured_value=0.0,
                measurement_unit="opacity",
                threshold=0.05,
                classification=ZERO_OPACITY_TEXT,
                screening_outcome=SCREENING_WARNING,
                title="Zero Opacity Native Text (100% Transparent)",
                explanation=f"Text '{span['text'][:40]}' is painted with zero opacity (fully transparent). It is invisible to consumers on printed artwork.",
                reviewer_action="Check whether transparent text was left from a previous packaging revision or template placeholder.",
            ))
            continue

        # Check against later vector drawings (seqno > span_seqno)
        is_occluded = False
        is_partially_occluded = False
        occluding_drawing = None

        for d in sorted_drawings:
            if d["seqno"] <= span_seqno:
                continue

            # If drawing is not an opaque fill, it cannot completely occlude text (e.g. tint overlay)
            if not d.get("isOpaqueFill"):
                continue

            d_bbox = d["bbox"]
            if not _rect_intersects(span_bbox, d_bbox):
                continue

            # Test complete containment
            if _rect_contains(d_bbox, span_bbox, tolerance=1.5):
                is_occluded = True
                occluding_drawing = d
                break

            # Test partial overlap (> 30% area)
            overlap_area = _intersection_area(span_bbox, d_bbox)
            if overlap_area / span_area > 0.30:
                is_partially_occluded = True
                occluding_drawing = d

        if is_occluded and occluding_drawing:
            span["visibilityClassification"] = POTENTIALLY_OCCLUDED
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_occluded",
                check_id=CHECK_PVP_002,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="PDF drawing sequence painting order & 2D geometry enclosure",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"], occluding_drawing["drawingId"]],
                drawing_sequence=span_seqno,
                measured_value=f"Text seqno {span_seqno} completely covered by later opaque path seqno {occluding_drawing['seqno']}",
                measurement_unit="drawing_sequence_order",
                classification=POTENTIALLY_OCCLUDED,
                screening_outcome=SCREENING_WARNING,
                title="Potentially Occluded Native Text",
                explanation=f"Text '{span['text'][:40]}' (seqno {span_seqno}) is geometrically enclosed by a subsequent opaque vector fill (seqno {occluding_drawing['seqno']}). It is likely hidden behind packaging graphics.",
                reviewer_action="Inspect the rendered artwork crop to confirm whether the text is actually hidden by artwork or background graphics.",
                evidence={
                    "textSeqno": span_seqno,
                    "occluderSeqno": occluding_drawing["seqno"],
                    "occluderBbox": occluding_drawing["bbox"],
                    "occluderLayer": occluding_drawing.get("layer", "Default"),
                }
            ))
        elif is_partially_occluded and occluding_drawing:
            span["visibilityClassification"] = PARTIALLY_OCCLUDED_CANDIDATE
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_partial_occlusion",
                check_id=CHECK_PVP_002,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="PDF drawing sequence partial area intersection",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"], occluding_drawing["drawingId"]],
                drawing_sequence=span_seqno,
                measured_value=f"Text seqno {span_seqno} partially intersected by opaque path seqno {occluding_drawing['seqno']}",
                measurement_unit="drawing_sequence_order",
                classification=PARTIALLY_OCCLUDED_CANDIDATE,
                screening_outcome=REVIEW_REQUIRED,
                title="Partially Obscured Text Candidate",
                explanation=f"Text '{span['text'][:40]}' is partially intersected by an opaque vector shape painted later in the PDF drawing order.",
                reviewer_action="Verify that characters are not clipped or obscured by the overlapping design element.",
            ))

    # 2. Evaluate Text Collisions & Overlaps (PVP-002)
    # Compare each pair of text spans on the page
    page_spans = [s for s in text_spans if s.get("page") == page_num]
    for i in range(len(page_spans)):
        s1 = page_spans[i]
        b1 = s1["bbox"]
        for j in range(i + 1, len(page_spans)):
            s2 = page_spans[j]
            b2 = s2["bbox"]

            if not _rect_intersects(b1, b2):
                continue

            # Calculate overlap area
            int_area = _intersection_area(b1, b2)
            area1 = max(1e-5, (b1[2] - b1[0]) * (b1[3] - b1[1]))
            area2 = max(1e-5, (b2[2] - b2[0]) * (b2[3] - b2[1]))
            overlap_ratio = int_area / min(area1, area2)

            if overlap_ratio < 0.40:
                continue

            # --- FALSE POSITIVE SUPPRESSION ---
            # Suppression 1: Multi-pass fill/stroke passes (identical text, nearly identical position)
            if s1["text"].strip() == s2["text"].strip():
                # Legitimate design technique: stroke pass + fill pass, or drop shadow
                dx = abs(b1[0] - b2[0])
                dy = abs(b1[1] - b2[1])
                if dx < 2.5 and dy < 2.5:
                    continue  # Multi-pass stroke/fill glyph rendering

            # Suppression 2: Intentional drop shadow (same string or offset shadow)
            dx = abs(b1[0] - b2[0])
            dy = abs(b1[1] - b2[1])
            if s1["text"] == s2["text"] and (dx < 4.0 and dy < 4.0):
                continue

            # If two distinct strings collide:
            s1["visibilityClassification"] = OVERLAP_NEEDS_REVIEW
            s2["visibilityClassification"] = OVERLAP_NEEDS_REVIEW
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{s1['spanId']}_collide_{s2['spanId']}",
                check_id=CHECK_PVP_002,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=s1["normalizedBox"],
                method="2D text bounding box intersection with false-positive suppression",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[s1["spanId"], s2["spanId"]],
                measured_value=f"Collision ({int(overlap_ratio * 100)}% overlap): '{s1['text'][:25]}' vs '{s2['text'][:25]}'",
                measurement_unit="bounding_box_overlap_ratio",
                threshold=0.40,
                classification=OVERLAP_NEEDS_REVIEW,
                screening_outcome=REVIEW_REQUIRED,
                title="Suspicious Native Text Collision",
                explanation=f"Text '{s1['text'][:30]}' and '{s2['text'][:30]}' overlap spatially by {int(overlap_ratio * 100)}%. These appear to be two conflicting text layers rather than a drop-shadow effect.",
                reviewer_action="Review artwork typography to ensure obsolete copy is not colliding with current packaging claims.",
                evidence={
                    "span1": {"id": s1["spanId"], "text": s1["text"], "bbox": s1["bbox"]},
                    "span2": {"id": s2["spanId"], "text": s2["text"], "bbox": s2["bbox"]},
                    "overlapPercent": round(overlap_ratio * 100, 1),
                }
            ))

    return text_spans, observations
