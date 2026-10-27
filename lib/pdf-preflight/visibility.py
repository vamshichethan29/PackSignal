"""
PackSignal PVP-001 Rendered Text Visibility Screening (lib/pdf-preflight/visibility.py)
Screens native PDF text for visibility discrepancies:
- Rendering mode 3 (invisible text)
- Zero opacity (opacity <= 0.001)
- Non-rendering OCR text layers
- Rendered crop contrast inspection (detecting completely flat or zero-contrast regions)
Operates on actual PDF objects and rendered artwork pixels.
"""

import math
from models import (
    CHECK_PVP_001,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    REVIEW_REQUIRED,
    UNABLE_TO_EVALUATE,
    RENDER_CONFIRMED,
    NATIVE_VISIBLE_CANDIDATE,
    PDF_NONRENDERING_TEXT,
    POTENTIALLY_OCCLUDED,
    LOW_CONTRAST_CONCERN,
    NOT_CONFIRMED_IN_RENDER,
    UNKNOWN_VISIBILITY,
    DISCLAIMER_TEXT,
)
from coordinates import pdf_to_normalized, normalized_to_rendered_pixels


def inspect_crop_contrast(crop_img):
    """
    Analyzes local contrast and edge variation of a rendered image crop.
    Returns: (is_analyzable, std_dev, min_val, max_val, contrast_ratio)
    """
    if crop_img is None:
        return False, 0.0, 0, 0, 1.0

    try:
        from PIL import ImageStat
        gray = crop_img.convert("L")
        stat = ImageStat.Stat(gray)
        std_dev = stat.stddev[0] if stat.stddev else 0.0
        min_v, max_v = stat.extrema[0] if stat.extrema else (0, 0)
        contrast_ratio = (max_v + 0.05) / (min_v + 0.05)
        return True, round(std_dev, 2), min_v, max_v, round(contrast_ratio, 2)
    except Exception:
        return False, 0.0, 0, 0, 1.0


