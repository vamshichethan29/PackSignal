"""Barcode Quiet-Zone and Contrast Preflight Engine.
Conforms to GS1 General Specifications (2026) for EAN-13, EAN-8, UPC-A, and UPC-E barcodes.
Performs deterministic module width estimation, quiet-zone obstruction analysis,
and raster print-contrast screening (clearly distinguished from ISO/IEC 15416 certified verification).
"""
import sys, json, math, os
from pathlib import Path
from PIL import Image

GS1_SPECS = {
    "EAN-13": {"leftMult": 11, "rightMult": 7, "name": "EAN-13", "source": "GS1 General Specifications section 5.2.1.4.1"},
    "EAN_13": {"leftMult": 11, "rightMult": 7, "name": "EAN-13", "source": "GS1 General Specifications section 5.2.1.4.1"},
    "EAN-8": {"leftMult": 7, "rightMult": 7, "name": "EAN-8", "source": "GS1 General Specifications section 5.2.1.4.2"},
    "EAN_8": {"leftMult": 7, "rightMult": 7, "name": "EAN-8", "source": "GS1 General Specifications section 5.2.1.4.2"},
    "UPC-A": {"leftMult": 9, "rightMult": 9, "name": "UPC-A", "source": "GS1 General Specifications section 5.2.1.4.3"},
    "UPC_A": {"leftMult": 9, "rightMult": 9, "name": "UPC-A", "source": "GS1 General Specifications section 5.2.1.4.3"},
    "UPC-E": {"leftMult": 9, "rightMult": 7, "name": "UPC-E", "source": "GS1 General Specifications section 5.2.1.4.4"},
    "UPC_E": {"leftMult": 9, "rightMult": 7, "name": "UPC-E", "source": "GS1 General Specifications section 5.2.1.4.4"},
}

def rgb_to_luminance(r, g, b):
    # Rec. 709 relative luminance
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0

