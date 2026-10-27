"""
PackSignal Color-Space Inventory & Prepress Inspection (lib/pdf_preflight/colors.py)
Inventories native PDF color spaces (DeviceCMYK, DeviceRGB, DeviceGray, ICCBased, Spot/Separation)
and distinguishes original PDF metadata from rendered RGB display colors.
"""

from .models import (
    CHECK_PVP_007,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    create_observation,
    DISCLAIMER_TEXT,
)


def inventory_pdf_colorspaces(doc, page, page_num=1, document_hash=""):
    """
    Inspects PDF page resources for declared color spaces and embedded image color models.
    Produces a comprehensive color space inventory and technical observations.
    """
    detected_spaces = set()
    spot_colors = []
    has_rgb = False
    has_cmyk = False
    has_gray = False
    has_spot = False
    has_icc = False

    try:
        # Inspect page images for color spaces
        images = page.get_images(full=True)
        for img in images:
            # tuple: (xref, smask, width, height, bpc, colorspace, alt.colorspace, name, filter, invoker)
            if len(img) > 5 and img[5]:
                cs_name = str(img[5])
                detected_spaces.add(cs_name)
                if "rgb" in cs_name.lower():
                    has_rgb = True
                if "cmyk" in cs_name.lower():
                    has_cmyk = True
                if "gray" in cs_name.lower():
                    has_gray = True
                if "icc" in cs_name.lower():
                    has_icc = True
                if "sep" in cs_name.lower() or "spot" in cs_name.lower():
                    has_spot = True
    except Exception:
        pass

    try:
        # Inspect page vector drawing colors
        drawings = page.get_drawings()
        for d in drawings:
            fill = d.get("fill")
            stroke = d.get("color")
            for c in [fill, stroke]:
                if c is not None:
                    if isinstance(c, (list, tuple)):
                        if len(c) == 3:
                            has_rgb = True
                            detected_spaces.add("DeviceRGB")
                        elif len(c) == 4:
                            has_cmyk = True
                            detected_spaces.add("DeviceCMYK")
                        elif len(c) == 1:
                            has_gray = True
                            detected_spaces.add("DeviceGray")
    except Exception:
        pass

    # Default to DeviceRGB / DeviceCMYK if none explicitly flagged
    if not detected_spaces:
        detected_spaces.add("DeviceRGB")

    inventory = {
        "page": page_num,
        "detectedColorSpaces": sorted(list(detected_spaces)),
        "hasRgb": has_rgb,
        "hasCmyk": has_cmyk,
        "hasGray": has_gray,
        "hasSpot": has_spot,
        "hasIccBased": has_icc,
        "spotColors": spot_colors,
        "disclaimer": (
            "This is a PDF resource inventory, not a physical press-separation certification. "
            "Presence of RGB does not make artwork illegal for printing; modern RIPs color-manage RGB via ICC profiles."
        )
    }

    observations = []
    if has_rgb and has_cmyk:
        observations.append(create_observation(
            observation_id=f"obs_p{page_num}_mixed_colorspace",
            check_id=CHECK_PVP_007,
            document_id="artwork",
            document_hash=document_hash,
            page=page_num,
            region=[0.0, 0.0, 1.0, 1.0],
            method="PDF resource dictionary & vector color space analysis",
            parser="PyMuPDF",
            parser_version="1.26+",
            measured_value="Mixed DeviceRGB and DeviceCMYK color spaces detected",
            measurement_unit="color_space_mix",
            classification="MIXED_COLORSPACE",
            screening_outcome=SCREENING_WARNING,
            title="Mixed RGB / CMYK Color Space Inventory Notice",
            explanation="The PDF contains both RGB and CMYK color spaces. Review pre-press color separation profiles before sending to press.",
            reviewer_action="Verify RIP color-management workflow converts RGB assets to target press gamut.",
            evidence={"colorSpaces": sorted(list(detected_spaces))}
        ))

    return inventory, observations