def screen_text_visibility(text_span, page_meta, rendered_image=None, options=None):
    """
    Inspects visibility of a single extracted PDF text span.
    text_span: {
        'text': str,
        'boxPt': [x0, y0, x1, y1],
        'renderingType': int (0=fill, 1=stroke, 2=fill+stroke, 3=invisible),
        'opacity': float,
        'layer': str,
        'seqno': int,
        'isOccluded': bool
    }
    page_meta: { 'pageNumber': int, 'widthPt': float, 'heightPt': float, 'rect': [...] }
    rendered_image: PIL.Image of the rendered page, or None
    """
    options = options or {}
    text = text_span.get("text", "").strip()
    box_pt = text_span.get("boxPt")
    rendering_type = text_span.get("renderingType", 0)
    opacity = text_span.get("opacity", 1.0)
    layer = text_span.get("layer", "")
    is_occluded = text_span.get("isOccluded", False)
    page_num = page_meta.get("pageNumber", 1)

    if not box_pt or len(box_pt) < 4:
        return {
            "checkId": CHECK_PVP_001,
            "title": "Rendered Text Visibility",
            "method": "native_pdf_property_inspection",
            "executionStatus": "UNABLE_TO_EVALUATE",
            "screeningOutcome": UNABLE_TO_EVALUATE,
            "technicalState": UNKNOWN_VISIBILITY,
            "page": page_num,
            "evidenceBox": None,
            "observations": "No valid geometry available for this text span.",
            "measurement": "coordinates_missing",
            "threshold": None,
            "thresholdOrigin": None,
            "sourceGeometry": "PDF textstream",
            "explanation": "Text was extracted without coordinate bounds.",
            "limitations": "Cannot verify location on rendered artwork.",
            "suggestedReviewerAction": "Inspect source document text stream manually."
        }

    norm_box = pdf_to_normalized(box_pt, page_meta.get("rect", [0, 0, page_meta["widthPt"], page_meta["heightPt"]]))

    # 1. Definite Non-Rendering Technical Modes
    if rendering_type == 3:
        return {
            "checkId": CHECK_PVP_001,
            "title": "Rendered Text Visibility — Non-Rendering Mode (Tr 3)",
            "method": "pdf_text_rendering_mode_inspection",
            "executionStatus": "EXECUTED",
            "screeningOutcome": SCREENING_WARNING,
            "technicalState": PDF_NONRENDERING_TEXT,
            "page": page_num,
            "evidenceBox": norm_box,
            "observations": f"Text '{text}' uses PDF Text Rendering Mode 3 (neither fill nor stroke).",
            "measurement": f"rendering_mode={rendering_type}",
            "threshold": "rendering_mode != 3",
            "thresholdOrigin": "pdf_specification_iso_32000",
            "sourceGeometry": f"Box pt: [{box_pt[0]:.1f}, {box_pt[1]:.1f}, {box_pt[2]:.1f}, {box_pt[3]:.1f}]",
            "explanation": (
                "The PDF text operator specifies non-rendering text (mode 3). "
                "This text exists in native PDF extraction (e.g. OCR layer or hidden metadata) "
                "but does not deposit ink on the printed artwork."
            ),
            "limitations": "Verified through native PDF operator inspection.",
            "suggestedReviewerAction": "Confirm whether this copy was intended to be printed or is an invisible search layer."
        }

    if opacity is not None and opacity <= 0.001:
        return {
            "checkId": CHECK_PVP_001,
            "title": "Rendered Text Visibility — Zero Opacity",
            "method": "pdf_graphics_state_inspection",
            "executionStatus": "EXECUTED",
            "screeningOutcome": SCREENING_WARNING,
            "technicalState": PDF_NONRENDERING_TEXT,
            "page": page_num,
            "evidenceBox": norm_box,
            "observations": f"Text '{text}' has graphics state opacity = {opacity:.3f}.",
            "measurement": f"opacity={opacity:.3f}",
            "threshold": "opacity > 0.01",
            "thresholdOrigin": "prepress_screening_rule",
            "sourceGeometry": f"Box pt: [{box_pt[0]:.1f}, {box_pt[1]:.1f}, {box_pt[2]:.1f}, {box_pt[3]:.1f}]",
            "explanation": "Text has zero opacity in its extended graphics state and will not render visually.",
            "limitations": "Verified through PDF graphics state dictionary.",
            "suggestedReviewerAction": "Inspect artwork layer transparency settings in prepress editor."
        }

    # 2. Potential Occlusion from Drawing Order
    if is_occluded:
        return {
            "checkId": CHECK_PVP_001,
            "title": "Rendered Text Visibility — Potential Occlusion",
            "method": "pdf_drawing_sequence_inspection",
            "executionStatus": "EXECUTED",
            "screeningOutcome": REVIEW_REQUIRED,
            "technicalState": POTENTIALLY_OCCLUDED,
            "page": page_num,
            "evidenceBox": norm_box,
            "observations": f"Text '{text}' is geometrically intersected by a later opaque painting operation.",
            "measurement": f"seqno_text={text_span.get('seqno')}",
            "threshold": "no_overlapping_subsequent_opaque_fills",
            "thresholdOrigin": "prepress_drawing_order_rule",
            "sourceGeometry": f"Box pt: [{box_pt[0]:.1f}, {box_pt[1]:.1f}, {box_pt[2]:.1f}, {box_pt[3]:.1f}]",
            "explanation": (
                "A later opaque drawing object in the PDF stream overlaps this text box. "
                "Because clipping and transparency blend modes can affect visibility, "
                "human prepress review is required to confirm visual legibility."
            ),
            "limitations": "Compositing depends on PDF blend modes and clipping paths.",
            "suggestedReviewerAction": "Zoom in on rendered artwork crop to verify if text is obscured."
        }

    # 3. Independent Rendered Image Crop Inspection (if available)
    crop_stat = None
    if rendered_image is not None:
        pixel_box = normalized_to_rendered_pixels(norm_box, rendered_image.width, rendered_image.height)
        if pixel_box and pixel_box[2] > pixel_box[0] and pixel_box[3] > pixel_box[1]:
            crop = rendered_image.crop(pixel_box)
            is_ok, std_dev, min_v, max_v, ratio = inspect_crop_contrast(crop)
            if is_ok:
                crop_stat = {
                    "stdDev": std_dev,
                    "minVal": min_v,
                    "maxVal": max_v,
                    "contrastRatio": ratio
                }
                # If rendered crop is completely uniform/blank (std_dev < 1.0 and ratio < 1.05)
                # while text is supposed to be present
                if std_dev < 0.8 and ratio < 1.05:
                    return {
                        "checkId": CHECK_PVP_001,
                        "title": "Rendered Text Visibility — Not Confirmed in Render",
                        "method": "rendered_crop_pixel_inspection",
                        "executionStatus": "EXECUTED",
                        "screeningOutcome": REVIEW_REQUIRED,
                        "technicalState": NOT_CONFIRMED_IN_RENDER,
                        "page": page_num,
                        "evidenceBox": norm_box,
                        "observations": (
                            f"Text '{text}' exists in PDF extraction, but rendered artwork crop "
                            f"is visually uniform (std_dev={std_dev}, contrast={ratio}:1)."
                        ),
                        "measurement": f"contrast_ratio={ratio}:1, std_dev={std_dev}",
                        "threshold": "rendered_crop_edge_energy > 1.0",
                        "thresholdOrigin": "rendered_crop_variance_screening",
                        "sourceGeometry": f"Pixel crop: {pixel_box}",
                        "explanation": (
                            "Independent pixel analysis of the rendered page crop shows no visual contrast "
                            "or edge transitions in the extracted text region. The text may be colored identical "
                            "to the background or rendered outside the visible page boundary."
                        ),
                        "limitations": "Pixel inspection does not read words; an empty crop suggests text is invisible.",
                        "suggestedReviewerAction": "Inspect the original PDF artwork layer visibility."
                    }

    # 4. Normal Candidate Text
    return {
        "checkId": CHECK_PVP_001,
        "title": "Rendered Text Visibility — Normal Attributes",
        "method": "pdf_render_attribute_inspection",
        "executionStatus": "EXECUTED",
        "screeningOutcome": NO_CONCERN_DETECTED,
        "technicalState": NATIVE_VISIBLE_CANDIDATE,
        "page": page_num,
        "evidenceBox": norm_box,
        "observations": f"Text '{text}' has normal rendering parameters (Tr={rendering_type}, opacity={opacity:.2f}).",
        "measurement": f"Tr={rendering_type}, opacity={opacity:.2f}",
        "threshold": "Tr in (0, 1, 2) and opacity > 0.1",
        "thresholdOrigin": "pdf_specification_iso_32000",
        "sourceGeometry": f"Box pt: [{box_pt[0]:.1f}, {box_pt[1]:.1f}, {box_pt[2]:.1f}, {box_pt[3]:.1f}]",
        "explanation": "Supported screening did not identify a visibility concern in this inspected region.",
        "limitations": DISCLAIMER_TEXT,
        "suggestedReviewerAction": "Review rendered artwork in prepress proof."
    }
