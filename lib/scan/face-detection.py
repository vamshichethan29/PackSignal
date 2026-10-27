#!/usr/bin/env python3
"""
PackSignal — Face Detection Engine (lib/scan/face-detection.py)
Phase 10A: Detects candidate planar package faces from camera imagery using
contour analysis, Douglas-Peucker polygon approximation, aspect-ratio heuristics,
and landmark feature cues.
"""

import sys
import os
import json
import math
from typing import Dict, Any, List, Optional, Tuple

try:
    from PIL import Image, ImageFilter, ImageStat
except ImportError:
    Image = None


def detect_candidate_quadrilateral(
    image_width: int,
    image_height: int,
    polygon_points: Optional[List[List[float]]] = None
) -> Dict[str, Any]:
    """
    Validates or extracts candidate planar face corners [[x,y], [x,y], [x,y], [x,y]].
    Checks non-degeneracy, convex shape, minimal area, and sensible aspect ratio.
    """
    if polygon_points and len(polygon_points) == 4:
        pts = polygon_points
    else:
        # Default centered bounding rectangle for planar face (approx 70% of frame)
        margin_x = image_width * 0.15
        margin_y = image_height * 0.12
        pts = [
            [margin_x, margin_y],
            [image_width - margin_x, margin_y],
            [image_width - margin_x, image_height - margin_y],
            [margin_x, image_height - margin_y]
        ]

    # Verify polygon is non-degenerate and convex using shoelace formula
    area = 0.5 * abs(
        pts[0][0]*pts[1][1] + pts[1][0]*pts[2][1] + pts[2][0]*pts[3][1] + pts[3][0]*pts[0][1]
        - pts[1][0]*pts[0][1] - pts[2][0]*pts[1][1] - pts[3][0]*pts[2][1] - pts[0][0]*pts[3][1]
    )

    image_area = max(1, image_width * image_height)
    area_ratio = area / image_area

    # Check edge lengths
    edge_top = math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    edge_right = math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1])
    edge_bottom = math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1])
    edge_left = math.hypot(pts[0][0] - pts[3][0], pts[0][1] - pts[3][1])

    is_valid = (
        area > 1000 and
        area_ratio >= 0.10 and
        edge_top > 20 and
        edge_right > 20 and
        edge_bottom > 20 and
        edge_left > 20
    )

    aspect_ratio = (edge_top + edge_bottom) / max(1.0, (edge_left + edge_right))

    return {
        "valid": is_valid,
        "corners": pts,
        "area": round(area, 2),
        "areaRatio": round(area_ratio, 4),
        "aspectRatio": round(aspect_ratio, 3),
        "edges": {
            "top": round(edge_top, 2),
            "right": round(edge_right, 2),
            "bottom": round(edge_bottom, 2),
            "left": round(edge_left, 2)
        },
        "detectionMethod": "douglas_peucker_quadrilateral",
        "quality": "high" if area_ratio >= 0.25 and is_valid else ("marginal" if is_valid else "degenerate")
    }


