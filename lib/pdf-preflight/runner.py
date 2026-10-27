#!/usr/bin/env python3
"""
PackSignal Master PDF Preflight Screening Engine (lib/pdf-preflight/runner.py)
Orchestrates the four prepress screening capabilities:
- PVP-001: Rendered Text Visibility
- PVP-002: Hidden / Overlapping Text
- PVP-003: Estimated Text Height
- PVP-004: Dieline / Trim Clearance
"""

import sys
import json
import hashlib
from pathlib import Path

# Add current directory to path
curr_dir = Path(__file__).resolve().parent
if str(curr_dir) not in sys.path:
    sys.path.insert(0, str(curr_dir))

from models import (
    CHECK_PVP_001,
    CHECK_PVP_002,
    CHECK_PVP_003,
    CHECK_PVP_004,
    BOUNDARY_CUT,
    BOUNDARY_CREASE,
    BOUNDARY_UNCLASSIFIED,
    DISCLAIMER_TEXT,
)
from coordinates import pdf_to_normalized
from geometry import classify_line_semantics
from visibility import screen_text_visibility
from overlap import (
    screen_drawing_occlusions,
    screen_text_collisions,
    screen_guide_layers,
    screen_clipped_text,
)
from typography import screen_text_height
from clearance import screen_trim_and_dieline_clearance


def detect_parser_capabilities(force_parser=None):
    """Detect available PDF parser engine and licensing details."""
    if force_parser != "pdfium":
        try:
            import fitz
            return {
                "parser": "PyMuPDF (fitz)",
                "version": getattr(fitz, "__version__", "unknown"),
                "licenseNotice": "PyMuPDF AGPL / Commercial license. Full drawing-order and texttrace enabled.",
                "capabilities": {
                    "texttrace": True,
                    "drawings": True,
                    "drawingSequence": True,
                    "renderMode": True,
                    "opacity": True,
                    "trimbox": True,
                    "optionalContentGroups": True,
                }
            }
        except ImportError:
            pass

    try:
        import pypdfium2
        return {
            "parser": "pypdfium2",
            "version": getattr(pypdfium2, "__version__", "unknown"),
            "licenseNotice": "Apache 2.0 / BSD 3-Clause license.",
            "capabilities": {
                "texttrace": False,
                "drawings": False,
                "drawingSequence": False,
                "renderMode": False,
                "opacity": False,
                "trimbox": False,
                "optionalContentGroups": False,
            }
        }
    except ImportError:
        return {
            "parser": "none",
            "version": "none",
            "licenseNotice": "No supported PDF engine installed.",
            "capabilities": {}
        }


