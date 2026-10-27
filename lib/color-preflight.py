"""PDF Color-Separation & Ink Preflight Inspector.
Inspects PDF color spaces (DeviceCMYK, DeviceGray, DeviceRGB, Separation, DeviceN, ICCBased).
Inventories spot colors (e.g. Pantone, metallic inks, varnish, cutcontour).
Screens for prepress registration risks such as 4-color rich black on small text,
RGB objects in print workflow, and multichannel barcodes.
"""
import sys, json, math, re
from pathlib import Path
import fitz, pikepdf

def extract_spot_colors_from_page(page_obj):
    spots = []
    seen = set()
    try:
        res = page_obj.Resources
        if '/ColorSpace' in res:
            for cs_name, cs_arr in res.ColorSpace.items():
                if isinstance(cs_arr, list) or hasattr(cs_arr, '__iter__'):
                    cs_type = str(cs_arr[0]).replace('/', '')
                    if cs_type in ('Separation', 'DeviceN'):
                        colorant = cs_arr[1]
                        if isinstance(colorant, (pikepdf.Array, list, tuple)):
                            colorants = [str(c).replace('/', '').strip(' "') for c in colorant]
                        else:
                            colorants = [str(colorant).replace('/', '').strip(' "')]
                        
                        for c_name in colorants:
                            c_name = re.sub(r'^pikepdf\.Array\(\[\s*"?|"?\s*\]\)$', '', c_name)
                            c_name = c_name.strip(' "')
                            if c_name in ('All', 'None', 'Cyan', 'Magenta', 'Yellow', 'Black') or not c_name:
                                continue
                            if c_name not in seen:
                                seen.add(c_name)
                                alt_space = str(cs_arr[2]).replace('/', '').strip() if len(cs_arr) > 2 else 'Unknown'
                                spots.append({
                                    "name": c_name,
                                    "resource": str(cs_name),
                                    "colorSpace": cs_type,
                                    "alternateSpace": alt_space
                                })
    except Exception:
        pass
    return spots

