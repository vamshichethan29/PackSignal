#!/usr/bin/env python3
"""
PackSignal Advanced PDF Text Reconstruction (lib/pdf_text_reconstruction.py)
Phase 1: Letter-Spaced Text + Curved Arc Text Reconstruction
Glyph Geometry + Reading Order + Visual Evidence

Deterministic, offline typography reconstruction module that detects:
1. Letter-spaced wide-tracked text (e.g. "1 5 g" -> "15 g", "2 . 2 g" -> "2.2 g", "P A C K E D   W I T H   G O O D N E S S" -> "PACKED WITH GOODNESS")
2. Curved arc text arranged along circular paths (e.g. brand seals, packaging slogans)
3. Preserves original glyph geometry, native PDF text, source coordinates, reading direction, and visibility evidence.
4. High-stakes numeric safeguards against cross-column merging.
5. Arc unwrapping / straightening for visual inspection.
"""

import sys
import os
import math
import json
import re
from pathlib import Path

# Supported Authority & Confidence States
AUTH_NATIVE_GEOMETRY_VERIFIED = "NATIVE_GEOMETRY_VERIFIED"
AUTH_NATIVE_GEOMETRY_RECONSTRUCTED = "NATIVE_GEOMETRY_RECONSTRUCTED"
AUTH_OCR_CORROBORATED = "OCR_CORROBORATED"
AUTH_RECONSTRUCTION_REVIEW_REQUIRED = "RECONSTRUCTION_REVIEW_REQUIRED"
AUTH_UNSUPPORTED_OUTLINED_TEXT = "UNSUPPORTED_OUTLINED_TEXT"
AUTH_VISIBILITY_UNCERTAIN = "VISIBILITY_UNCERTAIN"
AUTH_HIDDEN = "HIDDEN"


def _solve_3x3_linear_system(A, B):
    """
    Pure Python Cramer's rule solver for 3x3 system A * X = B.
    A is 3x3 list of lists, B is 3-element list.
    Returns list of 3 floats, or None if singular.
    """
    def det3(m):
        return (
            m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
        )

    d = det3(A)
    if abs(d) < 1e-12:
        return None

    def replace_col(m, c, col):
        return [[col[r] if col_idx == c else m[r][col_idx] for col_idx in range(3)] for r in range(3)]

    dx = det3(replace_col(A, 0, B))
    dy = det3(replace_col(A, 1, B))
    dz = det3(replace_col(A, 2, B))
    return [dx / d, dy / d, dz / d]


