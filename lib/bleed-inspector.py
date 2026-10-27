"""Bleed and Trim Geometry Inspector for Packaging PDFs.
Inspects MediaBox, CropBox, TrimBox, BleedBox, and ArtBox using PyMuPDF.
Measures available bleed margins in millimeters, verifies configurable bleed requirements (e.g. 3.0 mm),
and screens for text / barcode elements encroaching into the safety margin.
"""
import sys, json, math
from pathlib import Path

PT_TO_MM = 25.4 / 72.0
DEFAULT_REQUIRED_BLEED_MM = 3.0
DEFAULT_SAFE_MARGIN_MM = 3.0

def rect_to_dict(rect, rotation=0):
    if not rect:
        return None
    return {
        "x0": round(rect.x0, 2),
        "y0": round(rect.y0, 2),
        "x1": round(rect.x1, 2),
        "y1": round(rect.y1, 2),
        "widthPt": round(rect.width, 2),
        "heightPt": round(rect.height, 2),
        "widthMm": round(rect.width * PT_TO_MM, 2),
        "heightMm": round(rect.height * PT_TO_MM, 2),
    }

def inspect_bleed_and_trim(pdf_path, options=None):
    import fitz
    options = options or {}
    req_bleed_mm = float(options.get('requiredBleedMm', DEFAULT_REQUIRED_BLEED_MM))
    req_safe_mm = float(options.get('safeMarginMm', DEFAULT_SAFE_MARGIN_MM))
    req_bleed_pt = req_bleed_mm / PT_TO_MM
    req_safe_pt = req_safe_mm / PT_TO_MM

    doc = fitz.open(str(pdf_path))
    findings = []
    page_geometries = []

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        mediabox = page.mediabox
        cropbox = page.cropbox
        trimbox = getattr(page, 'trimbox', cropbox)
        bleedbox = getattr(page, 'bleedbox', cropbox)
        artbox = getattr(page, 'artbox', None)
        rotation = page.rotation

        # Calculate available bleed relative to TrimBox in points & mm
        # Top, Bottom, Left, Right
        bleed_left_pt = max(0.0, trimbox.x0 - bleedbox.x0)
        bleed_right_pt = max(0.0, bleedbox.x1 - trimbox.x1)
        bleed_bottom_pt = max(0.0, trimbox.y0 - bleedbox.y0)
        bleed_top_pt = max(0.0, bleedbox.y1 - trimbox.y1)

        bleed_left_mm = round(bleed_left_pt * PT_TO_MM, 2)
        bleed_right_mm = round(bleed_right_pt * PT_TO_MM, 2)
        bleed_top_mm = round(bleed_top_pt * PT_TO_MM, 2)
        bleed_bottom_mm = round(bleed_bottom_pt * PT_TO_MM, 2)
        min_available_bleed_mm = min(bleed_left_mm, bleed_right_mm, bleed_top_mm, bleed_bottom_mm)

        # Has explicit TrimBox distinct from MediaBox?
        has_explicit_trimbox = abs(trimbox.width - mediabox.width) > 1.0 or abs(trimbox.height - mediabox.height) > 1.0
        has_explicit_bleedbox = abs(bleedbox.width - trimbox.width) > 1.0 or abs(bleedbox.height - trimbox.height) > 1.0

        # Normalized coordinates of TrimBox inside the rendered page view (cropbox)
        pw = max(cropbox.width, 1.0)
        ph = max(cropbox.height, 1.0)
        norm_trim_box = [
            max(0.0, min(1.0, (trimbox.x0 - cropbox.x0) / pw)),
            max(0.0, min(1.0, (trimbox.y0 - cropbox.y0) / ph)),
            max(0.0, min(1.0, (trimbox.x1 - cropbox.x0) / pw)),
            max(0.0, min(1.0, (trimbox.y1 - cropbox.y0) / ph)),
        ]
        norm_bleed_box = [
            max(0.0, min(1.0, (bleedbox.x0 - cropbox.x0) / pw)),
            max(0.0, min(1.0, (bleedbox.y0 - cropbox.y0) / ph)),
            max(0.0, min(1.0, (bleedbox.x1 - cropbox.x0) / pw)),
            max(0.0, min(1.0, (bleedbox.y1 - cropbox.y0) / ph)),
        ]

        geom = {
            "page": page_num,
            "rotation": rotation,
            "mediaBox": rect_to_dict(mediabox, rotation),
            "cropBox": rect_to_dict(cropbox, rotation),
            "trimBox": rect_to_dict(trimbox, rotation),
            "bleedBox": rect_to_dict(bleedbox, rotation),
            "artBox": rect_to_dict(artbox, rotation) if artbox else None,
            "hasExplicitTrimBox": has_explicit_trimbox,
            "hasExplicitBleedBox": has_explicit_bleedbox,
            "availableBleedMm": {
                "left": bleed_left_mm,
                "right": bleed_right_mm,
                "top": bleed_top_mm,
                "bottom": bleed_bottom_mm,
                "minimum": min_available_bleed_mm
            },
            "normTrimBox": norm_trim_box,
            "normBleedBox": norm_bleed_box
        }
        page_geometries.append(geom)

        # FINDING 1: BleedBox dimension check
        if min_available_bleed_mm < req_bleed_mm:
            deficit_mm = round(req_bleed_mm - min_available_bleed_mm, 2)
            # If BleedBox is identical to TrimBox
            status = "issue" if has_explicit_trimbox else "review"
            findings.append({
                "id": f"preflight:bleed:insufficient-box:p{page_num}",
                "key": f"preflight:bleed:insufficient-box:p{page_num}",
                "check": "bleed_box_dimensions",
                "category": "bleed_trim",
                "title": f"Configured bleed ({min_available_bleed_mm} mm) is below required {req_bleed_mm} mm",
                "status": status,
                "severity": "major" if status == "issue" else "minor",
                "expected": f"Bleed margin ≥ {req_bleed_mm:.1f} mm on all outer edges (Print Specification)",
                "observed": (
                    f"Available bleed margins: Left {bleed_left_mm} mm, Right {bleed_right_mm} mm, "
                    f"Top {bleed_top_mm} mm, Bottom {bleed_bottom_mm} mm (min: {min_available_bleed_mm} mm)"
                ),
                "difference": f"{deficit_mm} mm bleed deficit",
                "unit": "mm",
                "measuredValue": min_available_bleed_mm,
                "requiredValue": req_bleed_mm,
                "measurementMethod": "pdf_page_box_header",
                "explanation": (
                    f"Page {page_num} provides {min_available_bleed_mm} mm minimum bleed between TrimBox and BleedBox "
                    f"(required: {req_bleed_mm} mm). Without sufficient bleed margin, cutting tolerances on press "
                    f"can introduce unwanted white borders or edge flash."
                ),
                "verificationLimitations": (
                    "Extracted from PDF /TrimBox and /BleedBox page headers. "
                    "If the document relies on a dieline layer instead of standard PDF page boxes, confirm trimming lines manually."
                ),
                "rule": {
                    "id": "PREPRESS-BLEED-01",
                    "source": "Standard Packaging Prepress Print Specification",
                    "text": f"Packaging artwork must provide at least {req_bleed_mm:.1f} mm bleed beyond the trim boundary."
                },
                "evidence": [{
                    "role": "artwork",
                    "page": page_num,
                    "box": norm_trim_box,
                    "location": f"Page {page_num} · Trim boundary ({geom['trimBox']['widthMm']} × {geom['trimBox']['heightMm']} mm)"
                }]
            })
        else:
            findings.append({
                "id": f"preflight:bleed:box-valid:p{page_num}",
                "key": f"preflight:bleed:box-valid:p{page_num}",
                "check": "bleed_box_dimensions",
                "category": "bleed_trim",
                "title": f"BleedBox margins ({min_available_bleed_mm} mm) meet {req_bleed_mm} mm specification",
                "status": "match",
                "severity": "minor",
                "expected": f"Bleed margin ≥ {req_bleed_mm:.1f} mm on all edges",
                "observed": f"Left {bleed_left_mm} mm, Right {bleed_right_mm} mm, Top {bleed_top_mm} mm, Bottom {bleed_bottom_mm} mm",
                "unit": "mm",
                "measuredValue": min_available_bleed_mm,
                "requiredValue": req_bleed_mm,
                "measurementMethod": "pdf_page_box_header",
                "explanation": f"Page {page_num} defines adequate bleed margins ({min_available_bleed_mm} mm ≥ {req_bleed_mm} mm).",
                "rule": {
                    "id": "PREPRESS-BLEED-01",
                    "source": "Standard Packaging Prepress Print Specification",
                    "text": f"Packaging artwork must provide at least {req_bleed_mm:.1f} mm bleed."
                },
                "evidence": [{
                    "role": "artwork",
                    "page": page_num,
                    "box": norm_trim_box,
                    "location": f"Page {page_num} · Trim and Bleed Boxes"
                }]
            })

        # FINDING 2: Safe Area Clearance Screening
        # Inspect text spans to see if any encroach into the safe margin inside TrimBox
        safe_left_pt = trimbox.x0 + req_safe_pt
        safe_right_pt = trimbox.x1 - req_safe_pt
        safe_bottom_pt = trimbox.y0 + req_safe_pt
        safe_top_pt = trimbox.y1 - req_safe_pt

        unsafe_text_spans = []
        raw_text_dict = page.get_text("dict")
        for block in raw_text_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text or len(text) < 2:
                        continue
                    bbox = span.get("bbox", [0, 0, 0, 0])
                    # Check encroachment into trim edge:
                    # Is span closer than safe margin to any edge of trimbox?
                    encroach_left = bbox[0] < safe_left_pt and bbox[0] >= trimbox.x0 - 5.0
                    encroach_right = bbox[2] > safe_right_pt and bbox[2] <= trimbox.x1 + 5.0
                    encroach_top = bbox[1] < safe_bottom_pt and bbox[1] >= trimbox.y0 - 5.0
                    encroach_bottom = bbox[3] > safe_top_pt and bbox[3] <= trimbox.y1 + 5.0

                    if encroach_left or encroach_right or encroach_top or encroach_bottom:
                        norm_box = [
                            max(0.0, min(1.0, (bbox[0] - cropbox.x0) / pw)),
                            max(0.0, min(1.0, (bbox[1] - cropbox.y0) / ph)),
                            max(0.0, min(1.0, (bbox[2] - cropbox.x0) / pw)),
                            max(0.0, min(1.0, (bbox[3] - cropbox.y0) / ph))
                        ]
                        unsafe_text_spans.append({
                            "text": text,
                            "box": norm_box,
                            "bbox": bbox
                        })

        if unsafe_text_spans:
            worst = unsafe_text_spans[0]
            findings.append({
                "id": f"preflight:safe-area:text-encroachment:p{page_num}",
                "key": f"preflight:safe-area:text-encroachment:p{page_num}",
                "check": "safe_area_clearance",
                "category": "safe_area",
                "title": f"{len(unsafe_text_spans)} text element(s) encroach within {req_safe_mm} mm safety zone",
                "status": "review",
                "severity": "minor",
                "expected": f"All readable text must maintain ≥ {req_safe_mm:.1f} mm clearance inside the trim boundary",
                "observed": f"Detected text '{worst['text']}' placed within {req_safe_mm} mm of the trim line",
                "unit": "mm",
                "requiredValue": req_safe_mm,
                "measurementMethod": "vector_bbox_trim_distance",
                "explanation": (
                    f"Page {page_num} contains {len(unsafe_text_spans)} text element(s) positioned closer than "
                    f"{req_safe_mm} mm to the outer trim boundary. Die-cutting movement on press risks clipping readable copy."
                ),
                "verificationLimitations": "Calculated against PDF TrimBox. If the carton relies on an irregular dieline profile, verify clearance relative to the actual cut/crease lines.",
                "rule": {
                    "id": "PREPRESS-SAFE-01",
                    "source": "Packaging Die-Cutting Safety Clearance Standard",
                    "text": f"Keep text and critical symbols at least {req_safe_mm:.1f} mm inside the cut line."
                },
                "evidence": [{
                    "role": "artwork",
                    "page": page_num,
                    "box": worst["box"],
                    "quote": worst["text"],
                    "location": f"Page {page_num} · Safe area boundary"
                }]
            })

    doc.close()
    return {
        "status": "success",
        "findings": findings,
        "pageGeometries": page_geometries,
        "thresholdsApplied": {
            "requiredBleedMm": req_bleed_mm,
            "safeMarginMm": req_safe_mm
        }
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        path = sys.argv[1]
        opts = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        print(json.dumps(inspect_bleed_and_trim(path, opts), indent=2))
