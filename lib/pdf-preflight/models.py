"""
PackSignal PDF Preflight Data Models and Constants (lib/pdf-preflight/models.py)
Defines screening outcomes, visibility states, boundary types, and schemas
for conservative prepress inspection.
"""

# Screening Outcomes (Conservative prepress classification)
NO_CONCERN_DETECTED = "NO_CONCERN_DETECTED"
SCREENING_WARNING = "SCREENING_WARNING"
REVIEW_REQUIRED = "REVIEW_REQUIRED"
UNABLE_TO_EVALUATE = "UNABLE_TO_EVALUATE"
NOT_APPLICABLE = "NOT_APPLICABLE"

# Technical Visibility States (PVP-001)
RENDER_CONFIRMED = "RENDER_CONFIRMED"
NATIVE_VISIBLE_CANDIDATE = "NATIVE_VISIBLE_CANDIDATE"
PDF_NONRENDERING_TEXT = "PDF_NONRENDERING_TEXT"
POTENTIALLY_OCCLUDED = "POTENTIALLY_OCCLUDED"
LOW_CONTRAST_CONCERN = "LOW_CONTRAST_CONCERN"
NOT_CONFIRMED_IN_RENDER = "NOT_CONFIRMED_IN_RENDER"
UNKNOWN_VISIBILITY = "UNKNOWN_VISIBILITY"

# Boundary & Linework Semantics (PVP-004)
BOUNDARY_CUT = "CUT / TRIM"
BOUNDARY_CREASE = "CREASE / FOLD"
BOUNDARY_GLUE = "GLUE AREA"
BOUNDARY_BLEED = "BLEED BOUNDARY"
BOUNDARY_UNCLASSIFIED = "UNCLASSIFIED LINE"

# Capability IDs
CHECK_PVP_001 = "PVP-001"  # Rendered Text Visibility
CHECK_PVP_002 = "PVP-002"  # Hidden / Overlapping Text
CHECK_PVP_003 = "PVP-003"  # Estimated Text Height
CHECK_PVP_004 = "PVP-004"  # Dieline / Trim Clearance

# Default Screening Thresholds (Illustrative reviewer-configurable defaults)
DEFAULT_TEXT_HEIGHT_MM = 1.6
DEFAULT_CUT_CLEARANCE_MM = 2.0
DEFAULT_CREASE_CLEARANCE_MM = 1.5

THRESHOLD_ORIGINS = {
    "REVIEWER_DEFINED": "reviewer_defined",
    "COMPANY_RULE": "company_rule",
    "REGULATORY_RULE": "regulatory_rule",
    "ILLUSTRATIVE_DEFAULT": "illustrative_default",
}

DISCLAIMER_TEXT = (
    "These results are limited technical prepress screening observations. "
    "They do not establish legal labeling compliance, guaranteed readability, "
    "manufacturing tolerance conformance, or print-release authorization."
)