def extract_with_pymupdf(pdf_path):
    """Extracts rich drawing order, texttrace, and vector geometry via PyMuPDF."""
    import fitz
    doc = fitz.open(pdf_path)
    pages_data = []

    for page_idx, page in enumerate(doc):
        rect = page.rect
        width_pt, height_pt = rect.width, rect.height

        # 1. Page Boxes
        mediabox = [page.mediabox.x0, page.mediabox.y0, page.mediabox.x1, page.mediabox.y1]
        cropbox = [page.cropbox.x0, page.cropbox.y0, page.cropbox.x1, page.cropbox.y1]
        
        # TrimBox check: Only treat as trusted TrimBox if explicitly distinct from MediaBox
        trimbox = None
        if hasattr(page, "trimbox") and page.trimbox:
            tb = [page.trimbox.x0, page.trimbox.y0, page.trimbox.x1, page.trimbox.y1]
            # If trimbox is strictly inside mediabox, it is an explicit production TrimBox
            if tb != mediabox and (tb[2] - tb[0] < mediabox[2] - mediabox[0] or tb[3] - tb[1] < mediabox[3] - mediabox[1]):
                trimbox = tb

        # 2. Extract Drawings and Vector Lines
        raw_drawings = page.get_drawings()
        drawings = []
        dieline_segments = []

        for d in raw_drawings:
            d_rect = d.get("rect")
            fill = d.get("fill")
            fill_opacity = d.get("fill_opacity", 1.0)
            seqno = d.get("seqno", 0)
            layer = d.get("layer") or ""
            stroke = d.get("color")

            if fill is not None:
                drawings.append({
                    "seqno": seqno,
                    "rect": [d_rect.x0, d_rect.y0, d_rect.x1, d_rect.y1] if d_rect else None,
                    "fill": fill,
                    "fill_opacity": fill_opacity,
                    "layer": layer
                })

            # Check if drawing contains dieline / structural lines
            line_kind = classify_line_semantics(layer_name=layer, stroke_color=str(stroke) if stroke else None)
            if line_kind != BOUNDARY_UNCLASSIFIED:
                for item in d.get("items", []):
                    if item[0] == "l":  # line: ("l", p1, p2)
                        p1, p2 = item[1], item[2]
                        dieline_segments.append({
                            "p1": [round(p1.x, 2), round(p1.y, 2)],
                            "p2": [round(p2.x, 2), round(p2.y, 2)],
                            "type": line_kind,
                            "source": f"PDF layer: {layer or 'vector stroke'}"
                        })

        # If TrimBox is confirmed, add its 4 edges as trusted cut lines
        if trimbox:
            tx0, ty0, tx1, ty1 = trimbox
            dieline_segments.extend([
                {"p1": [tx0, ty0], "p2": [tx1, ty0], "type": BOUNDARY_CUT, "source": "PDF TrimBox top"},
                {"p1": [tx1, ty0], "p2": [tx1, ty1], "type": BOUNDARY_CUT, "source": "PDF TrimBox right"},
                {"p1": [tx1, ty1], "p2": [tx0, ty1], "type": BOUNDARY_CUT, "source": "PDF TrimBox bottom"},
                {"p1": [tx0, ty1], "p2": [tx0, ty0], "type": BOUNDARY_CUT, "source": "PDF TrimBox left"},
            ])

        # 3. Extract Text Spans from TextTrace
        trace = page.get_texttrace()
        spans = []

        for s in trace:
            raw_chars = s.get("chars", [])
            txt = "".join(chr(u) for u, gid, o, b in raw_chars if u > 0).strip()
            if not txt:
                continue

            font_name = s.get("font", "")
            font_size = float(s.get("size", 0.0))
            layer = s.get("layer") or ""
            seqno = s.get("seqno", 0)
            rendering_type = s.get("type", 0)  # 3 = invisible text
            opacity = s.get("opacity", 1.0)

            boxes = [b for u, gid, o, b in raw_chars]
            if not boxes:
                continue
            x0 = min(b[0] for b in boxes)
            y0 = min(b[1] for b in boxes)
            x1 = max(b[2] for b in boxes)
            y1 = max(b[3] for b in boxes)

            # Check if any later opaque drawing covers this span
            is_occluded = False
            if rendering_type != 3 and opacity > 0.001:
                cx = (x0 + x1) / 2.0
                cy = (y0 + y1) / 2.0
                for d in drawings:
                    if d["seqno"] > seqno and d.get("fill_opacity", 1.0) >= 0.99:
                        dr = d.get("rect")
                        if dr and dr[0] <= cx <= dr[2] and dr[1] <= cy <= dr[3]:
                            is_occluded = True
                            break

            spans.append({
                "text": txt,
                "font": font_name,
                "fontSizePt": round(font_size, 2),
                "glyphHeightPt": round(y1 - y0, 2),
                "boxPt": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                "layer": layer,
                "renderingType": rendering_type,
                "opacity": opacity,
                "seqno": seqno,
                "isOccluded": is_occluded
            })

        # 4. Render preview image for pixel crop inspection
        pix = page.get_pixmap(dpi=150)
        from PIL import Image
        im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        pages_data.append({
            "pageNumber": page_idx + 1,
            "widthPt": round(width_pt, 2),
            "heightPt": round(height_pt, 2),
            "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
            "trimbox": trimbox,
            "cropbox": cropbox,
            "mediabox": mediabox,
            "hasVectorGeometry": True,
            "spans": spans,
            "drawings": drawings,
            "dielineSegments": dieline_segments,
            "renderedImage": im
        })

    doc.close()
    return pages_data


