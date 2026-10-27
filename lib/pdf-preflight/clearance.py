"""
PackSignal PVP-004 Dieline / Trim Clearance Screening (lib/pdf-preflight/clearance.py)
Screens text clearance to trusted cut, trim, and crease lines.
Strictly requires trusted geometry (PDF TrimBox, verified dieline layers, or confirmed DXF linework).
Does NOT invent trim lines from generic PDF MediaBox or CropBox edges.
"""

from models import (
    CHECK_PVP_004,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    UNABLE_TO_EVALUATE,
    DEFAULT_CUT_CLEARANCE_MM,
    DEFAULT_CREASE_CLEARANCE_MM,
    BOUNDARY_CUT,
    BOUNDARY_CREASE,
    BOUNDARY_UNCLASSIFIED,
    THRESHOLD_ORIGINS,
    DISCLAIMER_TEXT,
)
from coordinates import pdf_pt_to_mm, pdf_to_normalized
from geometry import minimum_distance_rect_to_segment, minimum_distance_text_to_boundary


def screen_trim_and_dieline_clearance(text_spans, boundary_segments, page_meta, options=None):
    """
    Evaluates text spans against trusted boundary segments.
    boundary_segments: list of dicts:
        {
            'p1': [x, y],  # in PDF points
            'p2': [x, y],  # in PDF points
            'type': BOUNDARY_CUT | BOUNDARY_CREASE | BOUNDARY_UNCLASSIFIED,
            'source': str
        }
    """
    options = options or {}
    findings = []
    page_num = page_meta.get("pageNumber", 1)
    page_rect = page_meta.get("rect", [0, 0, page_meta["widthPt"], page_meta["heightPt"]])

    # 1. Gate: Trusted Trim / Dieline Geometry Available?
    if not boundary_segments:
        # Explicit fail-safe: DO NOT invent trim lines from MediaBox or CropBox!
        return [{
            "checkId": CHECK_PVP_004,
            "title": "Dieline / Trim Clearance — Geometry Unavailable",
            "method": "dieline_geometry_verification",
            "executionStatus": "UNABLE_TO_EVALUATE",
            "screeningOutcome": UNABLE_TO_EVALUATE,
            "documentId": page_meta.get("documentId"),
            "page": page_num,
            "evidenceBox": None,
            "observations": "No trusted PDF TrimBox or verified CAD dieline geometry was provided for this artwork.",
            "measurement": "TRIM_GEOMETRY_UNAVAILABLE",
            "threshold": None,
            "thresholdOrigin": None,
            "sourceGeometry": "PDF page has MediaBox/CropBox but no verified TrimBox or registered DXF dieline",
            "explanation": (
                "PackSignal does not invent trim boundaries from generic PDF page edges. "
                "Clearance screening requires an explicit PDF TrimBox, spot dieline layer, or registered DXF."
            ),
            "limitations": "MediaBox and CropBox do not represent verified production cut boundaries.",
            "suggestedReviewerAction": "Attach an aligned DXF dieline or supply a PDF with an embedded TrimBox."
        }]

    # Filter into cut, crease, and unclassified segments
    cut_segments = [s for s in boundary_segments if s.get("type") == BOUNDARY_CUT]
    crease_segments = [s for s in boundary_segments if s.get("type") == BOUNDARY_CREASE]
    unclassified = [s for s in boundary_segments if s.get("type") == BOUNDARY_UNCLASSIFIED]

    cut_margin_mm = float(options.get("cutClearanceMm", DEFAULT_CUT_CLEARANCE_MM))
    crease_margin_mm = float(options.get("creaseClearanceMm", DEFAULT_CREASE_CLEARANCE_MM))
    threshold_origin = options.get("thresholdOrigin", THRESHOLD_ORIGINS["REVIEWER_DEFINED"])

    for span in text_spans:
        box_pt = span.get("boxPt")
        text = span.get("text", "").strip()
        if not box_pt or not text:
            continue

        norm_box = pdf_to_normalized(box_pt, page_rect)

        # Check Cut / Trim Clearance
        if cut_segments:
            nearest_cut, cut_dist_pt = minimum_distance_text_to_boundary(box_pt, cut_segments)
            if nearest_cut is not None:
                cut_dist_mm = round(pdf_pt_to_mm(cut_dist_pt), 2)
                if cut_dist_mm <= 0.0:
                    # Text intersects cut line!
                    findings.append({
                        "checkId": CHECK_PVP_004,
                        "title": f"Dieline Clearance — Text Crosses Cut Line ('{text[:30]}')",
                        "method": "exact_rect_to_segment_distance",
                        "executionStatus": "EXECUTED",
                        "screeningOutcome": SCREENING_WARNING,
                        "documentId": page_meta.get("documentId"),
                        "page": page_num,
                        "evidenceBox": norm_box,
                        "observations": f"Text '{text}' geometrically intersects the trusted cut boundary ({nearest_cut.get('source')}).",
                        "measurement": f"0.0 mm (intersects cut segment)",
                        "threshold": f"{cut_margin_mm} mm minimum cut clearance",
                        "thresholdOrigin": threshold_origin,
                        "sourceGeometry": f"Nearest cut segment: {nearest_cut.get('p1')} -> {nearest_cut.get('p2')}",
                        "explanation": "Text crosses the verified cutting path and will be cut through during die finishing.",
                        "limitations": "Calculated via exact 2D segment-to-box intersection.",
                        "suggestedReviewerAction": "Reposition copy away from the packaging cut path."
                    })
                elif cut_dist_mm < cut_margin_mm:
                    # Text within cut clearance margin
                    findings.append({
                        "checkId": CHECK_PVP_004,
                        "title": f"Dieline Clearance — Text Near Cut Line ({cut_dist_mm} mm < {cut_margin_mm} mm)",
                        "method": "exact_rect_to_segment_distance",
                        "executionStatus": "EXECUTED",
                        "screeningOutcome": SCREENING_WARNING,
                        "documentId": page_meta.get("documentId"),
                        "page": page_num,
                        "evidenceBox": norm_box,
                        "observations": (
                            f"Text '{text}' is {cut_dist_mm} mm from the nearest cut line "
                            f"(configured safe margin: {cut_margin_mm} mm)."
                        ),
                        "measurement": f"{cut_dist_mm} mm",
                        "threshold": f"{cut_margin_mm} mm",
                        "thresholdOrigin": threshold_origin,
                        "sourceGeometry": f"Nearest cut segment: {nearest_cut.get('p1')} -> {nearest_cut.get('p2')} ({nearest_cut.get('source')})",
                        "explanation": (
                            f"Text lies within the reviewer-configured cut-clearance margin ({cut_dist_mm} mm < {cut_margin_mm} mm). "
                            "Manufacturing die movement and registration drift could trim into copy."
                        ),
                        "limitations": "Clearance screening identifies proximity; press tolerances vary by converter.",
                        "suggestedReviewerAction": "Verify packaging die tolerance and safe margin with converter."
                    })

        # Check Crease / Fold Clearance
        if crease_segments:
            nearest_crease, crease_dist_pt = minimum_distance_text_to_boundary(box_pt, crease_segments)
            if nearest_crease is not None:
                crease_dist_mm = round(pdf_pt_to_mm(crease_dist_pt), 2)
                if crease_dist_mm < crease_margin_mm:
                    findings.append({
                        "checkId": CHECK_PVP_004,
                        "title": f"Dieline Clearance — Text Near Crease Line ({crease_dist_mm} mm < {crease_margin_mm} mm)",
                        "method": "exact_rect_to_segment_distance",
                        "executionStatus": "EXECUTED",
                        "screeningOutcome": SCREENING_WARNING,
                        "documentId": page_meta.get("documentId"),
                        "page": page_num,
                        "evidenceBox": norm_box,
                        "observations": (
                            f"Text '{text}' is {crease_dist_mm} mm from the nearest crease/fold line "
                            f"(configured safe margin: {crease_margin_mm} mm)."
                        ),
                        "measurement": f"{crease_dist_mm} mm",
                        "threshold": f"{crease_margin_mm} mm",
                        "thresholdOrigin": threshold_origin,
                        "sourceGeometry": f"Nearest crease segment: {nearest_crease.get('p1')} -> {nearest_crease.get('p2')}",
                        "explanation": (
                            f"Text lies within the crease clearance margin ({crease_dist_mm} mm < {crease_margin_mm} mm). "
                            "Folding along this crease may cause fiber cracking or legibility distortion across the score line."
                        ),
                        "limitations": "Calculated via exact Euclidean distance to crease line.",
                        "suggestedReviewerAction": "Ensure copy does not break across critical fold creases."
                    })

    # If no warnings triggered for trusted boundary
    if not findings:
        findings.append({
            "checkId": CHECK_PVP_004,
            "title": "Dieline / Trim Clearance — Confirmed Clear",
            "method": "exact_rect_to_segment_distance",
            "executionStatus": "EXECUTED",
            "screeningOutcome": NO_CONCERN_DETECTED,
            "documentId": page_meta.get("documentId"),
            "page": page_num,
            "evidenceBox": None,
            "observations": f"All inspected text spans maintain at least {cut_margin_mm} mm cut and {crease_margin_mm} mm crease clearance.",
            "measurement": f"Cut clearance >= {cut_margin_mm} mm, crease clearance >= {crease_margin_mm} mm",
            "threshold": f"Cut: {cut_margin_mm} mm, Crease: {crease_margin_mm} mm",
            "thresholdOrigin": threshold_origin,
            "sourceGeometry": f"{len(boundary_segments)} trusted boundary segments inspected",
            "explanation": "No text spans violated configured dieline or trim safe margins.",
            "limitations": DISCLAIMER_TEXT,
            "suggestedReviewerAction": "Review structural dieline in 3D fold simulation."
        })

    return findings
