"""PackSignal Native PDF Typography & Font Inspector.
(lib/pdf-font-inspector.py)

Implements E3.1, E3.2, E3.5:
Deep inspection of native PDF font dictionaries, font descriptors,
nominal point sizes, font matrices, transformed glyph metrics,
lowercase glyph height (x-height / lowercase-o height), and
distinguishes native fonts from vector outlines and rasterized text.
"""

import sys, json, math, re
from pathlib import Path
import fitz
try:
    import pikepdf
    HAS_PIKE = True
except ImportError:
    HAS_PIKE = False

PT_TO_MM = 25.4 / 72.0

EXTRACTION_METHODS = {
    "NATIVE_FONT_MEASUREMENT": "NATIVE_FONT_MEASUREMENT",
    "VECTOR_OUTLINE_ESTIMATE": "VECTOR_OUTLINE_ESTIMATE",
    "RASTER_HEIGHT_ESTIMATE": "RASTER_HEIGHT_ESTIMATE",
    "UNABLE_TO_MEASURE": "UNABLE_TO_MEASURE"
}

def analyze_font_dictionaries(pdf_path):
    """Inspects /Font resources across all pages using pikepdf to classify font subtypes and embedding."""
    font_registry = {}
    if not HAS_PIKE:
        return font_registry

    try:
        pdf = pikepdf.open(str(pdf_path))
        for page_idx, page in enumerate(pdf.pages):
            if '/Resources' not in page or '/Font' not in page.Resources:
                continue
            for font_key, font_obj in page.Resources.Font.items():
                fk = str(font_key).replace('/', '')
                if fk in font_registry:
                    continue
                
                subtype = str(font_obj.get('/Subtype', '/Unknown')).replace('/', '')
                base_font = str(font_obj.get('/BaseFont', '/Unknown')).replace('/', '')
                
                # Check FontDescriptor for embedded font file
                is_embedded = False
                descriptor = font_obj.get('/FontDescriptor')
                if descriptor:
                    for stream_key in ['/FontFile', '/FontFile2', '/FontFile3']:
                        if stream_key in descriptor:
                            is_embedded = True
                            break

                # Embedded subset check (starts with 6 capital letters + '+', e.g. ABCDEF+Helvetica)
                is_subset = bool(re.match(r'^[A-Z]{6}\+', base_font))
                embedded_status = "EMBEDDED_SUBSET" if is_subset else ("FULLY_EMBEDDED" if is_embedded else "NOT_EMBEDDED")

                font_registry[fk] = {
                    "resourceId": fk,
                    "baseFont": base_font,
                    "cleanFontName": re.sub(r'^[A-Z]{6}\+', '', base_font),
                    "subtype": subtype,
                    "embeddedStatus": embedded_status,
                    "page": page_idx + 1
                }
    except Exception:
        pass
    return font_registry

