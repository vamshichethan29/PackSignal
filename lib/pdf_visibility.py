#!/usr/bin/env python3
"""
PackSignal Native PDF Visibility & Occlusion Analyzer (lib/pdf_visibility.py)
Phase 1: Native PDF Vector Preflight & Paint-Order Occlusion Detection

Deterministic, offline preflight module that determines actual rendered text visibility by:
1. Extracting text spans and their exact painting sequence order (seqno).
2. Tracking all subsequent drawing operations (fills, paths, images, Form XObjects).
3. Analyzing geometric occlusion (complete vs partial enclosure).
4. Evaluating fill opacity (opaque >= 0.98 vs semitransparent) and fill color.
5. Detecting non-rendering modes (PDF text rendering mode 3, Tr 3).
6. Detecting zero-opacity / 100% transparent text (alpha == 0).
7. Inspecting Optional Content Groups (OCGs / PDF layers).
8. Normalizing coordinates to standard top-left [x0, y0, x1, y1] (0.0 to 1.0) format.
"""

import sys
import os
import json
import re
from pathlib import Path

# Common guide layer patterns (dielines, dimensions, production notes)
GUIDE_LAYERS_RE = re.compile(
    r'(?:dimension|dieline|cad|guide|cut|crease|fold|annotation|bleed|trim|technical|production|non[- ]?printing)',
    re.IGNORECASE
)

# Common guide text patterns that appear on packaging sheets outside consumer artwork
GUIDE_TEXT_PATTERNS = [
    re.compile(r'\bart\s*orientation\b', re.IGNORECASE),
    re.compile(r'\bcopy\s*free\b', re.IGNORECASE),
    re.compile(r'\bgl\d+\b', re.IGNORECASE),
    re.compile(r'\bprincipal\s*display\s*panel\b', re.IGNORECASE),
    re.compile(r'\b(?:front|back|left|right|top|bottom)\s*panel\b', re.IGNORECASE),
    re.compile(r'\bglue\s*flap\b', re.IGNORECASE),
    re.compile(r'\bcrease\s*line\b', re.IGNORECASE),
    re.compile(r'\bcut\s*line\b', re.IGNORECASE),
    re.compile(r'\bdo\s*not\s*print\b', re.IGNORECASE),
    re.compile(r'\bsafety\s*margin\b', re.IGNORECASE),
]

# Supported Visibility States
STATE_VISIBLE = "visible"
STATE_CONFIRMED_HIDDEN = "confirmed_hidden"
STATE_PARTIALLY_HIDDEN = "partially_hidden"
STATE_INVISIBLE_RENDER_MODE = "invisible_render_mode"
STATE_INVISIBLE_OPACITY = "invisible_opacity"
STATE_INACTIVE_OCG = "inactive_optional_content"
STATE_VISIBILITY_UNCERTAIN = "visibility_uncertain"
STATE_PRODUCTION_GUIDE = "production_guide"
STATE_UNSUPPORTED = "unsupported"


def _rect_intersects(r1, r2):
    """Check if two bounding boxes [x0, y0, x1, y1] intersect."""
    if not r1 or not r2 or len(r1) != 4 or len(r2) != 4 or None in r1 or None in r2:
        return False
    return not (r1[2] < r2[0] or r1[0] > r2[2] or r1[3] < r2[1] or r1[1] > r2[3])


def _intersection_area(r1, r2):
    """Compute 2D intersection area of two bounding boxes [x0, y0, x1, y1]."""
    if not r1 or not r2 or len(r1) != 4 or len(r2) != 4 or None in r1 or None in r2:
        return 0.0
    ix0 = max(r1[0], r2[0])
    iy0 = max(r1[1], r2[1])
    ix1 = min(r1[2], r2[2])
    iy1 = min(r1[3], r2[3])
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    return (ix1 - ix0) * (iy1 - iy0)


