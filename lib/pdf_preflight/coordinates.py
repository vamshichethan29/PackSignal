"""
PackSignal Coordinate Engine (lib/pdf_preflight/coordinates.py)
Handles transformations between PDF points, physical millimeters,
rendered image pixels, and normalized PackSignal viewport coordinates.
Strictly distinguishes physical vector coordinates from unscaled raster pixels.
"""

import math

MM_PER_PT = 25.4 / 72.0
PT_PER_MM = 72.0 / 25.4


def pdf_pt_to_mm(pt):
    """Convert PDF points (1/72 in) to millimeters."""
    if pt is None or not math.isfinite(pt):
        return None
    return float(pt) * MM_PER_PT


def mm_to_pdf_pt(mm):
    """Convert millimeters to PDF points."""
    if mm is None or not math.isfinite(mm):
        return None
    return float(mm) * PT_PER_MM


def pdf_points_to_millimeters(pt):
    """Alias for pdf_pt_to_mm."""
    return pdf_pt_to_mm(pt)


def pdf_to_normalized(box_pt, page_rect, rotation=0):
    """
    Transform a bounding box in PyMuPDF/PDF point coordinates to
    normalized [0, 1] PackSignal viewport coordinates (origin top-left).
    box_pt: [x0, y0, x1, y1] or fitz.Rect
    page_rect: [rx0, ry0, rx1, ry1] or fitz.Rect
    rotation: page rotation in degrees (0, 90, 180, 270)
    """
    if not box_pt or len(box_pt) < 4:
        return None

    if hasattr(page_rect, "x0"):
        rx0, ry0, rx1, ry1 = page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1
    else:
        rx0, ry0, rx1, ry1 = page_rect[:4]

    w = rx1 - rx0
    h = ry1 - ry0
    if w <= 0 or h <= 0:
        return None

    if hasattr(box_pt, "x0"):
        x0, y0, x1, y1 = box_pt.x0, box_pt.y0, box_pt.x1, box_pt.y1
    else:
        x0, y0, x1, y1 = box_pt[:4]

    # Normalize relative to page rect
    nx0 = (x0 - rx0) / w
    ny0 = (y0 - ry0) / h
    nx1 = (x1 - rx0) / w
    ny1 = (y1 - ry0) / h

    # Handle page rotation
    rot = (int(rotation) % 360 + 360) % 360
    if rot == 90:
        bx0 = min(1.0 - ny0, 1.0 - ny1)
        by0 = min(nx0, nx1)
        bx1 = max(1.0 - ny0, 1.0 - ny1)
        by1 = max(nx0, nx1)
    elif rot == 180:
        bx0 = min(1.0 - nx0, 1.0 - nx1)
        by0 = min(1.0 - ny0, 1.0 - ny1)
        bx1 = max(1.0 - nx0, 1.0 - nx1)
        by1 = max(1.0 - ny0, 1.0 - ny1)
    elif rot == 270:
        bx0 = min(ny0, ny1)
        by0 = min(1.0 - nx0, 1.0 - nx1)
        bx1 = max(ny0, ny1)
        by1 = max(1.0 - nx0, 1.0 - nx1)
    else:
        bx0 = min(nx0, nx1)
        by0 = min(ny0, ny1)
        bx1 = max(nx0, nx1)
        by1 = max(ny0, ny1)

    # Clamp to [0, 1] range safely
    return [
        round(max(0.0, min(1.0, bx0)), 5),
        round(max(0.0, min(1.0, by0)), 5),
        round(max(0.0, min(1.0, bx1)), 5),
        round(max(0.0, min(1.0, by1)), 5),
    ]


