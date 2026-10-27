#!/usr/bin/env python3
"""
PackSignal PDF Rulebook Paragraph Reader (lib/pdf-rulebook-reader.py)
Wave 1D: Dedicated Python module for multiline paragraph reconstruction from PDF rulebooks.
Preserves line-level coordinates while safely reconstructing wrapped requirement sentences.
"""

import sys
import json
import math

def reconstruct_paragraphs_from_lines(lines, line_spacing_threshold=1.6):
    """
    Reconstructs continuous paragraphs from extracted line spans.
    Merges lines if:
    1. They belong to the same horizontal column (left alignment within tolerance).
    2. Vertical spacing is close to normal line height.
    3. The previous line does not end with full stop or heading-like short phrase.
    """
    if not lines:
        return []

    paragraphs = []
    current_para = None

    for line in lines:
        text = line.get("text", "").strip()
        if not text:
            continue

        bbox = line.get("bbox", [0, 0, 0, 0]) # [x0, y0, x1, y1]
        line_height = max(1.0, bbox[3] - bbox[1])

        if current_para is None:
            current_para = {
                "text": text,
                "lines": [line],
                "bbox": list(bbox),
                "page": line.get("page", 1),
                "font_size": line.get("font_size", 10.0),
            }
            continue

        prev_bbox = current_para["bbox"]
        vert_gap = bbox[1] - prev_bbox[3]
        left_diff = abs(bbox[0] - prev_bbox[0])

        # Check line merge compatibility
        is_same_column = left_diff < 30.0
        is_normal_spacing = vert_gap < (line_height * line_spacing_threshold)
        prev_text = current_para["text"].rstrip()
        prev_is_sentence_end = prev_text.endswith((".", ":", ";", "!")) and not (prev_text.endswith("e.g.") or prev_text.endswith("sec."))

        if is_same_column and is_normal_spacing and not prev_is_sentence_end:
            # Merge into current paragraph
            current_para["text"] += " " + text
            current_para["lines"].append(line)
            current_para["bbox"][0] = min(current_para["bbox"][0], bbox[0])
            current_para["bbox"][1] = min(current_para["bbox"][1], bbox[1])
            current_para["bbox"][2] = max(current_para["bbox"][2], bbox[2])
            current_para["bbox"][3] = max(current_para["bbox"][3], bbox[3])
        else:
            paragraphs.append(current_para)
            current_para = {
                "text": text,
                "lines": [line],
                "bbox": list(bbox),
                "page": line.get("page", 1),
                "font_size": line.get("font_size", 10.0),
            }

    if current_para is not None:
        paragraphs.append(current_para)

    return paragraphs

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Internal test runner
        sample_lines = [
            {"text": "Ingredients required to be declared on the label", "bbox": [50, 100, 300, 112], "page": 1, "font_size": 10},
            {"text": "shall be listed by common or usual name in", "bbox": [50, 115, 290, 127], "page": 1, "font_size": 10},
            {"text": "descending order of predominance by weight.", "bbox": [50, 130, 280, 142], "page": 1, "font_size": 10},
            {"text": "Section 101.5 Food Name.", "bbox": [50, 180, 200, 195], "page": 1, "font_size": 12},
        ]
        paras = reconstruct_paragraphs_from_lines(sample_lines)
        assert len(paras) == 2, f"Expected 2 paragraphs, got {len(paras)}"
        assert "descending order of predominance" in paras[0]["text"]
        print("lib/pdf-rulebook-reader.py: Internal tests passed.")
        return

    print(json.dumps({"status": "ready"}))

if __name__ == "__main__":
    main()
