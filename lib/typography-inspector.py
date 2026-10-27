"""Native PDF Font Size and Legibility Inspector.
Uses PyMuPDF to inspect actual PDF text spans, font metadata, point sizes,
x-height estimation, allergen typography emphasis, and legibility thresholds.
Conforms to EU Regulation 1169/2011 and FDA 21 CFR 101.9 packaging standards.
"""
import sys, json, math, re
from pathlib import Path

PT_TO_MM = 25.4 / 72.0
EU_MANDATORY_XHEIGHT_MM = 1.2
EU_SMALL_PACK_XHEIGHT_MM = 0.9
DEFAULT_MIN_FONT_SIZE_PT = 6.0
NUTRITION_HEADER_MIN_PT = 8.0

ALLERGEN_TERMS = {
    'milk', 'dairy', 'egg', 'eggs', 'peanut', 'peanuts', 'tree nut', 'tree nuts',
    'almond', 'almonds', 'hazelnut', 'hazelnuts', 'walnut', 'walnuts', 'cashew',
    'cashews', 'pecan', 'pecans', 'brazil nut', 'pistachio', 'macadamia', 'wheat',
    'gluten', 'soy', 'soya', 'soybean', 'soybeans', 'fish', 'crustacean', 'crustaceans',
    'shellfish', 'mollusc', 'molluscs', 'celery', 'mustard', 'sesame', 'sulphur dioxide',
    'sulphites', 'sulfites', 'lupin', 'oat', 'oats', 'barley', 'rye'
}

def classify_text_category(text):
    t = text.lower()
    if any(k in t for k in ['nutrition facts', 'nutritional information', 'per 100g', 'per serving', 'energy', 'calories', 'total fat']):
        return 'nutrition'
    if any(k in t for k in ['ingredients:', 'ingredients', 'contains:']):
        return 'ingredients'
    if any(k in t for k in ['may contain', 'allergen', 'contains milk', 'contains wheat', 'contains soy']):
        return 'allergen'
    if re.search(r'\b(?:net\s*wt|net\s*quantity|net\s*weight|\d+\s*(?:g|kg|ml|l|oz|fl\s*oz))\b', t):
        return 'net_quantity'
    if any(k in t for k in ['keep refrigerated', 'store in a cool', 'best before', 'use by', 'refrigerate after']):
        return 'storage'
    if any(k in t for k in ['manufactured by', 'distributed by', 'produced for', 'consumer care', 'www.']):
        return 'contact'
    return 'general'

