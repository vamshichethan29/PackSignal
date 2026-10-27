"""
PackSignal Computational Geometry for Prepress Inspection (lib/pdf-preflight/geometry.py)
Computes exact 2D minimum distances from text bounding boxes to trusted dielines,
TrimBox boundaries, and crease lines. Strictly classifies structural linework.
"""

import math
from models import (
    BOUNDARY_CUT,
    BOUNDARY_CREASE,
    BOUNDARY_GLUE,
    BOUNDARY_BLEED,
    BOUNDARY_UNCLASSIFIED,
)


def point_distance(p1, p2):
    """Euclidean distance between two 2D points."""
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])


def point_to_segment_distance(pt, seg_p1, seg_p2):
    """
    Exact minimum distance from point pt=(px, py) to segment (seg_p1, seg_p2).
    Clamps orthogonal projection to segment endpoints.
    """
    px, py = pt[0], pt[1]
    x1, y1 = seg_p1[0], seg_p1[1]
    x2, y2 = seg_p2[0], seg_p2[1]

    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq <= 1e-12:
        return math.hypot(px - x1, py - y1)

    # Dot product of (pt - p1) with (p2 - p1)
    t = ((px - x1) * dx + (py - y1) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))

    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def segments_intersect(p1, p2, p3, p4):
    """Check if segment (p1, p2) intersects segment (p3, p4)."""
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])

    def on_segment(p, a, b):
        return (
            min(a[0], b[0]) - 1e-7 <= p[0] <= max(a[0], b[0]) + 1e-7 and
            min(a[1], b[1]) - 1e-7 <= p[1] <= max(a[1], b[1]) + 1e-7
        )

    # Collinear / orientation test
    d1 = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0])
    d2 = (p2[0] - p1[0]) * (p4[1] - p1[1]) - (p2[1] - p1[1]) * (p4[0] - p1[0])
    d3 = (p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0])
    d4 = (p4[0] - p3[0]) * (p2[1] - p3[1]) - (p4[1] - p3[1]) * (p2[0] - p3[0])

    if ((d1 > 1e-9 and d2 < -1e-9) or (d1 < -1e-9 and d2 > 1e-9)) and \
       ((d3 > 1e-9 and d4 < -1e-9) or (d3 < -1e-9 and d4 > 1e-9)):
        return True

    if abs(d1) <= 1e-9 and on_segment(p3, p1, p2): return True
    if abs(d2) <= 1e-9 and on_segment(p4, p1, p2): return True
    if abs(d3) <= 1e-9 and on_segment(p1, p3, p4): return True
    if abs(d4) <= 1e-9 and on_segment(p2, p3, p4): return True

    return False


def segment_to_segment_distance(p1, p2, p3, p4):
    """Minimum Euclidean distance between segment (p1, p2) and segment (p3, p4)."""
    if segments_intersect(p1, p2, p3, p4):
        return 0.0

    return min(
        point_to_segment_distance(p1, p3, p4),
        point_to_segment_distance(p2, p3, p4),
        point_to_segment_distance(p3, p1, p2),
        point_to_segment_distance(p4, p1, p2),
    )


def point_inside_rect(pt, rect):
    """Check if point pt is inside or on axis-aligned rect [x0, y0, x1, y1]."""
    x, y = pt[0], pt[1]
    rx0, ry0, rx1, ry1 = rect[0], rect[1], rect[2], rect[3]
    return rx0 <= x <= rx1 and ry0 <= y <= ry1


def minimum_distance_rect_to_segment(rect, seg_p1, seg_p2):
    """
    Calculate the exact minimum Euclidean distance from an axis-aligned
    rectangle [x0, y0, x1, y1] to line segment (seg_p1, seg_p2).
    Returns 0.0 if segment crosses or terminates inside the rectangle.
    """
    rx0, ry0, rx1, ry1 = rect[0], rect[1], rect[2], rect[3]

    # Ensure coordinates are properly ordered
    x_min, x_max = min(rx0, rx1), max(rx0, rx1)
    y_min, y_max = min(ry0, ry1), max(ry0, ry1)
    ordered_rect = [x_min, y_min, x_max, y_max]

    # 1. Does either endpoint lie inside the rectangle?
    if point_inside_rect(seg_p1, ordered_rect) or point_inside_rect(seg_p2, ordered_rect):
        return 0.0

    # 2. Check 4 rectangle perimeter edges
    c_tl = (x_min, y_min)
    c_tr = (x_max, y_min)
    c_br = (x_max, y_max)
    c_bl = (x_min, y_max)

    rect_edges = [
        (c_tl, c_tr),
        (c_tr, c_br),
        (c_br, c_bl),
        (c_bl, c_tl)
    ]

    min_dist = float("inf")
    for edge_p1, edge_p2 in rect_edges:
        d = segment_to_segment_distance(seg_p1, seg_p2, edge_p1, edge_p2)
        if d <= 1e-9:
            return 0.0
        if d < min_dist:
            min_dist = d

    return min_dist


def classify_line_semantics(layer_name="", stroke_color=None, dash_pattern=None, source_label=""):
    """
    Classifies a vector line segment into prepress boundary types.
    Requires trusted evidence; does NOT guess based on random black strokes.
    """
    text_meta = f"{layer_name} {source_label}".lower()

    if any(k in text_meta for k in ("cut", "trim", "die-cut", "outer-cut", "thrus")):
        return BOUNDARY_CUT
    if any(k in text_meta for k in ("crease", "fold", "score")):
        return BOUNDARY_CREASE
    if any(k in text_meta for k in ("glue", "paste")):
        return BOUNDARY_GLUE
    if any(k in text_meta for k in ("bleed", "bleed-line", "bleedbox")):
        return BOUNDARY_BLEED

    # Special spot colors
    if stroke_color and isinstance(stroke_color, str):
        color_lower = stroke_color.lower()
        if "cut" in color_lower or "dieline" in color_lower:
            return BOUNDARY_CUT
        if "crease" in color_lower or "fold" in color_lower:
            return BOUNDARY_CREASE

    return BOUNDARY_UNCLASSIFIED


def minimum_distance_text_to_boundary(text_box, boundary_segments):
    """
    Finds the nearest boundary line segment and exact minimum distance.
    text_box: [x0, y0, x1, y1]
    boundary_segments: list of dicts: {'p1': [x, y], 'p2': [x, y], 'type': str, 'source': str}
    """
    if not boundary_segments:
        return None, None, float("inf")

    nearest_seg = None
    min_distance = float("inf")

    for seg in boundary_segments:
        p1 = seg.get("p1")
        p2 = seg.get("p2")
        if not p1 or not p2:
            continue
        dist = minimum_distance_rect_to_segment(text_box, p1, p2)
        if dist < min_distance:
            min_distance = dist
            nearest_seg = seg

    return nearest_seg, min_distance


def text_outside_rect(text_box, boundary_rect):
    """
    Check if a text box extends outside a confirmed boundary rect (e.g. TrimBox).
    Returns True if any corner of text_box is outside boundary_rect.
    """
    tx0, ty0, tx1, ty1 = text_box[:4]
    bx0, by0, bx1, by1 = boundary_rect[:4]

    return tx0 < (bx0 - 1e-4) or ty0 < (by0 - 1e-4) or tx1 > (bx1 + 1e-4) or ty1 > (by1 + 1e-4)
