"""
PackSignal Embedded Raster Image Inspector (lib/pdf_preflight/images.py)
Extracts embedded images, colorspaces, source pixel dimensions, placement transforms,
and calculates true placed effective PPI (pixels per inch).
"""

import math
from .coordinates import pdf_to_normalized
from .models import (
    CHECK_PVP_006,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    DEFAULT_MIN_IMAGE_PPI,
    THRESHOLD_ORIGINS,
    create_observation,
    DISCLAIMER_TEXT,
)


def extract_and_inspect_images(doc, page, page_num=1, document_hash="", min_ppi=DEFAULT_MIN_IMAGE_PPI):
    """
    Extracts all placed raster images on a page, calculates effective resolution (PPI),
    and screens against configurable prepress resolution thresholds.
    """
    images = []
    observations = []
    page_rect = page.rect
    rotation = getattr(page, "rotation", 0) or 0

    try:
        # Use get_image_info() to get placed bounding boxes and transformation matrices
        raw_images = page.get_image_info(xrefs=True)
    except Exception:
        raw_images = []

    for idx, img_info in enumerate(raw_images):
        bbox = list(img_info.get("bbox", [0, 0, 0, 0]))
        src_w = int(img_info.get("width", 0))
        src_h = int(img_info.get("height", 0))
        xref = img_info.get("xref", 0)
        transform = img_info.get("transform", None)
        colorspace = img_info.get("colorspace", "Unknown")
        bpc = int(img_info.get("bpc", 8) or 8)

        # Calculate displayed dimensions in points
        if transform and len(transform) >= 6:
            # Affine matrix [a, b, c, d, e, f]
            # Basis vectors account for rotation & non-axis-aligned scaling
            a, b, c, d, e, f = transform[:6]
            disp_w_pt = math.sqrt(a * a + b * b)
            disp_h_pt = math.sqrt(c * c + d * d)
        else:
            disp_w_pt = max(1.0, bbox[2] - bbox[0])
            disp_h_pt = max(1.0, bbox[3] - bbox[1])

        disp_w_in = disp_w_pt / 72.0
        disp_h_in = disp_h_pt / 72.0

        # Calculate effective placed resolution (pixels per inch)
        ppi_x = src_w / disp_w_in if disp_w_in > 0 else 0
        ppi_y = src_h / disp_h_in if disp_h_in > 0 else 0
        effective_ppi = round(min(ppi_x, ppi_y), 1)

        norm_box = pdf_to_normalized(bbox, page_rect, rotation)
        image_id = f"img_p{page_num}_{idx}_xref{xref}"
        is_low_res = effective_ppi > 0 and effective_ppi < min_ppi

        img_record = {
            "imageId": image_id,
            "page": page_num,
            "xref": xref,
            "sourcePixelWidth": src_w,
            "sourcePixelHeight": src_h,
            "displayedWidthPt": round(disp_w_pt, 2),
            "displayedHeightPt": round(disp_h_pt, 2),
            "displayedWidthInches": round(disp_w_in, 3),
            "displayedHeightInches": round(disp_h_in, 3),
            "effectivePpi": effective_ppi,
            "bbox": [round(x, 2) for x in bbox],
            "normalizedBox": norm_box,
            "colorspace": colorspace,
            "bitsPerComponent": bpc,
            "isLowResolution": is_low_res,
            "placementTransform": [round(x, 4) for x in transform] if transform else None,
        }
        images.append(img_record)

        # Generate observation if below screening threshold
        if is_low_res:
            observations.append(create_observation(
                observation_id=f"obs_p{page_num}_{image_id}_low_res",
                check_id=CHECK_PVP_006,
                document_id="artwork",
                document_hash=document_hash,
                page=page_num,
                region=norm_box,
                method="Source pixel dimensions divided by placed physical dimensions (matrix-calibrated)",
                parser="PyMuPDF",
                parser_version="1.26+",
                native_object_ids=[image_id],
                measured_value=effective_ppi,
                measurement_unit="PPI",
                threshold=min_ppi,
                threshold_origin=THRESHOLD_ORIGINS["ILLUSTRATIVE_DEFAULT"],
                classification="LOW_IMAGE_RESOLUTION",
                screening_outcome=SCREENING_WARNING,
                title="Low Raster Image Resolution Screening Warning",
                explanation=(
                    f"Embedded image has effective placed resolution of {effective_ppi} PPI "
                    f"({src_w}×{src_h} px placed at {disp_w_in:.2f}×{disp_h_in:.2f} in), "
                    f"which is below the prepress screening threshold ({min_ppi} PPI). "
                    "Notice: 300 PPI is an internal prepress screening guideline, not a statutory regulation."
                ),
                reviewer_action="Inspect image sharpness and verify whether source asset should be re-linked at 300+ PPI prior to platemaking.",
                evidence={
                    "sourceDimensions": f"{src_w} x {src_h} px",
                    "displayedDimensionsInches": f"{disp_w_in:.2f} x {disp_h_in:.2f} in",
                    "effectivePpi": effective_ppi,
                    "colorspace": colorspace,
                }
            ))

    return images, observations