def inspect_typography(pdf_path, options=None):
    import fitz
    options = options or {}
    min_size_pt = float(options.get('minFontSizePt', DEFAULT_MIN_FONT_SIZE_PT))
    req_xheight_mm = float(options.get('requiredXHeightMm', EU_MANDATORY_XHEIGHT_MM))
    is_small_pack = bool(options.get('isSmallPackage', False))
    if is_small_pack:
        req_xheight_mm = EU_SMALL_PACK_XHEIGHT_MM

    doc = fitz.open(str(pdf_path))
    findings = []
    page_summaries = []

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        page_width = page.rect.width
        page_height = page.rect.height
        raw_text_dict = page.get_text("dict")
        
        spans_on_page = []
        small_text_spans = []
        allergen_spans = []
        fonts_used = set()

        for block in raw_text_dict.get("blocks", []):
            if block.get("type") != 0:  # Text block only
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    size_pt = float(span.get("size", 0.0))
                    font_name = span.get("font", "Unknown")
                    flags = int(span.get("flags", 0))
                    is_bold = bool(flags & 2 or "bold" in font_name.lower())
                    is_italic = bool(flags & 1 or "italic" in font_name.lower() or "oblique" in font_name.lower())
                    bbox = [float(c) for c in span.get("bbox", [0, 0, 0, 0])]

                    # Normalize box [x0, y0, x1, y1] to 0..1
                    norm_box = [
                        max(0.0, min(1.0, (bbox[0] - page.rect.x0) / max(page_width, 1.0))),
                        max(0.0, min(1.0, (bbox[1] - page.rect.y0) / max(page_height, 1.0))),
                        max(0.0, min(1.0, (bbox[2] - page.rect.x0) / max(page_width, 1.0))),
                        max(0.0, min(1.0, (bbox[3] - page.rect.y0) / max(page_height, 1.0)))
                    ]

                    # Estimate x-height
                    # Actual physical lowercase x-height:
                    # In Latin typography, typical x-height ratio is ~0.45 to 0.52 of nominal font size.
                    # Nominal point size 1 pt = 0.352778 mm.
                    # If glyph outline measurement is available or glyph lowercase 'x' present:
                    has_lowercase = any(c.islower() for c in text)
                    nominal_height_mm = size_pt * PT_TO_MM
                    
                    # Typical x-height factor estimation
                    # We explicitly label the measurement method
                    estimated_xheight_mm = nominal_height_mm * 0.485
                    xheight_reliable = False
                    xheight_method = "approximate_ratio_estimate"

                    span_record = {
                        "text": text,
                        "font": font_name,
                        "fontSizePt": round(size_pt, 2),
                        "nominalHeightMm": round(nominal_height_mm, 2),
                        "estimatedXHeightMm": round(estimated_xheight_mm, 2),
                        "xHeightMeasurementMethod": xheight_method,
                        "measurementReliable": xheight_reliable,
                        "isBold": is_bold,
                        "isItalic": is_italic,
                        "box": norm_box,
                        "page": page_num,
                        "category": classify_text_category(text)
                    }
                    spans_on_page.append(span_record)
                    fonts_used.add(f"{font_name} ({size_pt:.1f}pt)")

                    # Check for small text defect
                    # FDA minimum or company minimum font size threshold (default 6.0 pt)
                    if size_pt < min_size_pt and len(text) > 1:
                        small_text_spans.append(span_record)

                    # Check for allergens in ingredients
                    if span_record["category"] in ("ingredients", "allergen"):
                        words = set(re.findall(r'[a-zA-Z]+', text.lower()))
                        found_allergens = words.intersection(ALLERGEN_TERMS)
                        if found_allergens:
                            span_record["allergenTerms"] = sorted(list(found_allergens))
                            allergen_spans.append(span_record)

        # Aggregate small font issues
        if small_text_spans:
            # Group contiguous spans or report the most critical
            small_text_spans.sort(key=lambda s: s["fontSizePt"])
            worst = small_text_spans[0]
            diff_pt = round(min_size_pt - worst["fontSizePt"], 2)
            
            # Combine representative text snippet
            sample_texts = [s["text"] for s in small_text_spans[:3]]
            sample_quote = " | ".join(sample_texts)
            if len(sample_quote) > 120:
                sample_quote = sample_quote[:117] + "..."

            findings.append({
                "id": f"preflight:typography:small-font:p{page_num}",
                "key": f"preflight:typography:small-font:p{page_num}",
                "check": "font_size_minimum",
                "category": "typography",
                "title": f"Small font size ({worst['fontSizePt']} pt) below {min_size_pt} pt threshold",
                "status": "issue",
                "severity": "major",
                "expected": f"≥ {min_size_pt:.1f} pt (Company/FDA 21 CFR minimum for packaging legibility)",
                "observed": f"Detected {worst['fontSizePt']} pt text ({sample_quote}) in {worst['font']}",
                "difference": f"{diff_pt} pt below minimum",
                "unit": "pt",
                "measuredValue": worst["fontSizePt"],
                "requiredValue": min_size_pt,
                "measurementMethod": "native_pdf_font_dict",
                "xHeightEstimateMm": worst["estimatedXHeightMm"],
                "explanation": (
                    f"Page {page_num} contains {len(small_text_spans)} text element(s) with nominal font size below "
                    f"the {min_size_pt:.1f} pt requirement (minimum detected: {worst['fontSizePt']} pt). "
                    f"Small text introduces prepress legibility and compliance risks under FDA 21 CFR 101.9 / EU 1169/2011."
                ),
                "verificationLimitations": (
                    "Nominal PDF font point size extracted from font descriptor dict. "
                    "Physical printed x-height depends on typeface glyph proportions and print plate compensation."
                ),
                "rule": {
                    "id": "RULE-TYPOGRAPHY-01",
                    "source": "FDA 21 CFR 101.9 & Packaging Print Preflight Specification",
                    "text": f"Mandatory consumer packaging text must meet or exceed {min_size_pt:.1f} pt minimum."
                },
                "evidence": [{
                    "role": "artwork",
                    "page": page_num,
                    "box": worst["box"],
                    "quote": sample_quote,
                    "location": f"Page {page_num} · {worst['font']} {worst['fontSizePt']}pt"
                }],
                "affectedSpansCount": len(small_text_spans)
            })

            # Check EU 1169/2011 Article 13 x-height advisory
            if worst["estimatedXHeightMm"] < req_xheight_mm:
                findings.append({
                    "id": f"preflight:typography:xheight-advisory:p{page_num}",
                    "key": f"preflight:typography:xheight-advisory:p{page_num}",
                    "check": "eu_xheight_legibility",
                    "category": "typography",
                    "title": f"Estimated x-height ({worst['estimatedXHeightMm']} mm) below EU 1169/2011 target ({req_xheight_mm} mm)",
                    "status": "review",
                    "severity": "minor",
                    "expected": f"x-height ≥ {req_xheight_mm} mm (Regulation (EU) No 1169/2011, Article 13)",
                    "observed": f"Estimated x-height ~{worst['estimatedXHeightMm']} mm for {worst['fontSizePt']} pt text ({worst['font']})",
                    "difference": f"~{round(req_xheight_mm - worst['estimatedXHeightMm'], 2)} mm estimated deficit",
                    "unit": "mm",
                    "measuredValue": worst["estimatedXHeightMm"],
                    "requiredValue": req_xheight_mm,
                    "measurementMethod": "font_metrics_ratio_estimate",
                    "explanation": (
                        f"Under EU Food Information Regulation No 1169/2011 Article 13, mandatory information must have an "
                        f"x-height of at least {req_xheight_mm} mm ({EU_SMALL_PACK_XHEIGHT_MM} mm for small packs < 80 cm²). "
                        f"The detected {worst['fontSizePt']} pt font yields an estimated x-height of ~{worst['estimatedXHeightMm']} mm. "
                        f"Review with packaging prepress proof."
                    ),
                    "verificationLimitations": (
                        "This is an approximate ratio estimate (0.485 of nominal height). It is an advisory screening check, "
                        "not a certified physical optical measurement."
                    ),
                    "rule": {
                        "id": "EU-REG-1169-2011-ART13",
                        "source": "Regulation (EU) No 1169/2011, Article 13",
                        "text": f"Mandatory particulars must be printed with an x-height of at least {req_xheight_mm} mm."
                    },
                    "evidence": [{
                        "role": "artwork",
                        "page": page_num,
                        "box": worst["box"],
                        "quote": sample_quote,
                        "location": f"Page {page_num} · {worst['font']}"
                    }]
                })

        # Allergen emphasis check (EU 1169/2011 Article 21)
        # Check if allergen spans have distinctive font emphasis compared to general ingredients
        if allergen_spans:
            for asp in allergen_spans:
                terms_str = ", ".join(asp.get("allergenTerms", []))
                # If allergen span is not bold and not italic and not all-caps
                is_all_caps = asp["text"] == asp["text"].upper() and len(asp["text"]) > 2
                has_emphasis = asp["isBold"] or asp["isItalic"] or is_all_caps
                
                if not has_emphasis:
                    findings.append({
                        "id": f"preflight:typography:allergen-emphasis:p{page_num}:{asp['box'][0]:.2f}",
                        "key": f"preflight:typography:allergen-emphasis:p{page_num}:{asp['box'][0]:.2f}",
                        "check": "allergen_typographical_emphasis",
                        "category": "typography",
                        "title": f"Allergen ingredient '{terms_str}' lacks typographical emphasis",
                        "status": "issue",
                        "severity": "major",
                        "expected": "Clear typographical emphasis (bold, italic, style, or background color) under EU 1169/2011 Art 21",
                        "observed": f"Regular font '{asp['font']}' without bold, italic, or case emphasis on '{asp['text']}'",
                        "measurementMethod": "native_pdf_font_flags",
                        "explanation": (
                            f"Regulation (EU) No 1169/2011 Article 21 requires allergens in the ingredients list to be emphasized "
                            f"through a typeset that clearly distinguishes them from the rest of the ingredients (e.g. bold font). "
                            f"The text '{asp['text']}' appears in regular font without detected emphasis."
                        ),
                        "verificationLimitations": "Extracted from PDF font flags and typeface naming. Custom vector styling or background shading requires visual review.",
                        "rule": {
                            "id": "EU-REG-1169-2011-ART21",
                            "source": "Regulation (EU) No 1169/2011, Article 21",
                            "text": "Allergens must be emphasized through a typeset that clearly distinguishes them from the rest of the ingredients."
                        },
                        "evidence": [{
                            "role": "artwork",
                            "page": page_num,
                            "box": asp["box"],
                            "quote": asp["text"],
                            "location": f"Page {page_num} · Ingredients"
                        }]
                    })
                else:
                    findings.append({
                        "id": f"preflight:typography:allergen-emphasis:p{page_num}:{asp['box'][0]:.2f}",
                        "key": f"preflight:typography:allergen-emphasis:p{page_num}:{asp['box'][0]:.2f}",
                        "check": "allergen_typographical_emphasis",
                        "category": "typography",
                        "title": f"Allergen ingredient '{terms_str}' has distinctive typography",
                        "status": "match",
                        "severity": "minor",
                        "expected": "Typographical emphasis distinguishing allergen terms",
                        "observed": f"Emphasized with {'bold ' if asp['isBold'] else ''}{'italic ' if asp['isItalic'] else ''}{'uppercase ' if is_all_caps else ''}in '{asp['font']}'",
                        "measurementMethod": "native_pdf_font_flags",
                        "explanation": f"The allergen term '{terms_str}' has distinguishing styling in the ingredient list.",
                        "rule": {
                            "id": "EU-REG-1169-2011-ART21",
                            "source": "Regulation (EU) No 1169/2011, Article 21",
                            "text": "Allergens must be emphasized through a typeset that clearly distinguishes them."
                        },
                        "evidence": [{
                            "role": "artwork",
                            "page": page_num,
                            "box": asp["box"],
                            "quote": asp["text"],
                            "location": f"Page {page_num} · Ingredients"
                        }]
                    })

        page_summaries.append({
            "page": page_num,
            "totalSpans": len(spans_on_page),
            "fontsUsed": sorted(list(fonts_used)),
            "smallSpansCount": len(small_text_spans),
            "allergenSpansCount": len(allergen_spans)
        })

    doc.close()
    return {
        "status": "success",
        "findings": findings,
        "pageSummaries": page_summaries,
        "thresholdsApplied": {
            "minFontSizePt": min_size_pt,
            "requiredXHeightMm": req_xheight_mm
        }
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        path = sys.argv[1]
        opts = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        print(json.dumps(inspect_typography(path, opts), indent=2))