def normalized_to_pdf(box_norm, page_rect, rotation=0):
    """
    Inverse of pdf_to_normalized: transform [0, 1] box back to PDF points.
    """
    if not box_norm or len(box_norm) < 4:
        return None

    if hasattr(page_rect, "x0"):
        rx0, ry0, rx1, ry1 = page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1
    else:
        rx0, ry0, rx1, ry1 = page_rect[:4]

    w = rx1 - rx0
    h = ry1 - ry0
    bx0, by0, bx1, by1 = box_norm[:4]
    rot = (int(rotation) % 360 + 360) % 360

    if rot == 90:
        # bx0 = 1 - ny1, bx1 = 1 - ny0; by0 = nx0, by1 = nx1
        nx0 = by0
        nx1 = by1
        ny0 = 1.0 - bx1
        ny1 = 1.0 - bx0
    elif rot == 180:
        nx0 = 1.0 - bx1
        nx1 = 1.0 - bx0
        ny0 = 1.0 - by1
        ny1 = 1.0 - by0
    elif rot == 270:
        nx0 = 1.0 - by1
        nx1 = 1.0 - by0
        ny0 = bx0
        ny1 = bx1
    else:
        nx0, ny0, nx1, ny1 = bx0, by0, bx1, by1

    return [
        round(rx0 + nx0 * w, 2),
        round(ry0 + ny0 * h, 2),
        round(rx0 + nx1 * w, 2),
        round(ry0 + ny1 * h, 2),
    ]


def normalized_to_rendered_pixels(box_norm, render_width, render_height):
    """Convert normalized [0, 1] box to integer pixel bounds [px0, py0, px1, py1]."""
    if not box_norm or len(box_norm) < 4:
        return None
    bx0, by0, bx1, by1 = box_norm[:4]
    px0 = max(0, int(math.floor(bx0 * render_width)))
    py0 = max(0, int(math.floor(by0 * render_height)))
    px1 = min(render_width, int(math.ceil(bx1 * render_width)))
    py1 = min(render_height, int(math.ceil(by1 * render_height)))
    return [px0, py0, px1, py1]


def transform_text_quad(quad, page_rect, rotation=0):
    """
    Transform a text quad (4 points or rect) to normalized polygon coordinates.
    """
    if not quad:
        return []
    pts = []
    if hasattr(quad, "ul"):
        for pt in [quad.ul, quad.ur, quad.lr, quad.ll]:
            norm_box = pdf_to_normalized([pt.x, pt.y, pt.x, pt.y], page_rect, rotation)
            if norm_box:
                pts.append([norm_box[0], norm_box[1]])
    elif isinstance(quad, (list, tuple)) and len(quad) >= 4:
        norm_box = pdf_to_normalized(quad, page_rect, rotation)
        if norm_box:
            pts = [
                [norm_box[0], norm_box[1]],
                [norm_box[2], norm_box[1]],
                [norm_box[2], norm_box[3]],
                [norm_box[0], norm_box[3]],
            ]
    return pts


def transform_image_bbox(bbox, page_rect, rotation=0):
    """Transform image bounding box to normalized coordinates."""
    return pdf_to_normalized(bbox, page_rect, rotation)


def pdf_rect_to_viewport(rect, page_rect, viewport_width, viewport_height, rotation=0):
    """Convert PDF rect to viewport pixel coordinates."""
    norm = pdf_to_normalized(rect, page_rect, rotation)
    if not norm:
        return None
    return normalized_to_rendered_pixels(norm, viewport_width, viewport_height)


def validate_page_transform(page_rect, render_dims):
    """Verify aspect ratio consistency between vector PDF page and raster render."""
    if not page_rect or not render_dims:
        return True, 0.0
    if hasattr(page_rect, "width"):
        pw, ph = page_rect.width, page_rect.height
    else:
        pw, ph = page_rect[2] - page_rect[0], page_rect[3] - page_rect[1]
    rw, rh = render_dims[0], render_dims[1]
    if pw <= 0 or ph <= 0 or rw <= 0 or rh <= 0:
        return False, 1.0

    pdf_ar = pw / ph
    raster_ar = rw / rh
    diff_pct = abs(pdf_ar - raster_ar) / pdf_ar * 100.0
    is_valid = diff_pct < 1.0  # < 1% aspect ratio divergence
    return is_valid, round(diff_pct, 3)
