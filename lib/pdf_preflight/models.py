"""
PackSignal PDF Preflight Data Models and Constants (lib/pdf_preflight/models.py)
Defines screening outcomes, visibility states, boundary types, and schemas
for native PDF structural inspection and prepress screening.
"""

# Screening Outcomes (Technical prepress classification)
NO_CONCERN_DETECTED = "NO_CONCERN_DETECTED"
SCREENING_WARNING = "SCREENING_WARNING"
REVIEW_REQUIRED = "REVIEW_REQUIRED"
UNABLE_TO_EVALUATE = "UNABLE_TO_EVALUATE"
NOT_APPLICABLE = "NOT_APPLICABLE"

# Technical Visibility States (PVP-001 & Occlusion)
VISIBLE_CANDIDATE = "VISIBLE_CANDIDATE"
NONRENDERING_TEXT = "NONRENDERING_TEXT"  # Text rendering mode Tr 3
ZERO_OPACITY_TEXT = "ZERO_OPACITY_TEXT"  # Alpha == 0
POTENTIALLY_OCCLUDED = "POTENTIALLY_OCCLUDED"  # Completely covered by later opaque path/rect
PARTIALLY_OCCLUDED_CANDIDATE = "PARTIALLY_OCCLUDED_CANDIDATE"  # Partially covered by later opaque path
OVERLAP_NEEDS_REVIEW = "OVERLAP_NEEDS_REVIEW"  # Independent text collisions
UNKNOWN_VISIBILITY = "UNKNOWN_VISIBILITY"

# Boundary & Linework Semantics
BOUNDARY_CUT = "CUT / TRIM"
BOUNDARY_CREASE = "CREASE / FOLD"
BOUNDARY_GLUE = "GLUE AREA"
BOUNDARY_BLEED = "BLEED BOUNDARY"
BOUNDARY_UNCLASSIFIED = "UNCLASSIFIED LINE"

# Capability IDs
CHECK_PVP_001 = "PVP-001"  # Rendered Text Visibility
CHECK_PVP_002 = "PVP-002"  # Hidden / Overlapping Text
CHECK_PVP_003 = "PVP-003"  # Typography & Text Height
CHECK_PVP_004 = "PVP-004"  # Dieline / Trim Clearance
CHECK_PVP_005 = "PVP-005"  # Allergen Statement & Formatting
CHECK_PVP_006 = "PVP-006"  # Embedded Image Resolution (PPI)
CHECK_PVP_007 = "PVP-007"  # Color-Space Inventory
CHECK_PVP_008 = "PVP-008"  # Optional Content Groups / Layers

# Default Screening Thresholds
DEFAULT_TEXT_HEIGHT_MM = 1.6
DEFAULT_MIN_FONT_SIZE_PT = 6.0
DEFAULT_MIN_IMAGE_PPI = 300.0
DEFAULT_CUT_CLEARANCE_MM = 2.0
DEFAULT_CREASE_CLEARANCE_MM = 1.5

THRESHOLD_ORIGINS = {
    "REVIEWER_DEFINED": "reviewer_defined",
    "COMPANY_RULE": "company_rule",
    "REGULATORY_RULE": "regulatory_rule",
    "ILLUSTRATIVE_DEFAULT": "illustrative_default",
}

DISCLAIMER_TEXT = (
    "These findings are technical preflight screening observations. "
    "They do not establish legal compliance, validated print separations, "
    "guaranteed readability, or production-release approval."
)


def create_observation(
    observation_id,
    check_id,
    document_id,
    document_hash,
    page,
    region,
    method,
    parser,
    parser_version,
    native_object_ids=None,
    drawing_sequence=None,
    source_metadata=None,
    measured_value=None,
    measurement_unit=None,
    threshold=None,
    threshold_origin=None,
    classification=None,
    screening_outcome=None,
    source_rule_id=None,
    evidence=None,
    limitations=None,
    reviewer_action=None,
    title=None,
    explanation=None,
):
    """Factory creating structured, typed technical observation adhering to schema."""
    return {
        "observationId": observation_id,
        "checkId": check_id,
        "title": title or f"Technical Preflight Check ({check_id})",
        "documentId": document_id or "artwork",
        "documentHash": document_hash or "",
        "page": page,
        "region": region,  # [x0, y0, x1, y1] normalized
        "method": method,
        "parser": parser,
        "parserVersion": parser_version,
        "nativeObjectIds": native_object_ids or [],
        "drawingSequence": drawing_sequence,
        "sourceMetadata": source_metadata or {},
        "measuredValue": measured_value,
        "measurementUnit": measurement_unit,
        "threshold": threshold,
        "thresholdOrigin": threshold_origin or THRESHOLD_ORIGINS["ILLUSTRATIVE_DEFAULT"],
        "classification": classification,
        "screeningOutcome": screening_outcome or REVIEW_REQUIRED,
        "sourceRuleId": source_rule_id,
        "evidence": evidence or {},
        "limitations": limitations or [DISCLAIMER_TEXT],
        "reviewerAction": reviewer_action or "Inspect rendered artwork region.",
        "explanation": explanation or "",
    }
