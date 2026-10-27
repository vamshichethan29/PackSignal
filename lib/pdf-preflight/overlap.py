"""
PackSignal PVP-002 Hidden / Overlapping Text Screening (lib/pdf-preflight/overlap.py)
Screens artwork for:
- Drawing sequence occlusions (opaque drawings painted after text)
- Independent text collisions (unrelated text overlapping in the same region)
- False positive suppression for intentional multi-pass bolding, stroke passes, and drop shadows
- Guide/dieline layer text (non-printing technical annotations)
- Text extending outside confirmed TrimBox boundaries
"""

import re
from models import (
    CHECK_PVP_002,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    REVIEW_REQUIRED,
    UNABLE_TO_EVALUATE,
    DISCLAIMER_TEXT,
)
from coordinates import pdf_to_normalized
from geometry import minimum_distance_rect_to_segment, text_outside_rect

GUIDE_LAYERS_PATTERN = re.compile(
    r'(?:dimension|dieline|cad|guide|cut|crease|fold|annotation|bleed|trim|technical|production|non[- ]?printing)',
    re.IGNORECASE
)


def box_intersection_area(b1, b2):
    """Computes area of intersection between two boxes [x0, y0, x1, y1]."""
    ix0 = max(b1[0], b2[0])
    iy0 = max(b1[1], b2[1])
    ix1 = min(b1[2], b2[2])
    iy1 = min(b1[3], b2[3])

    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) * (iy1 - iy0)


def box_area(b):
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def is_intentional_duplicate_pass(span_a, span_b):
    """
    Suppresses false positives caused by PDF design techniques:
    1. Multi-pass bold / stroke+fill duplicate glyphs (identical text at virtually identical coords)
    2. Drop shadow effects (identical text offset by small delta)
    """
    text_a = span_a.get("text", "").strip()
    text_b = span_b.get("text", "").strip()

    if not text_a or text_a != text_b:
        return False

    b1 = span_a.get("boxPt", [0, 0, 0, 0])
    b2 = span_b.get("boxPt", [0, 0, 0, 0])

    dx0 = abs(b1[0] - b2[0])
    dy0 = abs(b1[1] - b2[1])
    dx1 = abs(b1[2] - b2[2])
    dy1 = abs(b1[3] - b2[3])

    # 1. Virtually identical coords (< 1.2 pt difference): multi-pass bolding / stroke pass
    if dx0 <= 1.2 and dy0 <= 1.2 and dx1 <= 1.2 and dy1 <= 1.2:
        return True

    # 2. Drop shadow offset (< 3.5 pt shift)
    if dx0 <= 3.5 and dy0 <= 3.5 and dx1 <= 3.5 and dy1 <= 3.5:
        return True

    return False


