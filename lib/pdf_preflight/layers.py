"""
PackSignal Optional Content Groups & Layer Inspector (lib/pdf_preflight/layers.py)
Inspects PDF layers / OCGs (Optional Content Groups), visibility states,
printing intent, and classifies potential structural guide layers.
"""

from .models import (
    CHECK_PVP_008,
    NO_CONCERN_DETECTED,
    SCREENING_WARNING,
    create_observation,
    DISCLAIMER_TEXT,
)


def inspect_optional_content_groups(doc, page, page_num=1, document_hash=""):
    """
    Inspects document and page Optional Content Groups (OCGs) / PDF layers.
    Identifies layer names, visibility intents, and potential structural dieline layers.
    """
    layers = []
    observations = []

    try:
        # PyMuPDF doc.get_ocgs() returns dict of xref -> OCG info
        ocgs = doc.get_ocgs()
        for xref, info in ocgs.items():
            name = str(info.get("name", f"Layer {xref}"))
            is_on = bool(info.get("on", True))
            intent = str(info.get("intent", "View"))

            # Check for structural keywords
            lower_name = name.lower()
            is_structural = any(w in lower_name for w in ["dieline", "die-cut", "cut", "crease", "fold", "glue", "dimensions", "guide"])

            layers.append({
                "xref": xref,
                "name": name,
                "visible": is_on,
                "intent": intent,
                "isStructuralCandidate": is_structural,
            })

            if is_structural:
                observations.append(create_observation(
                    observation_id=f"obs_p{page_num}_layer_{xref}_structural",
                    check_id=CHECK_PVP_008,
                    document_id="artwork",
                    document_hash=document_hash,
                    page=page_num,
                    region=[0.0, 0.0, 1.0, 1.0],
                    method="PDF Optional Content Group (OCG) dictionary inspection",
                    parser="PyMuPDF",
                    parser_version="1.26+",
                    measured_value=f"Layer '{name}' (Visible: {is_on})",
                    measurement_unit="ocg_layer_name",
                    classification="STRUCTURAL_LAYER_CANDIDATE",
                    screening_outcome=NO_CONCERN_DETECTED,
                    title="Structural Dieline Layer Candidate Located",
                    explanation=(
                        f"PDF layer '{name}' appears to contain packaging dieline or technical guide linework. "
                        "Notice: Layer names do not guarantee automatic suppression on press; verify plate output."
                    ),
                    reviewer_action="Ensure structural layers are routed to non-printing technical separation or CAD cutter table.",
                    evidence={"layerName": name, "visibleByDefault": is_on}
                ))
    except Exception:
        pass

    return layers, observations