def analyze_barcode_image(image_or_crop, barcode_meta=None, page_dpi=150.0):
    barcode_meta = barcode_meta or {}
    symbology_raw = str(barcode_meta.get("format", "EAN-13")).upper().replace("BARCODEFORMAT.", "")
    spec = GS1_SPECS.get(symbology_raw, GS1_SPECS["EAN-13"])
    gtin = barcode_meta.get("gtin", "")
    page_num = barcode_meta.get("page", 1)

    # Ensure image is in RGB
    im = image_or_crop.convert("RGB")
    width, height = im.size

    if width < 30 or height < 15:
        return {
            "status": "unable",
            "reason": "Image resolution too low for barcode preflight analysis",
            "findings": [{
                "id": f"preflight:barcode:low-res:p{page_num}",
                "key": f"preflight:barcode:low-res:p{page_num}",
                "check": "barcode_quiet_zone",
                "category": "barcode",
                "title": f"Barcode image resolution too low for reliable measurement",
                "status": "unable",
                "severity": "minor",
                "expected": "High-resolution raster scan or vector barcode",
                "observed": f"Barcode region is only {width}×{height} pixels",
                "explanation": "Cannot resolve narrow barcode modules at this resolution. Quiet zone and contrast checks require higher rendering DPI.",
                "verificationLimitations": "Raster inspection limitation; requires at least 300 DPI or clear vector barcode art.",
                "rule": {"id": "GS1-PREFLIGHT-00", "source": spec["source"], "text": "Barcode inspection requires resolvable modules."}
            }]
        }

    # Sample scanlines across 30% to 70% of vertical height
    # to avoid human readable text at the bottom and edge antialiasing at top
    scan_y_coords = [
        int(height * frac) for frac in [0.35, 0.42, 0.50, 0.58, 0.65]
        if 0 <= int(height * frac) < height
    ]
    if not scan_y_coords:
        scan_y_coords = [height // 2]

    pixels = im.load()
    scanline_modules = []
    scanline_contrasts = []
    dark_lums = []
    light_lums = []

    # Analyze scanlines
    for y in scan_y_coords:
        lums = [rgb_to_luminance(*pixels[x, y]) for x in range(width)]
        min_lum = min(lums)
        max_lum = max(lums)
        symbol_contrast = max_lum - min_lum
        scanline_contrasts.append(symbol_contrast)
        
        # Adaptive threshold
        thresh = (min_lum + max_lum) / 2.0
        binary = [1 if l < thresh else 0 for l in lums]  # 1 = dark bar, 0 = light space

        # Measure runs of 1s and 0s
        runs = []
        cur_val = binary[0]
        cur_len = 0
        for b in binary:
            if b == cur_val:
                cur_len += 1
            else:
                runs.append((cur_val, cur_len))
                cur_val = b
                cur_len = 1
        runs.append((cur_val, cur_len))

        # Filter out very wide background runs at outer boundaries
        inner_runs = [r[1] for r in runs if r[1] > 0]
        if len(inner_runs) >= 10:
            # Narrow modules are typically the 10th-25th percentile of run lengths
            sorted_runs = sorted(inner_runs)
            narrow_candidates = sorted_runs[:max(3, len(sorted_runs) // 4)]
            est_module = sum(narrow_candidates) / len(narrow_candidates)
            if est_module >= 0.8:
                scanline_modules.append(est_module)
        
        # Collect element luminance
        dark_samples = [lums[x] for x in range(width) if binary[x] == 1]
        light_samples = [lums[x] for x in range(width) if binary[x] == 0]
        if dark_samples:
            dark_lums.append(sum(dark_samples) / len(dark_samples))
        if light_samples:
            light_lums.append(sum(light_samples) / len(light_samples))

    # Module width estimation
    if not scanline_modules:
        est_module_px = max(1.0, width / 95.0)  # Standard EAN-13 has 95 modules
        module_reliable = False
    else:
        est_module_px = sum(scanline_modules) / len(scanline_modules)
        module_reliable = True

    # Calculate mm per pixel based on page DPI
    mm_per_px = 25.4 / max(page_dpi, 72.0)
    module_width_mm = round(est_module_px * mm_per_px, 3)

    # GS1 Quiet Zone Requirements
    req_left_mult = spec["leftMult"]
    req_right_mult = spec["rightMult"]
    req_left_px = req_left_mult * est_module_px
    req_right_px = req_right_mult * est_module_px
    req_left_mm = round(req_left_px * mm_per_px, 2)
    req_right_mm = round(req_right_px * mm_per_px, 2)

    # Locate the bar pattern bounds (first and last bar)
    mid_y = height // 2
    mid_lums = [rgb_to_luminance(*pixels[x, mid_y]) for x in range(width)]
    mid_thresh = (min(mid_lums) + max(mid_lums)) / 2.0
    bar_indices = [x for x, l in enumerate(mid_lums) if l < mid_thresh]

    findings = []
    norm_barcode_box = barcode_meta.get("box", [0.0, 0.0, 1.0, 1.0])

    sym_modules = 67 if ("8" in symbology_raw) else 51 if ("UPCE" in symbology_raw or "UPC-E" in symbology_raw) else 95
    expected_symbol_px = sym_modules * est_module_px

    if not bar_indices or len(bar_indices) < 5:
        # Cannot isolate bars
        avail_left_px = width * 0.1
        avail_right_px = width * 0.1
        avail_left_mm = round(avail_left_px * mm_per_px, 2)
        avail_right_mm = round(avail_right_px * mm_per_px, 2)
        quiet_zone_status = "unable"
    else:
        # Identify the 1D barcode symbol core pattern (guard-to-guard)
        # Compute horizontal edge transitions across the scanlines
        transitions = [0] * width
        for y in scan_y_coords:
            prev_dark = (rgb_to_luminance(*pixels[0, y]) < mid_thresh)
            for x in range(1, width):
                cur_dark = (rgb_to_luminance(*pixels[x, y]) < mid_thresh)
                if cur_dark != prev_dark:
                    transitions[x] += 1
                prev_dark = cur_dark

        # Find window of size ~expected_symbol_px with maximum edge transitions
        win_w = max(10, min(width - 5, int(expected_symbol_px * 1.05)))
        best_x = 0
        max_trans = -1
        cur_trans = sum(transitions[:win_w])
        for x in range(width - win_w):
            if cur_trans > max_trans:
                max_trans = cur_trans
                best_x = x
            cur_trans += transitions[x + win_w] - transitions[x]

        window_bars = [x for x in range(best_x, min(width, best_x + win_w)) if any(rgb_to_luminance(*pixels[x, y]) < mid_thresh for y in scan_y_coords)]
        if window_bars and (window_bars[-1] - window_bars[0]) >= expected_symbol_px * 0.8:
            first_bar_x = window_bars[0]
            last_bar_x = window_bars[-1]
        else:
            first_bar_x = bar_indices[0]
            last_bar_x = bar_indices[-1]

        # Inspect quiet zones for obstructions (dark spots / text / graphics)
        left_intrusions = []
        for y in scan_y_coords:
            for x in range(max(0, int(first_bar_x - req_left_px)), first_bar_x):
                if rgb_to_luminance(*pixels[x, y]) < mid_thresh:
                    left_intrusions.append((x, y))

        right_intrusions = []
        for y in scan_y_coords:
            for x in range(last_bar_x + 1, min(width, int(last_bar_x + 1 + req_right_px))):
                if rgb_to_luminance(*pixels[x, y]) < mid_thresh:
                    right_intrusions.append((x, y))

        # Available quiet zone before first intrusion
        if left_intrusions:
            avail_left_px = max(0.0, float(first_bar_x - max(pt[0] for pt in left_intrusions)))
        else:
            avail_left_px = float(first_bar_x)

        if right_intrusions:
            avail_right_px = max(0.0, float(min(pt[0] for pt in right_intrusions) - last_bar_x))
        else:
            avail_right_px = float(width - 1 - last_bar_x)

        avail_left_mm = round(avail_left_px * mm_per_px, 2)
        avail_right_mm = round(avail_right_px * mm_per_px, 2)

        has_left_intrusion = len(left_intrusions) > 2 or avail_left_px < (req_left_px * 0.85)
        has_right_intrusion = len(right_intrusions) > 2 or avail_right_px < (req_right_px * 0.85)

        if has_left_intrusion or has_right_intrusion:
            quiet_zone_status = "issue"
            side_defects = []
            if has_left_intrusion:
                side_defects.append(f"Left: {avail_left_mm} mm available vs {req_left_mm} mm required ({req_left_mult}X)")
            if has_right_intrusion:
                side_defects.append(f"Right: {avail_right_mm} mm available vs {req_right_mm} mm required ({req_right_mult}X)")

            findings.append({
                "id": f"preflight:barcode:quiet-zone:p{page_num}",
                "key": f"preflight:barcode:quiet-zone:p{page_num}",
                "check": "barcode_quiet_zone",
                "category": "barcode",
                "title": f"Barcode quiet zone obstruction detected ({spec['name']})",
                "status": "issue",
                "severity": "major",
                "expected": (
                    f"Left quiet zone ≥ {req_left_mm} mm ({req_left_mult}X), "
                    f"Right quiet zone ≥ {req_right_mm} mm ({req_right_mult}X) unobstructed ({spec['source']})"
                ),
                "observed": " ; ".join(side_defects),
                "unit": "mm",
                "moduleWidthMm": module_width_mm,
                "measuredValue": min(avail_left_mm, avail_right_mm),
                "requiredValue": min(req_left_mm, req_right_mm),
                "measurementMethod": "horizontal_scanline_module_estimation",
                "explanation": (
                    f"The {spec['name']} barcode on page {page_num} does not provide the required clear margin. "
                    f"Available margins: Left {avail_left_mm} mm (required: {req_left_mm} mm), "
                    f"Right {avail_right_mm} mm (required: {req_right_mm} mm). "
                    f"Intruding graphics, text, or tight trim clipping cause optical scanner read failures."
                ),
                "verificationLimitations": (
                    "Measured via scanline run-length analysis on rendered raster artwork. "
                    "Confirm against physical print master or dieline exclusion zones."
                ),
                "rule": {
                    "id": "GS1-QUIET-ZONE-01",
                    "source": spec["source"],
                    "text": f"{spec['name']} barcodes require unobstructed quiet zones: {req_left_mult}X left, {req_right_mult}X right."
                },
                "evidence": [{
                    "role": "artwork",
                    "page": page_num,
                    "box": norm_barcode_box,
                    "location": f"Page {page_num} · Barcode quiet zone"
                }]
            })
        else:
            quiet_zone_status = "match"
            findings.append({
                "id": f"preflight:barcode:quiet-zone-valid:p{page_num}",
                "key": f"preflight:barcode:quiet-zone-valid:p{page_num}",
                "check": "barcode_quiet_zone",
                "category": "barcode",
                "title": f"Barcode quiet zones ({spec['name']}) unobstructed",
                "status": "match",
                "severity": "minor",
                "expected": f"Left ≥ {req_left_mm} mm ({req_left_mult}X), Right ≥ {req_right_mm} mm ({req_right_mult}X)",
                "observed": f"Left {avail_left_mm} mm, Right {avail_right_mm} mm unobstructed",
                "unit": "mm",
                "moduleWidthMm": module_width_mm,
                "measuredValue": min(avail_left_mm, avail_right_mm),
                "requiredValue": min(req_left_mm, req_right_mm),
                "measurementMethod": "horizontal_scanline_module_estimation",
                "explanation": f"The {spec['name']} symbol satisfies the GS1 quiet-zone clearance requirement.",
                "rule": {
                    "id": "GS1-QUIET-ZONE-01",
                    "source": spec["source"],
                    "text": f"{spec['name']} quiet zones meet GS1 standards."
                },
                "evidence": [{
                    "role": "artwork",
                    "page": page_num,
                    "box": norm_barcode_box,
                    "location": f"Page {page_num} · Barcode"
                }]
            })

    # Print Contrast Screening (Phase 2)
    avg_dark_lum = sum(dark_lums) / len(dark_lums) if dark_lums else 0.05
    avg_light_lum = sum(light_lums) / len(light_lums) if light_lums else 0.95
    avg_symbol_contrast = round(avg_light_lum - avg_dark_lum, 3)

    if avg_symbol_contrast < 0.35:
        contrast_status = "issue"
        findings.append({
            "id": f"preflight:barcode:low-contrast:p{page_num}",
            "key": f"preflight:barcode:low-contrast:p{page_num}",
            "check": "barcode_print_contrast",
            "category": "barcode",
            "title": f"Barcode contrast screening: low optical contrast ({round(avg_symbol_contrast*100)}%)",
            "status": "issue",
            "severity": "major",
            "expected": "Symbol contrast ≥ 65% (dark bars on light reflective substrate)",
            "observed": (
                f"Luminance separation {round(avg_symbol_contrast*100)}% "
                f"(Dark element: {avg_dark_lum:.2f}, Light background: {avg_light_lum:.2f})"
            ),
            "unit": "ratio",
            "measuredValue": avg_symbol_contrast,
            "requiredValue": 0.65,
            "measurementMethod": "raster_luminance_separation_screening",
            "explanation": (
                f"Estimated symbol contrast is {round(avg_symbol_contrast*100)}%, which is below the recommended 65% "
                f"threshold for retail scanning. Low contrast can cause failure at point-of-sale optical scanners."
            ),
            "verificationLimitations": (
                "Raster contrast screening only. This is NOT an ISO/IEC 15416 calibrated verification grade, "
                "which requires spectrophotometric measurement on physical press substrate."
            ),
            "rule": {
                "id": "GS1-CONTRAST-01",
                "source": "GS1 General Specifications Section 5.5 (Symbol Quality)",
                "text": "Barcode symbols must provide sufficient reflectance contrast between bars and spaces."
            },
            "evidence": [{
                "role": "artwork",
                "page": page_num,
                "box": norm_barcode_box,
                "location": f"Page {page_num} · Barcode contrast"
            }]
        })
    elif avg_symbol_contrast < 0.60:
        contrast_status = "review"
        findings.append({
            "id": f"preflight:barcode:marginal-contrast:p{page_num}",
            "key": f"preflight:barcode:marginal-contrast:p{page_num}",
            "check": "barcode_print_contrast",
            "category": "barcode",
            "title": f"Barcode contrast screening: marginal optical contrast ({round(avg_symbol_contrast*100)}%)",
            "status": "review",
            "severity": "minor",
            "expected": "Symbol contrast ≥ 65%",
            "observed": f"Estimated contrast {round(avg_symbol_contrast*100)}%",
            "unit": "ratio",
            "measuredValue": avg_symbol_contrast,
            "requiredValue": 0.65,
            "measurementMethod": "raster_luminance_separation_screening",
            "explanation": (
                f"The estimated symbol contrast ({round(avg_symbol_contrast*100)}%) is marginal. "
                f"Perform physical press proofing to verify ISO/IEC 15416 reflectance."
            ),
            "verificationLimitations": "Raster screening approximation; not a calibrated ISO/IEC 15416 verification.",
            "rule": {
                "id": "GS1-CONTRAST-01",
                "source": "GS1 General Specifications Section 5.5",
                "text": "Adequate bar-to-space reflectance contrast is required."
            },
            "evidence": [{
                "role": "artwork",
                "page": page_num,
                "box": norm_barcode_box,
                "location": f"Page {page_num} · Barcode"
            }]
        })
    else:
        contrast_status = "match"
        findings.append({
            "id": f"preflight:barcode:contrast-valid:p{page_num}",
            "key": f"preflight:barcode:contrast-valid:p{page_num}",
            "check": "barcode_print_contrast",
            "category": "barcode",
            "title": f"Barcode contrast screening: clean separation ({round(avg_symbol_contrast*100)}%)",
            "status": "match",
            "severity": "minor",
            "expected": "Symbol contrast ≥ 65%",
            "observed": f"Luminance separation {round(avg_symbol_contrast*100)}% (Dark: {avg_dark_lum:.2f}, Light: {avg_light_lum:.2f})",
            "unit": "ratio",
            "measuredValue": avg_symbol_contrast,
            "requiredValue": 0.65,
            "measurementMethod": "raster_luminance_separation_screening",
            "explanation": "High visual contrast detected between barcode elements and background.",
            "rule": {
                "id": "GS1-CONTRAST-01",
                "source": "GS1 General Specifications Section 5.5",
                "text": "Barcode reflectance contrast meets screening guidelines."
            },
            "evidence": [{
                "role": "artwork",
                "page": page_num,
                "box": norm_barcode_box,
                "location": f"Page {page_num} · Barcode"
            }]
        })

    return {
        "status": "success",
        "symbology": spec["name"],
        "gtin": gtin,
        "moduleWidth": {
            "pixels": round(est_module_px, 2),
            "mm": module_width_mm,
            "reliable": module_reliable
        },
        "quietZones": {
            "status": quiet_zone_status,
            "left": {
                "requiredMultiplier": req_left_mult,
                "requiredMm": req_left_mm,
                "availableMm": avail_left_mm,
                "passes": avail_left_mm >= req_left_mm
            },
            "right": {
                "requiredMultiplier": req_right_mult,
                "requiredMm": req_right_mm,
                "availableMm": avail_right_mm,
                "passes": avail_right_mm >= req_right_mm
            }
        },
        "contrastScreening": {
            "status": contrast_status,
            "darkElementLuminance": round(avg_dark_lum, 3),
            "lightElementLuminance": round(avg_light_lum, 3),
            "symbolContrast": avg_symbol_contrast,
            "isCalibratedIsoGrade": False,
            "limitation": "Raster screening approximation; not an ISO/IEC 15416 certified physical verification grade."
        },
        "findings": findings
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        path = sys.argv[1]
        im = Image.open(path)
        meta = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        print(json.dumps(analyze_barcode_image(im, meta), indent=2))