def _format_color_name(fill):
    """Format fill color tuple into friendly description."""
    if fill is None:
        return "none"
    if isinstance(fill, (list, tuple)):
        if len(fill) == 3:
            r, g, b = fill
            if r > 0.96 and g > 0.96 and b > 0.96:
                return "white"
            if r < 0.05 and g < 0.05 and b < 0.05:
                return "black"
            return f"rgb({round(r*255)}, {round(g*255)}, {round(b*255)})"
        elif len(fill) == 4:
            c, m, y, k = fill
            if c < 0.02 and m < 0.02 and y < 0.02 and k < 0.02:
                return "white"
            return f"cmyk({round(c*100)}%, {round(m*100)}%, {round(y*100)}%, {round(k*100)}%)"
        elif len(fill) == 1:
            val = fill[0]
            if val > 0.96:
                return "white"
            if val < 0.05:
                return "black"
            return f"gray({round(val*100)}%)"
    return str(fill)


def analyze_page_visibility(page, page_num=1, max_objects=5000):
    """
    Analyzes native PDF visibility for a single page.
    Returns:
    - spans: list of structured text visibility entries
    - summary: counts of visible, hidden, partial, and guide spans
    - occluders: list of detected occluding vector shapes
    """
    rect = page.rect
    width_pt = max(1.0, float(rect.width))
    height_pt = max(1.0, float(rect.height))

    # 1. Collect vector drawing operations with sequence numbers
    try:
        drawings = page.get_drawings()
    except Exception:
        drawings = []

    draw_by_seq = {}
    for d in drawings[:max_objects]:
        seqno = d.get('seqno')
        if seqno is not None:
            draw_by_seq[seqno] = d

    # 2. Extract bounding-box event log (tracks order of text vs path vs image)
    try:
        bboxlog = page.get_bboxlog()
    except Exception:
        bboxlog = []

    # 3. Extract text spans from texttrace or dict
    trace = []
    try:
        trace = page.get_texttrace()
    except Exception:
        pass

    # Inspect Optional Content Groups (OCGs) to detect inactive layers
    inactive_ocg_names = set()
    try:
        doc = page.parent
        ocgs = doc.get_ocgs()
        for ocg_id, ocg_info in ocgs.items():
            if not ocg_info.get('on', True):
                name = ocg_info.get('name', '')
                if name:
                    inactive_ocg_names.add(name.strip().lower())
    except Exception:
        pass

    # Build text span candidates
    raw_spans = []
    if trace:
        for idx, s in enumerate(trace[:max_objects]):
            raw_chars = s.get('chars', [])
            txt = ''.join(chr(u) for u, gid, o, b in raw_chars if u > 0).strip()
            if not txt:
                continue

            boxes = [b for u, gid, o, b in raw_chars if len(b) == 4 and b[2] > b[0] and b[3] > b[1]]
            if not boxes:
                continue

            x0 = min(b[0] for b in boxes)
            y0 = min(b[1] for b in boxes)
            x1 = max(b[2] for b in boxes)
            y1 = max(b[3] for b in boxes)

            raw_spans.append({
                'spanId': f"p{page_num}_s{idx}",
                'text': txt,
                'seqno': s.get('seqno', idx),
                'font': s.get('font', ''),
                'size': float(s.get('size', 0.0)),
                'renderingType': int(s.get('type', 0)),
                'opacity': float(s.get('opacity', 1.0)),
                'layer': s.get('layer') or '',
                'boxPt': [x0, y0, x1, y1],
                'glyphBoxes': boxes
            })
    else:
        # Fallback to page.get_text('words') or 'blocks' if texttrace unavailable
        try:
            words = page.get_text('words')
            for idx, w in enumerate(words[:max_objects]):
                x0, y0, x1, y1, word_text = w[:5]
                raw_spans.append({
                    'spanId': f"p{page_num}_w{idx}",
                    'text': word_text,
                    'seqno': idx,
                    'font': 'Unknown',
                    'size': round(y1 - y0, 1),
                    'renderingType': 0,
                    'opacity': 1.0,
                    'layer': '',
                    'boxPt': [x0, y0, x1, y1],
                    'glyphBoxes': [[x0, y0, x1, y1]]
                })
        except Exception:
            pass

    # 4. Analyze each text span against paint order and later drawing operations
    spans_output = []
    detected_occluders = []

    for span in raw_spans:
        txt = span['text']
        seqno = span['seqno']
        rendering_type = span['renderingType']
        opacity = span['opacity']
        layer = span['layer']
        bx0, by0, bx1, by1 = span['boxPt']
        span_w = max(1e-4, bx1 - bx0)
        span_h = max(1e-4, by1 - by0)
        span_area = span_w * span_h

        # Compute normalized bounding box (0.0 to 1.0)
        norm_box = [
            round(max(0.0, min(1.0, bx0 / width_pt)), 5),
            round(max(0.0, min(1.0, by0 / height_pt)), 5),
            round(max(0.0, min(1.0, bx1 / width_pt)), 5),
            round(max(0.0, min(1.0, by1 / height_pt)), 5)
        ]

        # Check Inactive Optional Content Group (OCG)
        is_inactive_ocg = False
        if layer and layer.strip().lower() in inactive_ocg_names:
            is_inactive_ocg = True

        # Check guide/dieline classification
        is_guide_layer = bool(GUIDE_LAYERS_RE.search(layer))
        is_guide_text = any(p.search(txt) for p in GUIDE_TEXT_PATTERNS)

        # Check rendering mode 3 (Tr 3 invisible text)
        is_invisible_render_mode = (rendering_type == 3)

        # Check zero text opacity (fully transparent)
        is_zero_opacity = (opacity <= 0.001)

        # Occlusion search: look for drawing operations painted AFTER this text span
        is_covered = False
        is_partially_covered = False
        is_uncertain = False
        covering_op = None
        max_coverage_ratio = 0.0
        occluder_info = None

        if not (is_invisible_render_mode or is_zero_opacity or is_inactive_ocg):
            # Check later drawing operations in bboxlog or drawings
            # A drawing op painted at later_seq > seqno can occlude text
            for later_seq in range(seqno + 1, len(bboxlog)):
                op_type, op_rect = bboxlog[later_seq][:2]
                r = [op_rect[0], op_rect[1], op_rect[2], op_rect[3]]

                # Only filled paths and filled raster images can physically occlude underlying text.
                # Text glyphs (fill-text, stroke-text) and stroked outlines without fill do NOT occlude text.
                if op_type not in ('fill-path', 'fill-image'):
                    continue

                # Ignore non-overlapping operations
                if not _rect_intersects(span['boxPt'], r):
                    continue

                # Fetch associated drawing metadata if available
                draw_meta = draw_by_seq.get(later_seq)

                # For vector paths, verify an actual fill exists (not an unpainted clipping/stroke boundary)
                if op_type == 'fill-path':
                    if not draw_meta or draw_meta.get('fill') is None:
                        continue

                # Determine fill color and opacity
                fill_color = draw_meta.get('fill') if draw_meta else None
                fill_opacity = draw_meta.get('fill_opacity', 1.0) if draw_meta else 1.0
                if fill_opacity is None:
                    fill_opacity = 1.0

                # If fill_opacity is distinctly semitransparent (e.g. 0.05 to 0.95), text is partially tinted/uncertain
                if fill_opacity < 0.95:
                    inter_a = _intersection_area(span['boxPt'], r)
                    if inter_a / span_area > 0.40:
                        is_uncertain = True
                    continue

                # Calculate coverage ratio
                inter_area = _intersection_area(span['boxPt'], r)
                cov_ratio = inter_area / span_area

                if cov_ratio > max_coverage_ratio:
                    max_coverage_ratio = cov_ratio
                    covering_op = later_seq

                    # Format occluder normalized coordinates
                    occluder_norm = [
                        round(max(0.0, min(1.0, r[0] / width_pt)), 5),
                        round(max(0.0, min(1.0, r[1] / height_pt)), 5),
                        round(max(0.0, min(1.0, r[2] / width_pt)), 5),
                        round(max(0.0, min(1.0, r[3] / height_pt)), 5)
                    ]

                    occluder_info = {
                        'seqno': later_seq,
                        'type': op_type,
                        'fill': _format_color_name(fill_color),
                        'fillRaw': fill_color,
                        'opacity': round(fill_opacity, 3),
                        'box': occluder_norm,
                        'boxPt': [round(c, 2) for c in r],
                        'layer': draw_meta.get('layer', '') if draw_meta else ''
                    }

                # If >= 85% covered by an opaque fill, text is confirmed hidden
                if cov_ratio >= 0.85:
                    is_covered = True
                    break
                elif cov_ratio >= 0.20:
                    is_partially_covered = True

        # Determine final state & kind
        if is_invisible_render_mode:
            state = STATE_INVISIBLE_RENDER_MODE
            reason = "text_render_mode_3_invisible"
            kind = "hidden"
            confidence = "high"
        elif is_zero_opacity:
            state = STATE_INVISIBLE_OPACITY
            reason = "zero_opacity_transparent_text"
            kind = "hidden"
            confidence = "high"
        elif is_inactive_ocg:
            state = STATE_INACTIVE_OCG
            reason = "inactive_optional_content_group"
            kind = "hidden"
            confidence = "high"
        elif is_covered:
            state = STATE_CONFIRMED_HIDDEN
            reason = "opaque_later_painted_shape"
            kind = "hidden"
            confidence = "high"
        elif is_partially_covered:
            state = STATE_PARTIALLY_HIDDEN
            reason = "partial_occlusion_later_shape"
            kind = "partially_hidden"
            confidence = "moderate"
        elif is_uncertain:
            state = STATE_VISIBILITY_UNCERTAIN
            reason = "semitransparent_graphic_overlay"
            kind = "uncertain"
            confidence = "low"
        elif is_guide_layer or is_guide_text:
            state = STATE_PRODUCTION_GUIDE
            reason = "dieline_cad_guide_annotation"
            kind = "guide"
            confidence = "high"
        else:
            state = STATE_VISIBLE
            reason = "unobstructed_consumer_facing_artwork"
            kind = "visible"
            confidence = "high"

        entry = {
            'textId': span['spanId'],
            'page': page_num,
            'text': txt,
            'kind': kind,
            'box': norm_box,
            'boxPt': [round(c, 2) for c in span['boxPt']],
            'font': span['font'],
            'fontSizePt': round(span['size'], 2),
            'visibility': {
                'state': state,
                'reason': reason,
                'paintSequence': seqno,
                'coveringSequence': covering_op,
                'coveredRatio': round(max_coverage_ratio, 4),
                'method': 'native_pdf_paint_order',
                'confidence': confidence,
                'limitations': []
            }
        }

        if occluder_info:
            entry['occluder'] = occluder_info
            if occluder_info not in detected_occluders:
                detected_occluders.append(occluder_info)

        spans_output.append(entry)

    summary = {
        'totalSpans': len(spans_output),
        'visible': sum(1 for s in spans_output if s['kind'] == 'visible'),
        'hidden': sum(1 for s in spans_output if s['kind'] == 'hidden'),
        'partiallyHidden': sum(1 for s in spans_output if s['kind'] == 'partially_hidden'),
        'uncertain': sum(1 for s in spans_output if s['kind'] == 'uncertain'),
        'guides': sum(1 for s in spans_output if s['kind'] == 'guide')
    }

    return {
        'pageNumber': page_num,
        'widthPt': round(width_pt, 2),
        'heightPt': round(height_pt, 2),
        'spans': spans_output,
        'summary': summary,
        'occluders': detected_occluders
    }