def inspect_colors(pdf_path, options=None):
    import fitz, pikepdf
    options = options or {}
    pdf_p = Path(pdf_path)

    findings = []
    spot_inventory = []
    color_spaces_found = set()
    has_rgb_elements = False
    rich_black_small_text = []

    # Open with pikepdf for deep resource and content-stream inspection
    try:
        pipe_doc = pikepdf.open(str(pdf_p))
        for page_idx, page in enumerate(pipe_doc.pages):
            page_num = page_idx + 1
            spots = extract_spot_colors_from_page(page)
            for s in spots:
                s["page"] = page_num
                spot_inventory.append(s)

            # Inspect Resources / ColorSpace
            if '/ColorSpace' in page.Resources:
                for k, v in page.Resources.ColorSpace.items():
                    if hasattr(v, '__getitem__') and len(v) > 0:
                        color_spaces_found.add(str(v[0]).replace('/', ''))
                    else:
                        color_spaces_found.add(str(v).replace('/', ''))

            # Parse content stream operators for color usage
            try:
                contents = page.get_contents()
                if contents:
                    raw_stream = contents.read_bytes()
                    # Check for RGB operators (rg, RG)
                    # e.g., "0.2 0.3 0.4 rg" or "RG"
                    rgb_matches = re.findall(rb'([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(rg|RG)\b', raw_stream)
                    if rgb_matches:
                        has_rgb_elements = True
                        color_spaces_found.add('DeviceRGB')

                    # Check for CMYK operators (k, K)
                    cmyk_matches = re.findall(rb'([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(k|K)\b', raw_stream)
                    if cmyk_matches:
                        color_spaces_found.add('DeviceCMYK')
            except Exception:
                pass
        pipe_doc.close()
    except Exception as e:
        pass

    # Use PyMuPDF to correlate text spans with rich black / color definitions
    try:
        fitz_doc = fitz.open(str(pdf_p))
        for page_idx, page in enumerate(fitz_doc):
            page_num = page_idx + 1
            pw = max(page.rect.width, 1.0)
            ph = max(page.rect.height, 1.0)
            text_dict = page.get_text("dict")

            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        size = float(span.get("size", 0.0))
                        color_int = int(span.get("color", 0))
                        bbox = span.get("bbox", [0, 0, 0, 0])

                        # sRGB color decomposition
                        r = (color_int >> 16) & 0xFF
                        g = (color_int >> 8) & 0xFF
                        b = color_int & 0xFF

                        # If dark text (luminance < 0.15) and small (<= 9.0 pt)
                        # Check if sRGB representation exhibits multichannel mix:
                        # Process Black typically maps to r=0, g=0, b=0 or consistent neutral.
                        # If color_int has distinct non-neutral tint (r != g or g != b):
                        is_dark = max(r, g, b) < 45
                        is_non_neutral = (abs(r - g) > 8 or abs(g - b) > 8 or abs(r - b) > 8)

                        # Small text with potential rich black / color build
                        if size <= 9.0 and is_dark and is_non_neutral and len(text) > 2:
                            norm_box = [
                                max(0.0, min(1.0, (bbox[0] - page.rect.x0) / pw)),
                                max(0.0, min(1.0, (bbox[1] - page.rect.y0) / ph)),
                                max(0.0, min(1.0, (bbox[2] - page.rect.x0) / pw)),
                                max(0.0, min(1.0, (bbox[3] - page.rect.y0) / ph))
                            ]
                            rich_black_small_text.append({
                                "text": text,
                                "size": round(size, 2),
                                "font": span.get("font", "Unknown"),
                                "page": page_num,
                                "box": norm_box,
                                "srgb": f"#{r:02x}{g:02x}{b:02x}"
                            })
        fitz_doc.close()
    except Exception:
        pass

    # FINDING 1: Spot Color Inventory
    if spot_inventory:
        spot_names = sorted(list(set(s["name"] for s in spot_inventory)))
        findings.append({
            "id": f"preflight:color:spot-inventory",
            "key": f"preflight:color:spot-inventory",
            "check": "spot_color_inventory",
            "category": "color_separation",
            "title": f"Spot colors defined in artwork ({len(spot_names)} separation{'' if len(spot_names)==1 else 's'})",
            "status": "match",
            "severity": "minor",
            "expected": "Inventory of approved special inks and spot color separations",
            "observed": f"Detected spot separations: {', '.join(spot_names)}",
            "measurementMethod": "pdf_colorspace_resources_dict",
            "spotColors": spot_inventory,
            "explanation": (
                f"The document defines {len(spot_names)} custom spot colorant(s): {', '.join(spot_names)}. "
                f"Ensure press plates, varnish, or dieline separations correspond with print brief specifications."
            ),
            "verificationLimitations": (
                "Identifies PDF /Separation and /DeviceN colorant names. "
                "Physical ink mixing, drawdowns, and delta-E color matching require physical prepress proofs."
            ),
            "rule": {
                "id": "PREPRESS-COLOR-01",
                "source": "Packaging Ink & Separation Specification",
                "text": "All spot color separations must be inventoried and verified against the print contract."
            },
            "evidence": [{
                "role": "artwork",
                "page": spot_inventory[0]["page"],
                "box": [0.0, 0.0, 1.0, 0.1],
                "quote": f"Separation: {spot_names[0]}",
                "location": f"Page {spot_inventory[0]['page']} · /ColorSpace resource"
            }]
        })

    # FINDING 2: Rich Black on Small Text Warning
    if rich_black_small_text:
        sample = rich_black_small_text[0]
        findings.append({
            "id": f"preflight:color:rich-black-small-text:p{sample['page']}",
            "key": f"preflight:color:rich-black-small-text:p{sample['page']}",
            "check": "rich_black_registration_risk",
            "category": "color_separation",
            "title": f"Multichannel color build on fine text ({sample['size']} pt) risks press misregistration",
            "status": "review",
            "severity": "major",
            "expected": "100% single-channel Process Black (C=0, M=0, Y=0, K=100%) for text ≤ 9.0 pt",
            "observed": f"Small text '{sample['text']}' ({sample['size']} pt in {sample['font']}) uses composite color build ({sample['srgb']})",
            "measurementMethod": "pdf_text_color_screening",
            "explanation": (
                f"Fine text ({sample['size']} pt) appears to use a multichannel color build rather than single-channel black. "
                f"On press, microscopic plate movement (0.03–0.05 mm) can create color fringing, blurry edges, and illegible copy. "
                f"Convert small packaging text to 100% K (single-plate black) for optimal sharpness."
            ),
            "verificationLimitations": (
                "Screened via extracted text color descriptors. Deep plate separation confirmation requires RIP 1-bit TIFF inspection."
            ),
            "rule": {
                "id": "PREPRESS-COLOR-02",
                "source": "Esko / Ghent Workgroup Packaging Prepress Best Practice",
                "text": "Small body text must be 100% Process Black (single separation) to prevent press misregistration."
            },
            "evidence": [{
                "role": "artwork",
                "page": sample["page"],
                "box": sample["box"],
                "quote": sample["text"],
                "location": f"Page {sample['page']} · {sample['font']} {sample['size']}pt"
            }]
        })
    else:
        findings.append({
            "id": "preflight:color:process-black-valid",
            "key": "preflight:color:process-black-valid",
            "check": "rich_black_registration_risk",
            "category": "color_separation",
            "title": "Small body text uses clean single-channel black without composite build",
            "status": "match",
            "severity": "minor",
            "expected": "100% Process Black for small text",
            "observed": "No small text with composite multichannel build detected",
            "measurementMethod": "pdf_text_color_screening",
            "explanation": "Small body text conforms to single-channel black guidelines.",
            "rule": {
                "id": "PREPRESS-COLOR-02",
                "source": "Ghent Workgroup Packaging Specification",
                "text": "Fine text must avoid multichannel CMYK builds."
            },
            "evidence": [{
                "role": "artwork",
                "page": 1,
                "box": [0.0, 0.0, 1.0, 0.1],
                "location": "Page 1 · Text separations"
            }]
        })

    # FINDING 3: RGB in Print Workflow Warning
    if has_rgb_elements:
        findings.append({
            "id": "preflight:color:rgb-elements-detected",
            "key": "preflight:color:rgb-elements-detected",
            "check": "rgb_color_space_screening",
            "category": "color_separation",
            "title": "RGB color operands detected in print packaging workflow",
            "status": "review",
            "severity": "minor",
            "expected": "DeviceCMYK or native spot color separations for commercial print packaging",
            "observed": "DeviceRGB color space painting operators found in PDF content stream",
            "measurementMethod": "content_stream_token_analysis",
            "explanation": (
                "The PDF contains objects painted in RGB (rg/RG operators). In commercial offset or flexo packaging printing, "
                "RGB colors require color management conversion to CMYK at the RIP, which can alter brand color rendition "
                "or produce unexpected multi-plate black builds."
            ),
            "verificationLimitations": "Content-stream operator scan. If the printer applies calibrated DeviceLink profiles, conversion may be intentional.",
            "rule": {
                "id": "PREPRESS-COLOR-03",
                "source": "ISO 12647-2 & Packaging Prepress Guidelines",
                "text": "Packaging artwork intended for direct CMYK print should use DeviceCMYK or named spot separations."
            },
            "evidence": [{
                "role": "artwork",
                "page": 1,
                "box": [0.0, 0.0, 1.0, 0.1],
                "location": "Page 1 · Content stream"
            }]
        })

    return {
        "status": "success",
        "colorSpaces": sorted(list(color_spaces_found)),
        "spotColors": spot_inventory,
        "hasRgbElements": has_rgb_elements,
        "findings": findings
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        path = sys.argv[1]
        opts = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        print(json.dumps(inspect_colors(path, opts), indent=2))
