#!/usr/bin/env python3
"""
PackSignal PDF Visible-Text Intelligence (lib/pdf-visible-text.py)
Implements Phase 15, 16, 17:
- Distinguishes visible printed packaging artwork from hidden PDF content
- Detects non-printing guide layers, CAD dimensions, and dieline annotations
- Computes drawing sequence occlusions (text covered by later opaque objects)
- Classifies spans: VISIBLE, HIDDEN, GUIDE_OR_DIELINE, POTENTIALLY_OCCLUDED, UNKNOWN_VISIBILITY
"""

import sys
import json
import re
from pathlib import Path

GUIDE_LAYERS_RE = re.compile(
    r'(?:dimension|dieline|cad|guide|cut|crease|fold|annotation|bleed|trim|technical|production|non[- ]?printing)',
    re.IGNORECASE
)

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

def analyze_pdf_visibility(pdf_path):
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    page_results = []

    for page_idx, page in enumerate(doc):
        rect = page.rect
        width_pt, height_pt = rect.width, rect.height

        # 1. Collect opaque drawings and fills to determine drawing sequence
        drawings = page.get_drawings()
        opaque_fills = []
        for d in drawings:
            fill = d.get('fill')
            if fill is None:
                continue
            fill_opacity = d.get('fill_opacity')
            if fill_opacity is not None and fill_opacity < 0.99:
                continue
            layer = d.get('layer') or ''
            if GUIDE_LAYERS_RE.search(layer):
                continue
            d_rect = d.get('rect')
            if d_rect:
                opaque_fills.append({
                    'seqno': d.get('seqno', 0),
                    'rect': [d_rect.x0, d_rect.y0, d_rect.x1, d_rect.y1],
                    'fill': fill
                })

        # 2. Extract text spans from texttrace
        trace = page.get_texttrace()
        spans = []

        for s in trace:
            raw_chars = s.get('chars', [])
            txt = ''.join(chr(u) for u, gid, o, b in raw_chars if u > 0).strip()
            if not txt:
                continue

            font_name = s.get('font', '')
            font_size = float(s.get('size', 0.0))
            layer = s.get('layer') or ''
            seqno = s.get('seqno', 0)
            rendering_type = s.get('type', 0)  # 3 = invisible text
            opacity = s.get('opacity', 1.0)

            boxes = [b for u, gid, o, b in raw_chars]
            if not boxes:
                continue
            x0 = min(b[0] for b in boxes)
            y0 = min(b[1] for b in boxes)
            x1 = max(b[2] for b in boxes)
            y1 = max(b[3] for b in boxes)
            glyph_h = y1 - y0

            norm_box = [
                round(max(0.0, min(1.0, x0 / width_pt)), 5),
                round(max(0.0, min(1.0, y0 / height_pt)), 5),
                round(max(0.0, min(1.0, x1 / width_pt)), 5),
                round(max(0.0, min(1.0, y1 / height_pt)), 5)
            ]

            # Occlusion check: Is there an opaque fill drawn AFTER this span that covers it?
            is_occluded = False
            is_invisible_mode = (rendering_type == 3 or opacity == 0.0)

            if not is_invisible_mode:
                cx = (x0 + x1) / 2.0
                cy = (y0 + y1) / 2.0
                for fill_obj in opaque_fills:
                    if fill_obj['seqno'] > seqno:
                        fx0, fy0, fx1, fy1 = fill_obj['rect']
                        if fx0 <= cx <= fx1 and fy0 <= cy <= fy1:
                            is_occluded = True
                            break

            # Classification
            is_guide_layer = bool(GUIDE_LAYERS_RE.search(layer))
            is_guide_text = any(p.search(txt) for p in GUIDE_TEXT_PATTERNS)

            if is_invisible_mode:
                classification = 'HIDDEN'
            elif is_guide_layer or is_guide_text:
                classification = 'GUIDE_OR_DIELINE'
            elif is_occluded:
                classification = 'POTENTIALLY_OCCLUDED'
            elif opacity < 0.2:
                classification = 'UNKNOWN_VISIBILITY'
            else:
                classification = 'VISIBLE'

            spans.append({
                'text': txt,
                'font': font_name,
                'fontSizePt': round(font_size, 2),
                'glyphHeightPt': round(glyph_h, 2),
                'boxPt': [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                'boxNorm': norm_box,
                'layer': layer,
                'renderingType': rendering_type,
                'opacity': opacity,
                'classification': classification,
                'isConsumerFacing': classification == 'VISIBLE'
            })

        counts = {
            'VISIBLE': sum(1 for s in spans if s['classification'] == 'VISIBLE'),
            'HIDDEN': sum(1 for s in spans if s['classification'] == 'HIDDEN'),
            'GUIDE_OR_DIELINE': sum(1 for s in spans if s['classification'] == 'GUIDE_OR_DIELINE'),
            'POTENTIALLY_OCCLUDED': sum(1 for s in spans if s['classification'] == 'POTENTIALLY_OCCLUDED'),
            'UNKNOWN_VISIBILITY': sum(1 for s in spans if s['classification'] == 'UNKNOWN_VISIBILITY')
        }

        page_results.append({
            'pageNumber': page_idx + 1,
            'widthPt': round(width_pt, 2),
            'heightPt': round(height_pt, 2),
            'spans': spans,
            'summary': counts
        })

    return {
        'pages': page_results,
        'pdfPath': str(pdf_path),
        'totalSpans': sum(len(p['spans']) for p in page_results),
        'disclaimer': 'PDF visible-text classification analyzes drawing sequence, opacity, rendering modes, and dieline layer properties. Complex nesting or raster flattening requires visual verification.'
    }

if __name__ == '__main__':
    try:
        if len(sys.argv) > 1 and sys.argv[1] != '--json':
            pdf_path = sys.argv[1]
        elif not sys.stdin.isatty():
            raw_in = sys.stdin.read().strip()
            if raw_in:
                args = json.loads(raw_in)
                pdf_path = args.get('path')
            else:
                raise ValueError('Empty stdin received.')
        else:
            raise ValueError('Expected PDF path via argv or stdin JSON.')

        result = analyze_pdf_visibility(pdf_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