def analyze_pdf_visibility(pdf_path, max_pages=12):
    """
    Main entry point: analyzes native PDF paint-order visibility across document pages.
    """
    import fitz
    pdf_p = Path(pdf_path)
    if not pdf_p.exists():
        raise FileNotFoundError(f"PDF document not found: {pdf_path}")

    doc = fitz.open(str(pdf_p))
    page_results = []
    total_hidden = 0
    total_visible = 0
    total_partial = 0

    num_pages = min(len(doc), max_pages)
    for n in range(num_pages):
        page = doc[n]
        res = analyze_page_visibility(page, page_num=n + 1)
        page_results.append(res)
        total_hidden += res['summary']['hidden']
        total_visible += res['summary']['visible']
        total_partial += res['summary']['partiallyHidden']

    doc.close()

    return {
        'pdfPath': str(pdf_path),
        'totalPages': len(page_results),
        'pages': page_results,
        'summary': {
            'totalSpans': sum(p['summary']['totalSpans'] for p in page_results),
            'confirmedVisible': total_visible,
            'confirmedHidden': total_hidden,
            'partiallyHidden': total_partial,
        },
        'method': 'native_pdf_paint_order',
        'disclaimer': 'PDF visibility preflight inspects painting order, opaque path fills, rendering modes, and layer states. Visual inspection is required for flattened raster composites.'
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python3 lib/pdf_visibility.py <artwork.pdf>'}))
        sys.exit(1)

    try:
        report = analyze_pdf_visibility(sys.argv[1])
        print(json.dumps(report, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
