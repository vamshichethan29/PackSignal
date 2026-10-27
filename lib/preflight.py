"""Master Prepress Geometry & Print-Readiness Inspection Engine.
Orchestrates:
1. Typography inspection (font size minimum, x-height, allergen emphasis)
2. Bleed & TrimBox geometry (margins, available bleed, safe area clearance)
3. Color separations (spot colors, rich black on small text, RGB in print)
4. Barcode quiet zones & contrast screening (GS1 General Specifications)
Outputs clean, evidence-linked findings adhering to PackSignal's data model.
"""
import sys, json, os
from pathlib import Path

import importlib

# Add lib directory to path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

inspect_typography = importlib.import_module("typography-inspector").inspect_typography
inspect_bleed_and_trim = importlib.import_module("bleed-inspector").inspect_bleed_and_trim
inspect_colors = importlib.import_module("color-preflight").inspect_colors
analyze_barcode_image = importlib.import_module("barcode-preflight").analyze_barcode_image

def run_preflight_pipeline(artwork_path, options=None):
    options = options or {}
    p = Path(artwork_path)
    ext = p.suffix.lower()

    findings = []
    categories = {
        "typography": {"checks": 0, "issues": 0, "reviews": 0, "matches": 0},
        "bleed_trim": {"checks": 0, "issues": 0, "reviews": 0, "matches": 0},
        "color_separation": {"checks": 0, "issues": 0, "reviews": 0, "matches": 0},
        "barcode": {"checks": 0, "issues": 0, "reviews": 0, "matches": 0},
        "safe_area": {"checks": 0, "issues": 0, "reviews": 0, "matches": 0}
    }
    details = {}

    if ext == '.pdf':
        # 1. Typography
        try:
            typo_res = inspect_typography(str(p), options)
            details["typography"] = typo_res
            for f in typo_res.get("findings", []):
                findings.append(f)
        except Exception as e:
            details["typography_error"] = str(e)

        # 2. Bleed & Trim
        try:
            bleed_res = inspect_bleed_and_trim(str(p), options)
            details["bleed_trim"] = bleed_res
            for f in bleed_res.get("findings", []):
                findings.append(f)
        except Exception as e:
            details["bleed_trim_error"] = str(e)

        # 3. Color Separations
        try:
            color_res = inspect_colors(str(p), options)
            details["color_separation"] = color_res
            for f in color_res.get("findings", []):
                findings.append(f)
        except Exception as e:
            details["color_separation_error"] = str(e)

        # 4. Barcodes
        # If barcode metadata or codes are supplied in options, or if we extract barcode crops
        supplied_codes = options.get("codes", [])
        rendered_images = options.get("renderedImages", {})
        
        # If no explicit codes passed, check if we have any raster barcodes to inspect
        if supplied_codes:
            import fitz
            from PIL import Image
            try:
                doc = fitz.open(str(p))
                for c in supplied_codes:
                    page_num = c.get("page", 1)
                    box = c.get("box", [0, 0, 1, 1])
                    if 1 <= page_num <= len(doc):
                        page = doc[page_num - 1]
                        pix = page.get_pixmap(dpi=200)
                        im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        
                        # Crop to barcode box with small margin
                        crop_x0 = max(0, int((box[0] - 0.05) * pix.width))
                        crop_y0 = max(0, int((box[1] - 0.05) * pix.height))
                        crop_x1 = min(pix.width, int((box[2] + 0.05) * pix.width))
                        crop_y1 = min(pix.height, int((box[3] + 0.05) * pix.height))
                        
                        if crop_x1 > crop_x0 and crop_y1 > crop_y0:
                            crop = im.crop((crop_x0, crop_y0, crop_x1, crop_y1))
                            bc_res = analyze_barcode_image(crop, barcode_meta=c, page_dpi=200.0)
                            for f in bc_res.get("findings", []):
                                findings.append(f)
                doc.close()
            except Exception as e:
                details["barcode_error"] = str(e)

    elif ext in ('.png', '.jpg', '.jpeg', '.webp'):
        # For raster images, run image-based barcode inspection if codes present
        from PIL import Image
        try:
            im = Image.open(str(p))
            supplied_codes = options.get("codes", [])
            for c in supplied_codes:
                box = c.get("box", [0, 0, 1, 1])
                w, h = im.size
                crop_x0 = max(0, int((box[0] - 0.05) * w))
                crop_y0 = max(0, int((box[1] - 0.05) * h))
                crop_x1 = min(w, int((box[2] + 0.05) * w))
                crop_y1 = min(h, int((box[3] + 0.05) * h))
                if crop_x1 > crop_x0 and crop_y1 > crop_y0:
                    crop = im.crop((crop_x0, crop_y0, crop_x1, crop_y1))
                    bc_res = analyze_barcode_image(crop, barcode_meta=c, page_dpi=150.0)
                    for f in bc_res.get("findings", []):
                        findings.append(f)
        except Exception as e:
            details["raster_error"] = str(e)

    # Compute category statistics
    for f in findings:
        cat = f.get("category", "typography")
        if cat in categories:
            categories[cat]["checks"] += 1
            status = f.get("status", "review")
            if status == "issue":
                categories[cat]["issues"] += 1
            elif status == "review":
                categories[cat]["reviews"] += 1
            elif status == "match":
                categories[cat]["matches"] += 1

    return {
        "status": "success",
        "findings": findings,
        "categories": categories,
        "details": details
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        path = sys.argv[1]
        opts = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        print(json.dumps(run_preflight_pipeline(path, opts), indent=2))
    else:
        # Read from stdin
        try:
            payload = json.load(sys.stdin)
            path = payload.get("path")
            opts = payload.get("options", {})
            print(json.dumps(run_preflight_pipeline(path, opts), ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"error": str(e)[:500]}))
            sys.exit(1)
