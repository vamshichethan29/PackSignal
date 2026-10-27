#!/usr/bin/env python3
"""
PackSignal Visual Diff Engine (lib/visual-diff.py)
Computes real pixel differences, suppresses rasterization anti-aliasing noise,
extracts bounded visual change regions, and generates difference overlay masks.
"""

import sys
import json
import math
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

def compute_visual_diff(args):
    """
    Inputs in args:
      prev_image_path: str (path to rendered V1 page PNG)
      curr_image_path: str (path to rendered V2 page PNG)
      out_dir: str (directory to save difference overlay image)
      diff_image_name: str (filename for output diff image)
      tolerance: int (pixel intensity delta threshold, default 25)
      min_region_pixels: int (minimum pixel cluster size to qualify as change, default 30)
      max_regions: int (maximum number of change boxes to return, default 50)
      grid_step: int (subsampling step for region clustering, default 16)
    """
    prev_path = Path(args['prev_image_path'])
    curr_path = Path(args['curr_image_path'])
    out_dir = Path(args.get('out_dir', prev_path.parent))
    diff_name = args.get('diff_image_name', f"diff-{prev_path.stem}-{curr_path.stem}.png")

    if not prev_path.exists() or not curr_path.exists():
        return {
            "error": "One or both artwork page images do not exist.",
            "status": "UNAVAILABLE",
            "regions": [],
            "stats": {"changedPixels": 0, "changeRatio": 0.0}
        }

    im_prev = Image.open(prev_path).convert('RGB')
    im_curr = Image.open(curr_path).convert('RGB')

    orig_prev_size = im_prev.size
    orig_curr_size = im_curr.size

    # Check for dimension disparity
    size_mismatch = (orig_prev_size != orig_curr_size)

    # Normalize to common working dimensions (max of both, bounded to 1800x1800)
    target_w = min(1800, max(orig_prev_size[0], orig_curr_size[0]))
    target_h = min(1800, max(orig_prev_size[1], orig_curr_size[1]))

    # Use high-quality resampling if resizing is required
    if im_prev.size != (target_w, target_h):
        im_prev_scaled = im_prev.resize((target_w, target_h), Image.Resampling.BILINEAR)
    else:
        im_prev_scaled = im_prev

    if im_curr.size != (target_w, target_h):
        im_curr_scaled = im_curr.resize((target_w, target_h), Image.Resampling.BILINEAR)
    else:
        im_curr_scaled = im_curr

    # Fast NumPy array conversion
    import numpy as np
    arr_prev = np.asarray(im_prev_scaled, dtype=np.int16)
    arr_curr = np.asarray(im_curr_scaled, dtype=np.int16)

    # Compute absolute RGB channel differences
    diff_rgb = np.abs(arr_prev - arr_curr)
    
    # Calculate Euclidean color distance or max channel difference
    # Max channel delta suppresses minor anti-aliasing while catching ink shifts
    delta = np.max(diff_rgb, axis=2)

    tolerance = int(args.get('tolerance', 25))
    mask = (delta > tolerance).astype(np.uint8)

    total_pixels = target_w * target_h
    changed_pixels = int(np.sum(mask))
    change_ratio = float(changed_pixels / total_pixels) if total_pixels > 0 else 0.0

    # Cluster changed pixels using a grid-based connected component grouping
    grid_step = int(args.get('grid_step', 16))
    grid_h = math.ceil(target_h / grid_step)
    grid_w = math.ceil(target_w / grid_step)

    # Compute grid-cell density
    grid_counts = np.zeros((grid_h, grid_w), dtype=np.int32)
    min_cell_noise = max(4, int(grid_step * grid_step * 0.08)) # Suppress 8% speckle noise

    for gy in range(grid_h):
        y0 = gy * grid_step
        y1 = min(target_h, y0 + grid_step)
        for gx in range(grid_w):
            x0 = gx * grid_step
            x1 = min(target_w, x0 + grid_step)
            cell_count = np.sum(mask[y0:y1, x0:x1])
            if cell_count >= min_cell_noise:
                grid_counts[gy, gx] = cell_count

    # Connected component labeling on the 2D grid
    visited = np.zeros((grid_h, grid_w), dtype=bool)
    clusters = []

    for gy in range(grid_h):
        for gx in range(grid_w):
            if grid_counts[gy, gx] > 0 and not visited[gy, gx]:
                # Flood fill / BFS
                queue = [(gy, gx)]
                visited[gy, gx] = True
                cluster_cells = []
                total_cluster_pixels = 0

                while queue:
                    cy, cx = queue.pop(0)
                    cluster_cells.append((cy, cx))
                    total_cluster_pixels += int(grid_counts[cy, cx])

                    for dy, dx in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < grid_h and 0 <= nx < grid_w:
                            if grid_counts[ny, nx] > 0 and not visited[ny, nx]:
                                visited[ny, nx] = True
                                queue.append((ny, nx))

                if total_cluster_pixels >= int(args.get('min_region_pixels', 30)):
                    clusters.append({
                        'cells': cluster_cells,
                        'pixel_count': total_cluster_pixels
                    })

    # Sort clusters by area descending
    clusters.sort(key=lambda c: c['pixel_count'], reverse=True)
    max_regions = int(args.get('max_regions', 50))
    clusters = clusters[:max_regions]

    # Convert clusters into bounding boxes [left, top, right, bottom]
    regions = []
    for idx, c in enumerate(clusters):
        c_ys = [cell[0] for cell in c['cells']]
        c_xs = [cell[1] for cell in c['cells']]

        min_gx, max_gx = min(c_xs), max(c_xs)
        min_gy, max_gy = min(c_ys), max(c_ys)

        px_x0 = max(0, min_gx * grid_step - 4)
        px_y0 = max(0, min_gy * grid_step - 4)
        px_x1 = min(target_w, (max_gx + 1) * grid_step + 4)
        px_y1 = min(target_h, (max_gy + 1) * grid_step + 4)

        # Normalized coordinates 0..1
        norm_box = [
            round(px_x0 / target_w, 4),
            round(px_y0 / target_h, 4),
            round(px_x1 / target_w, 4),
            round(px_y1 / target_h, 4)
        ]

        regions.append({
            "id": f"chg-{idx + 1}",
            "box": norm_box,
            "pixelBox": [px_x0, px_y0, px_x1, px_y1],
            "pixelCount": c['pixel_count'],
            "areaPercent": round((c['pixel_count'] / total_pixels) * 100, 3),
            "label": f"Visual change area {idx + 1}"
        })

    # Generate Difference Overlay Image
    # Neutral cyan/amber difference layer over translucent V2
    out_dir.mkdir(parents=True, exist_ok=True)
    diff_out_path = out_dir / diff_name

    # Create RGBA heatmap image
    overlay = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    overlay_arr = np.zeros((target_h, target_w, 4), dtype=np.uint8)

    # Highlight changed pixels in semi-transparent amber/cyan
    # Amber: (255, 170, 0, 190)
    change_indices = mask > 0
    overlay_arr[change_indices, 0] = 255
    overlay_arr[change_indices, 1] = 160
    overlay_arr[change_indices, 2] = 20
    overlay_arr[change_indices, 3] = 180

    overlay_img = Image.fromarray(overlay_arr, mode='RGBA')

    # Draw region bounding boxes onto overlay
    draw = ImageDraw.Draw(overlay_img)
    for r in regions:
        b = r['pixelBox']
        draw.rectangle(b, outline=(255, 220, 60, 240), width=2)

    # Blend overlay with V2 background for rich inspection
    base_v2 = im_curr_scaled.convert('RGBA')
    combined = Image.alpha_composite(base_v2, overlay_img)
    combined.save(diff_out_path, format='PNG')

    # Determine alignment status
    alignment_status = "ALIGNED_MATCH"
    alignment_note = "Artwork dimensions and orientation aligned successfully."
    if size_mismatch:
        alignment_status = "DIMENSION_RESCALED"
        alignment_note = f"Previous artwork was {orig_prev_size[0]}x{orig_prev_size[1]}px; current is {orig_curr_size[0]}x{orig_curr_size[1]}px. Normalized for pixel comparison."

    return {
        "status": "COMPLETED",
        "alignment": {
            "status": alignment_status,
            "note": alignment_note,
            "targetDimensions": [target_w, target_h],
            "prevDimensions": list(orig_prev_size),
            "currDimensions": list(orig_curr_size),
            "rescaled": size_mismatch
        },
        "stats": {
            "totalPixels": total_pixels,
            "changedPixels": changed_pixels,
            "changeRatio": round(change_ratio, 5),
            "changePercentage": round(change_ratio * 100, 3),
            "regionCount": len(regions)
        },
        "diffImage": diff_name,
        "diffImagePath": str(diff_out_path),
        "regions": regions
    }

if __name__ == '__main__':
    try:
        raw_input = sys.stdin.read()
        args = json.loads(raw_input) if raw_input.strip() else {}
        result = compute_visual_diff(args)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        err_msg = str(e)
        print(json.dumps({
            "status": "ERROR",
            "error": err_msg,
            "trace": traceback.format_exc()[:400]
        }))
        sys.exit(1)
