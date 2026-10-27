#!/usr/bin/env python3
"""
PackSignal PDF Structure Analyzer.
Performs native PDF text span extraction, drawing sequence occlusion analysis,
dieline guide layer classification, and font measurement.

Deterministic and offline.
"""
import sys
import json
import re
from pathlib import Path

GUIDE_LAYERS_RE = re.compile(r'(?:dimension|dieline|cad|guide|cut|crease|fold|annotation|bleed)', re.IGNORECASE)
GUIDE_TEXT_PATTERNS = [
    re.compile(r'\bart\s*orientation\b', re.IGNORECASE),
    re.compile(r'\bcopy\s*free\b', re.IGNORECASE),
    re.compile(r'\bgl\d+\b', re.IGNORECASE),
    re.compile(r'\bprincipal\s*display\s*panel\b', re.IGNORECASE),
    re.compile(r'\b(?:front|back|left|right|top|bottom)\s*panel\b', re.IGNORECASE),
    re.compile(r'\bglue\s*flap\b', re.IGNORECASE),
    re.compile(r'\bcrease\s*line\b', re.IGNORECASE),
]

def analyze_pdf_structure(pdf_path):
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    page_results = []

    for page_idx, page in enumerate(doc):
        rect = page.rect
        width_pt, height_pt = rect.width, rect.height

        # 1. Collect opaque vector drawings and bounding boxes
        drawings = page.get_drawings()
        opaque_fills = []
        for d in drawings:
            # Check if this drawing has a fill
            fill = d.get('fill')
            if fill is None:
                continue
            fill_opacity = d.get('fill_opacity')
            if fill_opacity is not None and fill_opacity < 0.99:
                continue
            # Non-guide layer
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

            # Normalized bounding box (0.0 to 1.0)
            norm_box = [
                round(max(0.0, min(1.0, x0 / width_pt)), 5),
                round(max(0.0, min(1.0, y0 / height_pt)), 5),
                round(max(0.0, min(1.0, x1 / width_pt)), 5),
                round(max(0.0, min(1.0, y1 / height_pt)), 5)
            ]

            # Check occlusion: Is there an opaque fill drawn AFTER this span that covers it?
            is_occluded = False
            occluding_drawings = []
            if rendering_type == 3 or opacity == 0:
                is_occluded = True
            else:
                for fill_obj in opaque_fills:
                    if fill_obj['seqno'] > seqno:
                        fx0, fy0, fx1, fy1 = fill_obj['rect']
                        # Check if fill covers the span center or bbox
                        cx = (x0 + x1) / 2.0
                        cy = (y0 + y1) / 2.0
                        if fx0 <= cx <= fx1 and fy0 <= cy <= fy1:
                            is_occluded = True
                            occluding_drawings.append(fill_obj['seqno'])
                            break

            # Classify content role
            is_guide_layer = bool(GUIDE_LAYERS_RE.search(layer))
            is_guide_text = any(p.search(txt) for p in GUIDE_TEXT_PATTERNS)

            if is_guide_layer or is_guide_text:
                classification = 'PRODUCTION_GUIDE'
            elif is_occluded:
                classification = 'POTENTIALLY_OCCLUDED'
            else:
                classification = 'CONSUMER_COPY'

            spans.append({
                'text': txt,
                'font': font_name,
                'fontSizePt': round(font_size, 2),
                'glyphHeightPt': round(glyph_h, 2),
                'boxPt': [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                'boxNorm': norm_box,
                'layer': layer,
                'seqno': seqno,
                'renderingType': rendering_type,
                'opacity': opacity,
                'isOccluded': is_occluded,
                'occludingDrawings': occluding_drawings,
                'classification': classification
            })

        page_results.append({
            'pageNumber': page_idx + 1,
            'widthPt': round(width_pt, 2),
            'heightPt': round(height_pt, 2),
            'spans': spans,
            'summary': {
                'totalSpans': len(spans),
                'consumerCopyCount': sum(1 for s in spans if s['classification'] == 'CONSUMER_COPY'),
                'guideTextCount': sum(1 for s in spans if s['classification'] == 'PRODUCTION_GUIDE'),
                'occludedCount': sum(1 for s in spans if s['classification'] == 'POTENTIALLY_OCCLUDED')
            }
        })

    return {
        'pages': page_results,
        'pdfPath': str(pdf_path)
    }

if __name__ == '__main__':
    try:
        if len(sys.argv) > 1:
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

        result = analyze_pdf_structure(pdf_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