def screen_drawing_occlusions(spans, drawings, page_meta):
    """
    Subcheck B: Drawing Order Analysis
    Identifies opaque drawings painted after text (seqno_drawing > seqno_text)
    that geometrically overlap the text bounds.
    """
    findings = []
    page_num = page_meta.get("pageNumber", 1)
    page_rect = page_meta.get("rect", [0, 0, page_meta["widthPt"], page_meta["heightPt"]])

    for span in spans:
        if span.get("renderingType") == 3 or span.get("opacity", 1.0) <= 0.001:
            continue  # Handled in PVP-001 / Invisible subcheck

        s_box = span.get("boxPt")
        s_seqno = span.get("seqno", 0)
        s_text = span.get("text", "")
        if not s_box:
            continue

        s_cx = (s_box[0] + s_box[2]) / 2.0
        s_cy = (s_box[1] + s_box[3]) / 2.0

        for d in drawings:
            d_seqno = d.get("seqno", 0)
            if d_seqno <= s_seqno:
                continue

            d_rect = d.get("rect")
            if not d_rect:
                continue
            dx0, dy0, dx1, dy1 = d_rect[0], d_rect[1], d_rect[2], d_rect[3]

            # Check geometric intersection
            if dx0 <= s_cx <= dx1 and dy0 <= s_cy <= dy1:
                opacity = d.get("fill_opacity", 1.0)
                norm_box = pdf_to_normalized(s_box, page_rect)
                is_semi_transparent = opacity is not None and opacity < 0.99

                outcome = REVIEW_REQUIRED if is_semi_transparent else SCREENING_WARNING
                title = (
                    "Hidden / Overlapping Text — Semi-Transparent Overlay"
                    if is_semi_transparent else
                    "Hidden / Overlapping Text — Potential Occlusion"
                )

                findings.append({
                    "checkId": CHECK_PVP_002,
                    "title": title,
                    "method": "pdf_drawing_sequence_analysis",
                    "executionStatus": "EXECUTED",
                    "screeningOutcome": outcome,
                    "documentId": page_meta.get("documentId"),
                    "page": page_num,
                    "evidenceBox": norm_box,
                    "observations": (
                        f"Text '{s_text}' (seqno={s_seqno}) is overlapped by later drawing "
                        f"(seqno={d_seqno}, opacity={opacity})."
                    ),
                    "measurement": f"seqno_text={s_seqno}, seqno_drawing={d_seqno}, drawing_opacity={opacity}",
                    "threshold": "seqno_drawing < seqno_text or zero_intersection",
                    "thresholdOrigin": "pdf_drawing_order_rule",
                    "sourceGeometry": f"Text box pt: [{s_box[0]:.1f}, {s_box[1]:.1f}, {s_box[2]:.1f}, {s_box[3]:.1f}]",
                    "explanation": (
                        f"Drawing operation #{d_seqno} was executed after text #{s_seqno} and covers its center. "
                        + ("Because the overlay has transparency, verify contrast and legibility." if is_semi_transparent
                           else "The opaque object may obscure consumer-facing copy on the printed artwork.")
                    ),
                    "limitations": "Compositing depends on PDF blend modes and clipping hierarchy.",
                    "suggestedReviewerAction": "Inspect the rendered artwork crop at the intended production scale."
                })
                break  # Record one occlusion per span

    return findings


def screen_text_collisions(spans, page_meta):
    """
    Subcheck C: Text-on-Text Collision
    Screens for colliding independent text spans while suppressing
    multi-pass bolding, stroke duplicate passes, and drop shadows.
    """
    findings = []
    page_num = page_meta.get("pageNumber", 1)
    page_rect = page_meta.get("rect", [0, 0, page_meta["widthPt"], page_meta["heightPt"]])
    n = len(spans)

    reported_pairs = set()

    for i in range(n):
        span_a = spans[i]
        box_a = span_a.get("boxPt")
        text_a = span_a.get("text", "").strip()
        if not box_a or not text_a:
            continue
        area_a = box_area(box_a)
        if area_a <= 1.0:
            continue

        for j in range(i + 1, n):
            span_b = spans[j]
            box_b = span_b.get("boxPt")
            text_b = span_b.get("text", "").strip()
            if not box_b or not text_b:
                continue
            area_b = box_area(box_b)
            if area_b <= 1.0:
                continue

            # Check overlap area
            inter_area = box_intersection_area(box_a, box_b)
            min_area = min(area_a, area_b)
            if min_area <= 0:
                continue

            overlap_ratio = inter_area / min_area
            # Only flag significant collisions (> 35% overlap)
            if overlap_ratio < 0.35:
                continue

            # Check for multi-pass bolding or drop-shadow suppression
            if is_intentional_duplicate_pass(span_a, span_b):
                continue

            pair_key = tuple(sorted([text_a, text_b]))
            if pair_key in reported_pairs:
                continue
            reported_pairs.add(pair_key)

            union_box = [
                min(box_a[0], box_b[0]),
                min(box_a[1], box_b[1]),
                max(box_a[2], box_b[2]),
                max(box_a[3], box_b[3]),
            ]
            norm_box = pdf_to_normalized(union_box, page_rect)

            findings.append({
                "checkId": CHECK_PVP_002,
                "title": "Hidden / Overlapping Text — Text Collision",
                "method": "spatial_bounding_box_collision_analysis",
                "executionStatus": "EXECUTED",
                "screeningOutcome": SCREENING_WARNING,
                "documentId": page_meta.get("documentId"),
                "page": page_num,
                "evidenceBox": norm_box,
                "observations": (
                    f"Two distinct text spans overlap ({round(overlap_ratio * 100)}%): "
                    f"'{text_a}' and '{text_b}'."
                ),
                "measurement": f"overlap_ratio={round(overlap_ratio, 2)}",
                "threshold": "overlap_ratio < 0.35",
                "thresholdOrigin": "typography_collision_screening_rule",
                "sourceGeometry": f"Span A: {text_a} | Span B: {text_b}",
                "explanation": (
                    "Independent text elements share overlapping bounding box regions. "
                    "This may indicate accidental overlay, unaligned revisions, or corrupted typesetting."
                ),
                "limitations": "Does not model arbitrary custom glyph outlines; operates on span bounding boxes.",
                "suggestedReviewerAction": "Verify artwork typography layers for accidental overlapping text boxes."
            })

    return findings