def run_screening_pipeline(pdf_path, options=None):
    """Executes all 4 prepress screening capabilities on a PDF file."""
    options = options or {}
    pdf_p = Path(pdf_path)
    if not pdf_p.exists():
        raise FileNotFoundError(f"PDF artwork file not found: {pdf_path}")

    # Compute artwork hash
    artwork_hash = hashlib.sha256(pdf_p.read_bytes()).hexdigest()

    parser_info = detect_parser_capabilities(options.get("parser"))
    all_checks = []
    all_findings = []

    if parser_info["parser"].startswith("PyMuPDF"):
        pages_data = extract_with_pymupdf(str(pdf_p))
    else:
        # Fallback to pdfium (conservative)
        pages_data = []

    # Process options: DXF alignments
    dxf_lines = options.get("dxfLines", [])

    for page_data in pages_data:
        spans = page_data["spans"]
        drawings = page_data["drawings"]
        dieline_segs = page_data["dielineSegments"] + dxf_lines
        rendered_im = page_data.get("renderedImage")

        page_meta = {
            "pageNumber": page_data["pageNumber"],
            "widthPt": page_data["widthPt"],
            "heightPt": page_data["heightPt"],
            "rect": page_data["rect"],
            "hasVectorGeometry": True,
            "documentId": options.get("documentId", "artwork-pdf"),
        }

        # ----------------------------------------------------
        # PVP-001: Rendered Text Visibility
        # ----------------------------------------------------
        for span in spans:
            res_vis = screen_text_visibility(span, page_meta, rendered_im, options)
            if res_vis:
                all_checks.append(res_vis)
                if res_vis.get("screeningOutcome") in ("SCREENING_WARNING", "REVIEW_REQUIRED"):
                    all_findings.append(res_vis)

        # ----------------------------------------------------
        # PVP-002: Hidden / Overlapping Text
        # ----------------------------------------------------
        # A. Occlusions
        occ_findings = screen_drawing_occlusions(spans, drawings, page_meta)
        for f in occ_findings:
            all_checks.append(f)
            all_findings.append(f)

        # B. Text Collisions
        col_findings = screen_text_collisions(spans, page_meta)
        for f in col_findings:
            all_checks.append(f)
            all_findings.append(f)

        # C. Guide Layer Text
        guide_findings = screen_guide_layers(spans, page_meta)
        for f in guide_findings:
            all_checks.append(f)

        # D. Clipped Text
        clip_findings = screen_clipped_text(spans, page_data.get("trimbox"), page_meta)
        for f in clip_findings:
            all_checks.append(f)
            all_findings.append(f)

        # ----------------------------------------------------
        # PVP-003: Estimated Text Height
        # ----------------------------------------------------
        for span in spans:
            res_typo = screen_text_height(span, page_meta, options)
            if res_typo:
                all_checks.append(res_typo)
                if res_typo.get("screeningOutcome") == "SCREENING_WARNING":
                    all_findings.append(res_typo)

        # ----------------------------------------------------
        # PVP-004: Dieline / Trim Clearance
        # ----------------------------------------------------
        clear_findings = screen_trim_and_dieline_clearance(spans, dieline_segs, page_meta, options)
        for f in clear_findings:
            all_checks.append(f)
            if f.get("screeningOutcome") in ("SCREENING_WARNING", "UNABLE_TO_EVALUATE"):
                all_findings.append(f)

    # Coverage metadata
    coverage = {
        "parser": parser_info["parser"],
        "parserVersion": parser_info["version"],
        "licenseNotice": parser_info.get("licenseNotice", ""),
        "capabilities": parser_info.get("capabilities", {}),
        "totalPages": len(pages_data),
        "totalSpansInspected": sum(len(p["spans"]) for p in pages_data),
        "dielineSegmentsInspected": sum(len(p["dielineSegments"]) for p in pages_data),
        "checksExecuted": len(all_checks),
        "warningsDetected": len(all_findings),
    }

    return {
        "schema": "packsignal-pdf-preflight/v1",
        "reviewId": options.get("reviewId", "adhoc-preflight"),
        "artworkHash": artwork_hash,
        "screeningVersion": "1.0.0",
        "checks": all_checks,
        "findings": all_findings,
        "coverage": coverage,
        "limitations": [
            DISCLAIMER_TEXT,
            "Text-box height is an approximation and does not measure font x-height.",
            "Drawing sequence analysis does not evaluate complex transparency blend modes or soft masks.",
            "Dieline clearance screening requires trusted CAD or TrimBox geometry and does not infer cut lines from page edges."
        ]
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] != "--json":
            pdf_path = sys.argv[1]
            options = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        elif not sys.stdin.isatty():
            raw_input = sys.stdin.read().strip()
            payload = json.loads(raw_input) if raw_input else {}
            pdf_path = payload.get("path")
            options = payload.get("options", {})
        else:
            raise ValueError("Usage: runner.py <pdf_path> [options_json]")

        output = run_screening_pipeline(pdf_path, options)
        print(json.dumps(output, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e), "schema": "packsignal-pdf-preflight/v1", "screeningOutcome": "UNABLE_TO_EVALUATE"}))
        sys.exit(1)
