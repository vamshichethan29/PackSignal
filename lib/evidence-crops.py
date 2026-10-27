#!/usr/bin/env python3
"""
PackSignal Prepress Evidence Cropper
Extracts bounded, context-padded evidence crops from actual rendered packaging artwork,
draws visible verification bounding boxes, and generates lossless PNG crops for reports.
"""

import sys
import os
import json
import hashlib
import re
from pathlib import Path
from PIL import Image, ImageDraw

MAX_CROP_DIMENSION = 1600
MAX_PIXEL_COUNT = 4_000_000

STATUS_COLORS = {
    'issue': (211, 47, 47),    # Red #D32F2F
    'review': (245, 124, 0),   # Amber #F57C00
    'match': (46, 125, 50),    # Green #2E7D32
    'unable': (95, 112, 103),  # Muted slate
}

def sanitize_id(identifier):
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', str(identifier))

def compute_sha256(file_path):
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def extract_crops(review, rendered_dir, output_dir, max_occurrences_per_finding=2):
    """
    Extracts genuine artwork crops for findings in review.
    Returns: dict mapping finding_id -> list of crop metadata dicts.
    """
    rendered_dir = Path(rendered_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    art_docs = [d for d in review.get('documents', []) if d.get('role') == 'artwork']
    crops_by_finding = {}
    all_crops = []

    for finding in review.get('findings', []):
        f_id = finding.get('id', 'unknown')
        f_status = finding.get('status', 'review')
        f_crops = []

        # Find artwork evidence items
        art_evidence_items = []
        for idx, ev in enumerate(finding.get('evidence', [])):
            doc_id = ev.get('documentId')
            role = ev.get('role')
            # Check if this evidence is attached to an artwork doc
            is_artwork = (role == 'artwork') or any(d.get('id') == doc_id for d in art_docs)
            if is_artwork and ev.get('box'):
                art_evidence_items.append((idx, ev))

        if not art_evidence_items:
            crops_by_finding[f_id] = [{
                'findingId': f_id,
                'status': 'unavailable',
                'reason': 'No extracted artwork bounding box coordinates recorded for this finding.'
            }]
            continue

        occurrences_processed = 0
        for occ_idx, (orig_ev_idx, ev) in enumerate(art_evidence_items):
            if occurrences_processed >= max_occurrences_per_finding:
                break

            doc_id = ev.get('documentId')
            doc = next((d for d in art_docs if d.get('id') == doc_id), None)
            if not doc and art_docs:
                doc = art_docs[0]

            if not doc:
                f_crops.append({
                    'findingId': f_id,
                    'status': 'unavailable',
                    'reason': f"Artwork document '{doc_id}' not found in review sources."
                })
                continue

            page_num = ev.get('page') or 1
            page = next((p for p in doc.get('pages', []) if p.get('number') == page_num), None)
            if not page and doc.get('pages'):
                page = doc['pages'][0]

            if not page or not page.get('image'):
                f_crops.append({
                    'findingId': f_id,
                    'status': 'unavailable',
                    'reason': f"Rendered image record missing for artwork page {page_num}."
                })
                continue

            image_filename = os.path.basename(page['image'])
            image_path = rendered_dir / image_filename

            if not image_path.exists():
                f_crops.append({
                    'findingId': f_id,
                    'status': 'unavailable',
                    'reason': f"Rendered artwork image file '{image_filename}' does not exist on disk."
                })
                continue

            box = ev.get('box')
            if not isinstance(box, list) or len(box) != 4 or not all(isinstance(n, (int, float)) for n in box):
                f_crops.append({
                    'findingId': f_id,
                    'status': 'unavailable',
                    'reason': 'Bounding box coordinates are malformed or incomplete.'
                })
                continue

            x0, y0, x1, y1 = box
            # Validate coordinates
            if x1 <= x0 or y1 <= y0:
                f_crops.append({
                    'findingId': f_id,
                    'status': 'unavailable',
                    'reason': 'Reversed or degenerate bounding box coordinates.'
                })
                continue

            # Clamp coordinates to [0, 1]
            x0 = max(0.0, min(1.0, float(x0)))
            y0 = max(0.0, min(1.0, float(y0)))
            x1 = max(0.0, min(1.0, float(x1)))
            y1 = max(0.0, min(1.0, float(y1)))

            try:
                with Image.open(image_path) as img:
                    img_w, img_h = img.size
                    if img_w * img_h > MAX_PIXEL_COUNT:
                        scale = (MAX_PIXEL_COUNT / (img_w * img_h)) ** 0.5
                        img = img.resize((int(img_w * scale), int(img_h * scale)), Image.Resampling.LANCZOS)
                        img_w, img_h = img.size

                    px0 = int(round(x0 * img_w))
                    py0 = int(round(y0 * img_h))
                    px1 = int(round(x1 * img_w))
                    py1 = int(round(y1 * img_h))

                    bw = max(1, px1 - px0)
                    bh = max(1, py1 - py0)

                    # Add contextual surrounding margin (20-30% of box size, min 24px)
                    pad_x = max(24, int(bw * 0.25))
                    pad_y = max(24, int(bh * 0.25))

                    cx0 = max(0, px0 - pad_x)
                    cy0 = max(0, py0 - pad_y)
                    cx1 = min(img_w, px1 + pad_x)
                    cy1 = min(img_h, py1 + pad_y)

                    crop = img.crop((cx0, cy0, cx1, cy1)).convert('RGB')

                    # Visible highlight box in the crop
                    draw = ImageDraw.Draw(crop)
                    box_in_crop = [px0 - cx0, py0 - cy0, px1 - cx0, py1 - cy0]

                    border_color = STATUS_COLORS.get(f_status, (211, 47, 47))
                    line_width = max(2, min(5, int(min(crop.size) / 80)))

                    for w_offset in range(line_width):
                        draw.rectangle(
                            [
                                box_in_crop[0] - w_offset,
                                box_in_crop[1] - w_offset,
                                box_in_crop[2] + w_offset,
                                box_in_crop[3] + w_offset,
                            ],
                            outline=border_color,
                        )

                    # Max dimension clamp if crop itself is huge
                    if max(crop.size) > MAX_CROP_DIMENSION:
                        crop.thumbnail((MAX_CROP_DIMENSION, MAX_CROP_DIMENSION), Image.Resampling.LANCZOS)

                    clean_fid = sanitize_id(f_id)
                    crop_filename = f"finding-{clean_fid}.png" if occ_idx == 0 else f"finding-{clean_fid}-{occ_idx + 1}.png"
                    dest_file = output_dir / crop_filename

                    crop.save(dest_file, format='PNG', optimize=True)
                    crop_sha256 = compute_sha256(dest_file)

                    crop_meta = {
                        'findingId': f_id,
                        'evidenceIndex': orig_ev_idx,
                        'occurrence': occ_idx + 1,
                        'filename': crop_filename,
                        'relPath': f"evidence/{crop_filename}",
                        'fullPath': str(dest_file),
                        'page': page_num,
                        'artworkDocument': doc.get('name', 'Artwork'),
                        'box': [round(v, 5) for v in [x0, y0, x1, y1]],
                        'pixelBox': [px0, py0, px1, py1],
                        'cropBox': [cx0, cy0, cx1, cy1],
                        'width': crop.width,
                        'height': crop.height,
                        'sha256': crop_sha256,
                        'bytes': os.path.getsize(dest_file),
                        'status': 'available',
                        'quote': ev.get('quote', ''),
                        'location': ev.get('location', f"Page {page_num}"),
                    }
                    f_crops.append(crop_meta)
                    all_crops.append(crop_meta)
                    occurrences_processed += 1

            except Exception as e:
                f_crops.append({
                    'findingId': f_id,
                    'status': 'unavailable',
                    'reason': f"Image crop processing failed: {str(e)[:200]}"
                })

        crops_by_finding[f_id] = f_crops

    return {
        'cropsByFinding': crops_by_finding,
        'allCrops': all_crops,
        'totalExtracted': len(all_crops),
    }

if __name__ == '__main__':
    try:
        if len(sys.argv) > 1 and sys.argv[1] == '--json':
            payload = json.loads(sys.stdin.read())
            review_data = payload['review']
            if isinstance(review_data, str):
                review_data = json.loads(Path(review_data).read_text(encoding='utf-8'))
            rendered_path = payload['rendered']
            output_path = payload['output']
        elif len(sys.argv) == 4:
            review_path = Path(sys.argv[1])
            review_data = json.loads(review_path.read_text(encoding='utf-8'))
            rendered_path = sys.argv[2]
            output_path = sys.argv[3]
        else:
            payload = json.loads(sys.stdin.read())
            review_data = payload['review']
            if isinstance(review_data, str):
                review_data = json.loads(Path(review_data).read_text(encoding='utf-8'))
            rendered_path = payload['rendered']
            output_path = payload['output']

        result = extract_crops(review_data, rendered_path, output_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'error': str(exc)[:500]}), file=sys.stderr)
        sys.exit(1)
