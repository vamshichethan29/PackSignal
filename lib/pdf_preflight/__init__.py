"""
PackSignal PDF Preflight & Structural Inspection Package (lib/pdf_preflight)
Provides native PDF parsing, drawing-sequence occlusion detection,
rule-based typography verification, allergen formatting analysis,
and prepress metadata extraction.
"""

from .models import (
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    REVIEW_REQUIRED,
    UNABLE_TO_EVALUATE,
    NOT_APPLICABLE,
    VISIBLE_CANDIDATE,
    NONRENDERING_TEXT,
    ZERO_OPACITY_TEXT,
    POTENTIALLY_OCCLUDED,
    PARTIALLY_OCCLUDED_CANDIDATE,
    OVERLAP_NEEDS_REVIEW,
    UNKNOWN_VISIBILITY,
    DISCLAIMER_TEXT,
)

__version__ = "3.0.0"
__schema__ = "packsignal-pdf-inspector/v1"
