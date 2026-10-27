#!/usr/bin/env python3
"""
PackSignal Master Native PDF Structural Inspector (lib/pdf-inspector.py)
Phase 3 Core Inspection Worker.
Performs:
1. Native PDF structural and page box analysis (MediaBox, CropBox, TrimBox, BleedBox).
2. Drawing-sequence occlusion detection (PVP-001, PVP-002).
3. Rule-based typography & font size verification (PVP-003).
4. Major food allergen wording and formatting inspection (PVP-005).
5. Placed raster image resolution & matrix-calibrated effective PPI calculation (PVP-006).
6. Native PDF color space inventory (DeviceRGB, DeviceCMYK, Spot/Separation) (PVP-007).
7. Optional Content Groups (OCGs) and layer semantics (PVP-008).

CLI:
python3 lib/pdf-inspector.py --input artwork.pdf [--output inspection.json] [--options '{"minFontSizePt": 6.0}']
"""

import sys
import os
import json
import argparse
import hashlib
from pathlib import Path

# Add lib directory to sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from pdf_preflight.models import DISCLAIMER_TEXT
from pdf_preflight.geometry import extract_page_boxes_and_geometry, inspect_trim_and_dieline_clearance
from pdf_preflight.text_spans import extract_native_text_spans
from pdf_preflight.drawings import extract_drawing_operations
from pdf_preflight.occlusion import detect_text_occlusions_and_visibility
from pdf_preflight.typography import inspect_typography_and_text_height
from pdf_preflight.allergens import inspect_allergen_statements_and_formatting
from pdf_preflight.images import extract_and_inspect_images
from pdf_preflight.colors import inventory_pdf_colorspaces
from pdf_preflight.layers import inspect_optional_content_groups


INSPECTOR_VERSION = "3.0.0"
SCHEMA_VERSION = "packsignal-pdf-inspector/v1"