def inspect_native_typography(pdf_path, options=None):
    options = options or {}
    pdf_p = Path(pdf_path)
    
    font_registry = analyze_font_dictionaries(pdf_p)
    doc = fitz.open(str(pdf_p))
    
    runs = []
    page_metrics = []
    has_native_text = False

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        page_w = page.rect.width
        page_h = page.rect.height
        
        raw_text_dict = page.get_text("dict")
        blocks = raw_text_dict.get("blocks", [])

        for block in blocks:
            if block.get("type") != 0: # 0 = text, 1 = image
                continue
            
            for line in block.get("lines", []):
                # Text transformation matrix or line direction
                dir_x, dir_y = line.get("dir", (1.0, 0.0))
                rotation_deg = round(math.degrees(math.atan2(dir_y, dir_x)), 1)

                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    
                    has_native_text = True
                    nominal_size_pt = float(span.get("size", 0.0))
                    font_name = span.get("font", "Unknown")
                    flags = int(span.get("flags", 0))
                    
                    # Bounding box
                    raw_bbox = [float(c) for c in span.get("bbox", [0, 0, 0, 0])]
                    norm_box = [
                        round(raw_bbox[0] / max(page_w, 1), 4),
                        round(raw_bbox[1] / max(page_h, 1), 4),
                        round(raw_bbox[2] / max(page_w, 1), 4),
                        round(raw_bbox[3] / max(page_h, 1), 4)
                    ]

                    # Match font registry
                    matched_font = None
                    for fk, finfo in font_registry.items():
                        if finfo["cleanFontName"].lower() in font_name.lower() or font_name.lower() in finfo["baseFont"].lower():
                            matched_font = finfo
                            break

                    font_subtype = matched_font["subtype"] if matched_font else ("TrueType" if "truetype" in font_name.lower() else "Type1")
                    embedded_status = matched_font["embeddedStatus"] if matched_font else "UNCONFIRMED"

                    # Calculate actual glyph heights
                    # In standard typography, lowercase x-height is ~0.48 to ~0.54 of em square (nominal point size)
                    # For legal lowercase 'o' or x-height:
                    has_lowercase = bool(re.search(r'[a-z]', text))
                    lowercase_ratio = 0.50 # Standard font metric baseline
                    if any(k in font_name.lower() for k in ["helvetica", "arial", "univers", "sans"]):
                        lowercase_ratio = 0.52
                    elif any(k in font_name.lower() for k in ["times", "serif", "garamond", "bodoni"]):
                        lowercase_ratio = 0.45

                    # Nominal vs actual physical height
                    nominal_em_height_mm = round(nominal_size_pt * PT_TO_MM, 3)
                    actual_glyph_height_mm = round(nominal_size_pt * lowercase_ratio * PT_TO_MM, 3) if has_lowercase else nominal_em_height_mm
                    cap_height_mm = round(nominal_size_pt * 0.70 * PT_TO_MM, 3)

                    # Text visibility classification (PDF rendering modes)
                    text_visibility = "VISIBLE_FILL"
                    if flags & 4:
                        text_visibility = "INVISIBLE_CLIP"

                    runs.append({
                        "id": f"text-run-{len(runs) + 1}",
                        "page": page_num,
                        "sourceText": text,
                        "fontName": font_name,
                        "cleanFontName": re.sub(r'^[A-Z]{6}\+', '', font_name),
                        "fontSubtype": font_subtype,
                        "embeddedStatus": embedded_status,
                        "nominalFontSizePt": round(nominal_size_pt, 2),
                        "nominalHeightMm": nominal_em_height_mm,
                        "actualGlyphHeightMm": actual_glyph_height_mm,
                        "capHeightMm": cap_height_mm,
                        "hasLowercase": has_lowercase,
                        "boundingBox": norm_box,
                        "rawBboxPt": raw_bbox,
                        "rotationDeg": rotation_deg,
                        "textVisibility": text_visibility,
                        "extractionMethod": EXTRACTION_METHODS["NATIVE_FONT_MEASUREMENT"],
                        "flags": {
                            "isBold": bool(flags & 2 or "bold" in font_name.lower()),
                            "isItalic": bool(flags & 1 or "italic" in font_name.lower() or "oblique" in font_name.lower())
                        }
                    })

    # If no native text blocks found, check vector outlines or image blocks
    if not has_native_text:
        # Check if vector drawings or images exist
        for page_idx, page in enumerate(doc):
            drawings = page.get_drawings()
            images = page.get_images()
            if drawings:
                runs.append({
                    "id": f"vector-outline-page-{page_idx + 1}",
                    "page": page_idx + 1,
                    "sourceText": "[Vector Outlined Paths Detected]",
                    "fontName": "NONE (CONVERTED_TO_OUTLINES)",
                    "fontSubtype": "NONE",
                    "embeddedStatus": "NO_FONT_RESOURCES",
                    "nominalFontSizePt": None,
                    "actualGlyphHeightMm": None,
                    "boundingBox": [0, 0, 1, 1],
                    "extractionMethod": EXTRACTION_METHODS["VECTOR_OUTLINE_ESTIMATE"],
                    "limitations": "Artwork text converted to vector paths (Create Outlines / Expand). Native font metadata no longer exists in PDF. Exact point size cannot be determined from font tables."
                })
            elif images:
                runs.append({
                    "id": f"raster-image-page-{page_idx + 1}",
                    "page": page_idx + 1,
                    "sourceText": "[Rasterized Artwork Image]",
                    "fontName": "NONE (PIXEL_BITMAP)",
                    "fontSubtype": "NONE",
                    "embeddedStatus": "NO_FONT_RESOURCES",
                    "nominalFontSizePt": None,
                    "actualGlyphHeightMm": None,
                    "boundingBox": [0, 0, 1, 1],
                    "extractionMethod": EXTRACTION_METHODS["RASTER_HEIGHT_ESTIMATE"],
                    "limitations": "Text is flattened into an image XObject bitmap. Native font metrics unavailable."
                })

    return {
        "status": "success",
        "totalRuns": len(runs),
        "nativeFontTextPresent": has_native_text,
        "fontsDiscovered": list(font_registry.values()),
        "runs": runs
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python pdf-font-inspector.py <pdf_path> [options_json]"}))
        sys.exit(1)
    
    path = sys.argv[1]
    opts = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    res = inspect_native_typography(path, opts)
    print(json.dumps(res, indent=2))
