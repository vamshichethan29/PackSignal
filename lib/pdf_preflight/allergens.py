"""
PackSignal Allergen Statement & Formatting Inspector (lib/pdf_preflight/allergens.py)
Inspects allergen declaration wording, formatting cues (bold, uppercase, font size),
and 9 US FDA food allergen categories under FALCPA & the FASTER Act of 2021.
"""

import re
from .models import (
    CHECK_PVP_005,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    REVIEW_REQUIRED,
    UNABLE_TO_EVALUATE,
    create_observation,
    DISCLAIMER_TEXT,
)

# 9 Major US Food Allergens under FALCPA / FASTER Act
FDA_ALLERGENS = {
    "milk": {"name": "Milk", "patterns": [r"\bmilk\b", r"\bwhey\b", r"\bcasein\b", r"\bbutter\b", r"\bcream\b", r"\byogurt\b", r"\bcheese\b"]},
    "eggs": {"name": "Eggs", "patterns": [r"\beggs?\b", r"\balbumin\b", r"\begg\s+white\b", r"\begg\s+yolk\b"]},
    "fish": {"name": "Fish", "patterns": [r"\bfish\b", r"\bsalmon\b", r"\btuna\b", r"\bcod\b", r"\bhaddock\b", r"\btilapia\b", r"\banchov(?:y|ies)\b"]},
    "crustacean_shellfish": {"name": "Crustacean Shellfish", "patterns": [r"\bcrustacean\b", r"\bshellfish\b", r"\bshrimp\b", r"\bcrab\b", r"\blobster\b", r"\bprawns?\b"]},
    "tree_nuts": {"name": "Tree Nuts", "patterns": [r"\btree\s*nuts?\b", r"\balmonds?\b", r"\bwalnuts?\b", r"\bcashews?\b", r"\bpecans?\b", r"\bpistachios?\b", r"\bhazelnuts?\b", r"\bmacadamia\b", r"\bbrazil\s+nuts?\b", r"\bpine\s+nuts?\b", r"\bcoconut\b"]},
    "peanuts": {"name": "Peanuts", "patterns": [r"\bpeanuts?\b", r"\bpeanut\s+butter\b", r"\bpeanut\s+oil\b"]},
    "wheat": {"name": "Wheat", "patterns": [r"\bwheat\b", r"\bspelt\b", r"\bkamut\b", r"\bsemolina\b", r"\bdurum\b", r"\bfarina\b"]},
    "soybeans": {"name": "Soybeans", "patterns": [r"\bsoy(?:beans?|a)?\b", r"\bsoy\s+lecithin\b", r"\bsoy\s+protein\b", r"\btofu\b"]},
    "sesame": {"name": "Sesame", "patterns": [r"\bsesame\b", r"\btahini\b", r"\bsesame\s+seeds?\b", r"\bsesame\s+oil\b"]},
}


def inspect_allergen_statements_and_formatting(text_spans, document_hash="", page_num=1, approved_allergens=None):
    """
    Inspects packaging text for allergen declarations and formatting.
    Evaluates:
    1. Contains statement presence vs Ingredient list disclosures.
    2. Formatting cues (bold, uppercase, italics, font size).
    3. Explicit statutory disclaimer: FALCPA permits declaration either in 'Contains'
       statement OR within ingredient list; bolding is NOT universally mandated by FDA.
    """
    observations = []
    page_spans = [s for s in text_spans if s.get("page") == page_num]
    full_text = " ".join(s.get("text", "") for s in page_spans)

    contains_regex = re.compile(r"\bcontains\s*[:\s]?\s*([^\n\r\.;]+)", re.IGNORECASE)
    contains_match = contains_regex.search(full_text)

    # Detect declared allergen categories
    detected_allergens = {}
    for allergen_id, info in FDA_ALLERGENS.items():
        for pat in info["patterns"]:
            if re.search(pat, full_text, re.IGNORECASE):
                detected_allergens[allergen_id] = info["name"]
                break

    # Find spans mentioning allergens or Contains statement
    for span in page_spans:
        text = span.get("text", "")
        lower_text = text.lower()
        font_hints = span.get("fontStyleHints", {})
        is_bold = font_hints.get("isBold", False)
        is_upper = text.isupper() and len(text) > 3

        # Check for Contains statement span
        if "contains" in lower_text:
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{span['spanId']}_contains_statement",
                check_id=CHECK_PVP_005,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=span["normalizedBox"],
                method="PDF text search & font-style metadata inspection",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[span["spanId"]],
                measured_value=f"Contains statement detected: '{text[:50]}'",
                measurement_unit="statement_declaration",
                classification="CONTAINS_STATEMENT",
                screening_outcome=NO_CONCERN_DETECTED,
                title="Allergen 'Contains' Statement Located",
                explanation=f"Found explicit allergen declaration statement: '{text[:60]}'.",
                reviewer_action="Verify that all intentionally added major food allergens are listed in this statement.",
                evidence={
                    "statementText": text,
                    "isBold": is_bold,
                    "isUppercase": is_upper,
                    "fontName": span.get("fontName"),
                    "fontSizePt": span.get("fontSizePt"),
                    "detectedAllergens": list(detected_allergens.values()),
                    "statutoryNotice": "FALCPA 21 U.S.C. 343(w) requires food source declaration. Formatting (such as bolding) is not universally mandated by federal regulation unless specified by company rulebook.",
                }
            ))

        # Check individual allergen mentions for formatting cues
        for allergen_id, name in detected_allergens.items():
            if re.search(r"\b" + re.escape(allergen_id.replace("_", " ")) + r"\b", lower_text) or re.search(r"\b" + re.escape(name.lower()) + r"\b", lower_text):
                # Informational formatting observation
                formatting_summary = []
                if is_bold:
                    formatting_summary.append("Bold")
                if is_upper:
                    formatting_summary.append("Uppercase")
                if font_hints.get("isItalic"):
                    formatting_summary.append("Italic")
                format_desc = ", ".join(formatting_summary) if formatting_summary else "Standard roman (non-bold)"

                observations.append(create_observation(
                    observation_id=f"obs_p{page_num}_{span['spanId']}_allergen_{allergen_id}",
                    check_id=CHECK_PVP_005,
                    document_id="artwork",
                    document_hash=document_hash,
                    page=page_num,
                    region=span["normalizedBox"],
                    method="Allergen keyword & font-style flag inspection",
                    parser="PyMuPDF",
                    parser_version="1.26+",
                    native_object_ids=[span["spanId"]],
                    measured_value=f"{name} ({format_desc})",
                    measurement_unit="formatting_cue",
                    classification="ALLERGEN_FORMATTING_CUE",
                    screening_outcome=NO_CONCERN_DETECTED if is_bold or is_upper else REVIEW_REQUIRED,
                    title=f"Allergen Formatting Inspection: {name}",
                    explanation=(
                        f"Allergen '{name}' located in text '{text[:40]}' with formatting: {format_desc}. "
                        "Note: US FDA FALCPA does not universally require allergens to be bolded; company guidelines may mandate emphasis."
                    ),
                    reviewer_action="Confirm that allergen disclosure satisfies brand guidelines and destination market requirements.",
                    evidence={
                        "allergenCategory": name,
                        "spanText": text,
                        "isBold": is_bold,
                        "isUppercase": is_upper,
                        "fontName": span.get("fontName"),
                        "fontSizePt": span.get("fontSizePt"),
                    }
                ))
                break

    return observations