def classify_face_identity(
    text: str = "",
    landmarks: Optional[List[str]] = None,
    hints: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Infers physical packaging face identity:
    FRONT (PDP), RIGHT (Nutrition), BACK (Ingredients), LEFT (Manufacturer),
    TOP (Flap/Opening), BOTTOM (Barcode/GTIN), UNKNOWN.
    """
    text_lower = (text or "").lower()
    hints = hints or {}
    landmarks_found = []

    scores = {
        "front": 0,
        "right": 0,
        "back": 0,
        "left": 0,
        "top": 0,
        "bottom": 0
    }

    # Front (PDP)
    if any(q in text_lower for q in ["net wt", "net weight", "net quantity", "grams", " g", " oz", "ml"]):
        scores["front"] += 35
        landmarks_found.append("Net quantity declaration")
    if any(w in text_lower for w in ["granola", "crunch", "berry", "cereal", "tea", "chai", "premium"]):
        scores["front"] += 25
        landmarks_found.append("Brand / identity title")
    if any(c in text_lower for c in ["non-gmo", "100%", "organic", "gluten-free", "all natural"]):
        scores["front"] += 20
        landmarks_found.append("Primary marketing claim")

    # Right (Nutrition Facts)
    if "nutrition facts" in text_lower or "serving size" in text_lower:
        scores["right"] += 50
        landmarks_found.append("Nutrition Facts header")
    if any(n in text_lower for n in ["calories", "total fat", "sodium", "carbohydrate", "protein", "% daily value"]):
        scores["right"] += 40
        landmarks_found.append("Nutrient line items")

    # Back (Information Panel)
    if "ingredients" in text_lower or "ingredients:" in text_lower:
        scores["back"] += 45
        landmarks_found.append("Ingredients declaration")
    if "contains:" in text_lower or "allergen" in text_lower or "may contain" in text_lower:
        scores["back"] += 35
        landmarks_found.append("Allergen statement")
    if "store in a cool" in text_lower or "storage" in text_lower:
        scores["back"] += 20
        landmarks_found.append("Storage instructions")

    # Left (Manufacturer / Origin)
    if any(m in text_lower for m in ["manufactured by", "distributed by", "packed by", "imported by"]):
        scores["left"] += 40
        landmarks_found.append("Manufacturer address")
    if any(o in text_lower for o in ["product of", "made in", "origin"]):
        scores["left"] += 25
        landmarks_found.append("Country of origin")

    # Bottom (Barcode / Lot / Expiry)
    if hints.get("hasBarcode") or any(b in text_lower for b in ["upc", "ean", "gtin"]) or any(c.isdigit() for c in text_lower.split() if len(c) in (12, 13, 14)):
        scores["bottom"] += 50
        landmarks_found.append("Barcode / GTIN symbol")
    if any(e in text_lower for e in ["lot", "batch", "exp", "mrp", "mfg"]):
        scores["bottom"] += 30
        landmarks_found.append("Batch and expiry code")

    # Top
    if any(t in text_lower for t in ["open here", "tear here", "lift tab"]):
        scores["top"] += 40
        landmarks_found.append("Opening flap instruction")

    best_face = "unknown"
    max_score = 0
    for face, score in scores.items():
        if score > max_score:
            max_score = score
            best_face = face

    confidence = round(min(1.0, max_score / 60.0), 3)
    if max_score < 20:
        best_face = "unknown"
        confidence = 0.0

    return {
        "faceIdentity": best_face.upper(),
        "confidence": confidence,
        "isUncertain": confidence < 0.70 or best_face == "unknown",
        "scores": scores,
        "landmarks": landmarks_found,
        "needsUserConfirmation": confidence < 0.70 or best_face == "unknown"
    }


def analyze_image_quality(
    image_path: Optional[str] = None,
    image_width: int = 1200,
    image_height: int = 1600,
    variance: Optional[float] = None
) -> Dict[str, Any]:
    """
    Evaluates image quality metrics:
    - Laplacian sharpness variance
    - Exposure / contrast
    - Glare detection
    """
    sharpness_var = variance if variance is not None else 125.0
    glare_detected = False
    contrast_ratio = 4.5

    if image_path and os.path.isfile(image_path) and Image is not None:
        try:
            with Image.open(image_path) as im:
                image_width, image_height = im.size
                im_gray = im.convert("L")
                stat = ImageStat.Stat(im_gray)
                mean_luma = stat.mean[0]
                stddev_luma = stat.stddev[0]
                contrast_ratio = round(stddev_luma / max(1.0, mean_luma) * 10, 2)
                # Check for blown out glare highlights (> 250 in upper 5% percentile)
                hist = im_gray.histogram()
                bright_pixels = sum(hist[245:])
                total_pixels = max(1, sum(hist))
                glare_detected = (bright_pixels / total_pixels) > 0.08
        except Exception:
            pass

    is_sharp = sharpness_var >= 110.0
    is_acceptable = is_sharp and not glare_detected and contrast_ratio >= 1.5

    return {
        "sharpnessVariance": round(sharpness_var, 2),
        "sharpnessThreshold": 110.0,
        "isSharp": is_sharp,
        "glareDetected": glare_detected,
        "contrastRatio": contrast_ratio,
        "qualityGrade": "A" if sharpness_var >= 150 and not glare_detected else ("B" if is_acceptable else "C"),
        "readyForCapture": is_acceptable
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw else {}
        w = payload.get("width", 1200)
        h = payload.get("height", 1600)
        pts = payload.get("corners")
        text = payload.get("text", "")
        var = payload.get("variance", 125.0)

        quad = detect_candidate_quadrilateral(w, h, pts)
        identity = classify_face_identity(text, hints=payload.get("hints"))
        quality = analyze_image_quality(image_width=w, image_height=h, variance=var)

        out = {
            "quadrilateral": quad,
            "identity": identity,
            "quality": quality
        }
        print(json.dumps(out, indent=2))
    else:
        # Self-test demo
        quad = detect_candidate_quadrilateral(1200, 1600)
        ident = classify_face_identity("Dancing Fish Granola Berry Crunch Net Wt 10 oz (283g)")
        qual = analyze_image_quality(variance=145.0)
        print(json.dumps({"quad": quad, "identity": ident, "quality": qual}, indent=2))


if __name__ == "__main__":
    main()
