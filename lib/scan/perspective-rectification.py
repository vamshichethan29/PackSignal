#!/usr/bin/env python3
"""
PackSignal — Perspective Rectification Engine (lib/scan/perspective-rectification.py)
Phase 10A: Homography estimation and 4-corner perspective unwarping for planar packaging panels.
Supports original image preservation, forward/inverse homography matrices, and non-degeneracy validation.
"""

import sys
import os
import json
import math
from typing import Dict, Any, List, Optional, Tuple

try:
    from PIL import Image
except ImportError:
    Image = None


def solve_homography_4pt(src: List[List[float]], dst: List[List[float]]) -> List[float]:
    """
    Computes 3x3 homography matrix H mapping src -> dst using Direct Linear Transformation (DLT).
    Returns 9 elements [h00, h01, h02, h10, h11, h12, h20, h21, h22].
    """
    # 8 equations for 8 degrees of freedom (h22 normalized to 1)
    # A * h = b
    A = []
    b = []
    for (xs, ys), (xd, yd) in zip(src, dst):
        A.append([xs, ys, 1, 0, 0, 0, -xs * xd, -ys * xd])
        b.append(xd)
        A.append([0, 0, 0, xs, ys, 1, -xs * yd, -ys * yd])
        b.append(yd)

    # Solve using Gaussian elimination
    # Standard 8x8 linear solve
    n = 8
    # Augmented matrix
    M = [A[i] + [b[i]] for i in range(n)]

    for i in range(n):
        # Pivot
        max_row = i
        for k in range(i + 1, n):
            if abs(M[k][i]) > abs(M[max_row][i]):
                max_row = k
        M[i], M[max_row] = M[max_row], M[i]

        pivot = M[i][i]
        if abs(pivot) < 1e-9:
            raise ValueError("Degenerate point configuration: points may be collinear")

        for j in range(i, n + 1):
            M[i][j] /= pivot

        for k in range(n):
            if k != i:
                factor = M[k][i]
                for j in range(i, n + 1):
                    M[k][j] -= factor * M[i][j]

    h = [M[i][n] for i in range(n)] + [1.0]
    return h


def validate_quadrilateral(corners: List[List[float]]) -> Tuple[bool, str]:
    """
    Validates that 4 points form a non-degenerate, strictly convex quadrilateral.
    """
    if len(corners) != 4:
        return False, "Exactly 4 corners [TL, TR, BR, BL] required"

    # Cross products of consecutive edges must have same sign (strictly convex)
    signs = []
    for i in range(4):
        p1 = corners[i]
        p2 = corners[(i + 1) % 4]
        p3 = corners[(i + 2) % 4]

        dx1 = p2[0] - p1[0]
        dy1 = p2[1] - p1[1]
        dx2 = p3[0] - p2[0]
        dy2 = p3[1] - p2[1]

        cross = dx1 * dy2 - dy1 * dx2
        if abs(cross) < 1e-4:
            return False, "Degenerate collinear or overlapping edges detected"
        signs.append(cross > 0)

    if not (all(signs) or not any(signs)):
        return False, "Quadrilateral is self-intersecting or non-convex"

    # Check minimum edge length
    for i in range(4):
        p1 = corners[i]
        p2 = corners[(i + 1) % 4]
        dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        if dist < 15:
            return False, f"Edge {i} length ({dist:.1f}px) is too short"

    return True, "Valid convex quadrilateral"


def compute_rectification(
    corners: List[List[float]],
    target_width: Optional[int] = None,
    target_height: Optional[int] = None
) -> Dict[str, Any]:
    """
    Calculates perspective rectification homography and output panel dimensions.
    """
    is_valid, reason = validate_quadrilateral(corners)
    if not is_valid:
        return {
            "success": False,
            "error": reason,
            "homography": None,
            "destinationSize": None
        }

    p0, p1, p2, p3 = corners  # TL, TR, BR, BL

    top_w = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    bottom_w = math.hypot(p2[0] - p3[0], p2[1] - p3[1])
    left_h = math.hypot(p3[0] - p0[0], p3[1] - p0[1])
    right_h = math.hypot(p2[0] - p1[0], p2[1] - p1[1])

    w = int(round(target_width or max(top_w, bottom_w)))
    h = int(round(target_height or max(left_h, right_h)))

    dst_corners = [
        [0.0, 0.0],
        [float(w), 0.0],
        [float(w), float(h)],
        [0.0, float(h)]
    ]

    try:
        H_forward = solve_homography_4pt(corners, dst_corners)
        H_inverse = solve_homography_4pt(dst_corners, corners)
    except Exception as e:
        return {
            "success": False,
            "error": f"Homography calculation failed: {str(e)}",
            "homography": None
        }

    return {
        "success": True,
        "sourceCorners": corners,
        "destinationCorners": dst_corners,
        "destinationSize": {"width": w, "height": h},
        "aspectRatio": round(w / max(1, h), 4),
        "homographyForward": [round(v, 6) for v in H_forward],
        "homographyInverse": [round(v, 6) for v in H_inverse],
        "qualityWarnings": [] if is_valid else [reason]
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw else {}
        corners = payload.get("corners", [])
        w = payload.get("targetWidth")
        h = payload.get("targetHeight")

        res = compute_rectification(corners, w, h)
        print(json.dumps(res, indent=2))
    else:
        # Standard test box
        test_corners = [[40, 50], [440, 45], [450, 610], [35, 600]]
        res = compute_rectification(test_corners)
        print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
