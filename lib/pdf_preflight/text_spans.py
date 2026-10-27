"""
PackSignal Native PDF Text Span Extractor (lib/pdf_preflight/text_spans.py)
Extracts rich native PDF text spans with font metadata, source-reported font size,
font flags, rendering modes, opacity, painting sequence numbers, and character quads.
"""

import hashlib
from .coordinates import pdf_to_normalized
from .models import (
    VISIBLE_CANDIDATE,
    NONRENDERING_TEXT,
    ZERO_OPACITY_TEXT,
    UNKNOWN_VISIBILITY,
)


def extract_native_text_spans(page, page_num=1):
    """
    Extracts all native PDF text spans from a fitz.Page object using get_text("rawdict").
    Produces clean, structured span records adhering to the Phase 3 schema.
    """
    spans = []
    page_rect = page.rect
    rotation = getattr(page, "rotation", 0) or 0

    try:
        raw_dict = page.get_text("rawdict")
    except Exception:
        try:
            raw_dict = page.get_text("dict")
        except Exception:
            return spans

    # Retrieve texttrace if available to get native render_mode (Tr) and opacity
    traces = []
    if hasattr(page, "get_texttrace"):
        try:
            traces = page.get_texttrace() or []
        except Exception:
            traces = []

    blocks = raw_dict.get("blocks", [])
    span_index = 0

    for b_idx, block in enumerate(blocks):
        if block.get("type") != 0:  # 0 is text block, 1 is image
            continue

        for l_idx, line in enumerate(block.get("lines", [])):
            line_dir = line.get("dir", (1.0, 0.0))
            line_bbox = line.get("bbox", [0, 0, 0, 0])

            for s_idx, span in enumerate(line.get("spans", [])):
                text = span.get("text")
                if text is None and "chars" in span:
                    text = "".join(ch.get("c", "") for ch in span.get("chars", []))
                text = str(text or "").strip()
                if not text:
                    continue

                bbox = list(span.get("bbox", [0, 0, 0, 0]))
                font_name = str(span.get("font", "UnknownFont"))
                font_size_pt = float(span.get("size", 0.0))
                font_flags = int(span.get("flags", 0))
                color = span.get("color", 0)

                # Decode font style hints from flags and font name
                # PyMuPDF font flags: bit 0: superscript, bit 1: italic, bit 2: serif, bit 3: monospaced, bit 4: bold
                is_italic = bool(font_flags & 2) or ("italic" in font_name.lower()) or ("oblique" in font_name.lower())
                is_bold = bool(font_flags & 16) or ("bold" in font_name.lower()) or ("black" in font_name.lower()) or ("heavy" in font_name.lower())
                is_monospace = bool(font_flags & 8) or ("mono" in font_name.lower()) or ("courier" in font_name.lower())
                is_serif = bool(font_flags & 4)

                # Render mode and opacity from span or texttrace
                render_mode = int(span.get("render_mode", 0) or 0)
                opacity = float(span.get("opacity", 1.0) if span.get("opacity") is not None else 1.0)
                if "alpha" in span and span["alpha"] is not None:
                    opacity = min(opacity, float(span["alpha"]) / 255.0)

                # Cross-reference with texttrace for exact Tr render_mode and graphics state opacity
                for tr in traces:
                    t_bbox = tr.get("bbox", (0, 0, 0, 0))
                    # Check bounding box overlap / proximity
                    if (abs(t_bbox[0] - bbox[0]) < 2.0 and abs(t_bbox[1] - bbox[1]) < 2.0) or \
                       (t_bbox[0] <= bbox[2] and t_bbox[2] >= bbox[0] and t_bbox[1] <= bbox[3] and t_bbox[3] >= bbox[1]):
                        if "type" in tr and tr["type"] is not None:
                            render_mode = int(tr["type"])
                        if "opacity" in tr and tr["opacity"] is not None:
                            opacity = float(tr["opacity"])
                        break

                seqno = int(span.get("seqno", span_index))

                # Character-level boxes if present in rawdict
                char_boxes = []
                for ch in span.get("chars", []):
                    c_bbox = ch.get("bbox")
                    c_char = ch.get("c")
                    if c_bbox and c_char:
                        c_norm = pdf_to_normalized(c_bbox, page_rect, rotation)
                        char_boxes.append({
                            "char": c_char,
                            "bbox": list(c_bbox),
                            "normalizedBox": c_norm
                        })

                # Initial visibility classification from native PDF graphics state
                if render_mode == 3:
                    vis_class = NONRENDERING_TEXT
                elif opacity <= 0.001:
                    vis_class = ZERO_OPACITY_TEXT
                else:
                    vis_class = VISIBLE_CANDIDATE

                norm_box = pdf_to_normalized(bbox, page_rect, rotation)

                # Create stable span ID
                seed = f"{page_num}:{b_idx}:{l_idx}:{s_idx}:{text}:{bbox[0]:.1f}:{bbox[1]:.1f}"
                span_id = f"span_p{page_num}_{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:12]}"

                span_record = {
                    "spanId": span_id,
                    "text": text,
                    "page": page_num,
                    "fontName": font_name,
                    "fontSizePt": round(font_size_pt, 2),
                    "fontFlags": font_flags,
                    "fontStyleHints": {
                        "isBold": is_bold,
                        "isItalic": is_italic,
                        "isMonospace": is_monospace,
                        "isSerif": is_serif,
                    },
                    "textRenderingMode": render_mode,
                    "textOpacity": round(opacity, 3),
                    "color": color,
                    "bbox": [round(x, 2) for x in bbox],
                    "normalizedBox": norm_box,
                    "charBoxes": char_boxes,
                    "writingDirection": list(line_dir),
                    "rotation": rotation,
                    "seqno": seqno,
                    "layer": span.get("layer") or span.get("ocg") or "Default",
                    "extractionMethod": "pymupdf_native_text",
                    "visibilityClassification": vis_class,
                }

                spans.append(span_record)
                span_index += 1

    return spans