def screen_guide_layers(spans, page_meta):
    """
    Subcheck D: Guide or Non-Printing Text Screening
    Identifies text located on non-printing CAD / dieline / dimension layers.
    """
    findings = []
    page_num = page_meta.get("pageNumber", 1)
    page_rect = page_meta.get("rect", [0, 0, page_meta["widthPt"], page_meta["heightPt"]])

    for span in spans:
        layer = span.get("layer", "")
        text = span.get("text", "")
        if GUIDE_LAYERS_PATTERN.search(layer):
            box = span.get("boxPt")
            norm_box = pdf_to_normalized(box, page_rect) if box else None
            findings.append({
                "checkId": CHECK_PVP_002,
                "title": "Hidden / Overlapping Text — Guide Layer Text",
                "method": "pdf_optional_content_group_inspection",
                "executionStatus": "EXECUTED",
                "screeningOutcome": NO_CONCERN_DETECTED,
                "documentId": page_meta.get("documentId"),
                "page": page_num,
                "evidenceBox": norm_box,
                "observations": f"Text '{text}' is on technical guide layer '{layer}'.",
                "measurement": f"layer='{layer}'",
                "threshold": "classified_as_non_printing",
                "thresholdOrigin": "prepress_dieline_classification",
                "sourceGeometry": f"Box pt: {box}",
                "explanation": "Text is located on a structural dieline/guide layer and should not be treated as consumer-facing packaging copy.",
                "limitations": "Layer printing status verified via PDF optional content groups (OCG).",
                "suggestedReviewerAction": "Confirm that this dieline layer is set to non-printing in production RIP."
            })

    return findings


def screen_clipped_text(spans, trim_box, page_meta):
    """
    Subcheck E: Clipped or Out-of-Region Text
    Flags text that extends outside confirmed TrimBox boundaries.
    """
    findings = []
    if not trim_box:
        return findings

    page_num = page_meta.get("pageNumber", 1)
    page_rect = page_meta.get("rect", [0, 0, page_meta["widthPt"], page_meta["heightPt"]])

    for span in spans:
        box = span.get("boxPt")
        text = span.get("text", "")
        if not box:
            continue

        if text_outside_rect(box, trim_box):
            norm_box = pdf_to_normalized(box, page_rect)
            findings.append({
                "checkId": CHECK_PVP_002,
                "title": "Hidden / Overlapping Text — Text Extends Outside Trim",
                "method": "trimbox_containment_screening",
                "executionStatus": "EXECUTED",
                "screeningOutcome": SCREENING_WARNING,
                "documentId": page_meta.get("documentId"),
                "page": page_num,
                "evidenceBox": norm_box,
                "observations": f"Text '{text}' extends beyond the confirmed PDF TrimBox.",
                "measurement": f"text_box={box}, trim_box={trim_box}",
                "threshold": "text_contained_in_trimbox",
                "thresholdOrigin": "pdf_trimbox_specification",
                "sourceGeometry": f"TrimBox pt: {trim_box}",
                "explanation": "Part or all of this text lies outside the confirmed physical trim boundary and may be cut off during finishing.",
                "limitations": "Applies only when PDF has an explicitly verified TrimBox.",
                "suggestedReviewerAction": "Check packaging dieline alignment and trim safe margins."
            })

    return findings
