"""
PackSignal Coordinate Engine (lib/pdf-preflight/coordinates.py)
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


def pdf_to_normalized(box_pt, page_rect, rotation=0):
    """
    Transform a bounding box in PyMuPDF/PDF point coordinates to
    normalized [0, 1] PackSignal viewport coordinates (origin top-left).
    box_pt: [x0, y0, x1, y1]
    page_rect: [rx0, ry0, rx1, ry1] or object with x0, y0, x1, y1
    rotation: page rotation in degrees (0, 90, 180, 270)
    """
    if not box_pt or len(box_pt) < 4:
        return None

    if hasattr(page_rect, 'x0'):
        rx0, ry0, rx1, ry1 = page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1
    else:
        rx0, ry0, rx1, ry1 = page_rect[:4]

    w = rx1 - rx0
    h = ry1 - ry0
    if w <= 0 or h <= 0:
        return None

    x0, y0, x1, y1 = box_pt[:4]

    # Normalize relative to page rect
    nx0 = (x0 - rx0) / w
    ny0 = (y0 - ry0) / h
    nx1 = (x1 - rx0) / w
    ny1 = (y1 - ry0) / h

    # Handle page rotation
    rot = (int(rotation) % 360 + 360) % 360
    if rot == 90:
        # 90 deg clockwise: (x, y) -> (1 - y, x)
        bx0 = min(1.0 - ny0, 1.0 - ny1)
        by0 = min(nx0, nx1)
        bx1 = max(1.0 - ny0, 1.0 - ny1)
        by1 = max(nx0, nx1)
    elif rot == 180:
        # 180 deg: (x, y) -> (1 - x, 1 - y)
        bx0 = min(1.0 - nx0, 1.0 - nx1)
        by0 = min(1.0 - ny0, 1.0 - ny1)
        bx1 = max(1.0 - nx0, 1.0 - nx1)
        by1 = max(1.0 - ny0, 1.0 - ny1)
    elif rot == 270:
        # 270 deg clockwise: (x, y) -> (y, 1 - x)
        bx0 = min(ny0, ny1)
        by0 = min(1.0 - nx0, 1.0 - nx1)
        bx1 = max(ny0, ny1)
        by1 = max(1.0 - nx0, 1.0 - nx1)
    else:
        bx0 = min(nx0, nx1)
        by0 = min(ny0, ny1)
        bx1 = max(nx0, nx1)
        by1 = max(ny0, ny1)

    return [
        round(max(0.0, min(1.0, bx0)), 5),
        round(max(0.0, min(1.0, by0)), 5),
        round(max(0.0, min(1.0, bx1)), 5),
        round(max(0.0, min(1.0, by1)), 5),
    ]


def normalized_to_rendered_pixels(norm_box, img_width, img_height):
    """
    Convert normalized [0, 1] coordinates to exact integer pixel bounds for cropping.
    Ensures width and height are at least 1 pixel.
    """
    if not norm_box or len(norm_box) < 4:
        return None
    if img_width <= 0 or img_height <= 0:
        return None

    px0 = max(0, min(img_width - 1, int(math.floor(norm_box[0] * img_width))))
    py0 = max(0, min(img_height - 1, int(math.floor(norm_box[1] * img_height))))
    px1 = max(px0 + 1, min(img_width, int(math.ceil(norm_box[2] * img_width))))
    py1 = max(py0 + 1, min(img_height, int(math.ceil(norm_box[3] * img_height))))

    return [px0, py0, px1, py1]


def dxf_to_artwork(dxf_pt, alignment):
    """
    Transform a DXF physical coordinate (x, y in mm) into artwork PDF coordinate space
    given an alignment definition: {scale, offsetX, offsetY, rotation, physicalUnits}.
    Returns None if alignment is unconfirmed.
    """
    if not alignment or not alignment.get("isConfirmed"):
        return None
    x, y = dxf_pt[:2]
    units = (alignment.get("units") or "mm").lower()
    
    # Standardize to millimeters
    if units in ("in", "inch", "inches"):
        x_mm = x * 25.4
        y_mm = y * 25.4
    elif units == "mm":
        x_mm = x
        y_mm = y
    else:
        return None  # Unverified physical units

    scale = alignment.get("scale", 1.0)
    ox = alignment.get("offsetX", 0.0)
    oy = alignment.get("offsetY", 0.0)
    rot = alignment.get("rotation", 0.0)

    rad = math.radians(rot)
    rx = x_mm * math.cos(rad) - y_mm * math.sin(rad)
    ry = x_mm * math.sin(rad) + y_mm * math.cos(rad)

    art_x = rx * scale + ox
    art_y = ry * scale + oy
    return [round(art_x, 3), round(art_y, 3)]


def transform_bounding_box(box, transform_fn):
    """Apply coordinate transform to the 4 corners of a bounding box."""
    if not box or len(box) < 4:
        return None
    p1 = transform_fn([box[0], box[1]])
    p2 = transform_fn([box[2], box[1]])
    p3 = transform_fn([box[2], box[3]])
    p4 = transform_fn([box[0], box[3]])
    if any(p is None for p in [p1, p2, p3, p4]):
        return None
    xs = [p[0] for p in [p1, p2, p3, p4]]
    ys = [p[1] for p in [p1, p2, p3, p4]]
    return [min(xs), min(ys), max(xs), max(ys)]
