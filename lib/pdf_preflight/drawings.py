"""
PackSignal Vector Drawing & Painting Sequence Inspector (lib/pdf_preflight/drawings.py)
Extracts vector paths, fills, strokes, sequence numbers (seqno), clipping paths,
and opacities using PyMuPDF page.get_drawings(extended=True).
"""

from .coordinates import pdf_to_normalized


def extract_drawing_operations(page, page_num=1):
    """
    Extracts all vector drawing paths and graphic objects on a page.
    Preserves exact painting sequence order (seqno), fill/stroke colors,
    opacities, clipping paths, and normalized bounding boxes.
    """
    drawings = []
    page_rect = page.rect
    rotation = getattr(page, "rotation", 0) or 0

    try:
        # Use extended=True when supported to capture clips, groups, and layers
        try:
            raw_drawings = page.get_drawings(extended=True)
        except TypeError:
            raw_drawings = page.get_drawings()
    except Exception:
        return drawings

    for idx, d in enumerate(raw_drawings):
        rect = d.get("rect")
        if not rect:
            continue

        bbox = [float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)]
        norm_box = pdf_to_normalized(bbox, page_rect, rotation)

        fill_color = d.get("fill")
        stroke_color = d.get("color")
        fill_opacity = float(d.get("fill_opacity", 1.0) if d.get("fill_opacity") is not None else 1.0)
        stroke_opacity = float(d.get("stroke_opacity", 1.0) if d.get("stroke_opacity") is not None else 1.0)
        seqno = int(d.get("seqno", idx))
        layer = d.get("layer") or d.get("ocg") or "Default"
        items = d.get("items", [])
        even_odd = bool(d.get("even_odd", False))
        clips = d.get("clips", [])

        # Determine if this drawing is an opaque fill (potential occluder)
        has_fill = fill_color is not None
        is_opaque_fill = has_fill and fill_opacity >= 0.98

        drawing_record = {
            "drawingId": f"draw_p{page_num}_{idx}",
            "seqno": seqno,
            "page": page_num,
            "type": d.get("type", "path"),
            "bbox": [round(x, 2) for x in bbox],
            "normalizedBox": norm_box,
            "hasFill": has_fill,
            "hasStroke": stroke_color is not None,
            "fillColor": fill_color,
            "strokeColor": stroke_color,
            "fillOpacity": round(fill_opacity, 3),
            "strokeOpacity": round(stroke_opacity, 3),
            "isOpaqueFill": is_opaque_fill,
            "layer": layer,
            "itemCount": len(items),
            "evenOdd": even_odd,
            "hasClip": len(clips) > 0,
        }

        drawings.append(drawing_record)

    return drawings