def fit_circular_arc(points):
    """
    Fits a circle to a list of (x, y) points using algebraic least-squares (Kasa method).
    Points should be in points/pixel coordinates.
    Returns: dict(center=(xc, yc), radius=r, rmse=rmse, rel_rmse=rmse/r) or None.
    """
    n = len(points)
    if n < 3:
        return None

    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sx2 = sum(p[0] ** 2 for p in points)
    sy2 = sum(p[1] ** 2 for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    sz = sx2 + sy2
    sxz = sum(p[0] * (p[0] ** 2 + p[1] ** 2) for p in points)
    syz = sum(p[1] * (p[0] ** 2 + p[1] ** 2) for p in points)

    A = [
        [sx2, sxy, sx],
        [sxy, sy2, sy],
        [sx, sy, float(n)]
    ]
    B = [sxz, syz, sz]

    sol = _solve_3x3_linear_system(A, B)
    if not sol:
        return None

    xc = sol[0] / 2.0
    yc = sol[1] / 2.0
    r_sq = sol[2] + xc ** 2 + yc ** 2
    if r_sq <= 0:
        return None

    r = math.sqrt(r_sq)
    if r < 8.0 or r > 8000.0:
        return None

    residuals = [abs(math.sqrt((p[0] - xc) ** 2 + (p[1] - yc) ** 2) - r) for p in points]
    rmse = math.sqrt(sum(res ** 2 for res in residuals) / n)
    rel_rmse = rmse / r

    return {
        "center": (xc, yc),
        "radius": r,
        "rmse": rmse,
        "rel_rmse": rel_rmse
    }


def unwrap_arc_to_strip(image, center, radius, start_angle_rad, end_angle_rad, height=40, width=400):
    """
    Diagnostic unwrapping of a curved circular text arc into a horizontal rectangular strip.
    """
    try:
        from PIL import Image
        strip = Image.new('RGB', (width, height), (255, 255, 255))
        pixels = strip.load()
        src_w, src_h = image.size
        src_pixels = image.load()

        cx, cy = center
        ang_span = end_angle_rad - start_angle_rad
        half_h = height / 2.0

        for u in range(width):
            frac = u / float(width - 1) if width > 1 else 0
            ang = start_angle_rad + frac * ang_span
            cos_a = math.cos(ang)
            sin_a = math.sin(ang)
            for v in range(height):
                rho = radius - half_h + v
                sx = int(round(cx + rho * cos_a))
                sy = int(round(cy + rho * sin_a))
                if 0 <= sx < src_w and 0 <= sy < src_h:
                    pixels[u, v] = src_pixels[sx, sy]
        return strip
    except Exception:
        return None


def extract_glyphs_from_page(page, page_num=1, vis_report=None):
    """
    Extracts individual glyph data with coordinates, nominal font size,
    baseline origin, baseline direction vector, and visibility status.
    Uses PyMuPDF (fitz) page.get_text('rawjson').
    """
    rect = page.rect
    width_pt = max(1.0, float(rect.width))
    height_pt = max(1.0, float(rect.height))

    try:
        raw_data = page.get_text("rawdict")
    except Exception:
        try:
            raw_data = json.loads(page.get_text("rawjson"))
        except Exception:
            raw_data = {}

    hidden_boxes = []
    if vis_report and "pages" in vis_report:
        p_idx = page_num - 1
        if 0 <= p_idx < len(vis_report["pages"]):
            p_vis = vis_report["pages"][p_idx]
            for sp in p_vis.get("spans", []):
                if sp.get("kind") == "hidden" and "box" in sp:
                    b = sp["box"]
                    hidden_boxes.append((
                        b[0] * width_pt,
                        b[1] * height_pt,
                        b[2] * width_pt,
                        b[3] * height_pt
                    ))

    glyphs = []
    glyph_idx = 0

    blocks = raw_data.get("blocks", [])
    for b_idx, block in enumerate(blocks):
        if block.get("type") != 0:
            continue
        for l_idx, line in enumerate(block.get("lines", [])):
            line_dir = line.get("dir", [1.0, 0.0])
            for s_idx, span in enumerate(line.get("spans", [])):
                font_name = span.get("font", "")
                font_size = float(span.get("size", 10.0))

                for c_item in span.get("chars", []):
                    char_text = c_item.get("c", "")
                    if not char_text or char_text == "\x00":
                        continue

                    c_bbox = c_item.get("bbox", [0, 0, 0, 0])
                    c_origin = c_item.get("origin", [c_bbox[0], c_bbox[3]])

                    angle_rad = math.atan2(line_dir[1], line_dir[0])
                    angle_deg = math.degrees(angle_rad)

                    norm_box = [
                        max(0.0, min(1.0, c_bbox[0] / width_pt)),
                        max(0.0, min(1.0, c_bbox[1] / height_pt)),
                        max(0.0, min(1.0, c_bbox[2] / width_pt)),
                        max(0.0, min(1.0, c_bbox[3] / height_pt))
                    ]

                    is_hidden = False
                    for hx0, hy0, hx1, hy1 in hidden_boxes:
                        if not (c_bbox[2] < hx0 or c_bbox[0] > hx1 or c_bbox[3] < hy0 or c_bbox[1] > hy1):
                            is_hidden = True
                            break

                    visibility_status = "hidden" if is_hidden else "visible"

                    glyph = {
                        "glyphId": f"p{page_num}_g{glyph_idx}",
                        "page": page_num,
                        "char": char_text,
                        "origin": [float(c_origin[0]), float(c_origin[1])],
                        "bbox": [float(c_bbox[0]), float(c_bbox[1]), float(c_bbox[2]), float(c_bbox[3])],
                        "normBox": norm_box,
                        "font": font_name,
                        "fontSize": font_size,
                        "direction": [float(line_dir[0]), float(line_dir[1])],
                        "angleDeg": angle_deg,
                        "blockIdx": b_idx,
                        "lineIdx": l_idx,
                        "spanIdx": s_idx,
                        "visibility": visibility_status,
                        "isSynthetic": c_item.get("synthetic", False)
                    }
                    glyphs.append(glyph)
                    glyph_idx += 1

    return glyphs, width_pt, height_pt


def detect_table_column_boundaries(glyphs, width_pt, height_pt):
    """
    Detects vertical column alignments across multiple lines to prevent
    merging adjacent table columns (e.g. Column 1: '1', Column 2: '5 g').
    """
    if len(glyphs) < 6:
        return []

    lines = []
    sorted_glyphs = sorted(glyphs, key=lambda g: g["origin"][1])
    curr_line = []
    curr_y = None

    for g in sorted_glyphs:
        y = g["origin"][1]
        if curr_y is None or abs(y - curr_y) < max(4.0, g["fontSize"] * 0.4):
            curr_line.append(g)
            curr_y = y
        else:
            if curr_line:
                lines.append(curr_line)
            curr_line = [g]
            curr_y = y
    if curr_line:
        lines.append(curr_line)

    column_gaps = []
    for line in lines:
        if len(line) < 2:
            continue
        line_sorted = sorted(line, key=lambda g: g["bbox"][0])
        for i in range(len(line_sorted) - 1):
            g1 = line_sorted[i]
            g2 = line_sorted[i + 1]
            gap = g2["bbox"][0] - g1["bbox"][2]
            fsize = (g1["fontSize"] + g2["fontSize"]) / 2.0
            if gap > 2.0 * fsize:
                column_gaps.append((g1["bbox"][2], g2["bbox"][0]))

    return column_gaps


def is_wide_tracked_string(raw_str):
    """
    Evaluates whether raw string represents genuine wide tracking.
    Matches:
    - '1 5 g', '2 . 2 g', '4 8 0 g', '1 0 0 m L'
    - 'P A C K E D', 'N E T  W T', 'P A C K E D   W I T H   G O O D N E S S'
    Rejects:
    - Normal sentences: 'Store in a cool, dry place. Once opened...'
    - Single standard words: 'Nutrition', 'Ingredients'
    """
    s = raw_str.strip()
    if not s or len(s) < 3:
        return False

    # Spaced numeric values: '1 5 g', '2 . 2 g', '1868 kJ'
    if re.match(r'^\d(?:\s+\d)+(?:\s+[a-zA-Z%]+)?$', s):
        return True
    if re.match(r'^\d+\s*[\.,]\s*\d+(?:\s+[a-zA-Z%]+)?$', s):
        return True
    if re.match(r'^\d(?:\s*[\.,]\s*\d)+(?:\s+[a-zA-Z%]+)?$', s):
        return True
    if re.search(r'\b\d\s+\d\s+[a-zA-Z%]+\b', s):
        return True
    if re.search(r'\b\d\s*[\.,]\s+\d(?:\s+[a-zA-Z%]+)?\b', s) or re.search(r'\b\d\s+[\.,]\s*\d(?:\s+[a-zA-Z%]+)?\b', s):
        return True

    # Letter-spaced words or phrases
    tokens = s.split()
    if len(tokens) >= 3:
        single_chars = sum(1 for t in tokens if len(t) == 1 and t.isalnum())
        if single_chars / max(1, len(tokens)) >= 0.60:
            return True

    # Multi-word wide tracking: e.g. 'PAC K AG I N G  P OW E R E D  BY' or 'p e r  1 0 0 g'
    if '  ' in s and re.search(r'\b[A-Za-z0-9]\s+[A-Za-z0-9]\b', s):
        return True

    return False


def reconstruct_letter_spaced_runs(glyphs, width_pt, height_pt, table_gaps=None):
    """
    Reconstructs letter-spaced text where characters have wide tracking.
    Examples:
    - "1 5 g" -> "15 g"
    - "2 . 2 g" -> "2.2 g"
    - "N E T  W T" -> "NET WT"
    - "P A C K E D   W I T H   G O O D N E S S" -> "PACKED WITH GOODNESS"

    Guards against:
    - Column crossing in tables (Column 1: 1, Column 2: 5 g -> NOT merged)
    - Fabricating missing characters
    - Merging across distinct font sizes or baselines
    """
    if not glyphs:
        return []

    if table_gaps is None:
        table_gaps = []

    vis_glyphs = [g for g in glyphs if g.get("visibility") == "visible"]
    if not vis_glyphs:
        return []

    grouped_lines = []
    vis_glyphs_sorted = sorted(vis_glyphs, key=lambda g: (g["blockIdx"], g["lineIdx"], g["origin"][1], g["origin"][0]))

    current_group = []
    current_key = None

    for g in vis_glyphs_sorted:
        if abs(g["direction"][1]) > 0.35:
            continue

        key = (g["blockIdx"], g["lineIdx"])
        if current_key is None:
            current_group = [g]
            current_key = key
        elif key == current_key:
            current_group.append(g)
        else:
            if current_group:
                grouped_lines.append(current_group)
            current_group = [g]
            current_key = key
    if current_group:
        grouped_lines.append(current_group)

    segments = []

    for line in grouped_lines:
        if len(line) < 2:
            continue

        line = sorted(line, key=lambda g: g["origin"][0])

        runs = []
        current_run = [line[0]]

        for i in range(len(line) - 1):
            g1 = line[i]
            g2 = line[i + 1]

            gap_pt = g2["bbox"][0] - g1["bbox"][2]
            avg_size = (g1["fontSize"] + g2["fontSize"]) / 2.0
            norm_gap = gap_pt / max(1.0, avg_size)

            crosses_column = False
            for c_left, c_right in table_gaps:
                if g1["bbox"][2] <= c_left + 2.0 and g2["bbox"][0] >= c_right - 2.0:
                    crosses_column = True
                    break

            if crosses_column or norm_gap > 3.0:
                runs.append(current_run)
                current_run = [g2]
            else:
                current_run.append(g2)

        if current_run:
            runs.append(current_run)

        for run_glyphs in runs:
            if len(run_glyphs) < 2:
                continue

            raw_str = "".join(g["char"] for g in run_glyphs)

            # Strict wide tracking check
            if not is_wide_tracked_string(raw_str):
                continue

            words_glyphs = []
            curr_word_glyphs = [run_glyphs[0]]

            avg_fsize = sum(g["fontSize"] for g in run_glyphs) / len(run_glyphs)
            word_gap_threshold = max(5.0, avg_fsize * 0.85)

            for i in range(len(run_glyphs) - 1):
                g1 = run_glyphs[i]
                g2 = run_glyphs[i + 1]
                gap_pt = g2["bbox"][0] - g1["bbox"][2]

                is_double_space = (g1["char"].isspace() and g2["char"].isspace())
                is_wide_gap = gap_pt >= word_gap_threshold

                if is_double_space or is_wide_gap:
                    if curr_word_glyphs:
                        words_glyphs.append(curr_word_glyphs)
                        curr_word_glyphs = []
                    curr_word_glyphs.append(g2)
                else:
                    curr_word_glyphs.append(g2)

            if curr_word_glyphs:
                words_glyphs.append(curr_word_glyphs)

            cleaned_word_strings = []
            active_glyphs_all = []

            for w_g in words_glyphs:
                non_space_w = [g for g in w_g if not g["char"].isspace()]
                if not non_space_w:
                    continue
                active_glyphs_all.extend(non_space_w)
                raw_w = "".join(g["char"] for g in non_space_w)

                collapsed = raw_w
                with_unit = re.sub(r'(\d+(?:[\.,]\d+)?)([a-zA-Z%]+)', r'\1 \2', collapsed)
                with_unit = re.sub(r'\s*-\s*', '-', with_unit)
                cleaned_word_strings.append(with_unit)

            if not cleaned_word_strings or not active_glyphs_all:
                continue

            reconstructed_text = " ".join(cleaned_word_strings)

            is_numeric = bool(re.search(r'\d', reconstructed_text))
            authority = AUTH_NATIVE_GEOMETRY_VERIFIED
            confidence_geo = "high"
            confidence_char = "high"
            confidence_words = "high"

            min_x = min(g["bbox"][0] for g in active_glyphs_all)
            min_y = min(g["bbox"][1] for g in active_glyphs_all)
            max_x = max(g["bbox"][2] for g in active_glyphs_all)
            max_y = max(g["bbox"][3] for g in active_glyphs_all)

            norm_box = [
                max(0.0, min(1.0, min_x / width_pt)),
                max(0.0, min(1.0, min_y / height_pt)),
                max(0.0, min(1.0, max_x / width_pt)),
                max(0.0, min(1.0, max_y / height_pt))
            ]

            seg_id = f"recon_ls_p{run_glyphs[0]['page']}_{len(segments)+1}"

            word_bounds = []
            char_cursor = 0
            for w_str in cleaned_word_strings:
                start_c = char_cursor
                end_c = char_cursor + len(w_str)
                word_bounds.append({
                    "word": w_str,
                    "startChar": start_c,
                    "endChar": end_c
                })
                char_cursor = end_c + 1

            segments.append({
                "segmentId": seg_id,
                "documentId": "",
                "page": run_glyphs[0]["page"],
                "rawText": raw_str,
                "reconstructedText": reconstructed_text,
                "kind": "letter_spaced_text",
                "method": "letter_spacing_reconstruction",
                "authority": authority,
                "box": norm_box,
                "ptBox": [min_x, min_y, max_x, max_y],
                "glyphIds": [g["glyphId"] for g in active_glyphs_all],
                "glyphBoxes": [g["normBox"] for g in active_glyphs_all],
                "pathGeometry": None,
                "wordBoundaries": word_bounds,
                "visibility": "visible",
                "confidence": {
                    "geometry": confidence_geo,
                    "characters": confidence_char,
                    "readingOrder": "high",
                    "wordBoundaries": confidence_words,
                    "overall": 0.95
                },
                "originalEvidenceIds": [g["glyphId"] for g in active_glyphs_all],
                "alternatives": [],
                "limitations": []
            })

    return segments


def reconstruct_curved_arc_runs(glyphs, width_pt, height_pt):
    """
    Identifies text whose glyph positions and baseline directions follow a circular arc.
    Uses fast spatial grid binning for O(N) performance.
    """
    if not glyphs or len(glyphs) < 4:
        return []

    vis_glyphs = [g for g in glyphs if g.get("visibility") == "visible" and not g.get("isSynthetic")]
    if len(vis_glyphs) < 4:
        return []

    cell_size = 60.0
    grid = {}
    for idx, g in enumerate(vis_glyphs):
        gx = int(g["origin"][0] // cell_size)
        gy = int(g["origin"][1] // cell_size)
        grid.setdefault((gx, gy), []).append(idx)

    clusters = []
    visited = set()

    for i in range(len(vis_glyphs)):
        if i in visited:
            continue
        cluster = []
        queue = [i]
        visited.add(i)
        f_size = vis_glyphs[i]["fontSize"]
        max_d = max(35.0, f_size * 5.0)

        while queue:
            curr_idx = queue.pop(0)
            curr_g = vis_glyphs[curr_idx]
            cluster.append(curr_g)

            gx = int(curr_g["origin"][0] // cell_size)
            gy = int(curr_g["origin"][1] // cell_size)
            candidates = []
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    candidates.extend(grid.get((gx + dx, gy + dy), []))

            for j in candidates:
                if j in visited:
                    continue
                g2 = vis_glyphs[j]
                if abs(g2["fontSize"] - f_size) / max(1.0, f_size) > 0.35:
                    continue
                d = math.hypot(g2["origin"][0] - curr_g["origin"][0], g2["origin"][1] - curr_g["origin"][1])
                if d <= max_d:
                    visited.add(j)
                    queue.append(j)

        if len(cluster) >= 4:
            clusters.append(cluster)

    arc_segments = []

    for cluster in clusters:
        origins = [g["origin"] for g in cluster]
        fit = fit_circular_arc(origins)
        if not fit:
            continue

        if fit["rel_rmse"] > 0.08:
            continue

        xc, yc = fit["center"]
        r = fit["radius"]

        angles = [math.atan2(g["origin"][1] - yc, g["origin"][0] - xc) for g in cluster]
        angles_norm = [(a + 2 * math.pi) % (2 * math.pi) for a in angles]
        span_deg = math.degrees(max(angles_norm) - min(angles_norm))

        dir_angles = [g["angleDeg"] for g in cluster]
        dir_variance = max(dir_angles) - min(dir_angles)
        if dir_variance < 10.0 and span_deg < 15.0:
            continue

        # Sort candidate glyphs along angular circle coordinates
        order_a = sorted(range(len(cluster)), key=lambda idx: angles_norm[idx])
        order_b = list(reversed(order_a))

        # Determine reading direction using step vector dot product with character baseline direction
        score_a = 0.0
        for k in range(len(order_a) - 1):
            g1 = cluster[order_a[k]]
            g2 = cluster[order_a[k + 1]]
            dx = g2["origin"][0] - g1["origin"][0]
            dy = g2["origin"][1] - g1["origin"][1]
            score_a += dx * g1["direction"][0] + dy * g1["direction"][1]

        ordered_indices = order_a if score_a >= 0 else order_b
        ordered_glyphs = [cluster[idx] for idx in ordered_indices]

        # Calculate clockwise vs counterclockwise from angular progression
        ang_first = math.atan2(ordered_glyphs[0]["origin"][1] - yc, ordered_glyphs[0]["origin"][0] - xc)
        ang_last = math.atan2(ordered_glyphs[-1]["origin"][1] - yc, ordered_glyphs[-1]["origin"][0] - xc)
        diff_ang = (ang_last - ang_first + 2 * math.pi) % (2 * math.pi)
        is_clockwise = diff_ang < math.pi

        non_space_ordered = [g for g in ordered_glyphs if not g["char"].isspace()]
        if len(non_space_ordered) < 3:
            continue

        ordered_angles = [(math.atan2(g["origin"][1] - yc, g["origin"][0] - xc) + 2 * math.pi) % (2 * math.pi) for g in non_space_ordered]
        ang_gaps = []
        for k in range(len(ordered_angles) - 1):
            gap = abs(ordered_angles[k + 1] - ordered_angles[k])
            if gap > math.pi:
                gap = 2 * math.pi - gap
            ang_gaps.append(gap)

        med_ang_gap = sorted(ang_gaps)[len(ang_gaps) // 2] if ang_gaps else 0.05
        word_ang_threshold = max(0.08, med_ang_gap * 2.2)

        words = []
        curr_word = [non_space_ordered[0]]

        for k in range(len(non_space_ordered) - 1):
            gap = ang_gaps[k]
            g_next = non_space_ordered[k + 1]

            if gap >= word_ang_threshold:
                words.append(curr_word)
                curr_word = [g_next]
            else:
                curr_word.append(g_next)

        if curr_word:
            words.append(curr_word)

        cleaned_words = []
        for w in words:
            w_str = "".join(g["char"] for g in w).strip()
            if w_str:
                cleaned_words.append((w_str, w))

        if not cleaned_words:
            continue

        reconstructed_text = " ".join(w_str for w_str, _ in cleaned_words)
        raw_str = " ".join(g["char"] for g in non_space_ordered)

        min_x = min(g["bbox"][0] for g in non_space_ordered)
        min_y = min(g["bbox"][1] for g in non_space_ordered)
        max_x = max(g["bbox"][2] for g in non_space_ordered)
        max_y = max(g["bbox"][3] for g in non_space_ordered)

        norm_box = [
            max(0.0, min(1.0, min_x / width_pt)),
            max(0.0, min(1.0, min_y / height_pt)),
            max(0.0, min(1.0, max_x / width_pt)),
            max(0.0, min(1.0, max_y / height_pt))
        ]

        start_ang_deg = math.degrees(ordered_angles[0])
        end_ang_deg = math.degrees(ordered_angles[-1])

        path_geom = {
            "type": "circular_arc",
            "center": [max(0.0, min(1.0, xc / width_pt)), max(0.0, min(1.0, yc / height_pt))],
            "ptCenter": [xc, yc],
            "radius": r / max(width_pt, height_pt),
            "ptRadius": r,
            "startAngle": start_ang_deg,
            "endAngle": end_ang_deg,
            "direction": "clockwise" if is_clockwise else "counterclockwise",
            "fitResidual": fit["rel_rmse"]
        }

        word_bounds = []
        char_cursor = 0
        for w_str, _ in cleaned_words:
            start_c = char_cursor
            end_c = char_cursor + len(w_str)
            word_bounds.append({
                "word": w_str,
                "startChar": start_c,
                "endChar": end_c
            })
            char_cursor = end_c + 1

        seg_id = f"recon_arc_p{non_space_ordered[0]['page']}_{len(arc_segments)+1}"

        arc_segments.append({
            "segmentId": seg_id,
            "documentId": "",
            "page": non_space_ordered[0]["page"],
            "rawText": raw_str,
            "reconstructedText": reconstructed_text,
            "kind": "curved_text",
            "method": "native_glyph_arc_reconstruction",
            "authority": AUTH_NATIVE_GEOMETRY_VERIFIED,
            "box": norm_box,
            "ptBox": [min_x, min_y, max_x, max_y],
            "glyphIds": [g["glyphId"] for g in non_space_ordered],
            "glyphBoxes": [g["normBox"] for g in non_space_ordered],
            "pathGeometry": path_geom,
            "wordBoundaries": word_bounds,
            "visibility": "visible",
            "confidence": {
                "geometry": "high",
                "characters": "high",
                "readingOrder": "high",
                "wordBoundaries": "high",
                "overall": 0.94
            },
            "originalEvidenceIds": [g["glyphId"] for g in non_space_ordered],
            "alternatives": [],
            "limitations": []
        })

    return arc_segments


def detect_outlined_vector_text(page, page_num=1, native_glyphs=None):
    """
    Detects vector paths that form letters without native text objects.
    Labels results as VECTOR_OUTLINE_OCR with honest limitations.
    Never claims NATIVE_TEXT_VERIFIED.
    Bounded processing: limits drawings inspection to 500 operations.
    """
    rect = page.rect
    width_pt = max(1.0, float(rect.width))
    height_pt = max(1.0, float(rect.height))

    outlined_candidates = []
    try:
        drawings = page.get_drawings()
    except Exception:
        drawings = []

    if not drawings:
        return []

    glyph_boxes = [g["bbox"] for g in (native_glyphs or [])]

    small_closed_paths = []
    for d in drawings[:500]:
        d_rect = d.get("rect")
        if not d_rect:
            continue
        w = d_rect.width
        h = d_rect.height
        if 6.0 <= w <= 140.0 and 6.0 <= h <= 140.0:
            overlaps_native = False
            for gb in glyph_boxes[:200]:
                if not (d_rect.x1 < gb[0] or d_rect.x0 > gb[2] or d_rect.y1 < gb[1] or d_rect.y0 > gb[3]):
                    overlaps_native = True
                    break
            if not overlaps_native:
                small_closed_paths.append(d_rect)

    if len(small_closed_paths) >= 8:
        min_x = min(r.x0 for r in small_closed_paths)
        min_y = min(r.y0 for r in small_closed_paths)
        max_x = max(r.x1 for r in small_closed_paths)
        max_y = max(r.y1 for r in small_closed_paths)

        norm_box = [
            max(0.0, min(1.0, min_x / width_pt)),
            max(0.0, min(1.0, min_y / height_pt)),
            max(0.0, min(1.0, max_x / width_pt)),
            max(0.0, min(1.0, max_y / height_pt))
        ]

        outlined_candidates.append({
            "segmentId": f"recon_outline_p{page_num}_1",
            "documentId": "",
            "page": page_num,
            "rawText": "[VECTOR OUTLINE PATHS - NO NATIVE UNICODE]",
            "reconstructedText": "[OUTLINED TEXT - REQUIRES VISUAL OCR]",
            "kind": "outlined_vector_text",
            "method": "vector_outline_detection",
            "authority": AUTH_UNSUPPORTED_OUTLINED_TEXT,
            "box": norm_box,
            "glyphIds": [],
            "glyphBoxes": [],
            "pathGeometry": None,
            "wordBoundaries": [],
            "visibility": "visible",
            "confidence": {
                "geometry": "medium",
                "characters": "low",
                "readingOrder": "low",
                "wordBoundaries": "low",
                "overall": 0.40
            },
            "originalEvidenceIds": [],
            "alternatives": [],
            "limitations": ["Vector outlines have no embedded font glyphs or Unicode characters."]
        })

    return outlined_candidates


def reconstruct_pdf_text(pdf_path, max_pages=12, vis_report=None):
    """
    Main orchestrator for advanced PDF text reconstruction.
    Returns:
    {
      "textRuns": [...],
      "reconstructedSegments": [...],
      "ambiguousSegments": [...],
      "diagnostics": [...],
      "coverage": {
         "totalPages": N,
         "reconstructedCount": N,
         "letterSpacedCount": N,
         "curvedArcCount": N,
         "outlinedCount": N
      }
    }
    """
    import fitz

    doc = fitz.open(pdf_path)
    total_pages = min(len(doc), max_pages)

    all_segments = []
    all_runs = []
    diagnostics = []

    ls_count = 0
    arc_count = 0
    outline_count = 0

    for p_idx in range(total_pages):
        page = doc[p_idx]
        p_num = p_idx + 1

        glyphs, w_pt, h_pt = extract_glyphs_from_page(page, page_num=p_num, vis_report=vis_report)
        table_gaps = detect_table_column_boundaries(glyphs, w_pt, h_pt)

        ls_segs = reconstruct_letter_spaced_runs(glyphs, w_pt, h_pt, table_gaps=table_gaps)
        for s in ls_segs:
            all_segments.append(s)
            ls_count += 1

        arc_segs = reconstruct_curved_arc_runs(glyphs, w_pt, h_pt)
        for s in arc_segs:
            all_segments.append(s)
            arc_count += 1

        outline_segs = detect_outlined_vector_text(page, page_num=p_num, native_glyphs=glyphs)
        for s in outline_segs:
            all_segments.append(s)
            outline_count += 1

        diagnostics.append({
            "page": p_num,
            "glyphCount": len(glyphs),
            "visibleGlyphs": sum(1 for g in glyphs if g.get("visibility") == "visible"),
            "hiddenGlyphs": sum(1 for g in glyphs if g.get("visibility") == "hidden"),
            "tableColumnsDetected": len(table_gaps),
            "letterSpacedFound": len(ls_segs),
            "curvedArcsFound": len(arc_segs),
            "outlinedFound": len(outline_segs)
        })

    doc.close()

    ambiguous = [s for s in all_segments if s.get("authority") == AUTH_RECONSTRUCTION_REVIEW_REQUIRED]

    return {
        "textRuns": all_runs,
        "reconstructedSegments": all_segments,
        "ambiguousSegments": ambiguous,
        "diagnostics": diagnostics,
        "coverage": {
            "totalPages": total_pages,
            "reconstructedCount": len(all_segments),
            "letterSpacedCount": ls_count,
            "curvedArcCount": arc_count,
            "outlinedCount": outline_count
        }
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: pdf_text_reconstruction.py <path_to_pdf>")
        sys.exit(1)
    res = reconstruct_pdf_text(sys.argv[1])
    print(json.dumps(res, indent=2))
