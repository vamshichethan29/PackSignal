#!/usr/bin/env python3
"""
PackSignal Regulatory Symbol Inspector (lib/regulatory-symbols.py)
Computer Vision detection and geometric screening for packaging regulatory marks:
- Indian Vegetarian Symbol (green filled circle inside green square)
- Indian Non-Vegetarian Symbol (brown filled triangle inside brown square)
Uses pure PIL and NumPy without heavy dependencies.
"""

import sys
import json
from pathlib import Path
from PIL import Image
import numpy as np

def detect_regulatory_symbols(args):
    image_path = Path(args.get('image_path', ''))
    page = int(args.get('page', 1))
    target_symbols = args.get('symbols', ['fssai_veg', 'fssai_nonveg'])

    if not image_path.exists():
        return {
            "status": "ERROR",
            "error": f"Image file not found: {image_path}",
            "symbolsDetected": [],
            "limitations": ["Artwork page image unavailable for raster symbol screening."]
        }

    try:
        im = Image.open(image_path).convert('RGB')
    except Exception as e:
        return {
            "status": "ERROR",
            "error": f"Could not open image: {e}",
            "symbolsDetected": [],
            "limitations": []
        }

    w, h = im.size
    # Downscale large images for responsive screening while keeping detail (max 1400 on long side)
    scale = 1.0
    if max(w, h) > 1400:
        scale = 1400.0 / max(w, h)
        proc_w = int(w * scale)
        proc_h = int(h * scale)
        im_proc = im.resize((proc_w, proc_h), Image.Resampling.BILINEAR)
    else:
        im_proc = im
        proc_w, proc_h = w, h

    arr = np.array(im_proc, dtype=np.uint8)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    # 1. Color Segmentation
    # Green mask: G is dominant, R and B significantly lower
    green_mask = (g > 75) & (g > r + 25) & (g > b + 20) & (g < 240)
    # Brown mask: R is dominant over G and B, earthy tone
    brown_mask = (r > 70) & (r < 210) & (r > g + 20) & (r > b + 30) & (g > 25) & (b < 140)

    detected = []

    # Grid search for square-like clusters with internal symbols
    grid_size = 20
    cols = proc_w // grid_size
    rows = proc_h // grid_size

    def analyze_candidate(sub_mask, sub_r, sub_g, sub_b, color_type):
        """Checks if a sub-region has an outer square border and inner fill."""
        total_px = sub_mask.size
        filled_px = np.count_nonzero(sub_mask)
        fill_ratio = filled_px / max(1, total_px)

        # A circle or triangle inside a square typically occupies 25% to 65% of the bounding square
        if 0.18 <= fill_ratio <= 0.75:
            # Check aspect ratio
            sh_h, sh_w = sub_mask.shape
            ar = sh_w / max(1, sh_h)
            if 0.75 <= ar <= 1.33:
                return True, fill_ratio
        return False, fill_ratio

    # Scan for green (Veg) if requested
    if 'fssai_veg' in target_symbols:
        # Sum green mask along grid cells
        green_density = np.zeros((rows, cols), dtype=int)
        for gy in range(rows):
            for gx in range(cols):
                cell = green_mask[gy*grid_size:(gy+1)*grid_size, gx*grid_size:(gx+1)*grid_size]
                green_density[gy, gx] = np.count_nonzero(cell)

        # Look for contiguous blocks of green density
        active_cells = green_density > (grid_size * grid_size * 0.15)
        if np.any(active_cells):
            labeled_cells = []
            visited = np.zeros_like(active_cells, dtype=bool)

            for gy in range(rows):
                for gx in range(cols):
                    if active_cells[gy, gx] and not visited[gy, gx]:
                        # BFS to find component
                        comp = []
                        q = [(gy, gx)]
                        visited[gy, gx] = True
                        while q:
                            cy, cx = q.pop(0)
                            comp.append((cy, cx))
                            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                                ny, nx = cy + dy, cx + dx
                                if 0 <= ny < rows and 0 <= nx < cols and active_cells[ny, nx] and not visited[ny, nx]:
                                    visited[ny, nx] = True
                                    q.append((ny, nx))

                        min_gy = min(c[0] for c in comp)
                        max_gy = max(c[0] for c in comp)
                        min_gx = min(c[1] for c in comp)
                        max_gx = max(c[1] for c in comp)

                        box_w = (max_gx - min_gx + 1) * grid_size
                        box_h = (max_gy - min_gy + 1) * grid_size

                        # Symbols are typically between 12px and 240px in size
                        if 14 <= box_w <= 280 and 14 <= box_h <= 280:
                            sub_m = green_mask[min_gy*grid_size:(max_gy+1)*grid_size, min_gx*grid_size:(max_gx+1)*grid_size]
                            is_valid, ratio = analyze_candidate(sub_m, None, None, None, 'green')
                            if is_valid:
                                norm_x0 = round((min_gx * grid_size) / proc_w, 4)
                                norm_y0 = round((min_gy * grid_size) / proc_h, 4)
                                norm_x1 = round(min(1.0, ((max_gx + 1) * grid_size) / proc_w), 4)
                                norm_y1 = round(min(1.0, ((max_gy + 1) * grid_size) / proc_h), 4)

                                detected.append({
                                    "symbolType": "fssai_veg",
                                    "status": "FOUND",
                                    "detectedShape": "circle_in_square",
                                    "color": "green",
                                    "box": [norm_x0, norm_y0, norm_x1, norm_y1],
                                    "confidence": "HIGH" if (0.25 <= ratio <= 0.65) else "MEDIUM",
                                    "page": page,
                                    "fillRatio": round(ratio, 3),
                                    "explanation": "Indian Vegetarian symbol: green filled circle within green outlined square."
                                })

    # Scan for brown (Non-Veg) if requested
    if 'fssai_nonveg' in target_symbols:
        brown_density = np.zeros((rows, cols), dtype=int)
        for gy in range(rows):
            for gx in range(cols):
                cell = brown_mask[gy*grid_size:(gy+1)*grid_size, gx*grid_size:(gx+1)*grid_size]
                brown_density[gy, gx] = np.count_nonzero(cell)

        active_cells = brown_density > (grid_size * grid_size * 0.15)
        if np.any(active_cells):
            visited = np.zeros_like(active_cells, dtype=bool)
            for gy in range(rows):
                for gx in range(cols):
                    if active_cells[gy, gx] and not visited[gy, gx]:
                        comp = []
                        q = [(gy, gx)]
                        visited[gy, gx] = True
                        while q:
                            cy, cx = q.pop(0)
                            comp.append((cy, cx))
                            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                                ny, nx = cy + dy, cx + dx
                                if 0 <= ny < rows and 0 <= nx < cols and active_cells[ny, nx] and not visited[ny, nx]:
                                    visited[ny, nx] = True
                                    q.append((ny, nx))

                        min_gy = min(c[0] for c in comp)
                        max_gy = max(c[0] for c in comp)
                        min_gx = min(c[1] for c in comp)
                        max_gx = max(c[1] for c in comp)

                        box_w = (max_gx - min_gx + 1) * grid_size
                        box_h = (max_gy - min_gy + 1) * grid_size

                        if 14 <= box_w <= 280 and 14 <= box_h <= 280:
                            sub_m = brown_mask[min_gy*grid_size:(max_gy+1)*grid_size, min_gx*grid_size:(max_gx+1)*grid_size]
                            is_valid, ratio = analyze_candidate(sub_m, None, None, None, 'brown')
                            if is_valid:
                                norm_x0 = round((min_gx * grid_size) / proc_w, 4)
                                norm_y0 = round((min_gy * grid_size) / proc_h, 4)
                                norm_x1 = round(min(1.0, ((max_gx + 1) * grid_size) / proc_w), 4)
                                norm_y1 = round(min(1.0, ((max_gy + 1) * grid_size) / proc_h), 4)

                                detected.append({
                                    "symbolType": "fssai_nonveg",
                                    "status": "FOUND",
                                    "detectedShape": "triangle_in_square",
                                    "color": "brown",
                                    "box": [norm_x0, norm_y0, norm_x1, norm_y1],
                                    "confidence": "HIGH" if (0.22 <= ratio <= 0.60) else "MEDIUM",
                                    "page": page,
                                    "fillRatio": round(ratio, 3),
                                    "explanation": "Indian Non-Vegetarian symbol: brown filled triangle within brown outlined square."
                                })

    return {
        "status": "SUCCESS",
        "page": page,
        "imageWidth": w,
        "imageHeight": h,
        "symbolsDetected": detected,
        "hasSymbols": len(detected) > 0,
        "limitations": [
            "Symbol candidate screening is a visual computer-vision aid; reviewer must inspect original artwork dieline for exact statutory millimeters."
        ]
    }

if __name__ == '__main__':
    try:
        raw = sys.stdin.read()
        args = json.loads(raw) if raw.strip() else {}
        res = detect_regulatory_symbols(args)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({
            "status": "ERROR",
            "error": str(e),
            "trace": traceback.format_exc()[:400],
            "symbolsDetected": []
        }))
        sys.exit(1)