def compute_sha256(file_path):
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def inspect_pdf_document(pdf_path, options=None):
    """
    Main orchestration function: inspects native PDF document and generates structured report.
    """
    options = options or {}
    pdf_p = Path(pdf_path)
    if not pdf_p.exists():
        raise FileNotFoundError(f"PDF document not found: {pdf_path}")

    doc_hash = compute_sha256(pdf_p)
    warnings = []
    limitations = [
        DISCLAIMER_TEXT,
        "Native PDF text extraction and visible rendered text are not equivalent; unrendered Tr 3 or covered text is identified.",
        "Color-space inventory reports declared PDF resource metadata and does not certify press ink separations.",
        "Effective image PPI accounts for affine placement matrices but does not evaluate raster resampling interpolation.",
        "Font size in points is not physical x-height; EU FIC / FDA x-height compliance requires microscopic measurement.",
    ]

    # Check for PyMuPDF
    fitz_available = False
    fitz_version = "unavailable"
    if os.environ.get("DISABLE_PYMUPDF") != "1":
        try:
            import fitz
            fitz_available = True
            fitz_version = getattr(fitz, "__version__", "unknown")
        except ImportError:
            fitz_available = False

    if not fitz_available:
        # Fallback graceful report
        return {
            "schemaVersion": SCHEMA_VERSION,
            "documentHash": doc_hash,
            "inspectorVersion": INSPECTOR_VERSION,
            "parserVersion": "pypdfium2 (fallback)",
            "pageCount": 0,
            "pages": [],
            "textSpans": [],
            "drawingOperations": [],
            "embeddedImages": [],
            "optionalContent": [],
            "colorSpaces": {"detectedColorSpaces": ["Unknown"], "hasRgb": False, "hasCmyk": False},
            "observations": [],
            "capabilities": {
                "nativePdfInspection": False,
                "drawingOrderOcclusion": False,
                "matrixCalibratedPpi": False,
                "layerInventory": False,
                "reason": "PyMuPDF (fitz) is not installed or was disabled via DISABLE_PYMUPDF=1. Fallback to pypdfium2.",
            },
            "warnings": ["PyMuPDF native structural inspector unavailable; standard pypdfium2 text was retained."],
            "limitations": limitations,
        }

    # Open document with PyMuPDF
    import fitz
    try:
        doc = fitz.open(str(pdf_p))
    except Exception as e:
        raise ValueError(f"Failed to open PDF document: {e}")

    page_count = len(doc)
    pages = []
    all_text_spans = []
    all_drawings = []
    all_images = []
    all_layers = []
    all_observations = []
    all_color_spaces = []

    min_font_size_pt = float(options.get("minFontSizePt", 6.0))
    min_text_height_mm = float(options.get("textHeightThresholdMm", 1.6))
    min_ppi = float(options.get("minPpi", 300.0))
    cut_clearance_mm = float(options.get("cutClearanceMm", 2.0))
    crease_clearance_mm = float(options.get("creaseClearanceMm", 1.5))
    rules = options.get("rules", [])
    dieline_segments = options.get("dielineSegments", [])

    for page_idx in range(page_count):
        page_num = page_idx + 1
        page = doc[page_idx]

        # 1. Page Geometry & Standard Page Boxes
        page_geo = extract_page_boxes_and_geometry(page, page_num)
        pages.append(page_geo)

        # 2. Native Text Spans with Font Metadata
        spans = extract_native_text_spans(page, page_num)

        # 3. Vector Drawings & Painting Sequence
        drawings = extract_drawing_operations(page, page_num)

        # 4. Hidden & Obscured Text Detection (Drawing order occlusions & collisions)
        spans, occlusion_obs = detect_text_occlusions_and_visibility(
            spans, drawings, document_hash=doc_hash, page_num=page_num
        )
        all_text_spans.extend(spans)
        all_drawings.extend(drawings)
        all_observations.extend(occlusion_obs)

        # 5. Rule-Based Typography Verification & Text-Height Screening
        typo_obs = inspect_typography_and_text_height(
            spans,
            document_hash=doc_hash,
            page_num=page_num,
            min_font_size_pt=min_font_size_pt,
            min_text_height_mm=min_text_height_mm,
            rules=rules,
            threshold_origin=options.get("thresholdOrigin"),
        )
        all_observations.extend(typo_obs)

        # 6. Allergen Statement & Formatting Inspection
        allergen_obs = inspect_allergen_statements_and_formatting(
            spans, document_hash=doc_hash, page_num=page_num
        )
        all_observations.extend(allergen_obs)

        # 7. Embedded Images & Effective Placed PPI
        images, img_obs = extract_and_inspect_images(
            doc, page, page_num=page_num, document_hash=doc_hash, min_ppi=min_ppi
        )
        all_images.extend(images)
        all_observations.extend(img_obs)

        # 8. Color-Space Inventory
        colors, color_obs = inventory_pdf_colorspaces(
            doc, page, page_num=page_num, document_hash=doc_hash
        )
        all_color_spaces.append(colors)
        all_observations.extend(color_obs)

        # 9. Optional Content Groups (OCGs / Layers)
        layers, layer_obs = inspect_optional_content_groups(
            doc, page, page_num=page_num, document_hash=doc_hash
        )
        all_layers.extend(layers)
        all_observations.extend(layer_obs)

        # 10. Dieline & TrimBox Clearance
        clearance_obs = inspect_trim_and_dieline_clearance(
            page,
            spans,
            document_hash=doc_hash,
            page_num=page_num,
            cut_threshold_mm=cut_clearance_mm,
            crease_threshold_mm=crease_clearance_mm,
            dieline_segments=dieline_segments,
        )
        all_observations.extend(clearance_obs)

    doc.close()

    # Aggregate document color space summary
    combined_color_spaces = sorted(list(set(cs for item in all_color_spaces for cs in item.get("detectedColorSpaces", []))))
    color_summary = {
        "detectedColorSpaces": combined_color_spaces or ["DeviceRGB"],
        "hasRgb": any(item.get("hasRgb") for item in all_color_spaces),
        "hasCmyk": any(item.get("hasCmyk") for item in all_color_spaces),
        "hasGray": any(item.get("hasGray") for item in all_color_spaces),
        "hasSpot": any(item.get("hasSpot") for item in all_color_spaces),
        "hasIccBased": any(item.get("hasIccBased") for item in all_color_spaces),
        "disclaimer": (
            "PDF resource inventory only; physical plate verification is recommended prior to press cylinders."
        )
    }

    # Deduplicate layers by name
    unique_layers = []
    seen_layer_names = set()
    for l in all_layers:
        if l["name"] not in seen_layer_names:
            seen_layer_names.add(l["name"])
            unique_layers.append(l)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "documentHash": doc_hash,
        "inspectorVersion": INSPECTOR_VERSION,
        "parserVersion": f"PyMuPDF {fitz_version}",
        "pageCount": page_count,
        "pages": pages,
        "textSpans": all_text_spans,
        "drawingOperations": all_drawings,
        "embeddedImages": all_images,
        "optionalContent": unique_layers,
        "colorSpaces": color_summary,
        "observations": all_observations,
        "capabilities": {
            "nativePdfInspection": True,
            "drawingOrderOcclusion": True,
            "characterQuads": True,
            "matrixCalibratedPpi": True,
            "layerInventory": True,
            "colorSpaceInventory": True,
            "trimBoxClearance": True,
        },
        "warnings": warnings,
        "limitations": limitations,
    }


def main():
    parser = argparse.ArgumentParser(description="PackSignal Native PDF Structural Inspector")
    parser.add_argument("--input", "-i", required=True, help="Input PDF file path")
    parser.add_argument("--output", "-o", help="Output JSON file path (prints to stdout if omitted)")
    parser.add_argument("--options", help="JSON options string for thresholds and rules")

    args = parser.parse_args()

    options = {}
    if args.options:
        try:
            options = json.loads(args.options)
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to parse --options JSON: {e}\n")

    try:
        report = inspect_pdf_document(args.input, options)
        out_json = json.dumps(report, indent=2)

        if args.output:
            out_p = Path(args.output)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            out_p.write_text(out_json, encoding="utf-8")
        else:
            print(out_json)

    except Exception as e:
        err_report = {
            "schemaVersion": SCHEMA_VERSION,
            "error": str(e),
            "status": "error",
            "inspectorVersion": INSPECTOR_VERSION,
            "limitations": [str(e)],
        }
        sys.stderr.write(f"PDF Inspector Error: {e}\n")
        print(json.dumps(err_report))
        sys.exit(1)


if __name__ == "__main__":
    main()
