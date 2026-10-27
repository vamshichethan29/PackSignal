"""
PackSignal PVP-003 Estimated Text Height Screening (lib/pdf-preflight/typography.py)
Measures approximate text-box height converted to physical millimeters
using verified PDF coordinate scaling (1 pt = 25.4 / 72 mm).
Strictly separates approximate text-box height from validated font x-height.
Provides configurable reviewer screening thresholds with explicit provenance.
"""

import math
from models import (
    CHECK_PVP_003,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    UNABLE_TO_EVALUATE,
    DEFAULT_TEXT_HEIGHT_MM,
    THRESHOLD_ORIGINS,
    DISCLAIMER_TEXT,
)
from coordinates import pdf_pt_to_mm, pdf_to_normalized


def screen_text_height(text_span, page_meta, options=None):
    """
    Evaluates estimated text-box height of a text span against configurable screening threshold.
    text_span: {
        'text': str,
        'boxPt': [x0, y0, x1, y1],
        'fontSizePt': float,
        'glyphHeightPt': float
    }
    page_meta: {
        'pageNumber': int,
        'widthPt': float,
        'heightPt': float,
        'hasVectorGeometry': bool,
        'rect': [...]
    }
    options: {
        'textHeightThresholdMm': float,
        'thresholdOrigin': str,
        'companyRuleId': str
    }
    """
    options = options or {}
    text = text_span.get("text", "").strip()
    box_pt = text_span.get("boxPt")
    page_num = page_meta.get("pageNumber", 1)
    page_rect = page_meta.get("rect", [0, 0, page_meta.get("widthPt", 0), page_meta.get("heightPt", 0)])

    # 1. Physical Dimension Validation
    has_vector = page_meta.get("hasVectorGeometry", True)
    if not has_vector or page_meta.get("widthPt", 0) <= 0 or page_meta.get("heightPt", 0) <= 0:
        return {
            "checkId": CHECK_PVP_003,
            "title": "Estimated Text Height — Physical Size Unknown",
            "method": "physical_dimension_verification",
            "executionStatus": "UNABLE_TO_EVALUATE",
            "screeningOutcome": UNABLE_TO_EVALUATE,
            "documentId": page_meta.get("documentId"),
            "page": page_num,
            "evidenceBox": None,
            "observations": "Artwork page lacks verified physical dimensions or is raster without DPI metadata.",
            "measurement": "UNABLE_TO_EVALUATE_PHYSICAL_HEIGHT",
            "threshold": None,
            "thresholdOrigin": None,
            "sourceGeometry": "Unknown raster scaling",
            "explanation": "Cannot calculate millimeter dimensions without verified physical DPI or vector page units.",
            "limitations": "Arbitrary raster pixels cannot be multiplied by 25.4 / 72 without known physical resolution.",
            "suggestedReviewerAction": "Specify artwork physical dimensions or upload vector PDF."
        }

    if not box_pt or len(box_pt) < 4:
        return None

    # Calculate native height in PDF points
    # Priority: explicit glyphHeightPt, else bounding box height
    glyph_h_pt = text_span.get("glyphHeightPt")
    if glyph_h_pt is None or glyph_h_pt <= 0:
        glyph_h_pt = abs(box_pt[3] - box_pt[1])

    if glyph_h_pt <= 0:
        return None

    # Convert to physical millimeters
    est_height_mm = round(pdf_pt_to_mm(glyph_h_pt), 2)
    font_size_pt = round(text_span.get("fontSizePt", glyph_h_pt), 1)

    # Resolve screening threshold
    threshold_val = float(options.get("textHeightThresholdMm", DEFAULT_TEXT_HEIGHT_MM))
    threshold_origin = options.get("thresholdOrigin", THRESHOLD_ORIGINS["ILLUSTRATIVE_DEFAULT"])
    rule_id = options.get("companyRuleId", "REVIEWER-SCREENING-SETTING")

    norm_box = pdf_to_normalized(box_pt, page_rect)

    if est_height_mm < threshold_val:
        return {
            "checkId": CHECK_PVP_003,
            "title": f"Estimated Text Height ({est_height_mm} mm) Below Configured Threshold",
            "method": "approximate_native_glyph_span_height",
            "executionStatus": "EXECUTED",
            "screeningOutcome": SCREENING_WARNING,
            "documentId": page_meta.get("documentId"),
            "page": page_num,
            "evidenceBox": norm_box,
            "observations": (
                f"Estimated text-box height for '{text}' is {est_height_mm} mm "
                f"(native font size: {font_size_pt} pt)."
            ),
            "measurement": f"{est_height_mm} mm (approximate native span height)",
            "threshold": f"{threshold_val} mm",
            "thresholdOrigin": threshold_origin,
            "sourceRuleId": rule_id,
            "sourceGeometry": f"Box pt: [{box_pt[0]:.1f}, {box_pt[1]:.1f}, {box_pt[2]:.1f}, {box_pt[3]:.1f}]",
            "explanation": (
                f"The estimated text-box height ({est_height_mm} mm) is below the "
                f"configured screening threshold ({threshold_val} mm). "
                "This is a prepress screening indicator to inspect physical print size and legibility."
            ),
            "limitations": (
                "Estimated text-box height is an approximation based on PDF glyph/span bounds. "
                "It does NOT represent a true measured font x-height or legal statutory certification."
            ),
            "suggestedReviewerAction": (
                "Verify actual printed copy legibility and measure true x-height on packaging proof if required."
            )
        }
    else:
        return {
            "checkId": CHECK_PVP_003,
            "title": f"Estimated Text Height ({est_height_mm} mm) Meets Screening Threshold",
            "method": "approximate_native_glyph_span_height",
            "executionStatus": "EXECUTED",
            "screeningOutcome": NO_CONCERN_DETECTED,
            "documentId": page_meta.get("documentId"),
            "page": page_num,
            "evidenceBox": norm_box,
            "observations": (
                f"Estimated text-box height for '{text}' is {est_height_mm} mm "
                f"(meets screening threshold of {threshold_val} mm)."
            ),
            "measurement": f"{est_height_mm} mm",
            "threshold": f"{threshold_val} mm",
            "thresholdOrigin": threshold_origin,
            "sourceRuleId": rule_id,
            "sourceGeometry": f"Box pt: [{box_pt[0]:.1f}, {box_pt[1]:.1f}, {box_pt[2]:.1f}, {box_pt[3]:.1f}]",
            "explanation": "Estimated text-box height satisfies the reviewer-configured screening threshold.",
            "limitations": DISCLAIMER_TEXT,
            "suggestedReviewerAction": "No typography clearance action needed based on this screening setting."
        }
