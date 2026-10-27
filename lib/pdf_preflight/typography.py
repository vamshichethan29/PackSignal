"""
PackSignal Typography & Font Size Inspector (lib/pdf_preflight/typography.py)
Distinguishes source-reported font size (pt), rendered text-box height (mm),
and physical x-height. Evaluates both rule-based verifications and general screening thresholds.
"""

from .coordinates import pdf_pt_to_mm
from .models import (
    CHECK_PVP_003,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    REVIEW_REQUIRED,
    UNABLE_TO_EVALUATE,
    DEFAULT_TEXT_HEIGHT_MM,
    DEFAULT_MIN_FONT_SIZE_PT,
    THRESHOLD_ORIGINS,
    create_observation,
    DISCLAIMER_TEXT,
)


def inspect_typography_and_text_height(
    text_spans,
    document_hash="",
    page_num=1,
    min_font_size_pt=DEFAULT_MIN_FONT_SIZE_PT,
    min_text_height_mm=DEFAULT_TEXT_HEIGHT_MM,
    rules=None,
    threshold_origin=None,
):
    """
    Evaluates typography for all native text spans on a page.
    Distinguishes:
    1. Native font size in points (pt)
    2. Estimated text-box height in millimeters (mm)
    3. Explicit disclaimer: Font size is not physical x-height.
    """
    observations = []
    rules = rules or []
    threshold_origin = threshold_origin or THRESHOLD_ORIGINS["REVIEWER_DEFINED"]

    # Filter to spans on this page
    spans = [s for s in text_spans if s.get("page") == page_num]

    # Map verified rules if present (e.g. Phase 1 Rulebook rules)
    typo_rules = [r for r in rules if r.get("checkType") == "min_text_size" or "text size" in str(r.get("text", "")).lower()]

    for span in spans:
        font_size_pt = span.get("fontSizePt", 0.0)
        bbox = span.get("bbox", [0, 0, 0, 0])
        box_height_pt = max(0.0, bbox[3] - bbox[1])
        box_height_mm = pdf_pt_to_mm(box_height_pt) or 0.0
        text = span.get("text", "")

        # Ignore empty or single-character punctuation
        if len(text.strip()) <= 1 and not text.isalnum():
            continue

        # Mode A: Rule-Based Verification (if an approved company rule applies)
        matched_rule = None
        for r in typo_rules:
            # Check if scope matches text or panel
            r_scope = r.get("scope", "all")
            if r_scope == "all" or r_scope in text.lower():
                matched_rule = r
                break

        if matched_rule:
            req_size_pt = float(matched_rule.get("minFontSizePt", min_font_size_pt))
            passes = font_size_pt >= (req_size_pt - 0.05)
            status = "MATCH" if passes else "ISSUE"
            outcome = NO_CONCERN_DETECTED if passes else SCREENING_WARNING

            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_rule_typography",
                check_id=CHECK_PVP_003,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="Verified source rule typography verification (native font size pt)",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"]],
                measured_value=font_size_pt,
                measurement_unit="pt",
                threshold=req_size_pt,
                threshold_origin=THRESHOLD_ORIGINS["COMPANY_RULE"],
                source_rule_id=matched_rule.get("id", "TYPO-RULE"),
                classification="RULE_VERIFICATION",
                screening_outcome=outcome,
                title=f"Rule-Based Typography Check: {status}",
                explanation=(
                    f"Reported font size is {font_size_pt} pt (box height {box_height_mm:.2f} mm). "
                    f"Verified source rule '{matched_rule.get('id')}' specifies minimum {req_size_pt} pt. "
                    f"{'Requirement satisfied.' if passes else 'Reported font size is below rule requirement.'}"
                ),
                reviewer_action="Verify physical print legibility and packaging panel placement.",
                evidence={
                    "fontName": span.get("fontName"),
                    "reportedFontSizePt": font_size_pt,
                    "estimatedBoxHeightMm": round(box_height_mm, 2),
                    "xHeightMeasured": False,
                    "xHeightDisclaimer": "Native text-box height is not physical x-height. 21 CFR 101.2 / EU FIC x-height compliance requires microscopic or calibrated print measurement.",
                    "ruleQuotation": matched_rule.get("text", ""),
                }
            ))

        # Mode B: General Typography Screening (against project threshold)
        elif font_size_pt > 0 and (font_size_pt < min_font_size_pt or box_height_mm < min_text_height_mm):
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_screen_typography",
                check_id=CHECK_PVP_003,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="General prepress typography screening (native font size pt & box height mm)",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"]],
                measured_value=font_size_pt,
                measurement_unit="pt",
                threshold=min_font_size_pt,
                threshold_origin=threshold_origin,
                classification="GENERAL_TYPOGRAPHY_SCREEN",
                screening_outcome=SCREENING_WARNING,
                title="Small Typography Screening Warning",
                explanation=(
                    f"Text '{text[:35]}' has native font size {font_size_pt} pt and estimated text-box height {box_height_mm:.2f} mm, "
                    f"which is below the project screening threshold ({min_font_size_pt} pt / {min_text_height_mm} mm). "
                    "This is an internal prepress review prompt, not a confirmed legal labeling violation."
                ),
                reviewer_action="Review text in 2D proof viewer to verify customer readability and print process tolerances.",
                evidence={
                    "fontName": span.get("fontName"),
                    "reportedFontSizePt": font_size_pt,
                    "estimatedBoxHeightMm": round(box_height_mm, 2),
                    "xHeightMeasured": False,
                    "xHeightDisclaimer": "Native text-box height is not physical x-height.",
                }
            ))

    return observations
